import { useMemo, useState } from 'react';
import { SidePanel } from '@/components/ui/SidePanel';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { PeriodSummaryTable } from '@/components/assessment/PeriodSummaryTable';
import { useChildDevelopment } from '@/hooks/assessment/useAssessment';
import { formatDate, todayInput } from '@/utils/format';

const dayMonth = (iso) => formatDate(iso).slice(0, 5);
const goalLabel = (g) => g.name || g.description || `MT ${g.id}`;
const commentRowId = (date) => `dg-xcheck-nx-${date}`;
const commentText = (day) => [day.comment, day.behaviorNote && `Ghi chú hành vi: ${day.behaviorNote}`].filter(Boolean).join('\n');

/**
 * Đối chiếu đánh giá hằng ngày của một trẻ trong thời gian chủ đề (Cần yêu cầu 10/11/2026): cô xem từng mục tiêu
 * Đạt / Chưa đạt ngày nào, từng ngày đã chấm gì hoặc trẻ vắng, nhận xét hằng ngày của cô, cùng số liệu Hoạt động chung,
 * trước khi sửa tay / xác nhận bảng.
 * Chỉ hiển thị số liệu BE trả (GET /assessment/children/{id}/development), không tính lại kết quả bảng.
 */
export function ThemeDailyCrossCheck({ child, theme, onClose }) {
  const today = todayInput();
  const end = theme.endDate > today ? today : theme.endDate;
  const { development: d, loading, error, reload } = useChildDevelopment(child?.childId, { start: theme.startDate, end });
  const days = useMemo(() => [...(d?.days || [])].sort((a, b) => a.date.localeCompare(b.date)), [d]);
  // Từng ngày: ngày có đánh giá và ngày đã điểm danh vắng (BE trả absentDays)
  const timeline = useMemo(() => {
    const absent = (d?.absentDays || []).filter((x) => !days.some((day) => day.date === x)).map((x) => ({ date: x, absent: true }));
    return [...days, ...absent].sort((a, b) => a.date.localeCompare(b.date));
  }, [d, days]);
  // Lưới mục tiêu × ngày (giống bảng giấy của trường): + Đạt, − Chưa đạt (cố gắng tính như chưa đạt), trống = hôm đó không có MT
  const goals = useMemo(() => {
    const map = new Map();
    const add = (g, date, met) => {
      const key = goalLabel(g);
      if (!map.has(key)) map.set(key, { key, text: g.description, byDate: {}, metDays: 0 });
      const row = map.get(key);
      row.byDate[date] = met;
      if (met) row.metDays += 1;
    };
    days.forEach((day) => {
      (day.met || []).forEach((g) => add(g, day.date, true));
      [...(day.effort || []), ...(day.notMet || [])].forEach((g) => add(g, day.date, false));
    });
    return [...map.values()].sort((a, b) => a.key.localeCompare(b.key, 'vi', { numeric: true }));
  }, [days]);
  // Nhận xét cô ghi ở Đánh giá hằng ngày (comment) và ghi chú hành vi (behaviorNote)
  const comments = useMemo(() => days.filter((day) => day.comment || day.behaviorNote), [days]);
  const [activeDate, setActiveDate] = useState(null);
  const openComment = (date) => {
    setActiveDate(date);
    document.getElementById(commentRowId(date))?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  return (
    <SidePanel open={!!child} wide title={child ? `Đối chiếu đánh giá hằng ngày · ${child.fullName}` : ''} onClose={onClose}>
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading || !d ? (
        <LoadingState />
      ) : (
        <div className="dg-xcheck">
          <p className="muted text-sm">
            Chủ đề {theme.themeName}: {formatDate(theme.startDate)} – {formatDate(theme.endDate)} · Có mặt {d.presentDays} ngày ·{' '}
            {days.length} ngày có đánh giá{d.absentDays?.length ? ` · Vắng ${d.absentDays.length} ngày` : ''}
          </p>

          {goals.length === 0 ? (
            <EmptyState title="Chưa có kết quả Kiến thức kỹ năng trong thời gian chủ đề" />
          ) : (
            <div className="table-wrap dg-xcheck__wrap">
              <table className="table table--grid table--compact dg-xcheck__grid">
                <thead>
                  <tr>
                    <th className="dg-xcheck__goal">Mục tiêu</th>
                    <th>Kết quả</th>
                    {timeline.map((day) => (
                      <th key={day.date} className={`center${day.absent ? ' dg-xcheck__absent' : ''}`} title={formatDate(day.date)}>
                        {dayMonth(day.date)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {goals.map((g) => (
                    <tr key={g.key}>
                      <td className="dg-xcheck__goal" title={g.text}>
                        {g.key}
                      </td>
                      {/* OBS-27: chỉ cần 1 lần Đạt trong chủ đề là Đạt */}
                      <td>
                        <span className={`chip ${g.metDays ? 'chip--green' : 'chip--red'}`}>{g.metDays ? 'Đạt' : 'Chưa đạt'}</span>{' '}
                        <span className="muted text-sm">
                          {g.metDays}/{Object.keys(g.byDate).length} ngày Đạt
                        </span>
                      </td>
                      {timeline.map((day) => {
                        // OBS-01: ngày vắng, mục tiêu của giáo án hôm đó tính Chưa đạt
                        if (day.absent) {
                          return (
                            <td key={day.date} className="center dg-xcheck__absent" title="Vắng">
                              V
                            </td>
                          );
                        }
                        const met = g.byDate[day.date];
                        return (
                          <td
                            key={day.date}
                            className={`center dg-xcheck__mark ${met === true ? 'text-success' : met === false ? 'text-danger' : ''}`}
                          >
                            {met === true ? '+' : met === false ? '−' : ''}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr>
                    <td className="dg-xcheck__goal">Nhận xét của cô</td>
                    <td />
                    {timeline.map((day) => {
                      if (day.absent) {
                        return (
                          <td key={day.date} className="center dg-xcheck__absent" title="Vắng">
                            V
                          </td>
                        );
                      }
                      if (!day.comment && !day.behaviorNote) return <td key={day.date} />;
                      return (
                        <td key={day.date} className="center dg-xcheck__nx" title={commentText(day)}>
                          <button type="button" className="link-btn" onClick={() => openComment(day.date)}>
                            NX
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          <section>
            <h3 className="section-title">Nhận xét của cô</h3>
            {comments.length === 0 ? (
              <p className="muted text-sm">Chưa có nhận xét trong thời gian chủ đề.</p>
            ) : (
              <div className="table-wrap">
                <table className="table table--grid table--compact">
                  <thead>
                    <tr>
                      <th>Ngày</th>
                      <th>Nhận xét</th>
                      <th>Ghi chú hành vi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comments.map((day) => (
                      <tr
                        key={day.date}
                        id={commentRowId(day.date)}
                        className={activeDate === day.date ? 'dg-xcheck__nx-row--active' : undefined}
                      >
                        <td className="nowrap">{formatDate(day.date)}</td>
                        <td>{day.comment || '—'}</td>
                        <td>{day.behaviorNote || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <PeriodSummaryTable data={d.summary} />
        </div>
      )}
    </SidePanel>
  );
}
