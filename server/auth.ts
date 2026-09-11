import { one, run, now, type Env } from "./db.ts";
import { assert } from "./http.ts";
export type User = {
  id: string;
  email: string;
  name: string;
  bio: string;
  role: string;
  location: string;
  created_at: number;
};
// Identity is supplied by the Sites dispatcher; the local adapter strips untrusted identity headers.
export async function currentUser(request: Request, env: Env): Promise<User | null> {
  if (env.LOCAL_AUTH) return env.LOCAL_AUTH(request);
  const id = request.headers.get("oai-authenticated-user-id"),
    email = request.headers.get("oai-authenticated-user-email");
  if (!id || !email) return null;
  let name =
    request.headers.get("oai-authenticated-user-full-name") ?? email.split("@")[0] ?? "Explorer";
  if (request.headers.get("oai-authenticated-user-full-name-encoding") === "percent-encoded-utf-8")
    try {
      name = decodeURIComponent(name);
    } catch {}
  const isAdmin = (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .includes(email.toLowerCase());
  await run(
    env.DB,
    "INSERT INTO users(id,email,name,bio,role,location,created_at) VALUES(?,?,?,'',?,'72 Outer Circle, New York',?) ON CONFLICT(id) DO UPDATE SET email=excluded.email,role=excluded.role",
    id,
    email,
    name.slice(0, 100),
    isAdmin ? "admin" : "user",
    now(),
  );
  return one<User>(env.DB, "SELECT * FROM users WHERE id=?", id);
}
export function requireUser(user: User | null): asserts user is User {
  assert(user, 401, "Sign in to continue.");
}
export function requireAdmin(user: User | null): asserts user is User {
  requireUser(user);
  assert(user.role === "admin", 403, "Administrator access required.");
}
export async function rateLimit(env: Env, key: string, max = 30) {
  const bucket = Math.floor(now() / 60000);
  const row = await env.DB.prepare(
    "INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count",
  )
    .bind(key + ":" + bucket, now() + 120000)
    .first<{ count: number }>();
  assert(row && row.count <= max, 429, "Too many requests. Please try again in a minute.");
  await run(env.DB, "DELETE FROM rate_limits WHERE expires_at<?", now());
}
