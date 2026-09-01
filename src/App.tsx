import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { GlobalFilterProvider } from "@/contexts/GlobalFilterContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import SurveyAnalysis from "./pages/SurveyAnalysis";
import CompanyComparison from "./pages/CompanyComparison";
import Demographics from "./pages/Demographics";
import Heatmap from "./pages/Heatmap";
import Reports from "./pages/Reports";
import Forms from "./pages/Forms";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import CompanyNotes from "./pages/CompanyNotes";
import ActionPlans from "./pages/ActionPlans";
import TemporalEvolution from "./pages/TemporalEvolution";
import OpenResponses from "./pages/OpenResponses";
import Companies from "./pages/Companies";
import Respondents from "./pages/Respondents";
import Users from "./pages/Users";
import Help from "./pages/Help";
import Subscription from "./pages/Subscription";
import PublicSurvey from "./pages/PublicSurvey";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <GlobalFilterProvider>
          <ErrorBoundary>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/pesquisa/:slug/:id" element={<PublicSurvey />} />
              <Route path="/pesquisa/:id" element={<PublicSurvey />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              <Route path="/analise" element={<ProtectedRoute><SurveyAnalysis /></ProtectedRoute>} />
              <Route path="/empresas" element={<ProtectedRoute><CompanyComparison /></ProtectedRoute>} />
              <Route path="/demografico" element={<ProtectedRoute><Demographics /></ProtectedRoute>} />
              <Route path="/heatmap" element={<ProtectedRoute><Heatmap /></ProtectedRoute>} />
              <Route path="/evolucao" element={<ProtectedRoute><TemporalEvolution /></ProtectedRoute>} />
              <Route path="/respostas-livres" element={<ProtectedRoute><OpenResponses /></ProtectedRoute>} />
              <Route path="/relatorios" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
              <Route path="/empresas-cadastro" element={<ProtectedRoute requireAdmin><Companies /></ProtectedRoute>} />
              <Route path="/formularios" element={<ProtectedRoute requireAdmin><Forms /></ProtectedRoute>} />
              <Route path="/respondentes" element={<ProtectedRoute requireAdmin><Respondents /></ProtectedRoute>} />
              <Route path="/usuarios" element={<ProtectedRoute requireAdmin><Users /></ProtectedRoute>} />
              <Route path="/notas" element={<ProtectedRoute><CompanyNotes /></ProtectedRoute>} />
              <Route path="/plano-acao" element={<ProtectedRoute><ActionPlans /></ProtectedRoute>} />
              <Route path="/configuracoes" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/ajuda" element={<ProtectedRoute><Help /></ProtectedRoute>} />
              <Route path="/assinatura" element={<ProtectedRoute><Subscription /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ErrorBoundary>
          </GlobalFilterProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
