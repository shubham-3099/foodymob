import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { localDatabase } from "../scripts/local-db.ts";
import { testAuth } from "../scripts/test-auth.ts";
import { api } from "../server/index.ts";
import { communityApi, distanceKm } from "../server/community.ts";
import { imageApi } from "../scripts/community-services.ts";
import { migrateCommunity } from "../scripts/community-migration.ts";

test("community: verification, photos, ownership, social actions and durable outing order", async () => {
  const dir = mkdtempSync(join(tmpdir(), "dishspot-test-"));
  let db = localDatabase(join(dir, "data.sqlite"));
  try {
    const auth = await testAuth(db, "919999999999", "Admin-testing-12345");
    const req = (path: string, method = "GET", data?: unknown, cookie = "") =>
      new Request("http://localhost:5173" + path, {
        method,
        headers: {
          origin: "http://localhost:5173",
          "x-requested-with": "DishDiscovery",
          "content-type": "application/json",
          cookie,
        },
        ...(data === undefined ? {} : { body: JSON.stringify(data) }),
      });
    const env = {
      DB: db,
      LOCAL_AUTH: auth.current,
      PAYMENTS_MODE: "test",
      PAYMENT_SERVICE_SECRET: "test-only-secret-which-is-longer-than-32-characters",
    };
    const call = async (path = "", method = "GET", data?: unknown, cookie = "") => {
      const r = await communityApi(req("/api/community" + path, method, data, cookie), env);
      return { status: r.status, data: (await r.json()) as any };
    };
    async function register(phone: string) {
      const r = await auth.handle(
        req("/api/auth/register", "POST", {
          phone,
          firstName: "Test",
          lastName: phone,
          email: phone + "@example.test",
          password: "Password-testing-123",
          confirmPassword: "Password-testing-123",
          role: "user",
        }),
      );
      const c: any = await r.json();
      const v = await auth.handle(
        req("/api/auth/verify", "POST", { challengeId: c.challengeId, otp: c.testOtp }),
      );
      assert.equal(v.status, 200);
      return v.headers.get("set-cookie")!.split(";")[0]!;
    }
    const a = await register("919876543210"),
      b = await register("918765432109");
    const login = await auth.handle(
      req("/api/auth/login", "POST", { phone: "919999999999", password: "Admin-testing-12345" }),
    );
    const admin = login.headers.get("set-cookie")!.split(";")[0]!;
    await migrateCommunity(db);
    await migrateCommunity(db);
    assert.equal((await call()).data.restaurants.length, 0);
    assert.equal((await call("/admin", "GET", undefined, a)).status, 403);
    const form = new FormData();
    form.set(
      "file",
      new File(
        [
          Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN1sAAAAASUVORK5CYII=",
            "base64",
          ),
        ],
        "dish.png",
        { type: "image/png" },
      ),
    );
    const upload = await imageApi(
      new Request("http://localhost:5173/api/community/images", {
        method: "POST",
        headers: {
          origin: "http://localhost:5173",
          "x-requested-with": "DishDiscovery",
          cookie: a,
        },
        body: form,
      }),
      env,
      dir,
    );
    assert.equal(upload.status, 201);
    const photo: any = await upload.json();
    assert.equal((await imageApi(req("/api/community/images/" + photo.id), env, dir)).status, 404);
    assert.equal((await call("/profile/banner", "PUT", { imageId: photo.id })).status, 401);
    assert.equal((await call("/profile/banner", "PUT", { imageId: photo.id }, b)).status, 400);
    assert.equal((await call("/profile/banner", "PUT", { imageId: photo.id }, a)).status, 200);
    assert.equal((await call("", "GET", undefined, a)).data.user.banner_id, photo.id);
    assert.equal((await imageApi(req("/api/community/images/" + photo.id), env, dir)).status, 200);
    assert.equal((await call("/profile/banner", "PUT", { imageId: null }, a)).status, 200);
    assert.equal((await imageApi(req("/api/community/images/" + photo.id), env, dir)).status, 404);

    const review = {
      dishName: "Paneer tikka",
      restaurantName: "Test Kitchen",
      address: "Market Road, Test City",
      lat: 28.61,
      lng: 77.21,
      price: 230,
      category: "Indian",
      experience: "Fresh and delicious food served hot.",
      recommendation: 3,
      vlogUrl: "https://example.com/food",
      images: [photo.id],
    };
    assert.equal((await call("/reviews", "POST", review)).status, 401);
    assert.equal((await call("/reviews", "POST", review, b)).status, 400);
    const first = await call("/reviews", "POST", review, a);
    assert.equal(first.status, 201);
    assert.equal(first.data.status, "pending");
    assert.equal((await call()).data.reviews.length, 0);
    const mine = (await call("", "GET", undefined, a)).data.mine;
    const rid = mine[0].restaurant_id;
    assert.equal(
      (
        await call(
          "/reviews/" + first.data.id,
          "PUT",
          { ...review, experience: "Updated while still pending." },
          a,
        )
      ).status,
      200,
    );
    assert.equal((await call()).data.reviews.length, 0);
    assert.equal((await call("/likes/" + first.data.id, "PUT", { active: true }, b)).status, 404);
    assert.equal(
      (await call("/reports/" + first.data.id, "POST", { reason: "Pending review" }, b)).status,
      404,
    );
    assert.equal(
      (await call("/admin/verify", "POST", { id: rid, decision: "approved" }, a)).status,
      403,
    );
    assert.equal(
      (await call("/admin/verify", "POST", { id: rid, decision: "approved" }, admin)).status,
      200,
    );
    assert.equal(
      (await call("/admin/verify", "POST", { id: rid, decision: "approved" }, admin)).status,
      409,
    );
    assert.equal((await call()).data.restaurants.length, 1);
    assert.equal((await imageApi(req("/api/community/images/" + photo.id), env, dir)).status, 200);
    const second = await call("/reviews", "POST", { ...review, restaurantId: rid, images: [] }, b);
    assert.equal(second.data.status, "published");
    assert.equal((await call("/reviews/" + first.data.id, "DELETE", undefined, b)).status, 404);
    for (let i = 0; i < 2; i++)
      assert.equal((await call("/likes/" + first.data.id, "PUT", { active: true }, b)).status, 200);
    assert.equal((await call()).data.reviews.find((r: any) => r.id === first.data.id).likes, 1);
    const aid = (await call("", "GET", undefined, a)).data.user.id;
    assert.equal((await call("/follows/" + aid, "PUT", { active: true }, a)).status, 400);
    assert.equal((await call("/follows/" + aid, "PUT", { active: true }, b)).status, 200);
    assert.deepEqual((await call("", "GET", undefined, b)).data.following, [aid]);
    const bid = (await call("", "GET", undefined, b)).data.user.id;
    assert.deepEqual(
      (await call("/people/" + aid + "/connections?kind=followers")).data.people.map(
        (p: any) => p.id,
      ),
      [bid],
    );
    assert.deepEqual(
      (await call("/people/" + bid + "/connections?kind=following")).data.people.map(
        (p: any) => p.id,
      ),
      [aid],
    );
    assert.deepEqual((await call("", "GET", undefined, a)).data.followers, [bid]);
    assert.equal((await call("/people/" + aid + "/connections?kind=invalid")).status, 400);

    assert.equal((await call("/saves/" + first.data.id, "PUT", { active: true }, b)).status, 403);
    const checkout = await api(
      req(
        "/api/checkout",
        "POST",
        { planId: "member-month", idempotencyKey: "premium-save-test" },
        b,
      ),
      env,
    );
    assert.equal(checkout.status, 200);
    const order: any = await checkout.json();
    const paid = await api(
      req("/api/checkout/result", "POST", { orderId: order.order.id, outcome: "succeeded" }, b),
      env,
    );
    assert.equal(paid.status, 200);
    assert.equal((await call("", "GET", undefined, b)).data.premium, true);
    assert.equal((await call("/saves/" + first.data.id, "PUT", { active: true }, b)).status, 200);
    await db
      .prepare("UPDATE entitlements SET revoked=1 WHERE order_id=?")
      .bind(order.order.id)
      .run();
    assert.equal((await call("", "GET", undefined, b)).data.premium, false);
    assert.deepEqual((await call("", "GET", undefined, b)).data.saved, []);
    assert.equal((await call("/saves/" + first.data.id, "PUT", { active: true }, b)).status, 403);
    await db
      .prepare("UPDATE entitlements SET revoked=0 WHERE order_id=?")
      .bind(order.order.id)
      .run();
    assert.deepEqual((await call("", "GET", undefined, b)).data.saved, [first.data.id]);
    await db
      .prepare("UPDATE entitlements SET expires_at=0 WHERE order_id=?")
      .bind(order.order.id)
      .run();
    assert.equal((await call("", "GET", undefined, b)).data.premium, false);

    assert.equal((await call("", "GET", undefined, a)).data.saved.length, 0);

    const c = await register("917777777777"),
      d = await register("916666666666");
    assert.equal(
      (await call("/reports/" + first.data.id, "POST", { reason: "Incorrect information" })).status,
      401,
    );
    assert.equal(
      (await call("/reports/" + first.data.id, "POST", { reason: "Incorrect information" }, a))
        .status,
      400,
    );
    assert.equal((await call("/admin/reports", "GET", undefined, b)).status, 403);
    assert.equal(
      (await call("/reports/" + first.data.id, "POST", { reason: "Incorrect information" }, b))
        .status,
      200,
    );
    assert.equal(
      (await call("/reports/" + first.data.id, "POST", { reason: "Repeated report" }, b)).status,
      200,
    );
    assert.equal(
      (await call("/reports/" + first.data.id, "POST", { reason: "Misleading review" }, c)).status,
      200,
    );
    assert.equal((await call("/admin/reports", "GET", undefined, admin)).data.reviews.length, 0);
    assert.equal(
      (await call("/reports/" + first.data.id, "POST", { reason: "Wrong restaurant" }, d)).status,
      200,
    );
    const flagged = (await call("/admin/reports", "GET", undefined, admin)).data.reviews;
    assert.equal(flagged.length, 1);
    assert.equal(flagged[0].reports.length, 3);
    assert.ok((await call()).data.reviews.some((p: any) => p.id === first.data.id));
    assert.equal(
      (await call("/admin/reports", "POST", { reviewId: first.data.id, decision: "delete" }, b))
        .status,
      403,
    );
    assert.equal(
      (await call("/admin/reports", "POST", { reviewId: first.data.id, decision: "keep" }, admin))
        .status,
      200,
    );
    assert.equal((await call("/admin/reports", "GET", undefined, admin)).data.reviews.length, 0);
    assert.ok((await call()).data.reviews.some((p: any) => p.id === first.data.id));
    await call("/reports/" + first.data.id, "POST", { reason: "Repeat after dismissal" }, b);
    assert.equal((await call("/admin/reports", "GET", undefined, admin)).data.reviews.length, 0);
    for (const cookie of [a, c, d])
      assert.equal(
        (
          await call(
            "/reports/" + second.data.id,
            "POST",
            { reason: "Misleading information" },
            cookie,
          )
        ).status,
        200,
      );
    assert.equal(
      (
        await call(
          "/admin/reports",
          "POST",
          { reviewId: second.data.id, decision: "delete" },
          admin,
        )
      ).status,
      200,
    );
    assert.ok(!(await call()).data.reviews.some((p: any) => p.id === second.data.id));
    assert.equal(
      (await call("/reports/" + second.data.id, "POST", { reason: "Already deleted" }, a)).status,
      404,
    );
    assert.equal((await call("/profile/banner", "PUT", { imageId: photo.id }, a)).status, 200);
    const next = await call(
      "/reviews",
      "POST",
      { ...review, restaurantName: "Second Kitchen", images: [] },
      a,
    );
    assert.equal(next.data.status, "pending");
    const rid2 = (await call("", "GET", undefined, a)).data.mine.find(
      (r: any) => r.id === next.data.id,
    ).restaurant_id;
    const trip = (await call("/outings", "POST", { name: "Weekend" }, a)).data.id;
    assert.equal(
      (await call("/outings/" + trip, "PUT", { name: "Weekend", stops: [rid2], revision: 0 }, a))
        .status,
      400,
    );
    await call("/admin/verify", "POST", { id: rid2, decision: "approved" }, admin);
    assert.equal(
      (
        await call(
          "/outings/" + trip,
          "PUT",
          { name: "Weekend", stops: [rid, rid2], revision: 0 },
          a,
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await call(
          "/outings/" + trip,
          "PUT",
          { name: "Weekend", stops: [rid2, rid], revision: 1 },
          a,
        )
      ).status,
      200,
    );
    assert.equal(
      (await call("/outings/" + trip, "PUT", { name: "Stale", stops: [], revision: 1 }, a)).status,
      409,
    );
    assert.equal((await call("/outings/" + trip, "DELETE", undefined, b)).status, 404);
    assert.deepEqual((await call("", "GET", undefined, a)).data.outings[0].stops, [rid2, rid]);
    assert.ok(Math.abs(distanceKm(0, 0, 0, 1) - 111.195) < 0.01);
    db.close();
    db = localDatabase(join(dir, "data.sqlite"));
    const banner = await db
      .prepare("SELECT banner_id FROM community_profiles WHERE user_id=?")
      .bind(aid)
      .first<any>();
    assert.equal(banner.banner_id, photo.id);
    const saved = await db
      .prepare("SELECT stops FROM community_outings WHERE id=?")
      .bind(trip)
      .first<any>();
    assert.deepEqual(JSON.parse(saved.stops), [rid2, rid]);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("v3 reviewed catalog migration preserves records and is idempotent", async () => {
  const db = localDatabase();
  try {
    const { seedCatalog } = await import("../server/catalog.ts");
    await testAuth(db, "919999999999", "Admin-testing-12345");
    await seedCatalog({ DB: db });
    await migrateCommunity(db);
    const first = await db.prepare("SELECT count(*) AS n FROM community_reviews").first<any>();
    assert.ok(first.n > 0);
    await migrateCommunity(db);
    const again = await db.prepare("SELECT count(*) AS n FROM community_reviews").first<any>();
    assert.equal(again.n, first.n);
    const missing = await db
      .prepare(
        "SELECT count(*) AS n FROM community_restaurants s WHERE NOT EXISTS(SELECT 1 FROM community_reviews r WHERE r.restaurant_id=s.id)",
      )
      .first<any>();
    assert.equal(missing.n, 0);
  } finally {
    db.close();
  }
});

test("sample food seed is durable, reviewed and only inserted once", async () => {
  const db = localDatabase();
  try {
    const { seedCommunitySamples } = await import("../scripts/sample-community.ts");
    await seedCommunitySamples(db);
    const count = await db.prepare("SELECT count(*) AS n FROM community_reviews").first<any>();
    assert.equal(count.n, 16);
    assert.equal(
      (
        await db
          .prepare("SELECT count(DISTINCT dish_name) AS n FROM community_reviews")
          .first<any>()
      ).n,
      8,
    );
    assert.equal(
      (
        await db
          .prepare(
            "SELECT count(*) AS n FROM community_restaurants s WHERE NOT EXISTS(SELECT 1 FROM community_reviews r WHERE r.restaurant_id=s.id AND r.status='published')",
          )
          .first<any>()
      ).n,
      0,
    );
    await db
      .prepare("UPDATE community_reviews SET status='deleted' WHERE id='sample-momos-0'")
      .run();
    await seedCommunitySamples(db);
    assert.equal(
      (await db.prepare("SELECT count(*) AS n FROM community_reviews").first<any>()).n,
      16,
    );
    assert.equal(
      (
        await db
          .prepare("SELECT status FROM community_reviews WHERE id='sample-momos-0'")
          .first<any>()
      ).status,
      "deleted",
    );
  } finally {
    db.close();
  }
});

test("directions use restaurant coordinates or the encoded address", async () => {
  const { directionsUrl } = await import("../src/community/types.ts");
  const pin = new URL(directionsUrl({ lat: 0, lng: 0, restaurant_name: "Cafe", address: "Road" }));
  assert.equal(pin.origin, "https://www.google.com");
  assert.equal(pin.pathname, "/maps/dir/");
  assert.equal(pin.searchParams.get("destination"), "0,0");
  const address = new URL(
    directionsUrl({
      lat: null,
      lng: null,
      restaurant_name: "Tea & Toast",
      address: "Sector 17, Chandigarh",
    }),
  );
  assert.equal(address.searchParams.get("destination"), "Tea & Toast, Sector 17, Chandigarh");
});
