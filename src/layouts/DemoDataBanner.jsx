import { useAuth } from '@/contexts/AuthContext';
import { demoActorOf, demoModuleOfPath } from '@/services/demoSource';

// Màn của module chưa có BE vẫn hiển thị (user chốt 2026-11-01) nhưng phải nói rõ là dữ liệu demo
export function DemoDataBanner({ pathname }) {
  const { user } = useAuth();
  if (!demoModuleOfPath(pathname)) return null;
  const persona = user ? demoActorOf(user) : null;
  return (
    <div className="alert alert--warning app-content__notice" role="status">
      <span>
        <strong>Dữ liệu demo</strong> — chức năng này chưa nối hệ thống CareNest. Dữ liệu mẫu chỉ lưu trên trình duyệt này, thao tác không
        lưu vào hệ thống.
        {persona && persona !== user && ` Đang xem bằng tài khoản mẫu: ${persona.fullName}.`}
      </span>
    </div>
  );
}
