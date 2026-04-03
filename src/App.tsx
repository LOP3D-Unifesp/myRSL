import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AuthUserIdProvider } from "@/contexts/auth-user-id";
import AuthQuerySync from "@/components/AuthQuerySync";
import Auth from "./pages/Auth";
import AppLayout from "./components/AppLayout";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,  // dados considerados frescos por 5 min
      gcTime: 15 * 60 * 1000,    // mantém no cache por 15 min após desmonte
      retry: 1,
    },
  },
});
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ArticlesList = lazy(() => import("./pages/ArticlesList"));
const ArticleForm = lazy(() => import("./pages/ArticleForm"));
const ArticleDetail = lazy(() => import("./pages/ArticleDetail"));
const Analytics = lazy(() => import("./pages/Analytics"));
const DoiConflictReview = lazy(() => import("./pages/DoiConflictReview"));
const routerBase = import.meta.env.BASE_URL;

function ProtectedRoutes() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;

  return (
    <AuthUserIdProvider userId={session.user.id}>
      <AppLayout />
    </AuthUserIdProvider>
  );
}

function AuthRoute() {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (session) return <Navigate to="/" replace />;
  return <Auth />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthQuerySync />
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter
        basename={routerBase}
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Suspense
          fallback={
            <div className="flex min-h-screen items-center justify-center bg-background">
              <div className="text-muted-foreground">Loading...</div>
            </div>
          }
        >
          <Routes>
            <Route path="/auth" element={<AuthRoute />} />
            <Route element={<ProtectedRoutes />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/articles" element={<ArticlesList />} />
              <Route path="/articles/new" element={<ArticleForm />} />
              <Route path="/articles/:id" element={<ArticleDetail />} />
              <Route path="/articles/:id/edit" element={<ArticleForm />} />
              <Route path="/verifications" element={<Navigate to="/articles?status=pending" replace />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/doi-sync/review" element={<DoiConflictReview />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
