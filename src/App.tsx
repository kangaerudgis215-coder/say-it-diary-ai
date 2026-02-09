import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Chat from "./pages/Chat";
import Recall from "./pages/Recall";
import Calendar from "./pages/Calendar";
import Expressions from "./pages/Expressions";
import DiaryReview from "./pages/DiaryReview";
import InstantComposition from "./pages/InstantComposition";
import Progress from "./pages/Progress";
import Upgrade from "./pages/Upgrade";
import NotFound from "./pages/NotFound";
import ReviewHub from "./components/review/ReviewHub";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/recall" element={<Recall />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/expressions" element={<Expressions />} />
            <Route path="/review" element={<ReviewHub />} />
            <Route path="/instant" element={<InstantComposition />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/upgrade" element={<Upgrade />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
