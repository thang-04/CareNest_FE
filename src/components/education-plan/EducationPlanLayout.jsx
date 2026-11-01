import { Outlet } from 'react-router-dom';
import { EducationPlanProvider } from '@/hooks/education-plan/useEducationPlan';
import '@/styles/modules/education-plan.css';

/** Route wrapper: every /education page shares one data provider. */
export default function EducationPlanLayout() {
  return (
    <EducationPlanProvider>
      <Outlet />
    </EducationPlanProvider>
  );
}
