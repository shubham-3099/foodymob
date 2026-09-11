const encoder = new TextEncoder();
export async function sign(secret: string, text: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return [...new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(text)))]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}
export async function verify(secret: string, text: string, signature: string) {
  if (!/^[a-f0-9]{64}$/.test(signature)) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const bytes = new Uint8Array(signature.match(/../g)!.map((v) => parseInt(v, 16)));
  return crypto.subtle.verify("HMAC", key, bytes, encoder.encode(text));
}
export async function signedRequest(url: string, payload: unknown, secret: string) {
  const raw = JSON.stringify(payload),
    stamp = String(Date.now());
  return new Request(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Service-Timestamp": stamp,
      "X-Service-Signature": await sign(secret, stamp + "\n" + new URL(url).pathname + "\n" + raw),
    },
    body: raw,
  });
}
