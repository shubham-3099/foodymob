import { createFileRoute, Link } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { Shell, PageHeading } from "@/components/app/Shell";
export const Route = createFileRoute("/billing")({ component: Billing });
function Billing() {
  const s = useStore();
  return (
    <Shell>
      <PageHeading>Payments & premium</PageHeading>
      <p className="mt-2">All payments are tests. No money has been charged.</p>
      {!s.user ? (
        <Link className="button mt-4" to="/profile">
          Sign in
        </Link>
      ) : (
        <>
          <h2 className="mt-6 text-lg font-bold">Active test benefits</h2>
          {s.entitlements.map((e) => (
            <div className="panel mt-3" key={e.order_id}>
              <strong>{e.kind === "member" ? "User premium" : "Vlogger premium"}</strong>
              <p>
                Valid until {new Date(e.expires_at).toLocaleDateString()}. Does not renew
                automatically.
              </p>
            </div>
          ))}
          {!s.entitlements.length && <p className="mt-2">No active premium plan.</p>}
          <h2 className="mt-6 text-lg font-bold">Payment history</h2>
          <div className="mt-3 space-y-3">
            {s.orders.map((o) => (
              <div className="panel flex flex-wrap justify-between gap-4" key={o.id}>
                <div>
                  <strong>{o.plan_id.replaceAll("-", " ")}</strong>
                  <p className="text-sm">{new Date(o.created_at).toLocaleString()}</p>
                  <p className="mt-1 break-all text-xs">Reference: {o.id}</p>
                </div>
                <div>
                  <strong>₹{(o.amount / 100).toLocaleString("en-IN")}</strong>
                  <p>{o.status}</p>
                </div>
              </div>
            ))}
            {!s.orders.length && <p>No payment history yet.</p>}
          </div>
        </>
      )}
    </Shell>
  );
}
