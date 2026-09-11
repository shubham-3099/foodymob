import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { all, one, run, uid, now, type Env } from "../server/db.ts";
import { currentUser, requireUser, rateLimit } from "../server/auth.ts";
import { assert, body, json, sameOrigin, str, errorResponse } from "../server/http.ts";
import { coords } from "../server/community.ts";
const cache = new Map<string, { expires: number; value: unknown }>();
let nextLookup = 0;
export async function locationApi(request: Request, env: Env, base = "https://photon.komoot.io") {
  try {
    sameOrigin(request);
    assert(request.method === "POST", 405, "Use POST.");
    const d = await body(request);
    const reverse = new URL(request.url).pathname.endsWith("/reverse");
    const url = new URL(reverse ? "/reverse" : "/api", base);
    if (reverse) {
      const [lat, lng] = coords(d["lat"], d["lng"]);
      assert(lat !== null, 400, "Coordinates required.");
      url.searchParams.set("lat", String(lat));
      url.searchParams.set("lon", String(lng));
    } else url.searchParams.set("q", str(d["q"], 3, 200));
    url.searchParams.set("limit", "5");
    const key = url.href,
      hit = cache.get(key);
    if (hit && hit.expires > now()) return json(hit.value);
    assert(now() >= nextLookup, 429, "Please wait a moment before searching again.");
    nextLookup = now() + 1100;
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { "User-Agent": "DishSpotLocalTest/4.0", Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      throw new Error("Location lookup unavailable");
    }
    assert(response.ok, 503, "Location lookup is unavailable. Please try searching again shortly.");
    const result: any = await response.json();
    const places = (result.features || []).map((f: any) => ({
      label: [
        f.properties.name,
        f.properties.housenumber,
        f.properties.street,
        f.properties.city,
        f.properties.state,
        f.properties.country,
      ]
        .filter(Boolean)
        .filter((x: any, i: number, a: any[]) => a.indexOf(x) === i)
        .join(", "),
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
    }));
    const value = { places, attribution: "© OpenStreetMap contributors · Photon" };
    if (cache.size > 200) cache.clear();
    cache.set(key, { expires: now() + 86400000, value });
    return json(value);
  } catch (e) {
    return errorResponse(e);
  }
}
export async function imageApi(request: Request, env: Env, root = ".local/uploads") {
  try {
    sameOrigin(request);
    const user = await currentUser(request, env),
      db = env.DB,
      path = new URL(request.url).pathname;
    if (request.method === "POST") {
      requireUser(user);
      await rateLimit(env, "images:" + user.id, 30);
      const form = await request.formData(),
        file = form.get("file");
      assert(
        file instanceof File && file.size > 0 && file.size <= 3 * 1024 * 1024,
        400,
        "Choose a photo smaller than 3 MB.",
      );
      const bytes = Buffer.from(await file.arrayBuffer());
      const mime =
        bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
          ? "image/jpeg"
          : bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
            ? "image/png"
            : bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP"
              ? "image/webp"
              : null;
      assert(mime, 400, "Use a JPEG, PNG or WebP photo.");
      const id = uid();
      mkdirSync(root, { recursive: true });
      writeFileSync(root + "/" + id, bytes, { mode: 0o600 });
      await run(
        db,
        "INSERT INTO community_images(id,user_id,mime,created_at) VALUES(?,?,?,?)",
        id,
        user.id,
        mime,
        now(),
      );
      return json({ id }, 201);
    }
    assert(request.method === "GET", 405, "Unsupported method.");
    const id = path.split("/").pop()!;
    assert(/^[a-z0-9-]+$/.test(id), 404, "Image not found.");
    const row = await one<any>(db, "SELECT * FROM community_images WHERE id=?", id);
    assert(row, 404, "Image not found.");
    const visible = await one(
      db,
      "SELECT r.id FROM community_reviews r JOIN community_restaurants s ON s.id=r.restaurant_id,json_each(r.images) j WHERE j.value=? AND r.status='published' AND s.status='approved'",
      id,
    );
    const banner = await one(db, "SELECT user_id FROM community_profiles WHERE banner_id=?", id);
    assert(
      visible || banner || row.user_id === user?.id || user?.role === "admin",
      404,
      "Image not found.",
    );
    return new Response(readFileSync(root + "/" + id), {
      headers: {
        "Content-Type": row.mime,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
