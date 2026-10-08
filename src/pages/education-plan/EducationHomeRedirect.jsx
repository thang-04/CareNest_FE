import { Navigate } from 'react-router-dom';
import { ROLES } from '@/models/User';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';

/** /education: open the first screen of the current role. */
export default function EducationHomeRedirect() {
  const { role } = useEducationPlan();
  if (role === ROLES.PRINCIPAL) return <Navigate to="/education/school" replace />;
  if (role === ROLES.VICE_PRINCIPAL) return <Navigate to="/education/goals" replace />;
  if (role === ROLES.TEAM_LEADER) return <Navigate to="/education/themes" replace />;
  return <Navigate to="/education/lessons" replace />;
}
