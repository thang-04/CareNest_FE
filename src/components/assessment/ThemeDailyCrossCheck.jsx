import { useMemo } from 'react';
import { SidePanel } from '@/components/ui/SidePanel';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { PeriodSummaryTable } from '@/components/assessment/PeriodSummaryTable';
import { useChildDevelopment } from '@/hooks/assessment/useAssessment';
import { formatDate, todayInput } from '@/utils/format';

const dayMonth = (iso) => formatDate(iso).slice(0, 5);
const goalLabel = (g) => g.name || g.description || `MT ${g.id}`;

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
  // Gom theo mục tiêu: ngày Đạt / ngày Chưa đạt (cố gắng tính như chưa đạt, như bảng cuối chủ đề)
  const goals = useMemo(() => {
    const map = new Map();
    const add = (g, date, met) => {
      const key = goalLabel(g);
      if (!map.has(key)) map.set(key, { key, text: g.description, met: [], notMet: [] });
      map.get(key)[met ? 'met' : 'notMet'].push(date);
    };
    days.forEach((day) => {
      (day.met || []).forEach((g) => add(g, day.date, true));
      [...(day.effort || []), ...(day.notMet || [])].forEach((g) => add(g, day.date, false));
    });
    return [...map.values()].sort((a, b) => a.key.localeCompare(b.key, 'vi', { numeric: true }));
  }, [days]);

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

          <section>
            <h3 className="section-title">Kết quả theo mục tiêu</h3>
            {goals.length === 0 ? (
              <EmptyState title="Chưa có kết quả Kiến thức kỹ năng trong thời gian chủ đề" />
            ) : (
              <div className="table-wrap">
                <table className="table table--grid table--compact">
                  <thead>
                    <tr>
                      <th>Mục tiêu</th>
                      <th>Ngày Đạt</th>
                      <th>Ngày Chưa đạt</th>
                      <th className="center">Gợi ý</th>
                    </tr>
                  </thead>
                  <tbody>
                    {goals.map((g) => (
                      <tr key={g.key}>
                        <td title={g.text}>{g.key}</td>
                        <td>
                          <span className="dg-xcheck__dates">
                            {g.met.length
                              ? g.met.map((x) => (
                                  <span key={x} className="chip chip--green">
                                    {dayMonth(x)}
                                  </span>
                                ))
                              : '—'}
                          </span>
                        </td>
                        <td>
                          <span className="dg-xcheck__dates">
                            {g.notMet.length
                              ? g.notMet.map((x) => (
                                  <span key={x} className="chip chip--red">
                                    {dayMonth(x)}
                                  </span>
                                ))
                              : '—'}
                          </span>
                        </td>
                        {/* OBS-27: chỉ cần 1 lần Đạt trong chủ đề là Đạt */}
                        <td className="center">
                          <span className={`chip ${g.met.length ? 'chip--green' : 'chip--red'}`}>{g.met.length ? 'Đạt' : 'Chưa đạt'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {timeline.length > 0 && (
            <section>
              <h3 className="section-title">Theo từng ngày</h3>
              <div className="table-wrap">
                <table className="table table--grid table--compact">
                  <thead>
                    <tr>
                      <th>Ngày</th>
                      <th>Đạt</th>
                      <th>Chưa đạt</th>
                      <th>Nhận xét của cô</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timeline.map((day) =>
                      day.absent ? (
                        <tr key={day.date}>
                          <td className="nowrap">{formatDate(day.date)}</td>
                          {/* OBS-01: ngày vắng mọi mục tiêu của giáo án hôm đó tính Chưa đạt */}
                          <td colSpan={2}>
                            <span className="chip">Vắng</span>{' '}
                            <span className="muted text-sm">mục tiêu của giáo án hôm đó tính Chưa đạt</span>
                          </td>
                          <td>—</td>
                        </tr>
                      ) : (
                        <tr key={day.date}>
                          <td className="nowrap">{formatDate(day.date)}</td>
                          <td>{(day.met || []).map(goalLabel).join(', ') || '—'}</td>
                          <td>{[...(day.effort || []), ...(day.notMet || [])].map(goalLabel).join(', ') || '—'}</td>
                          <td>{day.comment || '—'}</td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <PeriodSummaryTable data={d.summary} />
        </div>
      )}
    </SidePanel>
  );
}
