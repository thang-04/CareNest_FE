import { useAuth } from '@/contexts/AuthContext';
import { useMasterData } from '@/hooks/useMasterData';
import { ROLES } from '@/models/User';

/**
 * Điểm trường của tài khoản đang đăng nhập để hiện cạnh vai trò ở hộp tài khoản. BE `/accounts/me` chỉ trả campusId nên tra
 * tên từ danh mục điểm trường; chỉ để hiển thị, không dùng phân quyền.
 */
export function useAccountScope() {
  const { user } = useAuth();
  const md = useMasterData();
  if (!user) return { campus: '', campusFull: '' };
  const campus = md.campusById(user.campusId);
  const allSchool = user.role === ROLES.PRINCIPAL && !user.campusId;
  return {
    campus: allSchool ? 'Toàn trường' : campus?.shortName || campus?.name || '',
    campusFull: allSchool ? 'Toàn trường' : campus?.name || campus?.shortName || '',
  };
}
