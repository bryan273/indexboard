import { useEffect } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Index from './pages/Index';
import AuthCallback from './pages/AuthCallback';
import AuthError from './pages/AuthError';
import EditorPage from './pages/EditorPage';
import BoardPage from './pages/BoardPage';
import PrintPage from './pages/PrintPage';
import { LangProvider } from './lib/i18n';
import { useSystemDark } from './components/board/chartKit';
// MODULE_IMPORTS_START
// MODULE_IMPORTS_END

const queryClient = new QueryClient();

function ThemeSync() {
  const dark = useSystemDark();
  const { pathname } = useLocation();
  const printView = pathname.endsWith('/print');
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark && !printView);
  }, [dark, printView]);
  return null;
}

const AppRoutes = () => (
  <>
    <ThemeSync />
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/new" element={<EditorPage />} />
      <Route path="/b/:slug" element={<BoardPage />} />
      <Route path="/b/:slug/edit" element={<EditorPage />} />
      <Route path="/b/:slug/print" element={<PrintPage />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/auth/error" element={<AuthError />} />
      {/* MODULE_ROUTES_START */}
      {/* MODULE_ROUTES_END */}
      <Route path="*" element={<Index />} />
    </Routes>
  </>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    {/* MODULE_PROVIDERS_START */}
    {/* MODULE_PROVIDERS_END */}
    <LangProvider>
      <TooltipProvider>
        <Toaster />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </LangProvider>
    {/* MODULE_PROVIDERS_CLOSE */}
  </QueryClientProvider>
);

export default App;
export { AppRoutes };
