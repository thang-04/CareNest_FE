import { Link } from 'react-router-dom';
import { CalendarDays, CalendarRange, ClipboardCheck, Pencil } from '@/components/ui/icons';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { EDU_STATUS } from '@/models/education-plan/educationPlanConstants';
import { Card, EduStatusBadge, fmtDate } from '@/components/education-plan/eduUi';
import { addDays, daysOf, mondayOf, weeksOf } from '@/components/education-plan/lessonShared';

const localToday = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const short = (iso) => fmtDate(iso).slice(0, 5);

/** Lịch tuần của lớp và "Việc cần làm" cho giáo viên: giáo án từng ngày, việc soạn, việc chấm. */
export default function ClassWeekBoard() {
  const { lessons, themes, user, schoolYear } = useEducationPlan();
  const today = localToday();
  const monday = mondayOf(today);
  // Thứ 7, Chủ nhật: xem trước tuần học kế tiếp.
  const weekStart = today > addDays(monday, 4) ? addDays(monday, 7) : monday;
  const nextWeek = addDays(weekStart, 7);
  const days = daysOf(weekStart);

  const mine = lessons.filter((l) => l.classId === user.classId);
  const live = (l) => l.status !== EDU_STATUS.REJECTED;
  const weekPlanOf = (start) => mine.find((l) => l.type === 'week' && l.weekStart === start && live(l));
  const dayPlanOf = (date) => mine.find((l) => l.type === 'day' && l.date === date && live(l));
  const approvedThemes = themes.filter(
    (t) => t.ageGroupId === user.ageGroupId && t.schoolYear === schoolYear && t.status === EDU_STATUS.APPROVED,
  );
  const hasTheme = (start) => approvedThemes.some((t) => weeksOf(t).some((w) => w.start === start));

  const weekPlan = weekPlanOf(weekStart);
  const missingDays = days.filter((d) => !dayPlanOf(d.date));
  const todayPlan = days.some((d) => d.date === today) ? dayPlanOf(today) : null;

  const tasks = [];
  if (!weekPlan)
    tasks.push(
      hasTheme(weekStart)
        ? {
            key: 'week',
            icon: CalendarRange,
            text: `Lập kế hoạch tuần ${short(weekStart)} – ${short(addDays(weekStart, 4))}`,
            to: `/education/lessons/new?tuan=${weekStart}`,
          }
        : {
            key: 'week',
            icon: CalendarRange,
            text: 'Tuần này chưa có kế hoạch chủ đề đã duyệt. Chờ tổ trưởng lập và Phó hiệu trưởng duyệt.',
          },
    );
  else if (missingDays.length)
    tasks.push({
      key: 'days',
      icon: CalendarDays,
      text: `Tạo ${missingDays.length} kế hoạch ngày còn thiếu từ kế hoạch tuần ${weekPlan.code}`,
      to: `/education/lessons/${weekPlan.id}`,
    });
  mine
    .filter((l) => l.status === EDU_STATUS.REJECTED)
    .forEach((l) => tasks.push({ key: l.id, icon: Pencil, text: `Sửa giáo án bị trả lại ${l.code}`, to: `/education/lessons/${l.id}` }));
  if (todayPlan?.status === EDU_STATUS.APPROVED)
    tasks.push({ key: 'assess', icon: ClipboardCheck, text: 'Chấm đánh giá trẻ hôm nay theo YCCĐ của giáo án', to: '/assessment/daily' });
  if (weekStart === monday && today >= addDays(monday, 3) && !weekPlanOf(nextWeek) && hasTheme(nextWeek))
    tasks.push({
      key: 'next',
      icon: CalendarRange,
      text: `Chuẩn bị kế hoạch tuần sau (${short(nextWeek)})`,
      to: `/education/lessons/new?tuan=${nextWeek}`,
    });

  return (
    <Card
      title={`Tuần ${short(weekStart)} – ${short(addDays(weekStart, 4))}`}
      actions={
        weekPlan ? (
          <Link to={`/education/lessons/${weekPlan.id}`} className="row gap-2">
            <span className="text-sm">Kế hoạch tuần {weekPlan.code}</span>
            <EduStatusBadge status={weekPlan.status} />
          </Link>
        ) : (
          <span className="muted text-sm">Chưa có kế hoạch tuần</span>
        )
      }
    >
      <div className="ga-week-cells mb-16">
        {days.map((d) => {
          const p = dayPlanOf(d.date);
          return (
            <div key={d.date} className="ga-week-cell">
              <div className="text-xs fw-600">
                {d.label} · {short(d.date)}
                {d.date === today && <span className="text-primary"> · Hôm nay</span>}
              </div>
              {p ? (
                <Link to={`/education/lessons/${p.id}`} className="stack gap-1">
                  <EduStatusBadge status={p.status} />
                  <span className="muted text-xs">{p.code}</span>
                </Link>
              ) : (
                <span className="muted text-xs">Chưa có kế hoạch ngày</span>
              )}
            </div>
          );
        })}
      </div>
      <div className="section-title">Việc cần làm</div>
      {tasks.length === 0 ? (
        <p className="muted text-sm">Không có việc cần làm cho tuần này.</p>
      ) : (
        <div className="stack gap-2">
          {tasks.map((t) =>
            t.to ? (
              <Link key={t.key} to={t.to} className="btn btn--sm btn--outline-primary">
                <t.icon size={16} aria-hidden /> {t.text}
              </Link>
            ) : (
              <p key={t.key} className="muted text-sm">
                {t.text}
              </p>
            ),
          )}
        </div>
      )}
    </Card>
  );
}
