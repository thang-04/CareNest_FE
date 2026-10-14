import { AGE_GROUPS, CLASSES, WEEKDAYS } from '@/models/education-plan/educationPlanConstants';
import { Card, fmtDate } from '@/components/education-plan/eduUi';
import { CodeChips } from '@/components/education-plan/PlanWidgets';

// Dates are handled as UTC so 'yyyy-mm-dd' never shifts with the local time zone.
const toDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const toIso = (dt) => dt.toISOString().slice(0, 10);

export const addDays = (iso, n) => {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toIso(d);
};

export const mondayOf = (iso) => {
  const d = toDate(iso);
  const wd = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - wd);
  return toIso(d);
};

/** Weeks of a theme plan with their branch themes. */
export function weeksOf(theme) {
  if (!theme) return [];
  if (theme.branches?.length) return theme.branches;
  const out = [];
  let start = mondayOf(theme.startDate);
  let i = 1;
  while (start <= theme.endDate) {
    out.push({ index: i++, start, end: addDays(start, 4), name: '' });
    start = addDays(start, 7);
  }
  return out;
}

export const daysOf = (weekStart) => WEEKDAYS.map((label, i) => ({ label, date: addDays(weekStart, i) }));

export const weekdayLabel = (iso) => {
  const wd = (toDate(iso).getUTCDay() + 6) % 7;
  return wd < 5 ? WEEKDAYS[wd] : wd === 5 ? 'Thứ 7' : 'Chủ nhật';
};

export const className = (id) => CLASSES.find((c) => c.id === id)?.name || '—';
export const typeLabel = (t) => (t === 'week' ? 'Kế hoạch tuần' : 'Kế hoạch ngày');

export function periodLabel(l) {
  if (l.type === 'day') return `${weekdayLabel(l.date)}, ${fmtDate(l.date)}`;
  return `${fmtDate(l.weekStart)} – ${fmtDate(l.weekEnd)}`;
}

