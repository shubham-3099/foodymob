export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export function assert(ok: unknown, status: number, message: string): asserts ok {
  if (!ok) throw new HttpError(status, message);
}
export function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}
export async function body(request: Request): Promise<Record<string, unknown>> {
  assert(
    (request.headers.get("content-type") ?? "").includes("application/json"),
    415,
    "Use JSON.",
  );
  const raw = await request.text();
  assert(raw.length <= 20000, 413, "Request is too large.");
  try {
    const value = JSON.parse(raw);
    assert(value && typeof value === "object" && !Array.isArray(value), 400, "Invalid request.");
    return value;
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(400, "Invalid JSON.");
  }
}
export function str(value: unknown, min = 1, max = 200) {
  assert(
    typeof value === "string" && value.trim().length >= min && value.trim().length <= max,
    400,
    `Enter between ${min} and ${max} characters.`,
  );
  return value.trim();
}
export function httpsUrl(value: unknown, optional = false) {
  if (optional && (value === undefined || value === "")) return "";
  const s = str(value, 1, 2000);
  try {
    const u = new URL(s);
    assert(u.protocol === "https:" && !u.username && !u.password, 400, "Use a public HTTPS link.");
    assert(
      !/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|\[)/.test(u.hostname),
      400,
      "Use a public HTTPS link.",
    );
    return u.href;
  } catch {
    throw new HttpError(400, "Use a valid HTTPS link.");
  }
}
export function errorResponse(error: unknown) {
  if (error instanceof HttpError) return json({ error: error.message }, error.status);
  console.error("Request failed", error instanceof Error ? error.message : "unknown");
  return json({ error: "Unable to complete this request. Please try again." }, 500);
}
export function sameOrigin(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  const origin = request.headers.get("origin");
  assert(origin === new URL(request.url).origin, 403, "Request origin is not allowed.");
  assert(
    request.headers.get("x-requested-with") === "DishDiscovery",
    403,
    "Missing request header.",
  );
}
