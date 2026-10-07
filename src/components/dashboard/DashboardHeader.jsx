import { useAuth } from '@/contexts/AuthContext';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ROLE_LABELS } from '@/models/User';
import { homeCrumbs } from '@/utils/dashboard/breadcrumbs';

/** Common head of the role dashboards: breadcrumb, greeting, role, optional filters on the right. */
export function DashboardHeader({ subtitle, children }) {
  const { user } = useAuth();
  return (
    <>
      <Breadcrumb items={homeCrumbs()} />
      <div className="db-head">
        <div>
          <h1 className="page__title">Xin chào, {user.fullName}</h1>
          <p className="text-2">
            Vai trò: <b>{ROLE_LABELS[user.role]}</b>
            {subtitle ? ` · ${subtitle}` : ''}
          </p>
        </div>
        {children && <div className="db-head__filters">{children}</div>}
      </div>
    </>
  );
}
