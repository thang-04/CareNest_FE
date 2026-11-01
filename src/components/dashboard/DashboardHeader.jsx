import { Sun } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { useAppearance } from '@/contexts/AppearanceContext';
import { sceneUrl } from '@/models/appearance/scenes';
import { ROLE_LABELS } from '@/models/User';
import { homeCrumbs } from '@/utils/dashboard/breadcrumbs';

const todayLabel = () => {
  const text = new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/** Common head of the role dashboards: breadcrumb + banner chào (tranh sáp màu), role, optional filters. */
export function DashboardHeader({ subtitle, children }) {
  const { user } = useAuth();
  const { sceneId } = useAppearance();
  return (
    <>
      <Breadcrumb items={homeCrumbs()} />
      <section className="db-hero">
        <div className="db-hero__text">
          <span className="db-hero__date">
            <Sun size={15} aria-hidden="true" /> {todayLabel()}
          </span>
          <h1 className="db-hero__title">
            Xin chào, <span className="db-hero__name">{user.fullName}</span>
          </h1>
          <p className="db-hero__meta">
            Vai trò: <b>{ROLE_LABELS[user.role]}</b>
            {subtitle ? ` · ${subtitle}` : ''}
          </p>
          {children && <div className="db-head__filters">{children}</div>}
        </div>
        <img className="db-hero__art" src={sceneUrl(sceneId)} alt="" aria-hidden="true" />
      </section>
    </>
  );
}
