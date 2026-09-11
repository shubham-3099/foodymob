import { all, one, now, run, uid, type Env } from "../../server/db.ts";
import { assert, body, errorResponse, json, str } from "../../server/http.ts";
import { planById } from "./plans.ts";
import { verify } from "./security.ts";
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      assert(request.method === "POST", 405, "Use POST.");
      assert(env.PAYMENTS_MODE === "test", 503, "Payments are not configured for test mode.");
      assert(
        env.PAYMENT_SERVICE_SECRET && env.PAYMENT_SERVICE_SECRET.length >= 32,
        503,
        "Payment service is not configured.",
      );
      const raw = await request.text(),
        timestamp = request.headers.get("X-Service-Timestamp") ?? "",
        path = new URL(request.url).pathname;
      assert(
        Number.isFinite(Number(timestamp)) && Math.abs(Date.now() - Number(timestamp)) < 60000,
        401,
        "Expired service request.",
      );
      assert(raw.length <= 20000, 413, "Request is too large.");
      assert(
        await verify(
          env.PAYMENT_SERVICE_SECRET,
          timestamp + "\n" + path + "\n" + raw,
          request.headers.get("X-Service-Signature") ?? "",
        ),
        401,
        "Invalid service signature.",
      );
      const data = await body(
        new Request(request.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: raw,
        }),
      );
      const userId = str(data["userId"], 1, 200),
        db = env.DB;
      assert(await one(db, "SELECT id FROM users WHERE id=?", userId), 401, "Account not found.");
      if (path === "/internal/checkout") {
        const plan = planById(str(data["planId"]));
        assert(plan, 400, "Unknown plan.");
        if (plan.kind === "creator")
          assert(
            await one(db, "SELECT id FROM creators WHERE owner_id=? AND status='approved'", userId),
            403,
            "An approved creator profile is required for this plan.",
          );
        const key = str(data["idempotencyKey"], 8, 120),
          time = now();
        await run(
          db,
          "INSERT INTO orders(id,user_id,plan_id,amount,currency,status,mode,idempotency_key,created_at,updated_at) VALUES(?,?,?,?,?,'pending','test',?,?,?) ON CONFLICT(user_id,idempotency_key) DO NOTHING",
          uid(),
          userId,
          plan.id,
          plan.amount,
          plan.currency,
          key,
          time,
          time,
        );
        const order = await one(
          db,
          "SELECT * FROM orders WHERE user_id=? AND idempotency_key=?",
          userId,
          key,
        );
        assert(order?.["plan_id"] === plan.id, 409, "This checkout key belongs to another plan.");
        return json({ order });
      }
      const orderId = str(data["orderId"]);
      const order = await one(db, "SELECT * FROM orders WHERE id=?", orderId);
      assert(order, 404, "Order not found.");
      if (path === "/internal/settle") {
        assert(order["user_id"] === userId, 404, "Order not found.");
        const outcome = str(data["outcome"]);
        assert(
          ["succeeded", "failed", "cancelled"].includes(outcome),
          400,
          "Choose a valid test outcome.",
        );
        if (order["status"] === outcome) return json({ order });
        assert(order["status"] === "pending", 409, "This checkout has already finished.");
        assert(
          now() - Number(order["created_at"]) <= 15 * 60 * 1000,
          409,
          "Checkout expired. Start a new checkout.",
        );
        const plan = planById(String(order["plan_id"]));
        assert(plan, 400, "Unknown plan.");
        const time = now();
        await db.batch([
          db
            .prepare("UPDATE orders SET status=?,updated_at=? WHERE id=? AND status='pending'")
            .bind(outcome, time, orderId),
          db
            .prepare(
              "INSERT OR IGNORE INTO payment_events(id,order_id,type,created_at) SELECT ?,id,?,? FROM orders WHERE id=? AND status=?",
            )
            .bind(orderId + ":" + outcome, outcome, time, orderId, outcome),
          db
            .prepare(
              "INSERT OR IGNORE INTO entitlements(order_id,user_id,kind,expires_at,revoked,mode) SELECT id,user_id,?,?,0,'test' FROM orders WHERE id=? AND status='succeeded'",
            )
            .bind(plan.kind, time + plan.days * 86400000, orderId),
        ]);
        const result = await one(db, "SELECT * FROM orders WHERE id=?", orderId);
        assert(
          result?.["status"] === outcome,
          409,
          "Another action already completed this checkout.",
        );
        return json({ order: result });
      }
      if (path === "/internal/refund") {
        const admin = await one(db, "SELECT role FROM users WHERE id=?", userId);
        assert(admin?.["role"] === "admin", 403, "Administrator access required.");
        assert(
          ["succeeded", "refunded"].includes(String(order["status"])),
          409,
          "Only successful test payments can be refunded.",
        );
        const time = now();
        await db.batch([
          db
            .prepare(
              "UPDATE orders SET status='refunded',updated_at=? WHERE id=? AND status='succeeded'",
            )
            .bind(time, orderId),
          db
            .prepare(
              "UPDATE entitlements SET revoked=1 WHERE order_id=? AND EXISTS(SELECT 1 FROM orders WHERE id=? AND status='refunded')",
            )
            .bind(orderId, orderId),
          db
            .prepare(
              "INSERT OR IGNORE INTO payment_events(id,order_id,type,created_at) SELECT ?,id,'refunded',? FROM orders WHERE id=? AND status='refunded'",
            )
            .bind(orderId + ":refunded", time, orderId),
          db
            .prepare("INSERT INTO audit(id,actor_id,action,target_id,created_at) VALUES(?,?,?,?,?)")
            .bind(uid(), userId, "test_refund", orderId, time),
        ]);
        return json({ order: await one(db, "SELECT * FROM orders WHERE id=?", orderId) });
      }
      return json({ error: "Not found" }, 404);
    } catch (error) {
      return errorResponse(error);
    }
  },
};
