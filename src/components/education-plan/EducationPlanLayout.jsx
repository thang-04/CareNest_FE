import { useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { EducationPlanProvider } from '@/hooks/education-plan/useEducationPlan';
import '@/styles/modules/education-plan.css';

/** Route wrapper: every /education page shares one data provider. */
export default function EducationPlanLayout() {
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
    <EducationPlanProvider>
      <div ref={scope}>
        <Outlet />
      </div>
    </EducationPlanProvider>
  );
}
