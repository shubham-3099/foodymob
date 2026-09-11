import { all, one, run, now, uid, type Env } from "./db.ts";
import { assert, body, json, sameOrigin, str, httpsUrl, errorResponse } from "./http.ts";
import { currentUser, requireUser, requireAdmin, rateLimit } from "./auth.ts";
export const normalized = (s: string) =>
  s.normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/g, " ");
export function coords(lat: unknown, lng: unknown): [number | null, number | null] {
  if (lat === null && lng === null) return [null, null];
  assert(
    typeof lat === "number" &&
      Number.isFinite(lat) &&
      Math.abs(lat) <= 90 &&
      typeof lng === "number" &&
      Number.isFinite(lng) &&
      Math.abs(lng) <= 180,
    400,
    "Choose a valid location on Earth.",
  );
  return [lat, lng];
}
export function distanceKm(a: number, b: number, c: number, d: number) {
  const rad = Math.PI / 180,
    x =
      Math.sin(((c - a) * rad) / 2) ** 2 +
      Math.cos(a * rad) * Math.cos(c * rad) * Math.sin(((d - b) * rad) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(Math.min(1, x)), Math.sqrt(Math.max(0, 1 - x)));
}
const publicReviews =
  "SELECT r.*,s.name AS restaurant_name,s.address,s.lat,s.lng,u.name AS author,(SELECT count(*) FROM community_likes l WHERE l.review_id=r.id) AS likes FROM community_reviews r JOIN community_restaurants s ON s.id=r.restaurant_id JOIN users u ON u.id=r.user_id WHERE r.status='published' AND s.status='approved'";
