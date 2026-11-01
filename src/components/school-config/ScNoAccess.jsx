import { StatusPage } from '@/components/ui/StatusPage';

/** Shown when the signed-in role may not use a configuration screen (DESIGN.md §9: có nút về trang chủ). */
export function ScNoAccess({ description = 'Chức năng này chỉ dành cho vai trò được phân quyền theo ma trận quyền của nhà trường.' }) {
  return <StatusPage kind="403" description={description} />;
}
