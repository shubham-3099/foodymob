export type Place = { label: string; lat: number | null; lng: number | null };
export type Restaurant = {
  id: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  status: string;
  note: string;
  created_at: number;
};
export type Post = {
  id: string;
  restaurant_id: string;
  user_id: string;
  dish_name: string;
  dish_key: string;
  price: number;
  category: string;
  experience: string;
  recommendation: number;
  vlog_url: string;
  images: string[];
  status: string;
  created_at: number;
  restaurant_name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  author: string;
  likes: number;
  note?: string;
};
export type Person = {
  id: string;
  name: string;
  bio: string;
  banner_id?: string | null;
  followers: number;
  following_count: number;
  review_count: number;
};
export type Outing = { id: string; name: string; stops: string[]; revision: number };
export type Community = {
  premium: boolean;
  user: {
    id: string;
    name: string;
    role: string;
    bio: string;
    location: string;
    banner_id?: string | null;
  } | null;
  reviews: Post[];
  restaurants: Restaurant[];
  people: Person[];
  following: string[];
  followers: string[];
  reported: string[];
  liked: string[];
  saved: string[];
  mine: Post[];
  outings: Outing[];
};
export const recommendation = (n: number) =>
  n === 3 ? "Must try" : n === 2 ? "Should try" : "Avoid";
export const photoUrl = (id: string) =>
  id.startsWith("https://") ? id : "/api/community/images/" + encodeURIComponent(id);
export function distance(
  a: Place | null,
  b: { lat: number | null; lng: number | null },
): number | null {
  if (a?.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  const rad = Math.PI / 180,
    x =
      Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
      Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 12742 * Math.atan2(Math.sqrt(Math.min(1, x)), Math.sqrt(Math.max(0, 1 - x)));
}

export function directionsUrl(p: {
  lat: number | null;
  lng: number | null;
  restaurant_name: string;
  address: string;
}) {
  const destination =
    p.lat != null && p.lng != null ? `${p.lat},${p.lng}` : `${p.restaurant_name}, ${p.address}`;
  return "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(destination);
}
