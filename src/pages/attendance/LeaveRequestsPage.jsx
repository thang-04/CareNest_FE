import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, RotateCcw } from '@/components/ui/icons';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { LeaveStatusBadge } from '@/components/attendance/AttendanceBadges';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { DateInput } from '@/components/form/DateInput';
import { SelectField } from '@/components/form/Field';
import { SemesterSelect } from '@/components/form/SemesterSelect';
import { semesterRange } from '@/utils/semesters';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useAsync } from '@/hooks/useAsync';
import { useAttendanceClasses } from '@/hooks/attendance/useAttendance';
import { useAgeGroupOptions } from '@/hooks/attendance/useAgeGroupOptions';
import { useYearCampuses } from '@/hooks/useYearCampuses';
import { campusOptionLabel } from '@/utils/campusLabel';
import { PERMISSIONS } from '@/models/bePermissions';
import { getCampuses } from '@/services/masterDataService';
import { getLeaveRequests } from '@/services/attendance/attendanceService';
import { canFilterLeaveByCampus } from '@/utils/attendance/attendancePermissions';
import { addDays, schoolToday } from '@/utils/attendance/attendanceTime';
import { attendanceCrumbs } from '@/utils/attendance/breadcrumbs';
import { exportWithPreview } from '@/components/ui/ExportPreview';
import { formatDate, formatDateTime, isIsoDate, monthRangeOf } from '@/utils/format';
import { childNameWithHistory } from '@/utils/childHistory';
import { LEAVE_PART, LEAVE_PART_LABELS, LEAVE_STATUS_LABELS, MEAL_SESSION_LABELS } from '@/models/attendance/attendanceConstants';
import '@/styles/modules/attendance.css';

const PAGE_SIZE = 10;
// ATT-12: đơn một buổi ghi bé có ăn bữa của buổi còn học không
// eats null: đơn cả ngày hoặc buổi còn học không có bữa nào ⇒ không áp dụng
const eatsLabel = (r) =>
  r.eats == null || !r.part || r.part === LEAVE_PART.FULL_DAY
    ? '—'
    : `${r.eats ? 'Có ăn' : 'Không ăn'}${r.eatsMeals?.length ? ` (${r.eatsMeals.map((s) => MEAL_SESSION_LABELS[s] || s).join(', ')})` : ''}`;

