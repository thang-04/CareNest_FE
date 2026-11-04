import { useAsync } from '@/hooks/useAsync';
import { ROLES } from '@/models/User';
import { principalSigns } from '@/models/education-plan/eduConfig';
import { getEduConfig } from '@/services/education-plan/educationPlanService';

const NONE = [];
const PRINCIPAL_HIDDEN = ['eduPlanReviews'];

/**
 * Mục menu kế hoạch giáo dục cần ẩn theo cấu hình (Tiền 03/11): Hiệu trưởng không có trong chuỗi ký của loại tài liệu nào
 * ⇒ ẩn "Duyệt kế hoạch, giáo án". Chưa tải được cấu hình thì giữ mục (không mất chỗ duyệt). Vai trò khác không đổi.
 */
export function useEduMenuHidden(role) {
  const { data } = useAsync(() => getEduConfig(), [role], { enabled: role === ROLES.PRINCIPAL });
  return role === ROLES.PRINCIPAL && data && !principalSigns(data) ? PRINCIPAL_HIDDEN : NONE;
}
