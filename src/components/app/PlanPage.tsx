import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Star, type LucideIcon } from "lucide-react";
import { Shell, PageHeading } from "./Shell";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useStore, type Order } from "@/lib/store";
import { request } from "@/lib/api";
export type Plan = {
  icon: LucideIcon;
  title: string;
  description: string;
  original: number;
  price: number;
  period: "month" | "year";
  bestValue?: boolean;
};
export function PlanPage({
  heading,
  subtitle,
  plans,
}: {
  heading: string;
  subtitle: string;
  plans: Plan[];
}) {
  const store = useStore();
  const [open, setOpen] = useState(false),
    [order, setOrder] = useState<Order | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function checkout(plan: Plan) {
    setOpen(true);
    setError("");
    setOrder(null);
    setBusy(true);
    try {
      const kind = "member";
      const result = await request<{ order: Order }>("/api/checkout", "POST", {
        planId: kind + "-" + plan.period,
        idempotencyKey: crypto.randomUUID(),
      });
      setOrder(result.order);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function finish(outcome: string) {
    if (!order) return;
    setBusy(true);
    setError("");
    try {
      const result = await request<{ order: Order }>("/api/checkout/result", "POST", {
        orderId: order.id,
        outcome,
      });
      setOrder(result.order);
      await store.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell>
      <div className="grid h-12 w-12 place-items-center rounded-xl bg-muted">
        <Star />
      </div>
      <div className="mt-4">
        <PageHeading>{heading}</PageHeading>
        <p className="mt-2">{subtitle}</p>
        <p className="mt-3 rounded-lg bg-muted p-3 text-sm">
          Test payments only. No card details, no charges and no automatic renewal. Test benefits
          last 30 days or 365 days.
        </p>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {plans.map((plan) => (
          <section className="panel" key={plan.period}>
            <plan.icon className="h-7 w-7" />
            <h2 className="mt-3 text-lg font-bold">{plan.title}</h2>
            <p className="mt-2 text-sm">{plan.description}</p>
            <div className="mt-5 flex flex-wrap items-baseline gap-2">
              <s className="text-muted-foreground">₹{plan.original.toLocaleString("en-IN")}</s>
              <strong className="text-3xl">₹{plan.price.toLocaleString("en-IN")}</strong>
              <span>/{plan.period}</span>
            </div>
            <p className="mt-2 text-sm">
              Save ₹{(plan.original - plan.price).toLocaleString("en-IN")} (
              {Math.round(((plan.original - plan.price) / plan.original) * 100)}% off)
            </p>
            <button
              className="button mt-5 w-full"
              disabled={busy || !store.user}
              onClick={() => {
                void checkout(plan);
              }}
            >
              Try test checkout
            </button>
            {!store.user && (
              <Link to="/profile" className="mt-2 block text-sm underline">
                Sign in to continue
              </Link>
            )}
          </section>
        ))}
      </div>
      <Link to="/billing" className="mt-5 inline-block underline">
        View payment history
      </Link>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Test checkout</DialogTitle>
            <DialogDescription>
              No money will move. Choose an outcome to test this purchase.
            </DialogDescription>
          </DialogHeader>
          {busy && <p role="status">Processing…</p>}
          {error && (
            <p role="alert" className="text-red-700">
              {error}
            </p>
          )}
          {order && (
            <>
              <p>
                ₹{(order.amount / 100).toLocaleString("en-IN")} · {order.currency}
              </p>
              <p>
                Status: <strong>{order.status}</strong>
              </p>
              {order.status === "pending" ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() => {
                      void finish("succeeded");
                    }}
                  >
                    Simulate success
                  </button>
                  <button
                    className="pill"
                    disabled={busy}
                    onClick={() => {
                      void finish("failed");
                    }}
                  >
                    Simulate failure
                  </button>
                  <button
                    className="pill"
                    disabled={busy}
                    onClick={() => {
                      void finish("cancelled");
                    }}
                  >
                    Cancel checkout
                  </button>
                </div>
              ) : (
                <p>
                  {order.status === "succeeded"
                    ? "Your test premium benefits are now active."
                    : "No premium benefits were activated."}
                </p>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </Shell>
  );
}