// ATT-04, ATT-05: phụ huynh gửi/hủy đơn trên App; GV, PHT, HT chỉ xem đơn của trẻ trong phạm vi (BE lọc theo quyền)
export default function LeaveRequestsPage() {
  const { user } = useAuth();
  const today = schoolToday();
  const [filters, setFilters] = useState(() => ({ ...monthRangeOf(today), campusId: '', classId: '', ageGroupId: '' }));
  const [page, setPage] = useState(1);
  // Lọc nhanh theo học kỳ: đặt khoảng ngày theo học kỳ; sửa ngày tay thì bỏ chọn
  const [semester, setSemester] = useState('');
  const classesQuery = useAttendanceClasses();
  // Năm học ở đầu trang: xem lại đơn của năm cũ. Đổi năm ⇒ bỏ lớp đã chọn; hôm nay ngoài năm đó thì xem tháng cuối năm
  const { schoolYear, schoolYears } = useSchoolYear();
  const yearRef = useRef(schoolYear);
  useEffect(() => {
    if (yearRef.current === schoolYear) return;
    yearRef.current = schoolYear;
    const y = schoolYears.find((o) => o.id === schoolYear);
    const inYear = !y?.startDate || (today >= y.startDate && today <= y.endDate);
    setFilters((f) => ({ ...f, ...monthRangeOf(inYear ? today : y.endDate), classId: '' }));
    setSemester('');
    setPage(1);
  }, [schoolYear, schoolYears, today]);
  const { data: campuses } = useAsync(() => getCampuses(user), [user?.id]);
  const leader = canFilterLeaveByCampus(user);
  const ageGroups = useAgeGroupOptions(classesQuery.classes);
  const classes = useMemo(
    () =>
      classesQuery.classes.filter(
        (c) =>
          (!filters.campusId || String(c.campusId) === String(filters.campusId)) &&
          (!filters.ageGroupId || String(c.ageGroupId) === filters.ageGroupId),
      ),
    [classesQuery.classes, filters.campusId, filters.ageGroupId],
  );
  // HT: đủ điểm trường của năm đang chọn; người khác: điểm trường có lớp trong phạm vi xem
  const yearCampuses = useYearCampuses(PERMISSIONS.ATTENDANCE_VIEW);
  const campusIds = new Set(yearCampuses ? yearCampuses.map((c) => String(c.id)) : classesQuery.classes.map((c) => String(c.campusId)));
  const campusList = [...campusIds].map((id) => (yearCampuses || campuses || []).find((c) => String(c.id) === id) || { id, name: id });
  const invalidRange = !isIsoDate(filters.from) || !isIsoDate(filters.to) || filters.from > filters.to;
  const query = invalidRange
    ? null
    : {
        from: filters.from,
        to: filters.to,
        campusId: filters.campusId || undefined,
        classId: filters.classId || undefined,
        schoolYear: schoolYear || undefined,
      };
  const leaves = useAsync(() => getLeaveRequests(query, user), [JSON.stringify(query), user?.id], { enabled: !invalidRange });
  // Lọc nhóm tuổi theo lớp của đơn (người dùng chọn, BE vẫn giới hạn phạm vi)
  const classIds = new Set(classes.map((c) => String(c.id)));
  const rows = invalidRange ? [] : (leaves.data || []).filter((r) => !filters.ageGroupId || classIds.has(String(r.classId)));
  const currentPage = Math.min(page, Math.max(1, Math.ceil(rows.length / PAGE_SIZE)));
  const setFilter = (patch) => {
    setFilters((f) => ({
      ...f,
      ...patch,
      ...(patch.campusId !== undefined || patch.ageGroupId !== undefined ? { classId: '' } : {}),
    }));
    setPage(1);
  };
  const campusName = (id) => {
    const c = [...(yearCampuses || []), ...(campuses || [])].find((x) => String(x.id) === String(id));
    return c?.shortName || c?.name || '';
  };
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
      'Buổi',
      'Bé tham gia ăn',
      'Lý do',
      'Trạng thái',
      'Ghi chú hiệu lực',
      'Hủy từ ngày',
      'Người gửi',
      'Gửi lúc',
    ];
    const body = rows.map((r) => [
      childNameWithHistory(r.childName, r.historyStatus),
      r.className,
      ...(leader ? [campusName(r.campusId)] : []),
      formatDate(r.fromDate),
      formatDate(r.toDate),
      LEAVE_PART_LABELS[r.part || LEAVE_PART.FULL_DAY],
      eatsLabel(r),
      r.reason,
      LEAVE_STATUS_LABELS[r.status] || r.status,
      r.noticeOnly ? 'Báo nghỉ chiều sau giờ chốt; không đổi điểm danh/suất ăn' : '',
      cancelledFrom(r),
      r.createdByName || '',
      formatDateTime(r.createdAt),
    ]);
    exportWithPreview(
      [[`Đơn nghỉ của phụ huynh ${formatDate(filters.from)} – ${formatDate(filters.to)}`], head, ...body],
      `don-nghi-${filters.from}-${filters.to}.xlsx`,
    );
  };
  const statusOf = (r) => (
    <>
      <LeaveStatusBadge status={r.status} />
      {r.noticeOnly && <div className="muted">Báo nghỉ chiều sau giờ chốt · không đổi điểm danh/suất ăn</div>}
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
      <div className="card">
        <div className="filter-bar">
          <div className="field">
            <span className="field__label">Học kỳ</span>
            <SemesterSelect
              value={semester}
              emptyLabel="Chọn ngày"
              onChange={(key, sem) => {
                const next = semesterRange(sem, today);
                setSemester(next ? key : '');
                if (next) setFilter(next);
              }}
            />
          </div>
          <div className="field">
            <span className="field__label">Từ ngày</span>
            <DateInput
              aria-label="Từ ngày"
              value={filters.from}
              max={filters.to || undefined}
              onChange={(from) => {
                setSemester('');
                setFilter({ from });
              }}
            />
          </div>
          <div className="field">
            <span className="field__label">Đến ngày</span>
            <DateInput
              aria-label="Đến ngày"
              value={filters.to}
              min={filters.from || undefined}
              onChange={(to) => {
                setSemester('');
                setFilter({ to });
              }}
            />
          </div>
          {leader && campusIds.size > 1 && (
            <select
              className="select"
              aria-label="Lọc điểm trường"
              value={filters.campusId}
              onChange={(e) => setFilter({ campusId: e.target.value })}
            >
              <option value="">Tất cả điểm trường</option>
              {campusList.map((c) => (
                <option key={c.id} value={c.id}>
                  {campusOptionLabel(c, campusList)}
                </option>
              ))}
            </select>
          )}
          {ageGroups.length > 1 && (
            <SelectField
              aria-label="Lọc nhóm tuổi"
              value={filters.ageGroupId}
              onChange={(e) => setFilter({ ageGroupId: e.target.value })}
              placeholder="Tất cả nhóm tuổi"
              options={ageGroups.map((g) => ({ value: g.id, label: g.name }))}
            />
          )}
          {classes.length > 1 && (
            <select
              className="select"
              aria-label="Lọc lớp"
              value={filters.classId}
              onChange={(e) => setFilter({ classId: e.target.value })}
            >
              <option value="">Tất cả lớp</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <button
            className="btn"
            type="button"
            onClick={() => setFilter({ ...monthRangeOf(today), campusId: '', classId: '', ageGroupId: '' })}
          >
            <RotateCcw size={15} /> Đặt lại bộ lọc
          </button>
        </div>
        {invalidRange && (
          <p className="field__error" role="alert">
            Nhập khoảng ngày hợp lệ theo dd/mm/yyyy, ngày bắt đầu không sau ngày kết thúc.
          </p>
        )}
        {/* Khoảng ngày sai: chỉ báo lỗi ở trên, không dựng bảng hay trạng thái "không có đơn nghỉ" */}
        {invalidRange ? null : leaves.error ? (
          <ErrorState error={leaves.error} onRetry={leaves.reload} />
        ) : (
          <div className="table-wrap">
            <table className="table table--grid">
              <thead>
                <tr>
                  <th>Trẻ</th>
                  <th>Lớp</th>
                  <th className="center">Nghỉ</th>
                  <th className="center">Buổi</th>
                  <th className="center" title="Bữa của buổi còn học; — khi đơn cả ngày hoặc buổi còn học không có bữa">
                    Bé tham gia ăn
                  </th>
                  <th>Lý do</th>
                  <th className="center">Trạng thái</th>
                  <th>Người gửi</th>
                  <th className="center">Gửi lúc</th>
                </tr>
              </thead>
              <tbody>
                {leaves.loading && !leaves.data ? (
                  <SkeletonRows rows={4} cols={9} />
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      {filters.campusId && !classes.length ? (
                        <EmptyState title="Chưa có dữ liệu" description="Điểm trường này chưa có lớp trong năm học đang chọn." />
                      ) : (
                        <EmptyState title="Không có đơn nghỉ" description="Chưa có phụ huynh nào gửi đơn nghỉ trong khoảng đã chọn." />
                      )}
                    </td>
                  </tr>
                ) : (
                  paginate(rows, currentPage, PAGE_SIZE).map((r) => (
                    <tr key={r.id}>
                      <td>{childNameWithHistory(r.childName, r.historyStatus)}</td>
                      <td>
                        {r.className}
                        {leader && campusIds.size > 1 && r.campusId ? ` · ${campusName(r.campusId)}` : ''}
                      </td>
                      <td className="nowrap center">
                        {r.fromDate === r.toDate ? formatDate(r.fromDate) : `${formatDate(r.fromDate)} – ${formatDate(r.toDate)}`}
                      </td>
                      <td className="nowrap center">{LEAVE_PART_LABELS[r.part || LEAVE_PART.FULL_DAY]}</td>
                      <td className="center">{eatsLabel(r)}</td>
                      <td>{r.reason}</td>
                      <td className="center">{statusOf(r)}</td>
                      <td>{r.createdByName || ''}</td>
                      <td className="nowrap center">{formatDateTime(r.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        {!invalidRange && <Pagination page={currentPage} total={rows.length} pageSize={PAGE_SIZE} onChange={setPage} />}
      </div>
    </div>
  );
}
