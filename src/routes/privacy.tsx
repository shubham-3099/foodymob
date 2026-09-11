import { createFileRoute } from "@tanstack/react-router";
import { Shell, PageHeading } from "@/components/app/Shell";
import { useStore } from "@/lib/store";
export const Route = createFileRoute("/privacy")({ component: Privacy });
function Privacy() {
  const s = useStore();
  return (
    <Shell>
      <PageHeading>Privacy & advertising</PageHeading>
      <div className="mt-5 max-w-2xl space-y-5">
        <section>
          <h2 className="text-lg font-bold">Local testing accounts</h2>
          <p>Use invented contact details and a test-only password. This local edition stores your
          phone, email, name, hashed password, OTP challenges and sessions in SQLite on your
          computer. Test OTPs are displayed on screen, not sent by SMS. Newsletter subscriptions
          are stored locally and do not send emails. This is not a production privacy policy.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold">Your account and contributions</h2>
          <p>
            Sign-in supplies your account identifier, email and display name. Your profile, saved
            dishes, follows and reviews are stored on the server. Published reviews and approved
            public profiles and reviews are visible to other visitors. You can edit your profile and
            delete your reviews from your profile page.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold">Payments</h2>
          <p>
            This version processes test payments only. It stores order amounts, statuses and test
            premium benefits. It does not collect payment-card details or charge money.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold">Advertising</h2>
          <p>
            Google AdSense is currently {s.ads.enabled ? "enabled subject to consent" : "disabled"}.
            When activated, Google may use cookies and related technologies to deliver and measure
            ads. Ad requests wait for the configured consent platform. Active premium plans hide the
            site’s ad units.
          </p>
          <a
            className="mt-2 inline-block underline"
            href="https://policies.google.com/technologies/ads"
            target="_blank"
            rel="noopener noreferrer"
          >
            How Google uses advertising information
          </a>
        </section>
        <section>
          <h2 className="text-lg font-bold">Images and external links</h2>
          <p>
            Images may load from external providers, including Unsplash. Opening a reviewer’s social
            link takes you to that provider’s website.
          </p>
        </section>
        <p className="rounded-xl bg-muted p-4 text-sm">
          This is a pre-launch site. Before a public launch, the operator must add their identity,
          privacy contact, retention periods and applicable privacy and consent disclosures.
        </p>
      </div>
    </Shell>
  );
}