/** Daily routine slots x Monday–Friday, following the weekly plan template. */
export function WeekMatrix({ weekStart, slots, dayNotes }) {
  const days = daysOf(weekStart);
  return (
    <div className="table-wrap">
      <table className="table ga-plan-table ga-week-table">
        <thead>
          <tr>
            <th style={{ width: 130 }}>Giờ sinh hoạt</th>
            {days.map((d) => (
              <th key={d.date}>
                {d.label} <span style={{ fontWeight: 400 }}>{fmtDate(d.date).slice(0, 5)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slots.map((s) => (
            <tr key={s.id}>
              <td className="fw-600">{s.name}</td>
              {s.allWeek ? (
                <td colSpan={5}>
                  <div className="ga-cell-text">{s.all?.text || '—'}</div>
                  <CodeChips codes={s.all?.codes} empty="" />
                </td>
              ) : (
                days.map((d) => (
                  <td key={d.date}>
                    <div className="ga-cell-text">{s.cells?.[d.date]?.text || ''}</div>
                    <CodeChips codes={s.cells?.[d.date]?.codes} empty="" />
                  </td>
                ))
              )}
            </tr>
          ))}
          {dayNotes && (
            <tr>
              <td className="fw-600">Nhận xét cuối ngày</td>
              {days.map((d) => (
                <td key={d.date}>
                  <div className="ga-cell-text">{dayNotes[d.date] || ''}</div>
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const listOf = (arr) => (arr?.length ? arr.join(', ') : '—');

/** 5-column daily plan table: Thời điểm | Mục đích – yêu cầu | Chuẩn bị | Hoạt động của cô | Hoạt động của trẻ */
export function DayTable({ slots }) {
  return (
    <div className="table-wrap">
      <table className="table ga-plan-table">
        <thead>
          <tr>
            <th style={{ width: 150 }}>Thời điểm / Hoạt động</th>
            <th>Mục đích – Yêu cầu</th>
            <th style={{ width: 170 }}>Chuẩn bị</th>
            <th>Hoạt động của cô</th>
            <th>Hoạt động của trẻ</th>
          </tr>
        </thead>
        <tbody>
          {slots.map((s0, i) => {
            // Only steps that already have content are shown.
            const s = { ...s0, steps: (s0.steps || []).filter((st) => st.teacher?.trim() || st.child?.trim()) };
            return (
              <tr key={s.id}>
                <td>
                  <div className="fw-600">
                    {i + 1}. {s.name}
                  </div>
                  {s.duration && <div className="text-xs">({s.duration})</div>}
                  {s.topic && <div className="mt-8">{s.topic}</div>}
                  <div className="mt-8">
                    <CodeChips codes={s.codes} empty="" />
                  </div>
                </td>
                <td>
                  {s.purpose && (
                    <div>
                      <span className="fw-600">Năng lực theo lĩnh vực:</span> {s.purpose}
                    </div>
                  )}
                  {s.skills && (
                    <div className="mt-8">
                      <span className="fw-600">Kỹ năng hỗ trợ:</span> {s.skills}
                    </div>
                  )}
                  <div className="mt-8">
                    <span className="fw-600">Phẩm chất:</span> {listOf(s.qualities)}
                  </div>
                  <div className="mt-8">
                    <span className="fw-600">Năng lực nền tảng:</span> {listOf(s.competencies)}
                  </div>
                </td>
                <td>
                  {s.prepTeacher && (
                    <div>
                      <span className="fw-600">Của cô:</span> {s.prepTeacher}
                    </div>
                  )}
                  {s.prepChild && (
                    <div className="mt-8">
                      <span className="fw-600">Của trẻ:</span> {s.prepChild}
                    </div>
                  )}
                  {!s.prepTeacher && !s.prepChild && '—'}
                </td>
                <td>
                  {s.steps?.length
                    ? s.steps.map((st, j) => (
                        <div key={st.id} className={j ? 'mt-8' : ''}>
                          <span className="fw-600">
                            Bước {j + 1}
                            {st.title ? `. ${st.title}` : ''}:
                          </span>{' '}
                          {st.teacher}
                        </div>
                      ))
                    : '—'}
                </td>
                <td>
                  {s.steps?.length
                    ? s.steps.map((st, j) => (
                        <div key={st.id} className={j ? 'mt-8' : ''}>
                          <span className="fw-600">Bước {j + 1}:</span> {st.child}
                        </div>
                      ))
                    : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function LessonInfo({ l, theme }) {
  return (
    <dl className="info-list">
      <dt>Loại</dt>
      <dd>{typeLabel(l.type)}</dd>
      <dt>Lớp</dt>
      <dd>
        {className(l.classId)} · {AGE_GROUPS.find((a) => a.id === l.ageGroupId)?.name}
      </dd>
      <dt>Thời gian</dt>
      <dd>{periodLabel(l)}</dd>
      <dt>Chủ đề</dt>
      <dd>{theme?.name || '—'}</dd>
      <dt>Chủ đề nhánh</dt>
      <dd>
        Tuần {l.weekIndex}: {l.branch || '—'}
      </dd>
      <dt>Người lập</dt>
      <dd>{l.createdBy}</dd>
    </dl>
  );
}

export function LessonBody({ l, theme }) {
  return (
    <div className="stack">
      <Card title="Thông tin chung">
        <LessonInfo l={l} theme={theme} />
      </Card>
      <Card
        title={l.type === 'week' ? 'Lịch hoạt động trong tuần' : 'Nội dung theo thời điểm trong ngày'}
        actions={<span className="muted text-xs">{l.slots?.length || 0} giờ sinh hoạt</span>}
      >
        {l.type === 'week' ? <WeekMatrix weekStart={l.weekStart} slots={l.slots || []} /> : <DayTable slots={l.slots || []} />}
      </Card>
    </div>
  );
}
