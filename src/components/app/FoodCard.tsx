import { Link } from "@tanstack/react-router";
import { Bookmark } from "lucide-react";
import type { Dish } from "@/data/seed";
import { useStore } from "@/lib/store";
import { Img } from "./Img";

export function FoodCard({ dish }: { dish: Dish }) {
  const { isSaved, toggleSaved, reviews } = useStore();
  const saved = isSaved(dish.id);
  const mustTry = dish.reviews.filter((r) => r.recommendation === "MUST TRY").length;

  return (
    <div className="relative flex items-center gap-3 rounded-2xl bg-muted p-3">
      <Link
        to="/dishes/$id"
        params={{ id: dish.id }}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
      >
        <Img
          src={dish.image}
          alt={dish.name}
          className="h-[70px] w-[70px] shrink-0 rounded-xl object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold text-foreground">{dish.name}</p>
          <p className="truncate text-[13px] text-muted-foreground">{dish.restaurant}</p>
          <p className="mt-1 text-[13px] font-semibold text-foreground">₹{dish.price}</p>
        </div>
        <div className="shrink-0 pr-8 text-right">
          <p className="text-[12px] font-semibold text-foreground">{mustTry} Must Try</p>
          <p className="mt-1 text-[12px] text-muted-foreground">{dish.distanceKm} km</p>
        </div>
      </Link>
      <button
        type="button"
        onClick={() => {
          void toggleSaved(dish.id).catch(() => {});
        }}
        aria-pressed={saved}
        aria-label={saved ? `Remove ${dish.name} from saved` : `Save ${dish.name}`}
        className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-foreground"
      >
        <Bookmark
          className="h-[18px] w-[18px] text-foreground"
          strokeWidth={1.8}
          fill={saved ? "currentColor" : "none"}
          aria-hidden="true"
        />
      </button>
    </div>
  );
}
