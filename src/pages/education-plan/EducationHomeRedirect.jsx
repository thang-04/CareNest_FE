import { Navigate } from 'react-router-dom';
import { ROLES } from '@/models/User';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';

/** /education: open the first screen of the current role. */
export default function EducationHomeRedirect() {
  const { role } = useEducationPlan();
  if (role === ROLES.PRINCIPAL || role === ROLES.VICE_PRINCIPAL) return <Navigate to="/education/year-plans" replace />;
  return <Navigate to="/education/class" replace />;
}
