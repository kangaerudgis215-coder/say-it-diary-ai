import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useEffect } from "react";
import { installAudioUnlock } from "@/lib/audioUnlock";
import { migrateFromV1Once } from "@/lib/conversationStore";
import HomeV2 from "./pages/HomeV2";
import ChatV2 from "./pages/ChatV2";
import ReviewV2 from "./pages/ReviewV2";
import LogsV2 from "./pages/LogsV2";
import LogDetailV2 from "./pages/LogDetailV2";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    migrateFromV1Once();
    installAudioUnlock();
  }, []);
  return (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomeV2 />} />
            <Route path="/chat/:id" element={<ChatV2 />} />
            <Route path="/review" element={<ReviewV2 />} />
            <Route path="/logs" element={<LogsV2 />} />
            <Route path="/logs/:id" element={<LogDetailV2 />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
  );
};

export default App;
