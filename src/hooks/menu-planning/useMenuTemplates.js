import { useAuth } from '@/contexts/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { menuTemplateApi } from '@/services/menuTemplateApi';

/** Các bộ thực đơn mẫu; `block`/`status` để lọc (bỏ trống = tất cả). */
export const useMenuTemplates = ({ block, status } = {}) => {
  const { user } = useAuth();
  return useAsync(() => menuTemplateApi.listTemplates({ block, status }), [user?.id, block, status], { enabled: !!user });
};

/** Một bộ thực đơn mẫu kèm lưới món; `id` rỗng (tạo mới) thì không gọi BE. */
export const useMenuTemplate = (id) => {
  const { user } = useAuth();
  return useAsync(() => menuTemplateApi.getTemplate(id), [user?.id, id], { enabled: !!id && !!user });
};
