import { useMemo, useState } from 'react';
import { Download, RotateCcw } from '@/components/ui/icons';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { LeaveStatusBadge } from '@/components/attendance/AttendanceBadges';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { DateInput } from '@/components/form/DateInput';
import { useAuth } from '@/contexts/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { useAttendanceClasses } from '@/hooks/attendance/useAttendance';
import { getCampuses } from '@/services/masterDataService';
import { getLeaveRequests } from '@/services/attendance/attendanceService';
import { canFilterLeaveByCampus } from '@/utils/attendance/attendancePermissions';
import { addDays, schoolToday } from '@/utils/attendance/attendanceTime';
import { attendanceCrumbs } from '@/utils/attendance/breadcrumbs';
import { downloadXlsx } from '@/utils/exportXlsx';
import { formatDate, formatDateTime, isIsoDate, monthRangeOf } from '@/utils/format';
import { LEAVE_STATUS_LABELS } from '@/models/attendance/attendanceConstants';
import '@/styles/modules/attendance.css';

const PAGE_SIZE = 10;

// ATT-04, ATT-05: phụ huynh gửi/hủy đơn trên App; GV, PHT, HT chỉ xem đơn của trẻ trong phạm vi (BE lọc theo quyền)
export default function LeaveRequestsPage() {
  const { user } = useAuth();
  const today = schoolToday();
  const [filters, setFilters] = useState(() => ({ ...monthRangeOf(today), campusId: '', classId: '' }));
  const [page, setPage] = useState(1);
  const classesQuery = useAttendanceClasses();
  const { data: campuses } = useAsync(() => getCampuses(user), [user?.id]);
  const leader = canFilterLeaveByCampus(user);
  const classes = useMemo(
    () => classesQuery.classes.filter((c) => !filters.campusId || c.campusId === filters.campusId),
    [classesQuery.classes, filters.campusId],
  );
  const campusIds = new Set(classesQuery.classes.map((c) => c.campusId));
  const invalidRange = !isIsoDate(filters.from) || !isIsoDate(filters.to) || filters.from > filters.to;
  const query = invalidRange
    ? null
    : { from: filters.from, to: filters.to, campusId: filters.campusId || undefined, classId: filters.classId || undefined };
  const leaves = useAsync(() => getLeaveRequests(query), [JSON.stringify(query)], { enabled: !invalidRange });
  const rows = invalidRange ? [] : leaves.data || [];
  const currentPage = Math.min(page, Math.max(1, Math.ceil(rows.length / PAGE_SIZE)));
  const setFilter = (patch) => {
    setFilters((f) => ({ ...f, ...patch, ...(patch.campusId !== undefined ? { classId: '' } : {}) }));
    setPage(1);
  };
  const campusName = (id) => (campuses || []).find((c) => c.id === id)?.name || '';
  // Hủy một phần: BE giữ ACTIVE, effectiveTo là ngày cuối còn hiệu lực
  const cancelledFrom = (r) =>
    r.status === 'ACTIVE' && r.effectiveTo && r.effectiveTo < r.toDate ? formatDate(addDays(r.effectiveTo, 1)) : '';
  const exportCsv = () => {
    // Cột điểm trường chỉ cho HT, PHT (GV chỉ có lớp của mình)
    const head = [
      'Trẻ',
      'Lớp',
      ...(leader ? ['Điểm trường'] : []),
      'Từ ngày',
      'Đến ngày',
      'Lý do',
      'Trạng thái',
      'Hủy từ ngày',
      'Người gửi',
      'Gửi lúc',
    ];
    const body = rows.map((r) => [
      r.childName,
      r.className,
      ...(leader ? [campusName(r.campusId)] : []),
      formatDate(r.fromDate),
      formatDate(r.toDate),
      r.reason,
      LEAVE_STATUS_LABELS[r.status] || r.status,
      cancelledFrom(r),
      r.createdByName || '',
      formatDateTime(r.createdAt),
    ]);
    downloadXlsx(
      [[`Đơn nghỉ của phụ huynh ${formatDate(filters.from)} – ${formatDate(filters.to)}`], head, ...body],
      `don-nghi-${filters.from}-${filters.to}.xlsx`,
    );
  };
  const statusOf = (r) => (
    <>
      <LeaveStatusBadge status={r.status} />
      {cancelledFrom(r) && <div className="muted">Phụ huynh hủy từ {cancelledFrom(r)}</div>}
    </>
  );

  return (
    <div className="page">
      <Breadcrumb items={attendanceCrumbs('Đơn nghỉ của phụ huynh', { linkParent: !leader })} />
      <div className="page__head">
        <h1 className="page__title">Đơn nghỉ của phụ huynh</h1>
        {rows.length > 0 && (
          <button className="btn mt-8" type="button" onClick={exportCsv}>
            <Download size={16} /> Xuất Excel
          </button>
        )}
      </div>
      <p className="page__subtitle">
        Phụ huynh gửi và hủy đơn trên ứng dụng. Ngày có đơn tự ghi Vắng có phép; đơn gửi sau giờ chốt không đổi điểm danh ngày đó.
      </p>
      <div className="card">
        <div className="filter-bar">
          <div className="field">
            <span className="field__label">Từ ngày</span>
            <DateInput aria-label="Từ ngày" value={filters.from} max={filters.to || undefined} onChange={(from) => setFilter({ from })} />
          </div>
          <div className="field">
            <span className="field__label">Đến ngày</span>
            <DateInput aria-label="Đến ngày" value={filters.to} min={filters.from || undefined} onChange={(to) => setFilter({ to })} />
          </div>
          {leader && campusIds.size > 1 && (
            <select
              className="select"
              aria-label="Lọc điểm trường"
              value={filters.campusId}
              onChange={(e) => setFilter({ campusId: e.target.value })}
            >
              <option value="">Tất cả điểm trường</option>
              {[...campusIds].map((id) => (
                <option key={id} value={id}>
                  {campusName(id) || id}
                </option>
              ))}
            </select>
          )}
          <select className="select" aria-label="Lọc lớp" value={filters.classId} onChange={(e) => setFilter({ classId: e.target.value })}>
            <option value="">Tất cả lớp</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button className="btn" type="button" onClick={() => setFilter({ ...monthRangeOf(today), campusId: '', classId: '' })}>
            <RotateCcw size={15} /> Đặt lại bộ lọc
          </button>
        </div>
        {invalidRange && (
          <p className="field__error" role="alert">
            Nhập khoảng ngày hợp lệ theo dd/mm/yyyy, ngày bắt đầu không sau ngày kết thúc.
          </p>
        )}
        {leaves.error ? (
          <ErrorState error={leaves.error} onRetry={leaves.reload} />
        ) : (
          <div className="table-wrap">
            <table className="table table--grid">
              <thead>
                <tr>
                  <th>Trẻ</th>
                  <th>Lớp</th>
                  <th>Nghỉ</th>
                  <th>Lý do</th>
                  <th>Trạng thái</th>
                  <th>Người gửi</th>
                  <th>Gửi lúc</th>
                </tr>
              </thead>
              <tbody>
                {leaves.loading && !leaves.data ? (
                  <SkeletonRows rows={4} cols={7} />
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState title="Không có đơn nghỉ" description="Chưa có phụ huynh nào gửi đơn nghỉ trong khoảng đã chọn." />
                    </td>
                  </tr>
                ) : (
                  paginate(rows, currentPage, PAGE_SIZE).map((r) => (
                    <tr key={r.id}>
                      <td>{r.childName}</td>
                      <td>
                        {r.className}
                        {leader && campusIds.size > 1 && r.campusId ? ` · ${campusName(r.campusId)}` : ''}
                      </td>
                      <td className="nowrap">
                        {r.fromDate === r.toDate ? formatDate(r.fromDate) : `${formatDate(r.fromDate)} – ${formatDate(r.toDate)}`}
                      </td>
                      <td>{r.reason}</td>
                      <td>{statusOf(r)}</td>
                      <td>{r.createdByName || ''}</td>
                      <td className="nowrap">{formatDateTime(r.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={currentPage} total={rows.length} pageSize={PAGE_SIZE} onChange={setPage} />
      </div>
    </div>
  );
}
