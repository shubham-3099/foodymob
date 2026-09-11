import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, Link, createRootRouteWithContext, HeadContent, useLocation } from "@tanstack/react-router";
import { StoreProvider, useStore } from "@/lib/store";
import { Toaster } from "sonner";
import {CommunityApp} from '@/community/App';
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Root,
  notFoundComponent: () => (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <Link to="/" className="underline">
        Back to Home
      </Link>
    </main>
  ),
  errorComponent: () => (
    <main className="p-8">
      <h1 className="text-2xl font-bold">This page could not load</h1>
      <a href="/" className="underline">
        Back to Home
      </a>
    </main>
  ),
});
function Root() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <StoreProvider>
        <HeadContent />
        <Ready />
        <Toaster />
      </StoreProvider>
    </QueryClientProvider>
  );
}

function Ready() {
  const s = useStore();
  const path = useLocation().pathname;
  if (!s.hydrated)
    return (
      <main className="p-8" role="status">
        Loading your discoveries…
      </main>
    );
  if (s.error)
    return (
      <main className="p-8">
        <h1>Unable to load the site</h1>
        <p>{s.error}</p>
        <button
          className="button mt-3"
          onClick={() => {
            void s.refresh().catch(() => {});
          }}
        >
          Retry
        </button>
      </main>
    );
  if (['/login','/signup','/signup-user','/verify','/forgot-password','/privacy','/terms','/plans','/billing'].includes(path))return <Outlet/>;
  return <CommunityApp path={path}/>;
}
