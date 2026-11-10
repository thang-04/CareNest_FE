import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useClassPlanContext } from '@/components/education-plan/planUi';
import { EmptyState, PageHead } from '@/components/education-plan/eduUi';
import { LoadingState } from '@/components/ui/States';
import { StatusPage } from '@/components/ui/StatusPage';
import { todayIso, yearWeeks } from '@/models/education-plan/classPlan';
import { WeekPlanInner } from '@/pages/education-plan/WeekPlanPage';

/** Đường dẫn cũ /education/class/:classId/weeks/:weekStart/days ⇒ trang Kế hoạch giáo dục ngày của tuần đó. */
export function DayPlansLegacyRedirect() {
  const { classId, weekStart } = useParams();
  return <Navigate to={`/education/day-plans/${classId}?week=${weekStart}`} replace />;
}

/**
 * Kế hoạch giáo dục ngày (spec 004): giáo án ngày theo tuần, kế hoạch tuần chỉ đọc ở trên làm căn cứ; gửi/duyệt theo hồ sơ
 * chủ đề. Mặc định tuần đang dạy, chưa tới năm học thì tuần đầu tiên.
 */
export default function DayPlansPage() {
  const { classId } = useParams();
  const [params] = useSearchParams();
  const ctx = useClassPlanContext(classId);
  if (ctx.loading) return <LoadingState />;
  if (!ctx.cls) return <StatusPage kind="404" title="Không tìm thấy lớp hoặc bạn không có quyền xem" />;
  const weeks = ctx.yearPlan ? yearWeeks(ctx.yearPlan).filter((w) => w.type === 'week') : [];
  if (!weeks.length)
    return (
      <div className="page ga-page">
        <PageHead crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: 'Kế hoạch giáo dục ngày' }]} title={`Kế hoạch giáo dục ngày ${ctx.cls.name}`} />
        <EmptyState
          title="Chưa có tuần học"
          desc="Kế hoạch giáo dục tổ chưa ban hành hoặc chưa có chủ đề có ngày. Giáo án ngày soạn được khi đã có tuần học."
        />
      </div>
    );
  const today = todayIso();
  const asked = params.get('week');
  const week =
    weeks.find((w) => w.start === asked) ||
    weeks.find((w) => String(w.theme.id) === params.get('theme')) ||
    weeks.find((w) => w.start <= today && today <= w.end) ||
    weeks[0];
  return <WeekPlanInner key={`${classId}/${week.start}`} mode="days" classId={classId} weekStart={week.start} dayPage />;
}
