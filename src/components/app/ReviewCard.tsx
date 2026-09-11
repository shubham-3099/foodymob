import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import type { Review } from "@/data/seed";

export function ReviewCard({ review }: { review: Review }) {
  return (
    <article className="rounded-2xl bg-muted p-4">
      <div className="flex flex-wrap items-center gap-2">
        {review.vloggerId ? (
          <Link
            to="/vloggers/$id"
            params={{ id: review.vloggerId }}
            className="text-[15px] font-bold text-foreground underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-foreground"
          >
            {review.author}
          </Link>
        ) : (
          <span className="text-[15px] font-bold text-foreground">{review.author}</span>
        )}
        <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-bold uppercase text-foreground">
          {review.recommendation}
        </span>
      </div>
      <p className="mt-2 text-[14px] leading-relaxed text-foreground">{review.text}</p>
      {review.links && (
        <div className="mt-3">
          <p className="text-[13px] font-semibold text-foreground">Watch my review on:</p>
          <div className="mt-1 flex gap-4">
            {review.links.map((l) => (
              <button
                key={l.platform}
                type="button"
                onClick={() =>
                  toast("Demo link", {
                    description: `${l.platform} review links are not available in this demo.`,
                  })
                }
                className="text-[13px] underline focus-visible:outline-2 focus-visible:outline-foreground"
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
