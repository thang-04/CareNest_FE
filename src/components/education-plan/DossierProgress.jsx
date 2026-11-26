import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Circle } from '@/components/ui/icons';
import { DataTable } from '@/components/ui/DataTable';
import { Card } from '@/components/education-plan/eduUi';
import { useClassPlanContext } from '@/components/education-plan/planUi';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { ddmm, WEEKDAY_LABELS, yearWeeks } from '@/models/education-plan/classPlan';
import { classPlanVersionPath } from '@/models/education-plan/planVersions.mjs';

// Thứ trong tuần của một ngày YYYY-MM-DD (Thứ 2 = 0)
const weekdayOf = (date) => WEEKDAY_LABELS[(new Date(`${date}T00:00:00`).getDay() + 6) % 7] || '';

/**
 * Tiến độ của kế hoạch giáo dục ngày theo chủ đề: mỗi tuần một dòng (tuần nào đã có giáo án, tuần nào chưa) để làm theo thứ
 * tự. Gửi duyệt thiếu thì BE trả đúng ngày và mục còn trống (`missing` = [{ date, section }]); nêu rõ từng ngày, từng mục
 * kèm liên kết mở đúng tuần.
 */
export function DossierProgress({ classId, themeId, weekStart, missing = [], sectionLabel = (key) => key }) {
  const { dayPlans } = useEducationPlan();
  const ctx = useClassPlanContext(classId);
  const { yearPlan } = ctx;
  const [folded, setFolded] = useState(false);
  if (!yearPlan) return null;
  const path = (to) => classPlanVersionPath(to, ctx.superseded ? yearPlan.id : null);
  const weeks = yearWeeks(yearPlan).filter((w) => w.type === 'week' && w.theme.id === themeId);
  if (!weeks.length) return null;
  const weekOf = (date) => weeks.find((w) => w.start <= date && date <= w.end);
  const linkOf = (start) => path(`/education/day-plans/${classId}?week=${start}`);
  const itemText = (m) => `${weekdayOf(m.date)} ${ddmm(m.date)}: ${sectionLabel(m.section)}`;
  const rows = weeks.map((w, i) => ({
    key: w.start,
    no: i + 1,
    week: w,
    here: w.start === weekStart,
    missing: missing.filter((m) => weekOf(m.date)?.start === w.start),
    done: dayPlans.some((d) => d.classId === classId && d.yearPlanId === yearPlan.id && d.weekStart === w.start),
  }));

  return (
    <Card
      title={`Tiến độ chủ đề: ${weeks[0].theme.name}`}
      bodyClass={null}
      className="mb-16"
      collapsed={folded}
      onToggle={() => setFolded((f) => !f)}
    >
      <div className="card__body">
        <div className="stack">
          {missing.length > 0 && (
            <div className="ga-plan-error-summary field__error" role="alert">
              <p>Chưa gửi duyệt được: còn {missing.length} mục chưa có nội dung. Bấm vào từng mục để mở đúng tuần.</p>
              {missing.map((m) => (
                <div key={`${m.date}-${m.section}`}>
                  <Link to={linkOf(weekOf(m.date)?.start || weekStart)}>
                    Tuần {weekOf(m.date) ? rows.find((r) => r.week === weekOf(m.date)).no : ''} › {itemText(m)}
                  </Link>
                </div>
              ))}
            </div>
          )}
          <DataTable
            className="ga-plan-table ga-class-plan-table"
            rowKey="key"
            rows={rows}
            columns={[
              {
                key: 'week',
                header: 'Tuần',
                render: (r) => (
                  <div className="fw-600" aria-current={r.here ? 'page' : undefined}>
                    <Link to={linkOf(r.week.start)}>Tuần {r.no}</Link>
                  </div>
                ),
              },
              { key: 'time', header: 'Thời gian', className: 'nowrap', render: (r) => `${ddmm(r.week.start)} → ${ddmm(r.week.end)}` },
              {
                key: 'status',
                header: 'Tình trạng',
                render: (r) =>
                  r.missing.length > 0 ? (
                    <span className="field__error">
                      <AlertTriangle size={14} aria-hidden /> Thiếu {r.missing.map(itemText).join('; ')}
                    </span>
                  ) : r.done ? (
                    <span className="text-success text-sm nowrap">
                      <CheckCircle2 size={14} aria-hidden /> Đã có giáo án
                    </span>
                  ) : (
                    <span className="muted text-sm nowrap">
                      <Circle size={14} aria-hidden /> Chưa soạn
                    </span>
                  ),
              },
            ]}
          />
        </div>
      </div>
    </Card>
  );
}
