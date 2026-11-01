import { NavLink } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { peopleTabsFor } from '@/utils/account/peopleNavigation';
import '@/styles/modules/people-tabs.css';

export function PeopleTabs({ embedded = false }) {
  const { user } = useAuth();
  const tabs = peopleTabsFor(user);
  if (tabs.length < 2) return null;

  return (
    <nav className={`people-tabs ${embedded ? 'people-tabs--embedded' : ''}`} aria-label="Quản lý con người">
      {tabs.map((tab) => (
        <NavLink
          key={tab.key}
          to={tab.to}
          end={tab.key === 'children'}
          className={({ isActive }) => `people-tabs__link ${isActive ? 'people-tabs__link--active' : ''}`}
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
