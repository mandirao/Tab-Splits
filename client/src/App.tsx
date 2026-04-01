import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import HomePage from "@/pages/HomePage";
import ReceiptDetailPage from "@/pages/ReceiptDetailPage";
import OrganizerViewPage from "@/pages/OrganizerViewPage";
import RegularsPage from "@/pages/RegularsPage";
import ScanReceiptPage from "@/pages/ScanReceiptPage";
import SharedReceiptPage from "@/pages/SharedReceiptPage";
import LoginPage from "@/pages/LoginPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import NotFound from "@/pages/not-found";
import { useAuth } from "@/hooks/useAuth";

function ProtectedRoute({ component: Component }: { component: React.ComponentType<any> }) {
  const [, navigate] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/login");
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/login" component={LoginPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/share/:token" component={SharedReceiptPage} />

      {/* Protected admin routes */}
      <Route path="/" component={() => <ProtectedRoute component={HomePage} />} />
      <Route path="/scan" component={() => <ProtectedRoute component={ScanReceiptPage} />} />
      <Route path="/receipt/:id" component={() => <ProtectedRoute component={ReceiptDetailPage} />} />
      <Route path="/receipt/:id/summary" component={() => <ProtectedRoute component={OrganizerViewPage} />} />
      <Route path="/receipt/:id/view" component={() => <ProtectedRoute component={OrganizerViewPage} />} />
      <Route path="/regulars" component={() => <ProtectedRoute component={RegularsPage} />} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
