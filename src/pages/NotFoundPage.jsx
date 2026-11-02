import { AccessDenied } from '@/routes/RoleGuard';

export default function NotFoundPage() {
  return <AccessDenied kind="404" title="Không tìm thấy trang" description="Đường dẫn không tồn tại, đã bị thay đổi hoặc gõ chưa đúng." />;
}
