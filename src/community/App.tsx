import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { request } from "@/lib/api";
import { Landing } from "@/components/app/Landing";
import { LocationPicker } from "./LocationPicker";
import { ReviewForm } from "./ReviewForm";
import { Shell, SectionHeading } from "@/components/app/Shell";
import { SearchField } from "@/components/app/SearchField";
import { Img } from "@/components/app/Img";
import { AdBanner } from "@/components/app/AdBanner";
import { CATEGORIES, IMG, AVATARS } from "@/data/seed";
import {
  MapPin,
  ChevronDown,
  SlidersHorizontal,
  Bookmark,
  Navigation,
  Shuffle,
} from "lucide-react";
import {
  distance,
  photoUrl,
  recommendation,
  directionsUrl,
  type Community,
  type Place,
  type Post,
} from "./types";
const money = (n: number) => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
function useCommunity(path: string) {
  const [data, setData] = useState<Community | null>(null),
    [error, setError] = useState("");
  const requestNumber = useRef(0);
  const reload = useCallback(async () => {
    const current = ++requestNumber.current;
    try {
      const next = await request<Community>("/api/community");
      if (current !== requestNumber.current) return;
      setData(next);
      setError("");
    } catch (e) {
      if (current === requestNumber.current) setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void reload();
    return () => {
      requestNumber.current++;
    };
  }, [reload]);
  useEffect(() => {
    if (!path.startsWith("/dishes/")) return;
    const refresh = () => {
      if (document.visibilityState === "visible") void reload();
    };
    refresh();
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [path, reload]);
  return { data, error, reload };
}
export function CommunityApp({ path }: { path: string }) {
  const { data, error, reload } = useCommunity(path);
  const [actionError, setActionError] = useState(""),
    [busy, setBusy] = useState(false);
  const [place, setPlace] = useState<Place | null>(() => {
    try {
      return JSON.parse(localStorage.getItem("dishspot-location-v4") || "null");
    } catch {
      return null;
    }
  });
  function locationChanged(p: Place) {
    setPlace(p);
    localStorage.setItem("dishspot-location-v4", JSON.stringify(p));
  }
  async function act(url: string, method: string, payload?: any) {
    if (url.startsWith("/api/community/saves/") && !data?.premium) {
      location.assign("/plans");
      return false;
    }
    setActionError("");
    setBusy(true);
    try {
      await request(url, method, payload);
      await reload();
      return true;
    } catch (e) {
      setActionError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  if (!data)
    return (
      <main className="community">
        <p role="status">{error || "Loading food discoveries…"}</p>
        {error && <Button onClick={() => void reload()}>Retry</Button>}
      </main>
    );
  if (path === "/" && !data.user) return <Landing />;
  const restricted =
    ["/review", "/outings", "/profile", "/saved", "/admin"].includes(path) && !data.user;
  return (
    <Shell>
      <div className="community v3-community">
        {actionError && (
          <p className="notice-error" role="alert">
            {actionError}
          </p>
        )}
        {restricted ? (
          <section className="empty-state">
            <h1>Log in to continue</h1>
            <a className="button" href="/login">
              Log in
            </a>
            <a href="/signup">Create an account</a>
          </section>
        ) : path === "/review" ? (
          <ReviewForm restaurants={data.restaurants} onDone={reload} />
        ) : path === "/admin" ? (
          data.user?.role === "admin" ? (
            <Admin data={data} act={act} busy={busy} />
          ) : (
            <p>Administrator access required.</p>
          )
        ) : path === "/saved" && !data.premium ? (
          <section>
            <h1>Save your favourite dishes</h1>
            <p>Saved dishes is included with Premium.</p>
            <a className="button" href="/plans">
              View Premium plans
            </a>
          </section>
        ) : path === "/profile" ? (
          <Profile data={data} act={act} busy={busy} />
        ) : path === "/people" ? (
          <People data={data} act={act} busy={busy} />
        ) : ["/", "/explore", "/saved"].includes(path) || path.startsWith("/dishes/") ? (
          <Discover
            data={data}
            place={place}
            setPlace={locationChanged}
            savedOnly={path === "/saved"}
            act={act}
            busy={busy}
          />
        ) : (
          <section className="empty-state">
            <h1>This page has moved</h1>
            <p>Everyone now uses the same community review features.</p>
            <a href="/explore">Discover dishes</a>
          </section>
        )}
      </div>
    </Shell>
  );
}
type Actions = {
  data: Community;
  act: (url: string, method: string, payload?: any) => Promise<boolean>;
  busy: boolean;
};
function PostCard({
  post,
  data,
  act,
  busy,
  editable = false,
}: { post: Post; editable?: boolean } & Actions) {
  const [editing, setEditing] = useState(false),
    [reporting, setReporting] = useState(false),
    [reportReason, setReportReason] = useState("");
  return (
    <article className="review-post">
      <div className="review-byline">
        <a href={"/people?user=" + encodeURIComponent(post.user_id)}>{post.author}</a>
        <span className={"recommendation rec-" + post.recommendation}>
          {recommendation(post.recommendation)}
        </span>
      </div>
      <h3>
        {post.dish_name} · {money(post.price)}
      </h3>
      <p className="muted">
        {post.restaurant_name} · {post.address}
      </p>
      <p className="experience">{post.experience}</p>
      {post.images.length > 0 && (
        <div className="review-images">
          {post.images.map((id, i) => (
            <a href={photoUrl(id)} target="_blank" rel="noreferrer" key={id}>
              <img src={photoUrl(id)} alt={`${post.dish_name}, photo ${i + 1}`} loading="lazy" />
            </a>
          ))}
        </div>
      )}
      {post.vlog_url && (
        <a className="text-link" href={post.vlog_url} target="_blank" rel="noopener noreferrer">
          Watch food vlog ↗
        </a>
      )}
      <p className="fineprint">
        {new Date(post.created_at).toLocaleDateString()} ·{" "}
        {post.status === "pending"
          ? "Waiting for new-restaurant verification (usually 3–4 days)"
          : post.status === "rejected"
            ? "Restaurant request rejected"
            : post.status}
      </p>
      {post.note && post.status !== "published" && <p>{post.note}</p>}
      <div className="control-row">
        {post.status === "published" && (
          <>
            <Button
              variant="outline"
              disabled={busy}
              aria-pressed={data.liked.includes(post.id)}
              onClick={() =>
                void act("/api/community/likes/" + post.id, "PUT", {
                  active: !data.liked.includes(post.id),
                })
              }
            >
              {data.liked.includes(post.id) ? "♥ Liked" : "♡ Like"} · {post.likes || 0}
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              aria-pressed={data.saved.includes(post.id)}
              onClick={() =>
                void act("/api/community/saves/" + post.id, "PUT", {
                  active: !data.saved.includes(post.id),
                })
              }
            >
              {data.saved.includes(post.id) ? "Saved" : "Save dish"}
            </Button>
          </>
        )}
        {post.status === "published" && post.user_id !== data.user?.id && (
          <Button
            variant="ghost"
            disabled={busy || data.reported.includes(post.id)}
            onClick={() => setReporting(!reporting)}
          >
            {data.reported.includes(post.id) ? "Reported" : "Report"}
          </Button>
        )}
        {editable && (
          <>
            <Button
              variant="ghost"
              disabled={
                busy ||
                post.user_id !== data.user?.id ||
                !["pending", "published"].includes(post.status)
              }
              onClick={() => setEditing(!editing)}
            >
              Edit
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                if (confirm("Delete this review?"))
                  void act("/api/community/reviews/" + post.id, "DELETE");
              }}
            >
              Delete
            </Button>
          </>
        )}
      </div>
      {reporting && (
        <form
          className="community-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await act("/api/community/reports/" + post.id, "POST", { reason: reportReason })) {
              setReporting(false);
              setReportReason("");
            }
          }}
        >
          <label>
            Why are you reporting this review?
            <Textarea
              required
              minLength={3}
              maxLength={500}
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
            />
          </label>
          <p className="fineprint">Three distinct reports send a review to admin for a decision.</p>
          <div className="control-row">
            <Button disabled={busy}>Send report</Button>
            <Button type="button" variant="ghost" onClick={() => setReporting(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
      {editing && (
        <form
          className="community-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const d = Object.fromEntries(new FormData(e.currentTarget));
            if (
              await act("/api/community/reviews/" + post.id, "PUT", {
                ...d,
                price: Number(d["price"]),
                recommendation: Number(d["recommendation"]),
              })
            )
              setEditing(false);
          }}
        >
          <label>
            Experience
            <Textarea
              required
              name="experience"
              minLength={10}
              maxLength={4000}
              defaultValue={post.experience}
            />
          </label>
          <label>
            Price paid (₹)
            <Input
              type="number"
              min="0"
              step="0.01"
              name="price"
              defaultValue={post.price}
              required
            />
          </label>
          <label>
            Recommendation
            <select name="recommendation" defaultValue={post.recommendation}>
              {[1, 2, 3].map((n) => (
                <option value={n} key={n}>
                  {recommendation(n)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Vlog link
            <Input type="url" name="vlogUrl" defaultValue={post.vlog_url} />
          </label>
          <Button disabled={busy}>Save changes</Button>
        </form>
      )}
    </article>
  );
}
function ReviewGroups({
  posts,
  editable = false,
  ...props
}: { posts: Post[]; editable?: boolean } & Actions) {
  return (
    <>
      {[
        { title: "Vlog reviews", items: posts.filter((p) => !!p.vlog_url) },
        { title: "Text reviews", items: posts.filter((p) => !p.vlog_url) },
      ].map((group) => (
        <section key={group.title}>
          <h2>{group.title}</h2>
          {group.items.length ? (
            group.items.map((post) => (
              <PostCard key={post.id} post={post} {...props} editable={editable} />
            ))
          ) : (
            <p className="muted">No {group.title.toLowerCase()} yet.</p>
          )}
        </section>
      ))}
    </>
  );
}
function Discover({
  data,
  act,
  busy,
  place,
  setPlace,
  savedOnly,
}: { place: Place | null; setPlace: (p: Place) => void; savedOnly: boolean } & Actions) {
  const params = new URLSearchParams(location.search);
  const [query, setQuery] = useState(params.get("q") || ""),
    [category, setCategory] = useState(""),
    [sort, setSort] = useState("recommended"),
    [radius, setRadius] = useState(""),
    [rating, setRating] = useState(""),
    [locationOpen, setLocationOpen] = useState(false),
    [filtersOpen, setFiltersOpen] = useState(false),
    [surpriseOpen, setSurpriseOpen] = useState(false),
    [surpriseKey, setSurpriseKey] = useState("");
  const detailId = location.pathname.startsWith("/dishes/")
    ? decodeURIComponent(location.pathname.split("/")[2] || "")
    : null;
  const groups = useMemo(() => {
    const map = new Map<string, Post[]>();
    for (const post of data.reviews) {
      const key = post.restaurant_id + "|" + post.dish_key;
      map.set(key, [...(map.get(key) || []), post]);
    }
    return [...map.values()].map((posts) => ({
      post: posts[0]!,
      posts,
      score: posts.reduce((n, r) => n + r.recommendation, 0) / posts.length,
      distance: distance(place, posts[0]!),
    }));
  }, [data.reviews, place]);
  const detail = detailId ? groups.find((g) => g.posts.some((p) => p.id === detailId)) : null;
  const nearby = detail
    ? groups
        .filter((g) => g !== detail)
        .map((g) => ({
          ...g,
          distance: distance(
            { label: detail.post.address, lat: detail.post.lat, lng: detail.post.lng },
            g.post,
          ),
        }))
        .filter((g): g is typeof g & { distance: number } => g.distance !== null && g.distance <= 5)
        .sort((a, b) => a.distance - b.distance || b.score - a.score)
        .slice(0, 4)
    : [];
  if (detailId)
    return (
      <section>
        <a href="/explore" className="text-sm underline">
          ← Back to dishes
        </a>
        {detail ? (
          <>
            <div className="dish-gallery">
              {detail.posts
                .flatMap((p) => p.images)
                .slice(0, 4)
                .map((id, i) => (
                  <img key={id + i} src={photoUrl(id)} alt={detail.post.dish_name} />
                ))}
            </div>
            <h1 className="mt-5">{detail.post.dish_name}</h1>
            <p>
              {detail.post.restaurant_name} · {money(detail.post.price)}
            </p>
            <p className="muted">{detail.post.address}</p>
            <p className="muted">
              {detail.distance === null
                ? "Distance unavailable"
                : detail.distance.toFixed(1) + " km away"}{" "}
              <Directions post={detail.post} />
            </p>
            <h2>Reviews</h2>
            <p className="muted text-sm">
              {detail.posts.length} {detail.posts.length === 1 ? "review" : "reviews"} · Updates
              every 30 seconds
            </p>
            {[3, 2, 1].map((n) => {
              const count = detail.posts.filter((p) => p.recommendation === n).length;
              return (
                <div className="rating-row" key={n}>
                  <strong>
                    {count} {recommendation(n)}
                  </strong>
                  <div
                    role="meter"
                    aria-label={recommendation(n)}
                    aria-valuemin={0}
                    aria-valuemax={detail.posts.length}
                    aria-valuenow={count}
                    aria-valuetext={`${count} of ${detail.posts.length} reviews`}
                  >
                    <span style={{ width: (count / detail.posts.length) * 100 + "%" }} />
                  </div>
                </div>
              );
            })}
            <ReviewGroups posts={detail.posts} data={data} act={act} busy={busy} />
            <a className="button my-4" href={"/review?restaurant=" + detail.post.restaurant_id}>
              Write a review
            </a>
            <div className="mt-6">
              <SectionHeading>Also try these</SectionHeading>
              <p className="muted text-sm mt-1">
                Reviewed dishes within 5 km of this restaurant. Distances are from this restaurant.
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {nearby.map((g) => (
                  <DishTile
                    key={g.post.id}
                    posts={g.posts}
                    km={g.distance}
                    data={data}
                    act={act}
                    busy={busy}
                  />
                ))}
              </div>
              {!nearby.length && (
                <p className="muted mt-3">
                  {detail.post.lat === null || detail.post.lng === null
                    ? "This restaurant needs a map location before we can find nearby dishes."
                    : "No other reviewed dishes within 5 km yet."}
                </p>
              )}
            </div>
          </>
        ) : (
          <p>This dish is no longer available.</p>
        )}
      </section>
    );
  const eligible = groups.filter(
    (g) =>
      (!savedOnly || g.posts.some((p) => data.saved.includes(p.id))) &&
      (!place ||
        place.lat !== null ||
        g.post.address.toLowerCase().includes(place.label.trim().toLowerCase())) &&
      (!radius || (g.distance !== null && g.distance <= Number(radius))) &&
      (!rating || g.score >= Number(rating)),
  );
  const surpriseChoices = [...new Map(eligible.map((g) => [g.post.dish_key, g])).values()];
  const surprise = surpriseChoices.find((g) => g.post.dish_key === surpriseKey);
  function surpriseMe() {
    const choices = surpriseChoices.filter((g) => g.post.dish_key !== surpriseKey);
    const pool = choices.length ? choices : surpriseChoices;
    setSurpriseKey(pool.length ? pool[Math.floor(Math.random() * pool.length)]!.post.dish_key : "");
    setSurpriseOpen(true);
  }
  const results = eligible
    .filter((g) => {
      const p = g.post;
      return (
        (!query ||
          (p.dish_name + " " + p.restaurant_name + " " + p.category)
            .toLowerCase()
            .includes(query.toLowerCase())) &&
        (!category || p.category.toLowerCase() === category.toLowerCase())
      );
    })
    .sort((a, b) =>
      sort === "distance" ? (a.distance ?? Infinity) - (b.distance ?? Infinity) : b.score - a.score,
    );
  return (
    <section>
      <button
        type="button"
        onClick={() => setLocationOpen(!locationOpen)}
        aria-expanded={locationOpen}
        className="flex max-w-full items-center gap-2 py-1 text-left text-[15px] font-semibold"
      >
        <MapPin className="h-[18px] w-[18px] shrink-0" />
        <span className="truncate">{place?.label || "Choose your location"}</span>
        <ChevronDown className="h-4 w-4 shrink-0" />
      </button>
      {locationOpen && (
        <div className="rounded-2xl border border-border p-3 mt-3">
          <LocationPicker
            value={place}
            onChange={(p) => {
              setPlace(p);
              setLocationOpen(false);
              if (p.lat === null) {
                setRadius("");
                setSort("recommended");
              }
            }}
          />
        </div>
      )}
      <div className="mt-4 home-search">
        <SearchField
          value={query}
          onChange={setQuery}
          label="Search dishes and restaurants"
          placeholder="Search dishes, cuisines, restaurants..."
        />
      </div>
      {!savedOnly && (
        <div className="mt-6">
          <SectionHeading>Popular Categories</SectionHeading>
          <ul className="mt-3 flex gap-4 overflow-x-auto pb-1">
            <li>
              <button
                type="button"
                onClick={surpriseMe}
                aria-expanded={surpriseOpen}
                aria-controls="surprise-dish"
                className="category-tile flex w-[72px] flex-col items-center gap-2"
              >
                <span className="h-10 w-10 rounded-full bg-background grid place-items-center">
                  <Shuffle className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="text-[12px] font-semibold whitespace-nowrap">Surprise me</span>
              </button>
            </li>
            {CATEGORIES.map((c) => (
              <li key={c.name}>
                <button
                  type="button"
                  aria-pressed={category === c.name}
                  onClick={() => setCategory(category === c.name ? "" : c.name)}
                  className="category-tile flex w-[72px] flex-col items-center gap-2"
                >
                  <Img
                    src={c.image}
                    alt={c.name}
                    className={
                      "h-10 w-10 rounded-full object-cover " +
                      (category === c.name ? "ring-2 ring-foreground ring-offset-2" : "")
                    }
                  />
                  <span className="text-[12px] font-semibold">{c.name}</span>
                </button>
              </li>
            ))}
          </ul>
          {surpriseOpen && (
            <div id="surprise-dish" className="mt-4 rounded-2xl bg-muted p-4">
              <div role="status" aria-live="polite" aria-atomic="true">
                {surprise ? (
                  <>
                    <p className="text-sm text-muted-foreground">How about…</p>
                    <h2 className="mt-1">{surprise.post.dish_name}</h2>
                    <p className="text-sm">Find reviewed places serving this dish.</p>
                  </>
                ) : (
                  <p>
                    No suggestions match your location and filters. Try a wider distance or another
                    rating.
                  </p>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {surprise && (
                  <Button
                    onClick={() => {
                      setQuery(surprise.post.dish_name);
                      setCategory("");
                      setSurpriseOpen(false);
                    }}
                  >
                    Search this dish
                  </Button>
                )}
                <Button
                  variant="outline"
                  disabled={surpriseChoices.length < 2}
                  onClick={surpriseMe}
                >
                  Surprise again
                </Button>
                <Button variant="ghost" onClick={() => setSurpriseOpen(false)}>
                  Close
                </Button>
              </div>
              {surpriseChoices.length === 1 && (
                <p className="text-xs text-muted-foreground mt-2">
                  This is the only dish matching your current location and filters.
                </p>
              )}
            </div>
          )}
        </div>
      )}
      <div className="mt-7 flex items-center justify-between gap-3">
        <SectionHeading>{savedOnly ? "Saved dishes" : "Best places in your city"}</SectionHeading>
        <button
          type="button"
          onClick={() => setFiltersOpen(!filtersOpen)}
          aria-expanded={filtersOpen}
          className="flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1.5 text-sm font-semibold"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filter{radius || rating || sort === "distance" ? " •" : ""}
        </button>
      </div>
      {filtersOpen && (
        <div className="rounded-2xl bg-muted p-4 mt-3 grid gap-3 sm:grid-cols-2">
          <label>
            Distance
            <select
              value={radius}
              disabled={place?.lat == null}
              onChange={(e) => setRadius(e.target.value)}
            >
              <option value="">Any distance</option>
              {[1, 3, 5, 10, 25].map((n) => (
                <option key={n} value={n}>
                  Within {n} km
                </option>
              ))}
            </select>
          </label>
          <label>
            Rating
            <select value={rating} onChange={(e) => setRating(e.target.value)}>
              <option value="">All reviews</option>
              <option value="2">Should try or better</option>
              <option value="3">Must try</option>
            </select>
          </label>
          <label>
            Sort
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="recommended">Recommended</option>
              <option value="distance" disabled={place?.lat == null}>
                Nearest first
              </option>
            </select>
          </label>
          <Button
            variant="ghost"
            onClick={() => {
              setRadius("");
              setRating("");
              setSort("recommended");
              setCategory("");
            }}
          >
            Reset filters
          </Button>
          {place?.lat == null && (
            <p className="text-sm sm:col-span-2">Select a location pin to filter by distance.</p>
          )}
        </div>
      )}
      {!results.length && (
        <div className="mt-4 rounded-2xl bg-muted p-5 text-sm">
          <p>No reviewed dishes found here.</p>
          <a className="underline" href="/review">
            Know a place? Add its first review
          </a>
          <p className="text-muted-foreground">
            New restaurants need admin verification, usually 3–4 days.
          </p>
        </div>
      )}
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {results.slice(0, savedOnly ? results.length : 2).map((g) => (
          <DishTile
            key={g.post.id}
            posts={g.posts}
            km={g.distance}
            data={data}
            act={act}
            busy={busy}
          />
        ))}
      </div>
      {!savedOnly && results.length > 0 && (
        <div className="my-6">
          <AdBanner />
        </div>
      )}
      {!savedOnly && results.length > 2 && (
        <>
          <div className="mt-7">
            <SectionHeading>Other options to try</SectionHeading>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {results.slice(2).map((g) => (
              <DishTile
                key={g.post.id}
                posts={g.posts}
                km={g.distance}
                data={data}
                act={act}
                busy={busy}
              />
            ))}
          </div>
        </>
      )}
      {results.some((g) => g.post.id.startsWith("sample-")) && (
        <p className="fineprint">Sample dishes and prices for testing.</p>
      )}

      <div className="mt-6">
        <a className="button" href="/review">
          Write a review
        </a>
      </div>
    </section>
  );
}
function Directions({ post }: { post: Post }) {
  return (
    <a
      className="directions-link"
      href={directionsUrl(post)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={"Google Maps directions to " + post.restaurant_name}
      title="Get directions"
    >
      <Navigation className="h-4 w-4" aria-hidden="true" />
    </a>
  );
}
function DishTile({ posts, km, data, act, busy }: { posts: Post[]; km: number | null } & Actions) {
  const p = posts[0]!,
    photo = posts.find((p) => p.images.length)?.images[0],
    saved = posts.some((p) => data.saved.includes(p.id));
  return (
    <article className="relative flex items-center gap-3 rounded-2xl bg-muted p-3">
      <a href={"/dishes/" + p.id} className="flex min-w-0 flex-1 items-center gap-3">
        <div className="h-[70px] w-[70px] shrink-0 rounded-xl overflow-hidden bg-background">
          {photo ? (
            <Img src={photoUrl(photo)} alt={p.dish_name} className="h-full w-full object-cover" />
          ) : (
            <span className="grid h-full place-items-center text-xs text-muted-foreground">
              No photo
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-bold">{p.dish_name}</div>
          <div className="truncate text-[13px] text-muted-foreground">{p.restaurant_name}</div>
          <div className="mt-1 text-[13px] font-semibold">{money(p.price)}</div>
        </div>
        <div className="shrink-0 pr-7 text-right">
          <div className="text-xs font-semibold">
            {posts.filter((r) => r.recommendation === 3).length} Must Try
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {km === null ? "—" : km.toFixed(1) + " km"}
          </div>
        </div>
      </a>
      <span className="card-directions">
        <Directions post={p} />
      </span>
      <button
        type="button"
        disabled={busy}
        aria-label={saved ? "Unsave dish" : "Save dish"}
        aria-pressed={saved}
        className="absolute right-2 top-2 grid h-9 w-9 place-items-center"
        onClick={() => {
          const ids = saved
            ? posts.filter((p) => data.saved.includes(p.id)).map((p) => p.id)
            : [p.id];
          void (async () => {
            for (const id of ids)
              await act("/api/community/saves/" + id, "PUT", { active: !saved });
          })();
        }}
      >
        <Bookmark className="h-[18px] w-[18px]" fill={saved ? "currentColor" : "none"} />
      </button>
    </article>
  );
}
type ProfileSection = "reviews" | "following" | "followers" | null;
function ProfileHeader({
  name,
  bio,
  id,
  banner,
  reviewCount,
  followingCount,
  followerCount,
  selected,
  onSelect,
  action,
  bannerAction,
}: {
  name: string;
  bio: string;
  id: string;
  banner?: string | null;
  reviewCount: number;
  followingCount: number;
  followerCount: number;
  selected: ProfileSection;
  onSelect: (s: ProfileSection) => void;
  action: React.ReactNode;
  bannerAction?: React.ReactNode;
}) {
  const avatar =
    id === "sample-anna"
      ? AVATARS.anna
      : id === "sample-ajay"
        ? AVATARS.ajay
        : id === "sample-meera"
          ? AVATARS.meera
          : null;
  return (
    <>
      <div className="profile-cover">
        <Img
          src={banner ? photoUrl(banner) : IMG.cover}
          alt={`${name}'s profile banner`}
          className="h-full w-full object-cover"
        />
        {bannerAction}
      </div>
      <div className="profile-topline">
        <div className="profile-avatar">
          {avatar ? (
            <Img src={avatar} alt={name} className="h-full w-full object-cover" />
          ) : (
            name
              .split(" ")
              .map((n) => n[0])
              .slice(0, 2)
              .join("")
          )}
        </div>
        {action}
      </div>
      <div className="profile-overview">
        <div>
          <h1>{name}</h1>
          <p className="profile-handle">
            @{name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_{id.slice(-4)}
          </p>
          <p>{bio || "Food explorer"}</p>
        </div>
      </div>
      <div className="profile-counters" aria-label="Profile sections">
        {(
          [
            { key: "following", label: "Following", count: followingCount },
            { key: "followers", label: "Followers", count: followerCount },
            { key: "reviews", label: "Reviews", count: reviewCount },
          ] as const
        ).map((item) => (
          <button
            type="button"
            key={item.key}
            aria-pressed={selected === item.key}
            onClick={() => onSelect(selected === item.key ? null : item.key)}
          >
            <strong>{item.count}</strong>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </>
  );
}
function ProfileContent({
  id,
  selected,
  posts,
  editable = false,
  ...props
}: { id: string; selected: ProfileSection; posts: Post[]; editable?: boolean } & Actions) {
  const [people, setPeople] = useState<{ id: string; name: string; bio: string }[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setPeople([]);
    setError("");
    if (!selected || selected === "reviews") return;
    setLoading(true);
    void request<{ people: { id: string; name: string; bio: string }[] }>(
      "/api/community/people/" + encodeURIComponent(id) + "/connections?kind=" + selected,
    )
      .then((r) => {
        if (active) setPeople(r.people);
      })
      .catch((e) => {
        if (active) setError((e as Error).message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, selected, props.data]);
  if (!selected) return null;
  if (selected === "reviews")
    return (
      <section className="profile-content">
        <h2>Reviewed places</h2>
        {posts.map((post) => (
          <PostCard key={post.id} post={post} {...props} editable={editable} />
        ))}
        {!posts.length && <p>No reviews yet.</p>}
      </section>
    );
  return (
    <section className="profile-content">
      <h2>{selected === "following" ? "Following" : "Followers"}</h2>
      {loading ? (
        <p role="status">Loading…</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : people.length ? (
        people.map((person) => (
          <div key={person.id} className="friend-row">
            <a href={"/people?user=" + person.id}>{person.name}</a>
            <Follow id={person.id} {...props} />
          </div>
        ))
      ) : (
        <p>{selected === "following" ? "Not following anyone yet." : "No followers yet."}</p>
      )}
    </section>
  );
}
function People({ data, act, busy }: Actions) {
  const [q, setQ] = useState(""),
    [selected, setSelected] = useState<ProfileSection>(null);
  const id = new URLSearchParams(location.search).get("user"),
    person = data.people.find((p) => p.id === id);
  if (person)
    return (
      <section className="photo-profile">
        <ProfileHeader
          id={person.id}
          name={person.name}
          bio={person.bio}
          banner={person.banner_id ?? null}
          reviewCount={person.review_count}
          followingCount={person.following_count}
          followerCount={person.followers}
          selected={selected}
          onSelect={setSelected}
          action={<Follow id={person.id} data={data} act={act} busy={busy} />}
        />
        <ProfileContent
          id={person.id}
          selected={selected}
          posts={data.reviews.filter((p) => p.user_id === person.id)}
          data={data}
          act={act}
          busy={busy}
        />
      </section>
    );
  return (
    <section>
      <h1>Friends</h1>
      <SearchField
        value={q}
        onChange={setQ}
        placeholder="Find your friends"
        label="Find your friends"
      />
      <div className="people-grid">
        {data.people
          .filter((p) => p.name.toLowerCase().includes(q.toLowerCase()))
          .map((p) => (
            <article key={p.id}>
              <h2>
                <a href={"/people?user=" + p.id}>{p.name}</a>
              </h2>
              <Follow id={p.id} data={data} act={act} busy={busy} />
            </article>
          ))}
      </div>
      {!data.people.length && <p>No friends found yet. Invite someone to join.</p>}
    </section>
  );
}
function Follow({ id, data, act, busy }: { id: string } & Actions) {
  return id === data.user?.id ? null : (
    <Button
      variant="outline"
      disabled={busy}
      onClick={() =>
        void act("/api/community/follows/" + id, "PUT", { active: !data.following.includes(id) })
      }
    >
      {data.following.includes(id) ? "Following · Unfollow" : "Follow"}
    </Button>
  );
}
function Profile({ data, act, busy }: Actions) {
  const [edit, setEdit] = useState(false),
    [selected, setSelected] = useState<ProfileSection>(null),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState("");
  const user = data.user!;
  async function banner(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      if (file.size > 3 * 1024 * 1024) throw new Error("Choose a banner smaller than 3 MB.");
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/community/images", {
        method: "POST",
        headers: { "X-Requested-With": "DishDiscovery" },
        body: form,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Upload failed.");
      await act("/api/community/profile/banner", "PUT", { imageId: result.id });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }
  return (
    <section className="photo-profile">
      <ProfileHeader
        id={user.id}
        name={user.name}
        bio={user.bio || (data.premium ? "Premium food explorer" : "Food explorer")}
        banner={user.banner_id ?? null}
        reviewCount={data.mine.length}
        followingCount={data.following.length}
        followerCount={data.followers.length}
        selected={selected}
        onSelect={(s) => {
          setSelected(s);
          setEdit(false);
        }}
        action={
          <Button
            variant="outline"
            onClick={() => {
              setEdit(!edit);
              setSelected(null);
            }}
          >
            Edit profile
          </Button>
        }
        bannerAction={
          <label className="banner-upload">
            {uploading ? "Uploading…" : "Change banner"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy || uploading}
              className="sr-only"
              onChange={(e) => {
                void banner(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
        }
      />
      {error && (
        <p role="alert" className="notice-error">
          {error}
        </p>
      )}
      {edit && (
        <>
          <form
            className="community-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const d = Object.fromEntries(new FormData(e.currentTarget));
              if (await act("/api/profile", "PUT", { ...d, location: user.location || "Not set" }))
                setEdit(false);
            }}
          >
            <label>
              Name
              <Input name="name" defaultValue={user.name} required maxLength={100} />
            </label>
            <label>
              Bio
              <Textarea name="bio" defaultValue={user.bio} maxLength={300} />
            </label>
            <Button disabled={busy}>Save profile</Button>
          </form>
          <div className="control-row">
            {user.banner_id && (
              <Button
                variant="outline"
                disabled={busy || uploading}
                onClick={() => void act("/api/community/profile/banner", "PUT", { imageId: null })}
              >
                Reset banner
              </Button>
            )}
            <a href={data.premium ? "/saved" : "/plans"}>
              {data.premium ? "Saved dishes" : "Premium"}
            </a>
            <a href="/billing">Payment history</a>
            {user.role === "admin" && <a href="/admin">Administration</a>}
            <Button
              variant="ghost"
              onClick={async () => {
                if (await act("/api/auth/logout", "POST", {})) location.assign("/login");
              }}
            >
              Log out
            </Button>
          </div>
        </>
      )}
      <ProfileContent
        id={user.id}
        selected={selected}
        posts={data.mine}
        data={data}
        act={act}
        busy={busy}
        editable
      />
    </section>
  );
}
function Admin({ data, act, busy }: Actions) {
  const [queue, setQueue] = useState<any>(null),
    [reported, setReported] = useState<any>(null),
    [error, setError] = useState("");
  async function load() {
    try {
      const [pending, flags] = await Promise.all([
        request("/api/community/admin"),
        request("/api/community/admin/reports"),
      ]);
      setQueue(pending);
      setReported(flags);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, [data]);
  return (
    <section>
      <h1>New restaurant verification</h1>
      <p>
        Check the first review, name, address and map pin. Users are told verification usually takes
        3–4 days.
      </p>
      {error && <p className="notice-error">{error}</p>}
      {!queue && <p>Loading requests…</p>}
      {queue?.requests.length === 0 && (
        <p className="empty-state">No pending restaurant requests.</p>
      )}
      {queue?.requests.map((r: any) => (
        <article className="admin-request" key={r.id}>
          <h2>{r.name}</h2>
          <p>{r.address}</p>
          <p>
            {r.requester} · {r.review_count} pending reviews · Submitted{" "}
            {new Date(r.created_at).toLocaleDateString()}
          </p>
          <a
            href={
              "https://www.google.com/maps/search/?api=1&query=" +
              encodeURIComponent(r.lat != null ? `${r.lat},${r.lng}` : `${r.name} ${r.address}`)
            }
            target="_blank"
            rel="noreferrer"
          >
            Check map location ↗
          </a>
          <form
            className="community-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const d = Object.fromEntries(new FormData(e.currentTarget));
              const button = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement;
              const decision = button.value;
              if (
                await act("/api/community/admin/verify", "POST", {
                  id: r.id,
                  decision,
                  note: d["note"],
                  lat: d["lat"] === "" ? null : Number(d["lat"]),
                  lng: d["lng"] === "" ? null : Number(d["lng"]),
                })
              )
                await load();
            }}
          >
            <div className="two-columns">
              <label>
                Verified latitude
                <Input
                  name="lat"
                  type="number"
                  step="any"
                  min="-90"
                  max="90"
                  defaultValue={r.lat ?? ""}
                />
              </label>
              <label>
                Verified longitude
                <Input
                  name="lng"
                  type="number"
                  step="any"
                  min="-180"
                  max="180"
                  defaultValue={r.lng ?? ""}
                />
              </label>
            </div>
            <label>
              Note / rejection reason
              <Textarea name="note" maxLength={500} />
            </label>
            <div className="control-row">
              <Button value="approved" disabled={busy}>
                Approve restaurant & first reviews
              </Button>
              <Button variant="outline" value="rejected" disabled={busy}>
                Reject
              </Button>
            </div>
          </form>
          <details>
            <summary>Inspect submitted reviews and photos</summary>
            {queue.reviews
              .filter((p: Post) => p.restaurant_id === r.id && p.status === "pending")
              .map((p: Post) => (
                <PostCard key={p.id} post={p} data={data} act={act} busy={busy} editable />
              ))}
          </details>
        </article>
      ))}
      <h2>Reported reviews</h2>
      <p>Reviews reported by at least three distinct people. They stay visible until you decide.</p>
      {reported?.reviews.length === 0 && <p>No reviews waiting for moderation.</p>}
      {reported?.reviews.map((p: Post & { reports: { reason: string; created_at: number }[] }) => (
        <article key={p.id} className="admin-request">
          <strong>{p.reports.length} reports</strong>
          <PostCard post={p} data={data} act={act} busy={busy} />
          <ul>
            {p.reports.map((r, i) => (
              <li key={i}>{r.reason}</li>
            ))}
          </ul>
          <div className="control-row">
            <Button
              disabled={busy}
              onClick={() => {
                if (confirm("Delete this reported review?"))
                  void act("/api/community/admin/reports", "POST", {
                    reviewId: p.id,
                    decision: "delete",
                  });
              }}
            >
              Delete review
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                void act("/api/community/admin/reports", "POST", {
                  reviewId: p.id,
                  decision: "keep",
                })
              }
            >
              Keep review / dismiss reports
            </Button>
          </div>
        </article>
      ))}
    </section>
  );
}
