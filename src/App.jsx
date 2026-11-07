import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { SchoolYearProvider } from '@/contexts/SchoolYearContext';
import { AppearanceProvider } from '@/contexts/AppearanceContext';
import { PermissionGrantProvider } from '@/contexts/PermissionGrantContext';
import { AppRoutes } from '@/routes/AppRoutes';
import { ExportPreviewHost } from '@/components/ui/ExportPreview';

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <SchoolYearProvider>
            <AppearanceProvider>
              <PermissionGrantProvider>
                <AppRoutes />
              </PermissionGrantProvider>
              <ExportPreviewHost />
            </AppearanceProvider>
          </SchoolYearProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
