import { Navigate } from 'react-router-dom';
import { ROLES } from '@/models/User';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';

/** /education: open the first screen of the current role. */
export default function EducationHomeRedirect() {
  const { role } = useEducationPlan();
  // PHT chỉ xem (không mã EDU-108) vẫn vào danh sách kế hoạch để xem bản đã ban hành
  if (role === ROLES.PRINCIPAL) return <Navigate to="/education/school-year-plans" replace />;
  if (role === ROLES.VICE_PRINCIPAL) return <Navigate to="/education/goals" replace />;
  if (role === ROLES.TEAM_LEADER) return <Navigate to="/education/goals" replace />;
  return <Navigate to="/education/class" replace />;
}
