import { useState } from 'react';
import { ArrowLeft, Download } from '@/components/ui/icons';
import { RowActions } from '@/components/ui/RowActions';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { TicketSummary } from '@/components/assessment/TicketSummary';
import { useTicketOverview } from '@/hooks/assessment/useAssessment';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { PERIOD_TYPE } from '@/models/assessment/assessmentConstants';
import { periodLabel } from '@/utils/assessment/assessmentPeriods';
import { downloadCsv } from '@/utils/exportCsv';

const monthText = (m) => periodLabel(PERIOD_TYPE.MONTH, m, m);

/**
 * Phiếu bé ngoan các lớp cho PHT (điểm trường mình) và Hiệu trưởng (toàn trường, lọc điểm trường):
 * bảng theo lớp; bấm Xem một lớp để thấy tổng hợp từng trẻ. Chỉ xem, phát phiếu do giáo viên lớp.
 */
export function TicketOverview() {
  const { schoolYear } = useSchoolYear();
  // Tháng đã chọn gắn với năm học ở header: đổi năm thì về cả năm học
  const [picked, setPicked] = useState({ year: schoolYear, month: '' });
  const month = picked.year === schoolYear ? picked.month : '';
  const setMonth = (value) => setPicked({ year: schoolYear, month: value });
  const [campusId, setCampusId] = useState('');
  const [classId, setClassId] = useState('');
  const [page, setPage] = useState(1);
  const PAGE = 10;
  const { overview, loading, error, reload } = useTicketOverview({
    schoolYear,
    month: month || undefined,
    campusId: campusId || undefined,
  });
  const rows = overview?.rows || [];
  const rangeText = month ? monthText(month) : 'cả năm học';
  const campusName = (id) => overview?.campuses.find((c) => String(c.id) === String(id))?.name || id;
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

  const exportCsv = () =>
    downloadCsv(
      [
        [`Phiếu bé ngoan các lớp – ${rangeText}`],
        ['Điểm trường', 'Lớp', 'Sĩ số', 'Bé ngoan', 'Bé ngoan toàn diện', 'Trẻ có phiếu'],
        ...rows.map((r) => [campusName(r.campusId), r.className, r.children, r.weekly, r.monthly, r.withTicket]),
      ],
      `phieu-be-ngoan-cac-lop-${month || 'nam-hoc'}.csv`,
    );

  return (
    <>
      <div className="filter-bar dg-ticket-bar">
        {multiCampus && (
          <select className="select" aria-label="Điểm trường" value={campusId} onChange={(e) => setCampusId(e.target.value)}>
            <option value="">Tất cả điểm trường</option>
            {overview.campuses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
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
                <th className="num">Bé ngoan</th>
                <th className="num">Bé ngoan toàn diện</th>
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
                paginate(rows, Math.min(page, Math.max(1, Math.ceil(rows.length / PAGE))), PAGE).map((r) => (
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
          {rows.length > PAGE && (
            <Pagination
              page={Math.min(page, Math.ceil(rows.length / PAGE))}
              total={rows.length}
              pageSize={PAGE}
              onChange={setPage}
              unit="lớp"
            />
          )}
        </div>
      )}
    </>
  );
}
