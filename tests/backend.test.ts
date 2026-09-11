import test from "node:test";
import assert from "node:assert/strict";
import { localDatabase } from "../scripts/local-db.ts";
import { api } from "../server/index.ts";
import { seedCatalog } from "../server/catalog.ts";
import { one, run, type Env } from "../server/db.ts";
import payments from "../services/payments/index.ts";
import { signedRequest } from "../services/payments/security.ts";
const secret = "test-only-secret-which-is-longer-than-32-characters";
async function fixture() {
  const DB = localDatabase();
  const env: Env = {
    DB,
    ADMIN_EMAILS: "owner@example.test",
    PAYMENTS_MODE: "test",
    PAYMENT_SERVICE_SECRET: secret,
  };
  await seedCatalog(env);
  return { env, close: DB.close };
}
async function call(env: Env, path: string, method = "GET", data?: unknown, identity = "alice") {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Origin: "https://site.test",
    "X-Requested-With": "DishDiscovery",
  };
  if (identity) {
    headers["oai-authenticated-user-id"] = identity;
    headers["oai-authenticated-user-email"] =
      identity === "admin" ? "owner@example.test" : identity + "@example.test";
  }
  const response = await api(
    new Request("https://site.test" + path, {
      method,
      headers,
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    }),
    env,
  );
  return { status: response.status, data: (await response.json()) as any };
}
async function checkout(env: Env, key = "checkout-key-1", who = "alice") {
  return call(env, "/api/checkout", "POST", { planId: "member-month", idempotencyKey: key }, who);
}
test("anonymous users can browse but cannot mutate", async () => {
  const f = await fixture();
  try {
    const r = await call(f.env, "/api/bootstrap", "GET", undefined, "");
    assert.equal(r.status, 200);
    assert.equal(r.data.user, null);
    assert.ok(r.data.dishes.length > 0);
    assert.equal((await call(f.env, "/api/saved/momos", "PUT", { active: true }, "")).status, 401);
  } finally {
    f.close();
  }
});
test("saved dishes and profile edits are durable and isolated", async () => {
  const f = await fixture();
  try {
    assert.equal((await call(f.env, "/api/saved/momos", "PUT", { active: true })).status, 200);
    await call(f.env, "/api/profile", "PUT", {
      name: "Alice Foodie",
      bio: "Exploring food",
      location: "Sector 29, Gurugram",
      role: "admin",
    });
    const a = (await call(f.env, "/api/me")).data,
      b = (await call(f.env, "/api/me", "GET", undefined, "bob")).data;
    assert.deepEqual(a.saved, ["momos"]);
    assert.deepEqual(b.saved, []);
    assert.equal(a.user.role, "user");
    assert.equal(a.user.name, "Alice Foodie");
    assert.equal((await call(f.env, "/api/admin/dashboard")).status, 403);
  } finally {
    f.close();
  }
});
test("CSRF and content-type checks reject unwanted writes", async () => {
  const f = await fixture();
  try {
    const r = await api(
      new Request("https://site.test/api/profile", {
        method: "PUT",
        headers: { Origin: "https://evil.test", "Content-Type": "application/json" },
        body: "{}",
      }),
      f.env,
    );
    assert.equal(r.status, 403);
    const r2 = await api(
      new Request("https://site.test/api/profile", {
        method: "PUT",
        headers: {
          Origin: "https://site.test",
          "X-Requested-With": "DishDiscovery",
          "oai-authenticated-user-id": "alice",
          "oai-authenticated-user-email": "alice@example.test",
        },
        body: "{}",
      }),
      f.env,
    );
    assert.equal(r2.status, 415);
  } finally {
    f.close();
  }
});
test("one review per user per dish and moderation cannot be bypassed by editing", async () => {
  const f = await fixture();
  try {
    const payload = {
      dishId: "momos",
      text: "A very tasty plate of dumplings.",
      recommendation: "MUST TRY",
    };
    await call(f.env, "/api/reviews", "POST", payload);
    await call(f.env, "/api/reviews", "POST", { ...payload, text: "Updated: a very tasty plate." });
    const rows = (await call(f.env, "/api/me")).data.reviews;
    assert.equal(rows.length, 1);
    await call(
      f.env,
      "/api/admin/moderate",
      "POST",
      { resource: "reviews", id: rows[0].id, status: "hidden" },
      "admin",
    );
    await call(f.env, "/api/reviews", "POST", payload);
    const cat = (await call(f.env, "/api/catalog")).data;
    assert.equal(
      cat.dishes.find((d: any) => d.id === "momos").reviews.some((r: any) => r.id === rows[0].id),
      false,
    );
    await call(f.env, "/api/reviews/" + rows[0].id, "DELETE", undefined, "bob");
    assert.equal((await call(f.env, "/api/me")).data.reviews.length, 1);
  } finally {
    f.close();
  }
});
test("checkout uses server prices, rejects removed advertising plans, and deduplicates retries", async () => {
  const f = await fixture();
  try {
    const a = await checkout(f.env),
      b = await checkout(f.env);
    assert.equal(a.status, 200);
    assert.equal(a.data.order.id, b.data.order.id);
    assert.equal(a.data.order.amount, 9900);
    assert.equal(
      (
        await call(f.env, "/api/checkout", "POST", {
          planId: "advertiser-month",
          idempotencyKey: "advertiser-key",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await call(f.env, "/api/checkout", "POST", {
          planId: "member-year",
          idempotencyKey: "checkout-key-1",
          amount: 1,
        })
      ).status,
      409,
    );
  } finally {
    f.close();
  }
});
test("success grants one entitlement, repeated settlement is harmless, and another user cannot settle", async () => {
  const f = await fixture();
  try {
    const order = (await checkout(f.env)).data.order;
    const payload = { orderId: order.id, outcome: "succeeded" };
    assert.equal((await call(f.env, "/api/checkout/result", "POST", payload, "bob")).status, 404);
    assert.equal((await call(f.env, "/api/checkout/result", "POST", payload)).status, 200);
    assert.equal((await call(f.env, "/api/checkout/result", "POST", payload)).status, 200);
    assert.equal((await call(f.env, "/api/me")).data.entitlements.length, 1);
    assert.equal(
      (await call(f.env, "/api/checkout/result", "POST", { ...payload, outcome: "failed" })).status,
      409,
    );
  } finally {
    f.close();
  }
});
test("failed and cancelled checkouts grant no premium", async () => {
  const f = await fixture();
  try {
    for (const outcome of ["failed", "cancelled"]) {
      const order = (await checkout(f.env, "key-" + outcome)).data.order;
      assert.equal(
        (await call(f.env, "/api/checkout/result", "POST", { orderId: order.id, outcome })).status,
        200,
      );
    }
    assert.deepEqual((await call(f.env, "/api/me")).data.entitlements, []);
  } finally {
    f.close();
  }
});
test("admin refund revokes benefits; users cannot refund themselves", async () => {
  const f = await fixture();
  try {
    const order = (await checkout(f.env)).data.order;
    await call(f.env, "/api/checkout/result", "POST", { orderId: order.id, outcome: "succeeded" });
    assert.equal(
      (await call(f.env, "/api/admin/refund", "POST", { orderId: order.id })).status,
      403,
    );
    assert.equal(
      (await call(f.env, "/api/admin/refund", "POST", { orderId: order.id }, "admin")).status,
      200,
    );
    assert.deepEqual((await call(f.env, "/api/me")).data.entitlements, []);
    assert.equal(
      (await call(f.env, "/api/admin/refund", "POST", { orderId: order.id }, "admin")).status,
      200,
    );
  } finally {
    f.close();
  }
});
test("expired checkout cannot activate a plan", async () => {
  const f = await fixture();
  try {
    const order = (await checkout(f.env)).data.order;
    await run(
      f.env.DB,
      "UPDATE orders SET created_at=? WHERE id=?",
      Date.now() - 20 * 60000,
      order.id,
    );
    assert.equal(
      (
        await call(f.env, "/api/checkout/result", "POST", {
          orderId: order.id,
          outcome: "succeeded",
        })
      ).status,
      409,
    );
    assert.deepEqual((await call(f.env, "/api/me")).data.entitlements, []);
  } finally {
    f.close();
  }
});
test("creator submissions require approval and only approved creators can buy creator premium", async () => {
  const f = await fixture();
  try {
    assert.equal(
      (
        await call(f.env, "/api/checkout", "POST", {
          planId: "creator-month",
          idempotencyKey: "creator-checkout",
        })
      ).status,
      403,
    );
    await call(f.env, "/api/creator", "POST", {
      name: "Alice",
      handle: "@alice",
      bio: "Sharing delicious discoveries",
    });
    const creator = (await call(f.env, "/api/me")).data.creator;
    assert.equal(creator.status, "pending");
    assert.equal(
      (await call(f.env, "/api/catalog")).data.vloggers.some((v: any) => v.id === creator.id),
      false,
    );
    await call(
      f.env,
      "/api/admin/moderate",
      "POST",
      { resource: "creators", id: creator.id, status: "approved" },
      "admin",
    );
    assert.equal(
      (
        await call(f.env, "/api/checkout", "POST", {
          planId: "creator-month",
          idempotencyKey: "creator-checkout",
        })
      ).status,
      200,
    );
    const d = await call(f.env, "/api/dishes", "POST", {
      name: "Rice bowl",
      restaurant: "My cafe",
      price: 100,
      calories: 300,
      distanceKm: 1,
      address: "12 Example Street",
      hours: "10 AM - 8 PM",
      category: "Rice",
      city: "New York",
      image: "https://example.com/food.jpg",
    });
    assert.equal(d.status, 201);
    assert.equal(
      (await call(f.env, "/api/catalog")).data.dishes.some((x: any) => x.id === d.data.id),
      false,
    );
    await call(
      f.env,
      "/api/admin/moderate",
      "POST",
      { resource: "dishes", id: d.data.id, status: "approved" },
      "admin",
    );
    assert.equal(
      (await call(f.env, "/api/catalog")).data.dishes.some((x: any) => x.id === d.data.id),
      true,
    );
  } finally {
    f.close();
  }
});
test("payment service rejects forged signatures and live mode", async () => {
  const f = await fixture();
  try {
    const r = await payments.fetch(
      new Request("https://service.test/internal/checkout", { method: "POST", body: "{}" }),
      f.env,
    );
    assert.equal(r.status, 401);
    const signed = await signedRequest(
      "https://service.test/internal/checkout",
      { userId: "alice", planId: "member-month", idempotencyKey: "test-key" },
      secret,
    );
    assert.equal((await payments.fetch(signed, { ...f.env, PAYMENTS_MODE: "live" })).status, 503);
  } finally {
    f.close();
  }
});
test("AdSense is off by default, validates IDs, and produces ads.txt only with a valid publisher", async () => {
  const f = await fixture();
  try {
    assert.equal((await call(f.env, "/api/bootstrap")).data.ads.enabled, false);
    assert.equal((await api(new Request("https://site.test/ads.txt"), f.env)).status, 404);
    assert.equal(
      (
        await call(
          f.env,
          "/api/admin/adsense",
          "PUT",
          { enabled: true, publisherId: "bad" },
          "admin",
        )
      ).status,
      400,
    );
    const d = {
      publisherId: "ca-pub-1234567890123456",
      homeSlot: "1234567890",
      profileSlot: "1234567891",
      vloggerSlot: "1234567892",
      consentConfigured: false,
      enabled: false,
    };
    assert.equal((await call(f.env, "/api/admin/adsense", "PUT", d, "admin")).status, 200);
    const txt = await api(new Request("https://site.test/ads.txt"), f.env);
    assert.equal(await txt.text(), "google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n");
    assert.equal(
      (await call(f.env, "/api/admin/adsense", "PUT", { ...d, enabled: true }, "admin")).status,
      400,
    );
  } finally {
    f.close();
  }
});
