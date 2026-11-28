import { useEffect, useRef, useState } from 'react';
import { Outlet, useMatch, useSearchParams } from 'react-router-dom';
import { EducationPlanProvider } from '@/hooks/education-plan/useEducationPlan';
import '@/styles/modules/education-plan.css';

/** Route wrapper: every /education page shares one data provider. */
export default function EducationPlanLayout() {
  const settings = useMatch('/education/settings');
  const curriculum = useMatch('/education/curriculum-sources');
  const reviews = useMatch('/education/plan-reviews');
  const [params] = useSearchParams();
  const reviewView = !!reviews || params.get('review') === '1';
  // Trang danh sách dạng bảng tự tải danh sách gọn có phân trang (edu-list-paging) ⇒ không tải cả gói tài liệu lớp
  // Trang của một lớp chỉ tải tài liệu (đủ nội dung) của lớp đó; trang khác chỉ cần lớp/nhân sự (Tiền 25/11/2026)
  const themePlans = useMatch('/education/theme-plans/:classId');
  const dayPlans = useMatch('/education/day-plans/:classId');
  const branches = useMatch('/education/branches/:classId');
  const classPage = useMatch('/education/class/:classId/*');
  const classId = (themePlans || dayPlans || branches || classPage)?.params?.classId ?? null;
  const lightDocs = classId == null;
  // Hiệu trưởng xem hồ sơ quá hạn của một lớp (mở từ Kế hoạch quá hạn): chỉ đọc. Giữ chế độ khi đi qua lại các trang lớp
  // (đường dẫn trong trang không mang ?overdue=1); rời trang lớp thì thoát
  const askedOverdue = classId != null && params.get('overdue') === '1';
  const [overdueMode, setOverdueMode] = useState(askedOverdue);
  useEffect(() => {
    if (askedOverdue) setOverdueMode(true);
    else if (classId == null) setOverdueMode(false);
  }, [askedOverdue, classId]);
  const overdueView = classId != null && (askedOverdue || overdueMode);
  // Hàng chờ duyệt, quá hạn tự tải danh sách của mình ⇒ không tải danh sách kế hoạch năm/tổ (size=200, 2 cấp)
  const overdue = useMatch('/education/overdue');
  const skipGoals = !!(reviews || overdue);
  // Bảng kế hoạch giáo dục: bấm chuột vào ô không tô khung; chỉ hiện khung ô đang nhập khi đi bằng phím Tab (Tiền 11/11/2026).
  // Đổi class thẳng trên DOM để không vẽ lại cả trang mỗi lần bấm chuột
  const scope = useRef(null);
  useEffect(() => {
    const set = (on) => scope.current?.classList.toggle('ga-keyboard-nav', on);
    const onKey = (event) => event.key === 'Tab' && set(true);
    const onPointer = () => set(false);
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    // Tiêu đề cột bảng dính ngay dưới hàng nút đang dính (Tiền 12/11/2026): đo chiều cao hàng nút (xuống 2 hàng khi hẹp).
    // ponytail: đo lại khi cuộn/đổi cỡ thay vì theo dõi từng hàng nút; chỉ ghi khi số đo đổi
    let barH = '';
    const measure = () => {
      const bar = scope.current?.querySelector('.ga-sticky-head > .ga-year-toolbar');
      const next = `${bar ? bar.offsetHeight : 0}px`;
      if (next !== barH) scope.current?.style.setProperty('--ga-bar-h', (barH = next));
    };
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, []);
  return (
    <EducationPlanProvider
      yearScoped={!settings && !curriculum}
      reviewView={reviewView}
      overdueView={overdueView}
      lightDocs={lightDocs}
      classId={classId}
      skipGoals={skipGoals}
    >
      <div ref={scope}>
        {/* Xem hồ sơ quá hạn: tắt mọi nút và ô nhập; liên kết chuyển tuần, chủ đề vẫn dùng được */}
        {overdueView ? (
          <fieldset disabled className="ga-overdue-fieldset">
            <Outlet />
          </fieldset>
        ) : (
          <Outlet />
        )}
      </div>
    </EducationPlanProvider>
  );
}
