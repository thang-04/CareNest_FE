import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { EmptyCard, EmptyState, Notice, PageHead, YearPlanStatusBadge } from '@/components/education-plan/eduUi';
import { classFilterPath, ClassPageEmpty, useClassPlanContext } from '@/components/education-plan/planUi';
import { LoadingState } from '@/components/ui/States';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { classPlanVersionPath } from '@/models/education-plan/planVersions.mjs';
import { semesterChoices, todayIso } from '@/models/education-plan/classPlan';

/** /education/theme-plans, /education/branches: mở lớp đầu tiên người dùng được xem (lớp mình dạy trước). */
export function ClassPlanRedirect({ showAllAges = false, toOf = (id) => `/education/theme-plans/${id}` }) {
  const { user, classes } = useEducationPlan();
  const own = classes.find((c) => (c.teacherIds || []).includes(user.id)) || classes[0];
  if (!own && showAllAges) return <Navigate to={toOf('no-class')} replace />;
  if (!own) return <EmptyState title="Bạn chưa được phân công lớp nào" />;
  return <Navigate to={toOf(own.id)} replace />;
}

/** Đường dẫn cũ /education/class/:classId ⇒ trang Kế hoạch giáo dục chủ đề. */
export function ClassPlanLegacyRedirect() {
  const { classId, no } = useParams();
  const [params] = useSearchParams();
  const to = `/education/theme-plans/${classId}${no ? `?hk=${no}` : ''}`;
  const review = params.get('review') === '1' ? `${no ? '&' : '?'}review=1` : '';
  return <Navigate to={classPlanVersionPath(to + review, params.get('plan'))} replace />;
}

/**
 * Kế hoạch giáo dục chủ đề của một lớp theo học kỳ: không còn trang tổng quan, vào thẳng chủ đề đầu của học kỳ (Tiền 26/11/2026).
 * Tiến độ, gửi duyệt học kỳ và chọn chủ đề khác ở đầu trang chủ đề (SemesterProgress).
 */
export default function ClassPlanPage() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { semesterPackages, yearOption } = useEducationPlan();
  const ctx = useClassPlanContext(classId);
  const { cls, classes, yearPlan, pendingYearPlan, canComposeClassDocs } = ctx;
  if (ctx.loading) return <LoadingState />;
  const crumbs = [{ label: 'Kế hoạch giáo dục' }, { label: 'Kế hoạch giáo dục chủ đề' }];
  if (!cls)
    return (
      <ClassPageEmpty
        showAllAges
        crumbs={crumbs}
        title="Kế hoạch giáo dục chủ đề"
        classes={classes}
        classId={classId}
        onPick={(id, age) => navigate(classFilterPath('/education/theme-plans', id, age))}
        emptyTitle="Không tìm thấy lớp"
      />
    );
  if (!yearPlan)
    return (
      <div className="page ga-page">
        <PageHead crumbs={crumbs} title={`Kế hoạch giáo dục chủ đề ${cls.name}`} />
        {canComposeClassDocs && pendingYearPlan && (
          <Notice tone="info">
            Trạng thái kế hoạch giáo dục tổ: <YearPlanStatusBadge status={pendingYearPlan.status} doc={pendingYearPlan} />
          </Notice>
        )}
        <EmptyCard title="Kế hoạch giáo dục tổ của nhóm tuổi này chưa được ban hành" />
      </div>
    );

  const packages = semesterPackages
    .filter((p) => p.classId === classId && p.yearPlanId === yearPlan.id)
    .sort((a, b) => a.semesterNo - b.semesterNo);
  const allThemes = [...yearPlan.themes].filter((t) => t.start && t.end).sort((a, b) => a.start.localeCompare(b.start));
  const choices = semesterChoices(yearOption, allThemes, packages);
  // Mặc định học kỳ đang diễn ra (hạn = ngày bắt đầu học kỳ đã tới), chưa vào năm học thì học kỳ 1
  const today = todayIso();
  const current = [...choices].reverse().find((c) => c.deadline && c.deadline <= today) || choices[0];
  const hk = params.get('hk') || (current ? String(current.semesterNo) : '');
  const choice = choices.find((c) => String(c.semesterNo) === hk) || null;
  const pkg = choice?.pkg || null;
  const visible = choice ? allThemes.filter((t) => choice.themeIds.includes(String(t.id))) : allThemes;
  // Người chỉ xem chỉ thấy học kỳ đã gửi hoặc đã ban hành (Tiền 23/11/2026)
  const themes = canComposeClassDocs || pkg?.status === 'APPROVED' || pkg?.status === 'REVIEW' ? visible : [];
  if (themes.length) {
    const review = params.get('review') === '1' ? '?review=1' : '';
    return (
      <Navigate
        replace
        to={classPlanVersionPath(`/education/class/${classId}/themes/${themes[0].id}${review}`, ctx.superseded ? yearPlan.id : null)}
      />
    );
  }
  return (
    <div className="page ga-page">
      <PageHead crumbs={crumbs} title={`Kế hoạch giáo dục chủ đề ${cls.name}`} />
      <EmptyCard title="Chưa có chủ đề trong học kỳ" />
    </div>
  );
}
