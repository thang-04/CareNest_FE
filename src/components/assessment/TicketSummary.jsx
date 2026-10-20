import { useState } from 'react';
import { Award, BadgeCheck, Download, Flag, Ticket } from '@/components/ui/icons';
import { StatCardIcon } from '@/components/ui/StatCardIcon';
import { ChildAvatar } from '@/components/ChildAvatar';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { useTicketSummary } from '@/hooks/assessment/useAssessment';
import { periodLabel } from '@/utils/assessment/assessmentPeriods';
import { PERIOD_TYPE } from '@/models/assessment/assessmentConstants';
import { downloadCsv } from '@/utils/exportCsv';

const monthText = (m) => periodLabel(PERIOD_TYPE.MONTH, m, m);

// Sắp xếp hiển thị (chỉ đổi thứ tự dòng, không tính lại số liệu)
const tickets = (r) => r.weekly + r.monthly;
const byName = (a, b) => a.child.fullName.localeCompare(b.child.fullName, 'vi');
const SORTS = {
  most: { label: 'Nhiều phiếu → ít phiếu', fn: (a, b) => tickets(b) - tickets(a) || b.monthly - a.monthly || byName(a, b) },
  least: { label: 'Ít phiếu → nhiều phiếu', fn: (a, b) => tickets(a) - tickets(b) || a.monthly - b.monthly || byName(a, b) },
  flags: { label: 'Nhiều cờ bé ngoan → ít', fn: (a, b) => b.flags - a.flags || byName(a, b) },
  name: { label: 'Tên A → Z', fn: byName },
};

/**
 * Tổng hợp phiếu bé ngoan của lớp theo trẻ: số phiếu tuần, phiếu tháng, cờ bé ngoan trong năm học hoặc một tháng.
 * Số liệu do service trả (BE tính), màn hình chỉ hiển thị và xuất Excel.
 */
export function TicketSummary({ classId }) {
  const [month, setMonth] = useState('');
  const [sort, setSort] = useState('most');
  const { summary, loading, error, reload } = useTicketSummary({ classId, month: month || undefined });
  const rows = [...(summary?.rows || [])].sort(SORTS[sort].fn);
  const t = summary?.totals;
  const rangeText = month ? monthText(month) : 'cả năm học';

  const exportCsv = () =>
    downloadCsv(
      [
        [`Tổng hợp phiếu bé ngoan ${summary.cls.name} – ${rangeText}`],
        ['Mã trẻ', 'Họ tên', 'Phiếu tuần', 'Phiếu tháng', 'Cờ bé ngoan'],
        ...rows.map((r) => [r.child.code, r.child.fullName, r.weekly, r.monthly, r.flags]),
      ],
      `phieu-be-ngoan-${summary.cls.name}-${month || 'nam-hoc'}.csv`,
    );

  // Thẻ tổng số phiếu của khoảng đang chọn (số do service tính)
  const kpis = t
    ? [
        { key: 'weekly', tone: 'teal', icon: Ticket, value: t.weekly, label: 'Phiếu tuần' },
        { key: 'monthly', tone: 'blue', icon: Award, value: t.monthly, label: 'Phiếu tháng' },
        { key: 'total', tone: 'gray', icon: BadgeCheck, value: t.weekly + t.monthly, label: 'Tổng phiếu đã phát' },
        { key: 'children', tone: 'green', value: `${t.children}/${t.total}`, label: 'Trẻ có phiếu' },
      ]
    : [];

  return (
    <>
      {kpis.length > 0 && (
        <div className="stat-grid dg-ticket-kpis">
          {kpis.map((k) => (
            <div key={k.key} className={`stat-card stat-card--${k.tone}`}>
              <div className="stat-card__value">{k.value}</div>
              <div className="stat-card__label">
                {k.label} · {rangeText}
              </div>
              <StatCardIcon tone={k.tone} icon={k.icon} />
            </div>
          ))}
        </div>
      )}
      <div className="filter-bar dg-ticket-bar">
        {summary?.cls && <span className="fw-600">{summary.cls.name}</span>}
        <select className="select" aria-label="Khoảng thời gian" value={month} onChange={(e) => setMonth(e.target.value)}>
          <option value="">Cả năm học</option>
          {(summary?.months || []).map((m) => (
            <option key={m} value={m}>
              {monthText(m)}
            </option>
          ))}
        </select>
        <select className="select" aria-label="Sắp xếp" value={sort} onChange={(e) => setSort(e.target.value)}>
          {Object.entries(SORTS).map(([key, x]) => (
            <option key={key} value={key}>
              {x.label}
            </option>
          ))}
        </select>
        <div className="spacer" />
        {rows.length > 0 && (
          <button className="btn" onClick={exportCsv}>
            <Download size={16} /> Xuất Excel
          </button>
        )}
      </div>
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <div className="table-wrap dg-ticket-table">
          <table className="table table--grid">
            <thead>
              <tr>
                <th className="center dg-col-no">STT</th>
                <th>Trẻ</th>
                <th className="num">Phiếu tuần</th>
                <th className="num">Phiếu tháng</th>
                <th className="num">Cờ bé ngoan</th>
              </tr>
            </thead>
            <tbody>
              {loading || !summary ? (
                <SkeletonRows rows={5} cols={5} />
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState title="Lớp chưa có trẻ" />
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={r.child.id}>
                    <td className="center muted">{i + 1}</td>
                    <td>
                      <div className="dg-ticket-child">
                        <ChildAvatar child={r.child} size="sm" />
                        <div>
                          <div className="fw-600">{r.child.fullName}</div>
                          <div className="muted text-xs">{r.child.code}</div>
                        </div>
                      </div>
                    </td>
                    <td className={`num ${r.weekly ? 'fw-600' : 'muted'}`}>{r.weekly}</td>
                    <td className={`num ${r.monthly ? 'fw-600' : 'muted'}`}>{r.monthly}</td>
                    <td className="num">
                      <span className="dg-flag-count">
                        <Flag size={14} aria-hidden="true" /> {r.flags}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
