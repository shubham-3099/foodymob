import { all, one, run, uid, now, type Env } from "./db.ts";
import { assert, body, errorResponse, json, sameOrigin, str, httpsUrl } from "./http.ts";
import { currentUser, requireAdmin, requireUser, rateLimit, type User } from "./auth.ts";
import { catalog, seedCatalog } from "./catalog.ts";
import paymentWorker from "../services/payments/index.ts";
import { signedRequest } from "../services/payments/security.ts";
import { PLANS } from "../services/payments/plans.ts";
const emptyAds = {
  enabled: false,
  publisherId: "",
  homeSlot: "",
  profileSlot: "",
  vloggerSlot: "",
  consentConfigured: false,
};
async function settings(env: Env) {
  const row = await one<{ value: string }>(
    env.DB,
    "SELECT value FROM settings WHERE key='adsense'",
  );
  return row ? { ...emptyAds, ...JSON.parse(row.value) } : emptyAds;
}
async function me(env: Env, user: User | null) {
  if (!user)
    return {
      user: null,
      saved: [],
      following: [],
      reviews: [],
      entitlements: [],
      creator: null,
      orders: [],
    };
  await run(
    env.DB,
    "UPDATE orders SET status='expired',updated_at=? WHERE user_id=? AND status='pending' AND created_at<?",
    now(),
    user.id,
    now() - 15 * 60000,
  );
  const [saved, following, reviews, entitlements, creator, orders] = await Promise.all([
    all(env.DB, "SELECT dish_id FROM saved WHERE user_id=?", user.id),
    all(env.DB, "SELECT creator_id FROM follows WHERE user_id=?", user.id),
    all(env.DB, "SELECT * FROM reviews WHERE user_id=? ORDER BY created_at DESC", user.id),
    all(
      env.DB,
      "SELECT * FROM entitlements WHERE user_id=? AND expires_at>? AND revoked=0",
      user.id,
      now(),
    ),
    one(env.DB, "SELECT * FROM creators WHERE owner_id=?", user.id),
    all(env.DB, "SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC LIMIT 100", user.id),
  ]);
  return {
    user,
    saved: saved.map((r) => r["dish_id"]),
    following: following.map((r) => r["creator_id"]),
    reviews: reviews.map((r) => ({
      id: r["id"],
      dishId: r["dish_id"],
      author: user.name,
      authorType: "user",
      text: r["text"],
      recommendation: r["recommendation"],
      createdAt: r["created_at"],
      status: r["status"],
    })),
    entitlements,
    creator: creator ? { ...creator, data: JSON.parse(String(creator["data"])) } : null,
    orders,
  };
}
async function payment(path: string, data: unknown, env: Env) {
  assert(env.PAYMENT_SERVICE_SECRET, 503, "Payment service is not configured.");
  const request = await signedRequest(
    (env.PAYMENT_SERVICE_URL ?? "https://payment-service.internal") + path,
    data,
    env.PAYMENT_SERVICE_SECRET,
  );
  if (env.PAYMENT_SERVICE_URL) {
    assert(
      new URL(env.PAYMENT_SERVICE_URL).protocol === "https:",
      503,
      "Payment service URL must use HTTPS.",
    );
    return fetch(request);
  }
  return paymentWorker.fetch(request, env);
}
function number(value: unknown, min: number, max: number) {
  assert(
    typeof value === "number" && Number.isFinite(value) && value >= min && value <= max,
    400,
    "Enter a valid amount or number.",
  );
  return value;
}
export async function api(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url),
      path = url.pathname,
      method = request.method;
    assert(env.DB, 503, "Database is unavailable.");
    sameOrigin(request);
    if (path === "/api/health")
      return json({
        ok: !!(await one(env.DB, "SELECT 1 AS ok")),
        paymentsMode: env.PAYMENTS_MODE ?? "disabled",
      });
    if (path === "/ads.txt") {
      const ads = await settings(env);
      if (!/^ca-pub-\d{16}$/.test(ads.publisherId)) return new Response("", { status: 404 });
      return new Response(
        `google.com, ${ads.publisherId.replace("ca-", "")}, DIRECT, f08c47fec0942fa0\n`,
        { headers: { "Content-Type": "text/plain", "Cache-Control": "public, max-age=3600" } },
      );
    }
    const user = await currentUser(request, env);
    if(env.LOCAL_AUTH && (path.startsWith('/api/creator') || path==='/api/dishes' || path==='/api/catalog' || path.startsWith('/api/reviews') || path.startsWith('/api/saved') || path.startsWith('/api/follows') || ['/api/admin/seed','/api/admin/moderate','/api/admin/dashboard'].includes(path)))
      return json({error:'This feature was replaced by community reviews.'},410);
    if (path === "/api/bootstrap" && method === "GET") {
      if(env.LOCAL_AUTH) return json({...(await me(env,user)),dishes:[],vloggers:[],creator:null,plans:PLANS.filter(p=>p.kind==='member'),ads:emptyAds,mode:'test'});
      const data = await catalog(env),
        ads = await settings(env),
        account = await me(env, user);
      return json({
        ...data,
        ...account,
        plans: PLANS,
        ads,
        mode: env.PAYMENTS_MODE ?? "disabled",
      });
    }
    if (path === "/api/catalog" && method === "GET") return json(await catalog(env));
    requireUser(user);
    if (env.LOCAL_AUTH && (path.startsWith('/api/creator') || path === '/api/dishes'))
      assert(user.role === 'vlogger' || user.role === 'admin', 403, 'Vlogger account required.');
    if (method !== "GET") await rateLimit(env, user.id, 60);
    if (path === "/api/me" && method === "GET") return json(await me(env, user));
    if (path === "/api/profile" && method === "PUT") {
      const d = await body(request);
      await run(
        env.DB,
        "UPDATE users SET name=?,bio=?,location=? WHERE id=?",
        str(d["name"], 1, 100),
        str(d["bio"] ?? "", 0, 300),
        str(d["location"], 1, 120),
        user.id,
      );
      return json({ ok: true });
    }
    const saveMatch = path.match(/^\/api\/(saved|follows)\/([^/]+)$/);
    if (saveMatch && method === "PUT") {
      const kind = saveMatch[1],
        id = decodeURIComponent(saveMatch[2]!),
        d = await body(request);
      assert(typeof d["active"] === "boolean", 400, "Choose an active state.");
      const table = kind === "saved" ? "saved" : "follows",
        column = kind === "saved" ? "dish_id" : "creator_id",
        target = kind === "saved" ? "dishes" : "creators";
      assert(
        await one(env.DB, `SELECT id FROM ${target} WHERE id=? AND status='approved'`, id),
        404,
        "Item not found.",
      );
      if (d["active"])
        await run(
          env.DB,
          `INSERT OR IGNORE INTO ${table}(user_id,${column}) VALUES(?,?)`,
          user.id,
          id,
        );
      else await run(env.DB, `DELETE FROM ${table} WHERE user_id=? AND ${column}=?`, user.id, id);
      return json({ ok: true });
    }
    if (path === "/api/reviews" && method === "POST") {
      const d = await body(request),
        dishId = str(d["dishId"]),
        rec = str(d["recommendation"]);
      assert(["MUST TRY", "Should Try", "Avoid"].includes(rec), 400, "Choose a recommendation.");
      assert(
        await one(env.DB, "SELECT id FROM dishes WHERE id=? AND status='approved'", dishId),
        404,
        "Dish not found.",
      );
      await rateLimit(env, "review:" + user.id, 5);
      await run(
        env.DB,
        "INSERT INTO reviews(id,user_id,dish_id,text,recommendation,status,created_at) VALUES(?,?,?,?,?,'published',?) ON CONFLICT(user_id,dish_id) DO UPDATE SET text=excluded.text,recommendation=excluded.recommendation,created_at=excluded.created_at",
        uid(),
        user.id,
        dishId,
        str(d["text"], 10, 2000),
        rec,
        now(),
      );
      return json({ ok: true });
    }
    if (path.startsWith("/api/reviews/") && method === "DELETE") {
      await run(
        env.DB,
        "DELETE FROM reviews WHERE id=? AND user_id=?",
        path.split("/").at(-1),
        user.id,
      );
      return json({ ok: true });
    }
    if (path === "/api/creator" && method === "POST") {
      const d = await body(request),
        existing = await one(env.DB, "SELECT id FROM creators WHERE owner_id=?", user.id),
        id = String(existing?.["id"] ?? uid());
      const handle = str(d["handle"], 3, 40);
      assert(
        /^@[a-zA-Z0-9_]+$/.test(handle),
        400,
        "Use @ followed by letters, numbers or underscores.",
      );
      const data = {
        id,
        name: str(d["name"], 1, 100),
        handle,
        bio: str(d["bio"], 10, 500),
        avatar: httpsUrl(d["avatar"], true),
        cover: httpsUrl(d["cover"], true),
        reviewsCount: 0,
        followers: "0",
        visited: [],
        socials: {
          youtube: httpsUrl(d["youtube"], true),
          instagram: httpsUrl(d["instagram"], true),
        },
      };
      await run(
        env.DB,
        "INSERT INTO creators(id,owner_id,status,data,created_at) VALUES(?,?,'pending',?,?) ON CONFLICT(owner_id) DO UPDATE SET data=excluded.data,status='pending'",
        id,
        user.id,
        JSON.stringify(data),
        now(),
      );
      return json({ ok: true });
    }
    if (path === "/api/creator/dashboard" && method === "GET") {
      const creator = await one(env.DB, "SELECT * FROM creators WHERE owner_id=?", user.id);
      const dishes = creator
        ? await all(
            env.DB,
            "SELECT * FROM dishes WHERE creator_id=? ORDER BY created_at DESC",
            creator["id"],
          )
        : [];
      return json({
        creator: creator ? { ...creator, data: JSON.parse(String(creator["data"])) } : null,
        dishes: dishes.map((r) => ({ ...r, data: JSON.parse(String(r["data"])) })),
      });
    }
    if (path === "/api/dishes" && method === "POST") {
      const creator = await one(
        env.DB,
        "SELECT id FROM creators WHERE owner_id=? AND status='approved'",
        user.id,
      );
      assert(creator, 403, "Your creator profile must be approved first.");
      const d = await body(request),
        id = uid(),
        data = {
          id,
          name: str(d["name"], 2, 100),
          restaurant: str(d["restaurant"], 2, 120),
          price: number(d["price"], 0, 100000),
          calories: number(d["calories"], 0, 10000),
          distanceKm: number(d["distanceKm"], 0, 1000),
          address: str(d["address"], 5, 300),
          hours: str(d["hours"], 3, 120),
          category: str(d["category"], 2, 50),
          city: str(d["city"], 2, 100),
          image: httpsUrl(d["image"]),
          reviews: [],
        };
      await run(
        env.DB,
        "INSERT INTO dishes(id,creator_id,status,data,created_at) VALUES(?,?,'pending',?,?)",
        id,
        creator["id"],
        JSON.stringify(data),
        now(),
      );
      return json({ id }, 201);
    }
    if (path === "/api/checkout" && method === "POST") {
      const d = await body(request);
      if(env.LOCAL_AUTH) assert(PLANS.some(p=>p.id===d['planId']&&p.kind==='member'),400,'Only user premium plans are available.');
      return payment(
        "/internal/checkout",
        { userId: user.id, planId: d["planId"], idempotencyKey: d["idempotencyKey"] },
        env,
      );
    }
    if (path === "/api/checkout/result" && method === "POST") {
      const d = await body(request);
      return payment(
        "/internal/settle",
        { userId: user.id, orderId: d["orderId"], outcome: d["outcome"] },
        env,
      );
    }
    if (path.startsWith("/api/admin/")) {
      requireAdmin(user);
      if (path === "/api/admin/seed" && method === "POST") {
        await seedCatalog(env);
        return json({ ok: true });
      }
      if (path === "/api/admin/dashboard" && method === "GET") {
        const [users, creators, dishes, reviews, orders, audit] = await Promise.all([
          all(
            env.DB,
            "SELECT id,name,email,role,created_at FROM users ORDER BY created_at DESC LIMIT 200",
          ),
          all(env.DB, "SELECT * FROM creators ORDER BY created_at DESC LIMIT 200"),
          all(env.DB, "SELECT * FROM dishes ORDER BY created_at DESC LIMIT 200"),
          all(
            env.DB,
            "SELECT r.*,u.name AS author FROM reviews r JOIN users u ON u.id=r.user_id ORDER BY r.created_at DESC LIMIT 200",
          ),
          all(env.DB, "SELECT * FROM orders ORDER BY created_at DESC LIMIT 200"),
          all(env.DB, "SELECT * FROM audit ORDER BY created_at DESC LIMIT 100"),
        ]);
        return json({ users, creators, dishes, reviews, orders, audit, ads: await settings(env) });
      }
      if (path === "/api/admin/moderate" && method === "POST") {
        const d = await body(request),
          resource = str(d["resource"]),
          id = str(d["id"]),
          status = str(d["status"]);
        assert(["creators", "dishes", "reviews"].includes(resource), 400, "Unknown resource.");
        assert(
          (resource === "reviews" ? ["published", "hidden"] : ["approved", "rejected"]).includes(
            status,
          ),
          400,
          "Invalid status.",
        );
        assert(
          await one(env.DB, `SELECT id FROM ${resource} WHERE id=?`, id),
          404,
          "Item not found.",
        );
        await env.DB.batch([
          env.DB.prepare(`UPDATE ${resource} SET status=? WHERE id=?`).bind(status, id),
          env.DB.prepare(
            "INSERT INTO audit(id,actor_id,action,target_id,created_at) VALUES(?,?,?,?,?)",
          ).bind(uid(), user.id, resource + ":" + status, id, now()),
        ]);
        return json({ ok: true });
      }
      if (path === "/api/admin/refund" && method === "POST") {
        const d = await body(request);
        return payment("/internal/refund", { userId: user.id, orderId: d["orderId"] }, env);
      }
      if (path === "/api/admin/adsense" && method === "PUT") {
        const d = await body(request);
        const next = {
          enabled: d["enabled"] === true,
          publisherId: str(d["publisherId"] ?? "", 0, 30),
          homeSlot: str(d["homeSlot"] ?? "", 0, 20),
          profileSlot: str(d["profileSlot"] ?? "", 0, 20),
          vloggerSlot: str(d["vloggerSlot"] ?? "", 0, 20),
          consentConfigured: d["consentConfigured"] === true,
        };
        assert(
          !next.publisherId || /^ca-pub-\d{16}$/.test(next.publisherId),
          400,
          "Use an AdSense publisher ID such as ca-pub- followed by 16 digits.",
        );
        for (const slot of [next.homeSlot, next.profileSlot, next.vloggerSlot])
          assert(!slot || /^\d{5,20}$/.test(slot), 400, "Ad slot IDs must contain digits only.");
        assert(
          !next.enabled ||
            (next.publisherId &&
              next.homeSlot &&
              next.profileSlot &&
              next.vloggerSlot &&
              next.consentConfigured),
          400,
          "Provide all publisher/slot IDs and configure your Google-certified consent platform before enabling ads.",
        );
        await env.DB.batch([
          env.DB.prepare(
            "INSERT INTO settings(key,value) VALUES('adsense',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
          ).bind(JSON.stringify(next)),
          env.DB.prepare(
            "INSERT INTO audit(id,actor_id,action,target_id,created_at) VALUES(?,?,?,?,?)",
          ).bind(uid(), user.id, "adsense:update", "adsense", now()),
        ]);
        return json({ ok: true });
      }
    }
    return json({ error: "Not found" }, 404);
  } catch (error) {
    return errorResponse(error);
  }
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path.startsWith("/api/") || path === "/ads.txt") return api(request, env);
    if (!env.ASSETS) return new Response("Not found", { status: 404 });
    let result = await env.ASSETS.fetch(request);
    if (result.status === 404 && request.method === "GET" && !path.split("/").at(-1)?.includes("."))
      result = await env.ASSETS.fetch(new Request(new URL("/index.html", request.url), request));
    return result;
  },
};
