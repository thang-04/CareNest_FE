import { Fragment, useState } from 'react';
import { Card } from '@/components/education-plan/eduUi';
import { domainLabel } from '@/models/education-plan/educationPlanConstants';
import { domainRoman } from '@/models/education-plan/goalTable';
import { WEEKDAY_LABELS, contentLinesOf, coverageOf, ddmm, themeTree } from '@/models/education-plan/classPlan';

const dayShort = (i) => WEEKDAY_LABELS[i].replace('Thứ ', 'T');

/**
 * Tab "Bảng phủ MT" (FR-013, FR-023, US5): hàng MT nhóm theo lĩnh vực (như bảng kế hoạch chủ đề), cột tuần của chủ đề, ô ghi
 * các thứ đã dạy, cột đếm lượt. weeks = [{ start, no, offDays, doc, edited }] là bản tuần người xem được thấy (trang tính sẵn
 * theo quyền và bản hiệu lực). onOpen(weekStart, day) mở đúng tuần, cuộn tới cột ngày.
 */
export function CoverageTab({ blocks, cards, weeks, contentsOf, onOpen }) {
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState(() => new Set());
  const goals = blocks.flatMap((b) => b.goals);
  const cov = coverageOf(goals, cards, weeks);
  const tree = new Map(themeTree(blocks, cards, (g) => contentLinesOf(contentsOf(g))).map((t) => [String(t.goal.id), t]));
  const rowOf = new Map(cov.rows.map((r) => [String(r.goal.id), r]));
  const show = (g) => {
    if (filter === 'missing') return !rowOf.get(String(g.id)).count;
    if (filter === 'contents') return tree.get(String(g.id)).contents.some((c) => c.warn);
    return true;
  };
  const toggle = (id) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const cols = weeks.length + 3;
  const shown = blocks.map((b) => b.goals.filter(show));
  return (
    <Card title="Bảng phủ MT" bodyClass="card__body stack">
      {goals.length === 0 ? (
        <p className="text-danger text-sm text-right">Kế hoạch năm chưa tích nội dung nào vào chủ đề này.</p>
      ) : (
        <>
          <div className="row row--wrap row--between row--middle gap-2">
            <div className="row row--wrap gap-2" role="group" aria-label="Lọc">
              {[
                ['all', 'Tất cả'],
                ['missing', 'MT chưa dạy'],
                ['contents', 'Nội dung chưa có hoạt động'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={filter === key}
                  className={`btn btn--sm ${filter === key ? 'btn--primary' : 'btn--outline-primary'}`}
                  onClick={() => setFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="muted text-sm">
              Đã phủ {cov.covered}/{cov.total} MT
            </span>
          </div>
          <div className="table-wrap">
            <table className="table ga-plan-table ga-goal-table">
              <colgroup>
                <col className="ga-goal-table__del" />
                <col className="ga-goal-table__goaltext" />
                {weeks.map((w) => (
                  <col key={w.start} />
                ))}
                <col className="ga-goal-table__del" />
              </colgroup>
              <thead>
                <tr>
                  <th className="ga-stt">TT</th>
                  <th>Mục tiêu giáo dục</th>
                  {weeks.map((w) => (
                    <th key={w.start} className="center">
                      Tuần {w.no} · {ddmm(w.start)}
                      {w.edited && <div className="text-xs text-warning">Đã sửa theo chủ đề</div>}
                    </th>
                  ))}
                  <th className="center">Lần</th>
                </tr>
              </thead>
              <tbody>
                {blocks.map((b, bi) => {
                  const list = shown[bi];
                  if (!list.length) return null;
                  const firstOfDomain = shown.findIndex((l, i) => l.length && blocks[i].domain === b.domain) === bi;
                  return (
                    <Fragment key={`${b.domain}-${b.sub}-${bi}`}>
                      {firstOfDomain && (
                        <tr>
                          <td colSpan={cols} className="ga-goal-table__domain">
                            <div className="ga-goal-table__pad">
                              <h3>
                                {domainRoman(b.domain)}. {domainLabel(b.domain).toUpperCase()}
                              </h3>
                            </div>
                          </td>
                        </tr>
                      )}
                      {b.sub && (
                        <tr>
                          <td colSpan={cols} className="ga-goal-table__subband">
                            <div className="ga-goal-table__subname">{b.sub}</div>
                          </td>
                        </tr>
                      )}
                      {list.map((g) => {
                        const id = String(g.id);
                        const r = rowOf.get(id);
                        const t = tree.get(id);
                        const empty = t.contents.filter((c) => c.warn).length;
                        return (
                          <Fragment key={id}>
                            <tr>
                              <td className="ga-stt">
                                <div className="ga-goal-table__pad">
                                  <span className="ga-goal-code">MT{g.no}</span>
                                </div>
                              </td>
                              <td>
                                <div className="ga-goal-table__pad stack">
                                  <span>{g.text}</span>
                                  {/* MT chưa dạy ngày nào: chữ đỏ nhỏ, chỉ cảnh báo (gói học kỳ không chặn — EDU-80) */}
                                  {!r.count && <span className="text-danger text-sm">Chưa dạy</span>}
                                  {t.contents.length > 0 && (
                                    <div className="row row--wrap row--middle gap-2">
                                      <button type="button" className="btn btn--sm" aria-expanded={open.has(id)} onClick={() => toggle(id)}>
                                        {open.has(id) ? 'Ẩn nội dung' : `Xem ${t.contents.length} nội dung`}
                                      </button>
                                      {empty > 0 && <span className="text-danger text-sm">{empty} nội dung chưa có hoạt động</span>}
                                    </div>
                                  )}
                                </div>
                              </td>
                              {weeks.map((w) => (
                                <td key={w.start} className="center">
                                  <div className="ga-goal-table__pad row row--wrap gap-1">
                                    {(r.weeks[w.start] || []).map((i) => (
                                      <button
                                        key={i}
                                        type="button"
                                        className="btn btn--sm btn--outline-primary"
                                        aria-label={`Mở tuần ${w.no}, ${WEEKDAY_LABELS[i]}`}
                                        onClick={() => onOpen(w.start, i)}
                                      >
                                        {dayShort(i)}
                                      </button>
                                    ))}
                                  </div>
                                </td>
                              ))}
                              <td className="center">
                                <div className="ga-goal-table__pad">{r.count}</div>
                              </td>
                            </tr>
                            {open.has(id) && (
                              <tr>
                                <td />
                                <td colSpan={cols - 1}>
                                  <ul className="ga-goal-table__pad stack text-sm">
                                    {t.contents.map((c) => (
                                      <li key={c.index}>
                                        {c.text}
                                        {c.warn && <span className="text-danger"> · chưa có hoạt động</span>}
                                      </li>
                                    ))}
                                  </ul>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </Fragment>
                  );
                })}
                {/* Hàng cuối: hoạt động gõ tay chưa gắn MT không tính vào MT nào (Tiền 12/11) */}
                <tr>
                  <td />
                  <td colSpan={cols - 1}>
                    <div className="ga-goal-table__pad stack">
                      <span className="fw-600">Hoạt động chưa gắn MT</span>
                      {cov.unlinked.length === 0 ? (
                        <span className="muted text-sm">Không có</span>
                      ) : (
                        <ul className="stack text-sm">
                          {cov.unlinked.map((u) => {
                            const w = weeks.find((x) => x.start === u.weekStart);
                            const when = /^\d$/.test(u.day) ? WEEKDAY_LABELS[Number(u.day)] : 'cả tuần';
                            return (
                              <li key={`${u.weekStart}-${u.rowKey}-${u.day}`} className="row row--wrap row--middle gap-2">
                                <button
                                  type="button"
                                  className="btn btn--sm btn--outline-primary"
                                  onClick={() => onOpen(u.weekStart, u.day)}
                                >
                                  Tuần {w?.no} · {when}
                                </button>
                                <span>{u.text}</span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}
