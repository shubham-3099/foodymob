import { DISHES, VLOGGERS, type Dish, type Vlogger } from "../src/data/seed.ts";
import { all, one, now, type Env } from "./db.ts";
export async function seedCatalog(env: Env) {
  if (await one(env.DB, "SELECT key FROM settings WHERE key='catalog_seed_v1'")) return;
  const statements = [
    ...VLOGGERS.map((v) =>
      env.DB.prepare(
        "INSERT OR IGNORE INTO creators(id,owner_id,status,data,created_at) VALUES(?,NULL,'approved',?,?)",
      ).bind(v.id, JSON.stringify(v), now()),
    ),
    ...DISHES.map((d) =>
      env.DB.prepare(
        "INSERT OR IGNORE INTO dishes(id,creator_id,status,data,created_at) VALUES(?,NULL,'approved',?,?)",
      ).bind(d.id, JSON.stringify(d), now()),
    ),
    env.DB.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES('catalog_seed_v1','true')"),
  ];
  await env.DB.batch(statements);
}
export async function catalog(env: Env) {
  const dishes = (
    await all<{ data: string }>(
      env.DB,
      "SELECT data FROM dishes WHERE status='approved' ORDER BY created_at,id",
    )
  ).map((r) => JSON.parse(r.data) as Dish);
  const creators = (
    await all<{ data: string; owner_id: string | null }>(
      env.DB,
      "SELECT data,owner_id FROM creators WHERE status='approved' ORDER BY created_at,id",
    )
  ).map((r) => ({ ...(JSON.parse(r.data) as Vlogger), ownerId: r.owner_id }));
  const reviews = await all<{
    id: string;
    dish_id: string;
    text: string;
    recommendation: "MUST TRY" | "Should Try" | "Avoid";
    created_at: number;
    name: string;
    creator_id: string | null;
  }>(
    env.DB,
    "SELECT r.*,u.name,c.id AS creator_id FROM reviews r JOIN users u ON r.user_id=u.id LEFT JOIN creators c ON c.owner_id=u.id AND c.status='approved' WHERE r.status='published'",
  );
  for (const d of dishes)
    d.reviews = [
      ...d.reviews,
      ...reviews
        .filter((r) => r.dish_id === d.id)
        .map((r) => ({
          id: r.id,
          author: r.name,
          authorType: r.creator_id ? ("vlogger" as const) : ("user" as const),
          ...(r.creator_id ? { vloggerId: r.creator_id } : {}),
          text: r.text,
          recommendation: r.recommendation,
        })),
    ];
  for (const c of creators)
    if (c.ownerId) {
      c.visited = dishes
        .filter((d) => d.reviews.some((r) => r.vloggerId === c.id))
        .map((d) => d.id);
      c.reviewsCount = c.visited.length;
      c.followers = String(
        (
          await one<{ n: number }>(
            env.DB,
            "SELECT count(*) n FROM follows WHERE creator_id=?",
            c.id,
          )
        )?.n ?? 0,
      );
    }
  const premiumOwners = await all<{ user_id: string }>(
    env.DB,
    "SELECT DISTINCT user_id FROM entitlements WHERE kind='creator' AND revoked=0 AND expires_at>?",
    now(),
  );
  const premiumIds = new Set(premiumOwners.map((r) => r.user_id));
  for (const c of creators) c.premium = !!c.ownerId && premiumIds.has(c.ownerId);
  creators.sort((a, b) => Number(b.premium) - Number(a.premium));
  return { dishes, vloggers: creators };
}
