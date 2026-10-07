import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { SchoolYearProvider } from '@/contexts/SchoolYearContext';
import { AppRoutes } from '@/routes/AppRoutes';

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <SchoolYearProvider>
            <AppRoutes />
          </SchoolYearProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
