import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import HomePage from "@/pages/HomePage";
import ReceiptDetailPage from "@/pages/ReceiptDetailPage";
import SummaryPage from "@/pages/SummaryPage";
import RegularsPage from "@/pages/RegularsPage";
import ScanReceiptPage from "@/pages/ScanReceiptPage";
import SharedReceiptPage from "@/pages/SharedReceiptPage";
import DebugFileInput from "@/pages/DebugFileInput";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/scan" component={ScanReceiptPage} />
      <Route path="/debug-upload" component={DebugFileInput} />
      <Route path="/receipt/:id" component={ReceiptDetailPage} />
      <Route path="/receipt/:id/summary" component={SummaryPage} />
      <Route path="/regulars" component={RegularsPage} />
      <Route path="/share/:token" component={SharedReceiptPage} />
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
