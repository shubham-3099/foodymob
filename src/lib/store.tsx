import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { toast } from "sonner";
import type { Dish, Vlogger, Review, Recommendation } from "@/data/seed";
import { request } from "./api";
export type LocalReview = Review & { dishId: string; createdAt: number; status: string };
type User = {
  id: string;
  email: string;
  name: string;
  bio: string;
  role: string;
  location: string;
};
export type Order = {
  id: string;
  plan_id: string;
  amount: number;
  currency: string;
  status: string;
  created_at: number;
  mode: string;
};
export type Entitlement = { order_id: string; kind: string; expires_at: number; mode: string };
type Ads = {
  enabled: boolean;
  publisherId: string;
  homeSlot: string;
  profileSlot: string;
  vloggerSlot: string;
  consentConfigured: boolean;
};
type State = {
  user: User | null;
  dishes: Dish[];
  vloggers: Vlogger[];
  saved: string[];
  following: string[];
  reviews: LocalReview[];
  orders: Order[];
  entitlements: Entitlement[];
  creator: any;
  ads: Ads;
  mode: string;
};
type Store = State & {
  profile: { name: string; bio: string };
  location: string;
  hydrated: boolean;
  busy: boolean;
  error: string;
  refresh: () => Promise<void>;
  isSaved: (id: string) => boolean;
  isFollowing: (id: string) => boolean;
  toggleSaved: (id: string) => Promise<void>;
  toggleFollow: (id: string) => Promise<void>;
  setProfile: (p: { name: string; bio: string }) => Promise<void>;
  setLocation: (l: string) => Promise<void>;
  addReview: (dishId: string, text: string, recommendation: Recommendation) => Promise<void>;
  deleteReview: (id: string) => Promise<void>;
  hasPlan: (kind: string) => boolean;
};
const Context = createContext<Store | null>(null);
const initial: State = {
  user: null,
  dishes: [],
  vloggers: [],
  saved: [],
  following: [],
  reviews: [],
  orders: [],
  entitlements: [],
  creator: null,
  ads: {
    enabled: false,
    publisherId: "",
    homeSlot: "",
    profileSlot: "",
    vloggerSlot: "",
    consentConfigured: false,
  },
  mode: "test",
};
export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initial),
    [hydrated, setHydrated] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [guestLocation, setGuestLocation] = useState("72 Outer Circle, New York");
  const refresh = async () => {
    try {
      setState(await request<State>("/api/bootstrap"));
      setError("");
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
      throw e;
    } finally {
      setHydrated(true);
    }
  };
  useEffect(() => {
    void refresh().catch(() => {});
  }, []);
  const mutate = async (path: string, method: string, data?: unknown) => {
    if (!state.user) {
      toast.error("Sign in from Profile to continue.");
      throw new Error("Sign in from Profile to continue.");
    }
    setBusy(true);
    try {
      await request(path, method, data);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unable to save");
      throw e;
    } finally {
      setBusy(false);
    }
  };
  const profile = {
    name: state.user?.name ?? "Guest explorer",
    bio: state.user?.bio ?? "Sign in to save your discoveries",
  };
  return (
    <Context.Provider
      value={{
        ...state,
        profile,
        location: state.user?.location ?? guestLocation,
        hydrated,
        busy,
        error,
        refresh,
        isSaved: (id) => state.saved.includes(id),
        isFollowing: (id) => state.following.includes(id),
        toggleSaved: (id) =>
          mutate("/api/saved/" + encodeURIComponent(id), "PUT", {
            active: !state.saved.includes(id),
          }),
        toggleFollow: (id) =>
          mutate("/api/follows/" + encodeURIComponent(id), "PUT", {
            active: !state.following.includes(id),
          }),
        setProfile: (p) => mutate("/api/profile", "PUT", { ...p, location: state.user?.location }),
        setLocation: async (location) => {
          if (!state.user) {
            setGuestLocation(location);
            return;
          }
          await mutate("/api/profile", "PUT", { ...profile, location });
        },
        addReview: (dishId, text, recommendation) =>
          mutate("/api/reviews", "POST", { dishId, text, recommendation }),
        deleteReview: (id) => mutate("/api/reviews/" + id, "DELETE"),
        hasPlan: (kind) =>
          state.entitlements.some((e) => e.kind === kind && e.expires_at > Date.now()),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useStore() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("StoreProvider required");
  return ctx;
}