const decode = (r: any) => ({ ...r, images: JSON.parse(r.images) });
export const REPORT_THRESHOLD = 3;
export async function communityApi(request: Request, env: Env) {
  try {
    sameOrigin(request);
    const path = new URL(request.url).pathname,
      method = request.method;
    const user = await currentUser(request, env),
      db = env.DB;
    const premium = !!(
      user &&
      (await one(
        db,
        "SELECT order_id FROM entitlements WHERE user_id=? AND kind='member' AND revoked=0 AND expires_at>?",
        user.id,
        now(),
      ))
    );
    if (path === "/api/community" && method === "GET") {
      const reviews = (await all(db, publicReviews + " ORDER BY r.created_at DESC,r.id")).map(
        decode,
      );
      const restaurants = await all(
        db,
        "SELECT * FROM community_restaurants s WHERE status='approved' AND EXISTS(SELECT 1 FROM community_reviews r WHERE r.restaurant_id=s.id AND r.status='published') ORDER BY name",
      );
      const people = await all(
        db,
        "SELECT u.id,u.name,u.bio,(SELECT banner_id FROM community_profiles p WHERE p.user_id=u.id) AS banner_id,(SELECT count(*) FROM community_follows f WHERE f.user_id=u.id) AS following_count,(SELECT count(*) FROM community_follows f WHERE f.target_id=u.id) AS followers,(SELECT count(*) FROM community_reviews r JOIN community_restaurants s ON s.id=r.restaurant_id WHERE r.user_id=u.id AND r.status='published' AND s.status='approved') AS review_count FROM users u WHERE u.role<>'admin' AND (EXISTS(SELECT 1 FROM local_accounts a WHERE a.user_id=u.id AND a.verified=1) OR EXISTS(SELECT 1 FROM community_reviews r WHERE r.user_id=u.id AND r.status='published')) ORDER BY u.name",
      );
      const profile = user
        ? await one<any>(db, "SELECT banner_id FROM community_profiles WHERE user_id=?", user.id)
        : null;
      return json({
        user: user ? { ...user, banner_id: profile?.banner_id ?? null } : null,
        premium,
        reviews,
        restaurants,
        people,
        followers: user
          ? (await all(db, "SELECT user_id FROM community_follows WHERE target_id=?", user.id)).map(
              (x) => x["user_id"],
            )
          : [],
        reported: user
          ? (await all(db, "SELECT review_id FROM community_reports WHERE user_id=?", user.id)).map(
              (x) => x["review_id"],
            )
          : [],
        following: user
          ? (await all(db, "SELECT target_id FROM community_follows WHERE user_id=?", user.id)).map(
              (x) => x["target_id"],
            )
          : [],
        liked: user
          ? (await all(db, "SELECT review_id FROM community_likes WHERE user_id=?", user.id)).map(
              (x) => x["review_id"],
            )
          : [],
        saved:
          premium && user
            ? (await all(db, "SELECT review_id FROM community_saves WHERE user_id=?", user.id)).map(
                (x) => x["review_id"],
              )
            : [],
        mine: user
          ? (
              await all(
                db,
                "SELECT r.*,s.name AS restaurant_name,s.address,s.status AS restaurant_status,s.note,u.name AS author FROM community_reviews r JOIN community_restaurants s ON s.id=r.restaurant_id JOIN users u ON u.id=r.user_id WHERE r.user_id=? AND r.status<>'deleted' ORDER BY r.created_at DESC",
                user.id,
              )
            ).map(decode)
          : [],
        outings: user
          ? (
              await all(
                db,
                "SELECT * FROM community_outings WHERE user_id=? ORDER BY created_at DESC",
                user.id,
              )
            ).map((x) => ({ ...x, stops: JSON.parse(String(x["stops"])) }))
          : [],
      });
    }
    const connections = path.match(/^\/api\/community\/people\/([^/]+)\/connections$/);
    if (connections && method === "GET") {
      const kind = new URL(request.url).searchParams.get("kind");
      assert(kind === "following" || kind === "followers", 400, "Choose following or followers.");
      const id = decodeURIComponent(connections[1]!);
      assert(await one(db, "SELECT id FROM users WHERE id=?", id), 404, "Profile not found.");
      const join = kind === "following" ? "f.target_id=u.id" : "f.user_id=u.id",
        where = kind === "following" ? "f.user_id=?" : "f.target_id=?";
      return json({
        people: await all(
          db,
          `SELECT u.id,u.name,u.bio FROM users u JOIN community_follows f ON ${join} WHERE ${where} ORDER BY u.name`,
          id,
        ),
      });
    }
    requireUser(user);
    if (method !== "GET") await rateLimit(env, "community:" + user.id, 120);
    const data = method === "GET" || method === "DELETE" ? {} : await body(request);
    if (path === "/api/community/profile/banner" && method === "PUT") {
      const id = data["imageId"];
      assert(id === null || typeof id === "string", 400, "Choose an uploaded banner.");
      if (id !== null)
        assert(
          await one(db, "SELECT id FROM community_images WHERE id=? AND user_id=?", id, user.id),
          400,
          "Use your own uploaded image.",
        );
      await run(
        db,
        "INSERT INTO community_profiles(user_id,banner_id) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET banner_id=excluded.banner_id",
        user.id,
        id,
      );
      return json({ ok: true });
    }
    const report = path.match(/^\/api\/community\/reports\/([^/]+)$/);
    if (report && method === "POST") {
      const review = await one<any>(
        db,
        "SELECT r.id,r.user_id FROM community_reviews r JOIN community_restaurants s ON s.id=r.restaurant_id WHERE r.id=? AND r.status='published' AND s.status='approved'",
        report[1],
      );
      assert(review, 404, "Review not found.");
      assert(review.user_id !== user.id, 400, "You cannot report your own review.");
      await run(
        db,
        "INSERT OR IGNORE INTO community_reports(user_id,review_id,reason,created_at) VALUES(?,?,?,?)",
        user.id,
        review.id,
        str(data["reason"], 3, 500),
        now(),
      );
      return json({
        ok: true,
        message:
          "Report received. Reviews reported by three distinct people go to admin for review.",
      });
    }
    if (path === "/api/community/reviews" && method === "POST") {
      const dish = str(data["dishName"], 1, 100),
        experience = str(data["experience"], 10, 4000),
        category = str(data["category"], 1, 60);
      const price = data["price"],
        recommendation = data["recommendation"];
      assert(
        typeof price === "number" && Number.isFinite(price) && price >= 0 && price <= 1000000,
        400,
        "Enter the actual price paid in INR.",
      );
      assert(
        [1, 2, 3].includes(Number(recommendation)) && typeof recommendation === "number",
        400,
        "Choose Avoid, Should try or Must try.",
      );
      const vlog = httpsUrl(data["vlogUrl"] || "", true),
        photos = data["images"] ?? [];
      assert(Array.isArray(photos) && photos.length <= 5, 400, "Add at most five photos.");
      for (const id of photos)
        assert(
          typeof id === "string" &&
            (await one(
              db,
              "SELECT id FROM community_images WHERE id=? AND user_id=?",
              id,
              user.id,
            )),
          400,
          "Use your own uploaded photos.",
        );
      let restaurant: any = null;
      const newStatements = [];
      if (data["restaurantId"]) {
        restaurant = await one(
          db,
          "SELECT * FROM community_restaurants WHERE id=? AND status='approved'",
          str(data["restaurantId"]),
        );
        assert(restaurant, 400, "Choose a listed restaurant or submit a new restaurant.");
      } else {
        const name = str(data["restaurantName"], 2, 150),
          address = str(data["address"], 5, 400),
          [lat, lng] = coords(data["lat"], data["lng"]);
        assert(lat !== null && lng !== null, 400, "Select or enter the restaurant’s coordinates.");
        const key = normalized(name) + "|" + normalized(address);
        restaurant = await one(db, "SELECT * FROM community_restaurants WHERE identity_key=?", key);
        if (!restaurant) {
          restaurant = { id: uid(), status: "pending" };
          newStatements.push(
            db
              .prepare(
                "INSERT INTO community_restaurants(id,identity_key,name,address,lat,lng,status,requested_by,created_at,note) VALUES(?,?,?,?,?,?,'pending',?,?,'')",
              )
              .bind(restaurant.id, key, name, address, lat, lng, user.id, now()),
          );
        } else if (restaurant.status === "rejected") {
          restaurant = { ...restaurant, status: "pending" };
          newStatements.push(
            db
              .prepare(
                "UPDATE community_restaurants SET status='pending',note='',requested_by=?,created_at=?,lat=?,lng=? WHERE id=?",
              )
              .bind(user.id, now(), lat, lng, restaurant.id),
          );
        }
      }
      const status = restaurant.status === "approved" ? "published" : "pending",
        id = uid();
      newStatements.push(
        db
          .prepare(
            "INSERT INTO community_reviews(id,restaurant_id,user_id,dish_name,dish_key,price,category,experience,recommendation,vlog_url,images,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            id,
            restaurant.id,
            user.id,
            dish,
            normalized(dish),
            price,
            category,
            experience,
            recommendation,
            vlog,
            JSON.stringify(photos),
            status,
            now(),
            now(),
          ),
      );
      await db.batch(newStatements);
      return json(
        {
          id,
          status,
          message:
            status === "pending"
              ? "New restaurant submitted. Admin verification usually takes 3–4 days. You can submit more restaurants meanwhile."
              : "Your review is now published.",
        },
        201,
      );
    }
    const reviewPath = path.match(/^\/api\/community\/reviews\/([^/]+)$/);
    if (reviewPath && (method === "PUT" || method === "DELETE")) {
      const review = await one<any>(
        db,
        "SELECT * FROM community_reviews WHERE id=?",
        reviewPath[1],
      );
      assert(
        review && (review.user_id === user.id || user.role === "admin"),
        404,
        "Review not found.",
      );
      if (method === "DELETE") {
        await run(db, "UPDATE community_reviews SET status='deleted' WHERE id=?", review.id);
        return json({ ok: true });
      }
      assert(review.user_id === user.id, 403, "Only the author may edit a review.");
      assert(
        ["published", "pending"].includes(review.status),
        409,
        "This review cannot be edited. Submit a new review instead.",
      );
      const p = data["price"],
        rec = data["recommendation"];
      assert(
        typeof p === "number" &&
          Number.isFinite(p) &&
          p >= 0 &&
          p <= 1000000 &&
          typeof rec === "number" &&
          [1, 2, 3].includes(rec),
        400,
        "Enter a valid price and recommendation.",
      );
      await run(
        db,
        "UPDATE community_reviews SET experience=?,price=?,recommendation=?,vlog_url=?,updated_at=? WHERE id=?",
        str(data["experience"], 10, 4000),
        p,
        rec,
        httpsUrl(data["vlogUrl"] || "", true),
        now(),
        review.id,
      );
      return json({ ok: true });
    }
    const toggle = path.match(/^\/api\/community\/(likes|saves|follows)\/([^/]+)$/);
    if (toggle && method === "PUT") {
      const kind = toggle[1],
        id = decodeURIComponent(toggle[2]!);
      if (kind === "saves")
        assert(premium, 403, "Saved dishes is a Premium feature. Choose a plan to unlock it.");
      assert(typeof data["active"] === "boolean", 400, "Choose an active state.");
      if (kind === "follows")
        assert(
          id !== user.id &&
            (await one(db, "SELECT id FROM users WHERE id=? AND role<>'admin'", id)),
          400,
          "Choose another user.",
        );
      else
        assert(
          await one(
            db,
            "SELECT r.id FROM community_reviews r JOIN community_restaurants s ON s.id=r.restaurant_id WHERE r.id=? AND r.status='published' AND s.status='approved'",
            id,
          ),
          404,
          "Review not available.",
        );
      const table =
          kind === "follows"
            ? "community_follows"
            : kind === "likes"
              ? "community_likes"
              : "community_saves",
        column = kind === "follows" ? "target_id" : "review_id";
      if (data["active"])
        await run(db, `INSERT OR IGNORE INTO ${table}(user_id,${column}) VALUES(?,?)`, user.id, id);
      else await run(db, `DELETE FROM ${table} WHERE user_id=? AND ${column}=?`, user.id, id);
      return json({ ok: true });
    }
    if (path === "/api/community/outings" && method === "POST") {
      const id = uid();
      await run(
        db,
        "INSERT INTO community_outings(id,user_id,name,stops,revision,created_at) VALUES(?,?,?,'[]',0,?)",
        id,
        user.id,
        str(data["name"], 1, 100),
        now(),
      );
      return json({ id }, 201);
    }
    const trip = path.match(/^\/api\/community\/outings\/([^/]+)$/);
    if (trip && (method === "PUT" || method === "DELETE")) {
      const outing = await one<any>(
        db,
        "SELECT * FROM community_outings WHERE id=? AND user_id=?",
        trip[1],
        user.id,
      );
      assert(outing, 404, "Outing not found.");
      if (method === "DELETE") {
        await run(db, "DELETE FROM community_outings WHERE id=? AND user_id=?", outing.id, user.id);
        return json({ ok: true });
      }
      const stops = data["stops"];
      assert(
        Array.isArray(stops) &&
          stops.every((x) => typeof x === "string") &&
          new Set(stops).size === stops.length,
        400,
        "Choose distinct restaurant stops.",
      );
      for (const id of stops)
        assert(
          await one(
            db,
            "SELECT s.id FROM community_restaurants s WHERE s.id=? AND s.status='approved' AND EXISTS(SELECT 1 FROM community_reviews r WHERE r.restaurant_id=s.id AND r.status='published')",
            id,
          ),
          400,
          "An outing stop is not available.",
        );
      assert(typeof data["revision"] === "number", 400, "Missing outing version.");
      const changed = await run(
        db,
        "UPDATE community_outings SET name=?,stops=?,revision=revision+1 WHERE id=? AND user_id=? AND revision=?",
        str(data["name"], 1, 100),
        JSON.stringify(stops),
        outing.id,
        user.id,
        data["revision"],
      );
      assert(
        changed.meta.changes === 1,
        409,
        "This outing changed in another tab. Reload before editing.",
      );
      return json({ ok: true });
    }
    if (path.startsWith("/api/community/admin")) {
      requireAdmin(user);
      if (path === "/api/community/admin/reports" && method === "GET") {
        const rows = (
          await all(
            db,
            publicReviews +
              " AND (SELECT count(*) FROM community_reports q WHERE q.review_id=r.id AND q.handled_at IS NULL)>=? ORDER BY r.created_at",
            REPORT_THRESHOLD,
          )
        ).map(decode);
        return json({
          threshold: REPORT_THRESHOLD,
          reviews: await Promise.all(
            rows.map(async (r) => ({
              ...r,
              reports: await all(
                db,
                "SELECT reason,created_at FROM community_reports WHERE review_id=? AND handled_at IS NULL ORDER BY created_at",
                r.id,
              ),
            })),
          ),
        });
      }
      if (path === "/api/community/admin/reports" && method === "POST") {
        const id = str(data["reviewId"]),
          decision = data["decision"];
        assert(decision === "delete" || decision === "keep", 400, "Choose delete or keep.");
        const row = await one<any>(
          db,
          "SELECT count(*) AS n FROM community_reports WHERE review_id=? AND handled_at IS NULL",
          id,
        );
        assert(row.n >= REPORT_THRESHOLD, 409, "This report is not waiting for moderation.");
        const statements = [];
        if (decision === "delete")
          statements.push(
            db
              .prepare("UPDATE community_reviews SET status='deleted',updated_at=? WHERE id=?")
              .bind(now(), id),
          );
        statements.push(
          db
            .prepare(
              "UPDATE community_reports SET handled_at=? WHERE review_id=? AND handled_at IS NULL",
            )
            .bind(now(), id),
        );
        statements.push(
          db
            .prepare("INSERT INTO audit(id,actor_id,action,target_id,created_at) VALUES(?,?,?,?,?)")
            .bind(uid(), user.id, "reported_review_" + decision, id, now()),
        );
        await db.batch(statements);
        return json({ ok: true });
      }
      if (path === "/api/community/admin" && method === "GET")
        return json({
          requests: await all(
            db,
            "SELECT s.*,u.name AS requester,(SELECT count(*) FROM community_reviews r WHERE r.restaurant_id=s.id AND r.status='pending') AS review_count FROM community_restaurants s LEFT JOIN users u ON u.id=s.requested_by WHERE s.status='pending' ORDER BY s.created_at",
          ),
          reviews: (
            await all(
              db,
              "SELECT r.*,s.name AS restaurant_name,s.address,u.name AS author FROM community_reviews r JOIN community_restaurants s ON s.id=r.restaurant_id JOIN users u ON u.id=r.user_id WHERE r.status<>'deleted' ORDER BY r.created_at DESC",
            )
          ).map(decode),
        });
      if (path === "/api/community/admin/verify" && method === "POST") {
        const id = str(data["id"]),
          decision = data["decision"];
        assert(
          ["approved", "rejected"].includes(String(decision)),
          400,
          "Choose approve or reject.",
        );
        const restaurant = await one<any>(
          db,
          "SELECT * FROM community_restaurants WHERE id=? AND status='pending'",
          id,
        );
        assert(restaurant, 409, "This request has already been handled.");
        const [lat, lng] = coords(data["lat"] ?? restaurant.lat, data["lng"] ?? restaurant.lng);
        assert(
          decision !== "approved" || lat !== null,
          400,
          "Verify restaurant coordinates before approval.",
        );
        const note = str(data["note"] ?? "", decision === "rejected" ? 3 : 0, 500);
        assert(
          decision !== "approved" ||
            (await one(
              db,
              "SELECT id FROM community_reviews WHERE restaurant_id=? AND status='pending'",
              id,
            )),
          409,
          "No pending first review remains.",
        );
        await db.batch([
          db
            .prepare(
              "UPDATE community_restaurants SET status=?,note=?,lat=?,lng=? WHERE id=? AND status='pending'",
            )
            .bind(decision, note, lat, lng, id),
          db
            .prepare(
              "UPDATE community_reviews SET status=?,updated_at=? WHERE restaurant_id=? AND status='pending'",
            )
            .bind(decision === "approved" ? "published" : "rejected", now(), id),
          db
            .prepare("INSERT INTO audit(id,actor_id,action,target_id,created_at) VALUES(?,?,?,?,?)")
            .bind(uid(), user.id, "restaurant_" + decision, id, now()),
        ]);
        return json({ ok: true });
      }
    }
    return json({ error: "Not found" }, 404);
  } catch (e) {
    return errorResponse(e);
  }
}
