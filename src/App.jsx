import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { SchoolYearProvider } from '@/contexts/SchoolYearContext';
import { AppearanceProvider } from '@/contexts/AppearanceContext';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { AppRoutes } from '@/routes/AppRoutes';

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary standalone>
        <ToastProvider>
          <AuthProvider>
            <SchoolYearProvider>
              <AppearanceProvider>
                <AppRoutes />
              </AppearanceProvider>
            </SchoolYearProvider>
          </AuthProvider>
        </ToastProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
