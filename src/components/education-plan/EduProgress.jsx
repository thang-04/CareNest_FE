import { useNavigate } from 'react-router-dom';
import { ROLES } from '@/models/User';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { EDU_STATUS } from '@/models/education-plan/educationPlanConstants';
import { StatCardIcon } from '@/components/ui/StatCardIcon';

const PENDING = [EDU_STATUS.PENDING_TL, EDU_STATUS.PENDING_VP];
const count = (list, pred) => list.filter(pred).length;

/** Chuỗi kế hoạch của năm học: Mục tiêu → Chủ đề → Kế hoạch tuần → Kế hoạch ngày → Đánh giá, theo phạm vi của người dùng. */
export default function EduProgress() {
  const { goals, themes, lessons, role, user, schoolYear } = useEducationPlan();
  const navigate = useNavigate();
  const isLeader = role === ROLES.PRINCIPAL || role === ROLES.VICE_PRINCIPAL;
  const isClassStaff = role === ROLES.TEACHER || role === ROLES.TEAM_LEADER;

  // Ban giám hiệu xem toàn trường; tổ trưởng xem nhóm tuổi; giáo viên xem lớp mình.
  const inAge = (x) => isLeader || x.ageGroupId === user.ageGroupId;
  const yearGoals = goals.filter((g) => g.schoolYear === schoolYear && inAge(g));
  const yearThemes = themes.filter((t) => t.schoolYear === schoolYear && inAge(t));
  const themeIds = new Set(yearThemes.map((t) => t.id));
  const yearLessons = lessons.filter((l) => themeIds.has(l.themeId) && (role === ROLES.TEACHER ? l.classId === user.classId : inAge(l)));
  const ofType = (type) => yearLessons.filter((l) => l.type === type);

  const link = {
    goals: role === ROLES.VICE_PRINCIPAL ? '/education/goals' : role === ROLES.PRINCIPAL ? '/education/school' : '/education/overview',
    themes:
      role === ROLES.TEAM_LEADER
        ? '/education/themes'
        : role === ROLES.VICE_PRINCIPAL
          ? '/education/approvals'
          : role === ROLES.PRINCIPAL
            ? '/education/school'
            : '/education/overview',
    lessons: isClassStaff ? '/education/lessons' : role === ROLES.VICE_PRINCIPAL ? '/education/approvals' : '/education/school',
  };

  const planStep = (key, label, list, to, tone) => ({
    key,
    label,
    to,
    tone,
    value: `${count(list, (x) => x.status === EDU_STATUS.APPROVED)}/${list.length}`,
    sub: `${count(list, (x) => PENDING.includes(x.status))} chờ duyệt · ${count(list, (x) => x.status === EDU_STATUS.DRAFT || x.status === EDU_STATUS.REJECTED)} nháp/trả lại`,
  });

  const steps = [
    {
      key: 'goals',
      label: '1. Mục tiêu năm học',
      to: link.goals,
      tone: 'blue',
      value: `${count(yearGoals, (g) => g.status === EDU_STATUS.SENT)}/${yearGoals.length}`,
      sub: `${count(yearGoals, (g) => g.status === EDU_STATUS.DRAFT)} đang soạn`,
    },
    planStep('themes', '2. Kế hoạch chủ đề', yearThemes, link.themes, 'purple'),
    planStep('weeks', '3. Kế hoạch tuần', ofType('week'), link.lessons, 'orange'),
    planStep('days', '4. Kế hoạch ngày', ofType('day'), link.lessons, 'green'),
  ];
  if (isClassStaff)
    steps.push({
      key: 'assess',
      label: '5. Đánh giá hằng ngày',
      to: '/assessment/daily',
      tone: 'teal',
      value: 'Chấm',
      sub: 'Theo YCCĐ của giáo án ngày đã duyệt',
    });

  return (
    <div className="stat-grid" aria-label={`Tiến trình kế hoạch giáo dục năm học ${schoolYear}`}>
      {steps.map((s) => (
        <button key={s.key} type="button" className={`stat-card stat-card--${s.tone}`} onClick={() => navigate(s.to)}>
          <div className="stat-card__label">
            <span>
              {s.label}
              <br />
              <span className="muted text-xs">{s.sub}</span>
            </span>
          </div>
          <div className="stat-card__value">{s.value}</div>
          <StatCardIcon tone={s.tone} />
        </button>
      ))}
    </div>
  );
}
