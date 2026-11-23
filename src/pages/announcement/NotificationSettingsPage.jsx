import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components';
import { Tabs } from '@/components/ui/Tabs';
import { useAuth } from '@/contexts/AuthContext';
import AnnouncementTemplatesPage from './AnnouncementTemplatesPage';
import NotificationRulesPage from './NotificationRulesPage';
import AnnouncementSchedulesPage from './AnnouncementSchedulesPage';
import { activeSettingsTab, settingsTabsFor } from './notificationSettingsTabs.mjs';
import '@/styles/modules/announcement.css';

const PANELS = { templates: AnnouncementTemplatesPage, rules: NotificationRulesPage, schedules: AnnouncementSchedulesPage };

export default function NotificationSettingsPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tabs = settingsTabsFor(user?.role);
  const active = activeSettingsTab(user?.role, params.get('tab'));
  const changeTab = (key) => setParams(key === tabs[0]?.key ? {} : { tab: key }, { replace: true });
  const Panel = active && PANELS[active.key];
  return (
    <div className="page announcement-page">
      <PageHeader title="Cấu hình thông báo" crumbs={[{ label: 'Trang chủ', to: '/' }, { label: 'Cấu hình thông báo' }]} />
      <Tabs
        items={tabs.map(({ key, label }) => ({ key, label }))}
        value={active?.key}
        onChange={changeTab}
        ariaLabel="Cấu hình thông báo"
      />
      {Panel && <Panel key={active.key} />}
    </div>
  );
}
