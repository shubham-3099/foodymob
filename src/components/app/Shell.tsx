import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";

export function Shell({ children, flush = false }: { children: ReactNode; flush?: boolean }) {
  return (
    <div className="min-h-screen bg-background">
      <main
        className={`mx-auto w-full max-w-2xl pb-28 lg:max-w-5xl ${flush ? "" : "px-5 pt-5 sm:px-8"}`}
      >
        {children}
      </main>
      <BottomNav />
    </div>
  );
}

export function PageHeading({ children }: { children: ReactNode }) {
  return <h1 className="text-[22px] font-bold tracking-tight text-foreground">{children}</h1>;
}

export function SectionHeading({ children }: { children: ReactNode }) {
  return <h2 className="text-[18px] font-bold tracking-tight text-foreground">{children}</h2>;
}
