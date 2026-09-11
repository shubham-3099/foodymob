import { Link } from "@tanstack/react-router";
import { Home, Users, Bookmark, User, Star } from "lucide-react";
import { useStore } from '@/lib/store';

const items = [
  { to: "/", label: "Home", icon: Home },
  { to: "/people", label: "Friends", icon: Users },
  { to: "/saved", label: "Saved", icon: Bookmark },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function BottomNav() {
  const premium=useStore().hasPlan('member');
  const navigation=items.map(item=>item.to==='/saved'&&!premium?{to:'/plans' as const,label:'Premium',icon:Star}:item);
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-muted pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto grid max-w-2xl grid-cols-4">
        {navigation.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              activeOptions={{ exact: true }}
              activeProps={{ className: "text-foreground" }}
              inactiveProps={{ className: "text-muted-foreground" }}
              className="flex min-h-14 flex-col items-center justify-center gap-1 py-2 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-foreground"
            >
              <Icon className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
              <span className="text-[11px] font-bold">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
