import { useState } from 'react';
import { ArrowLeft, Award, BadgeCheck, Download, Ticket } from '@/components/ui/icons';
import { CampusFilter } from '@/components/ui/CampusFilter';
import { RowActions } from '@/components/ui/RowActions';
import { StatCardIcon } from '@/components/ui/StatCardIcon';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { TicketSummary } from '@/components/assessment/TicketSummary';
import { useTicketOverview } from '@/hooks/assessment/useAssessment';
import { PERIOD_TYPE } from '@/models/assessment/assessmentConstants';
import { periodLabel } from '@/utils/assessment/assessmentPeriods';
import { downloadCsv } from '@/utils/exportCsv';

const monthText = (m) => periodLabel(PERIOD_TYPE.MONTH, m, m);

/**
 * Phiếu bé ngoan các lớp cho PHT (điểm trường mình) và Hiệu trưởng (toàn trường, lọc điểm trường):
 * thẻ tổng, bảng theo lớp; bấm Xem một lớp để thấy tổng hợp từng trẻ. Chỉ xem, phát phiếu do giáo viên lớp.
 */
export function TicketOverview() {
  const [month, setMonth] = useState('');
  const [campusId, setCampusId] = useState('');
  const [classId, setClassId] = useState('');
  const { overview, loading, error, reload } = useTicketOverview({ month: month || undefined, campusId: campusId || undefined });
  const rows = overview?.rows || [];
  const t = overview?.totals;
  const rangeText = month ? monthText(month) : 'cả năm học';
  const campusName = (id) => overview?.campuses.find((c) => c.id === id)?.name || id;
  const multiCampus = (overview?.campuses.length || 0) > 1;

  if (classId) {
    const cls = rows.find((r) => r.classId === classId);
    return (
      <>
        <div className="filter-bar">
          <button className="btn" onClick={() => setClassId('')}>
            <ArrowLeft size={16} /> Tất cả lớp
          </button>
          {cls && multiCampus && <span className="muted">{campusName(cls.campusId)}</span>}
        </div>
        <TicketSummary classId={classId} />
      </>
    );
  }

  const kpis = t
    ? [
        { key: 'weekly', tone: 'teal', icon: Ticket, value: t.weekly, label: 'Phiếu tuần' },
        { key: 'monthly', tone: 'blue', icon: Award, value: t.monthly, label: 'Phiếu tháng' },
        { key: 'total', tone: 'gray', icon: BadgeCheck, value: t.weekly + t.monthly, label: 'Tổng phiếu đã phát' },
        { key: 'children', tone: 'green', value: `${t.withTicket}/${t.children}`, label: 'Trẻ có phiếu' },
      ]
    : [];

  const exportCsv = () =>
    downloadCsv(
      [
        [`Phiếu bé ngoan các lớp – ${rangeText}`],
        ['Điểm trường', 'Lớp', 'Sĩ số', 'Phiếu tuần', 'Phiếu tháng', 'Trẻ có phiếu'],
        ...rows.map((r) => [campusName(r.campusId), r.className, r.children, r.weekly, r.monthly, r.withTicket]),
      ],
      `phieu-be-ngoan-cac-lop-${month || 'nam-hoc'}.csv`,
    );

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
        <CampusFilter campuses={overview?.campuses} value={campusId} onChange={setCampusId} />
        <select className="select" aria-label="Khoảng thời gian" value={month} onChange={(e) => setMonth(e.target.value)}>
          <option value="">Cả năm học</option>
          {(overview?.months || []).map((m) => (
            <option key={m} value={m}>
              {monthText(m)}
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
                <th>Lớp</th>
                {multiCampus && <th>Điểm trường</th>}
                <th className="num">Sĩ số</th>
                <th className="num">Phiếu tuần</th>
                <th className="num">Phiếu tháng</th>
                <th className="num">Trẻ có phiếu</th>
                <th className="cell--actions">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading || !overview ? (
                <SkeletonRows rows={5} cols={multiCampus ? 7 : 6} />
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={multiCampus ? 7 : 6}>
                    <EmptyState title="Không có lớp trong phạm vi" />
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.classId}>
                    <td className="fw-600">{r.className}</td>
                    {multiCampus && <td>{campusName(r.campusId)}</td>}
                    <td className="num">{r.children}</td>
                    <td className={`num ${r.weekly ? 'fw-600' : 'muted'}`}>{r.weekly}</td>
                    <td className={`num ${r.monthly ? 'fw-600' : 'muted'}`}>{r.monthly}</td>
                    <td className="num">
                      {r.withTicket}/{r.children}
                    </td>
                    <td className="cell--actions">
                      <RowActions view={{ label: 'Xem từng trẻ', onClick: () => setClassId(r.classId) }} name={r.className} />
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
