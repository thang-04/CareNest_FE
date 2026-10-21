import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Users, Info, UserCheck, Crown, Search } from '@/components/ui/icons';
import { SearchSubmit } from '@/components/ui/SearchSubmit';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { normalizeText } from '@/utils/format';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useSchoolYears, useTeacherAssignments, useTeamLeaders } from '@/hooks/school-config/useSchoolConfig';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { YearPicker } from '@/components/school-config/YearPicker';
import { UnassignedBadge } from '@/components/school-config/SchoolConfigBadges';
import { ScNoAccess } from '@/components/school-config/ScNoAccess';
import { saveTeamLeader } from '@/services/school-config/schoolConfigService';
import { TEACHERS_PER_CLASS, YEAR_STATUS } from '@/models/school-config/schoolConfigConstants';
import { ROLES } from '@/models/User';
import {
  ASSIGN_TEACHER,
  canAssignClass,
  canAssignTeachers,
  canViewTeacherAssignments,
  canViewTeamLeaders,
  permissionAccess,
  teamLeaderActions,
} from '@/utils/school-config/schoolConfigPermissions';
import { teacherCrumbs } from '@/utils/school-config/breadcrumbs';
import { ClassTeachersModal } from '@/components/school-config/ClassTeachersModal';
import { TeamLeaderModal } from '@/components/school-config/TeamLeaderModal';
import '@/styles/modules/school-config.css';

const CAMPUS_ALL = 'all';
const CLASS_PAGE_SIZE = 10;

/** Một dòng nhóm tuổi: tổ trưởng hiện tại và nút mở hộp chọn (cùng kiểu Phân công giáo viên). */
function TeamLeaderRow({ group, classCount, current, campusName, readOnly, acts, onOpen }) {
  const canEdit = !readOnly && (current ? acts.update || acts.delete : acts.create);
  return (
    <tr>
      <td className="fw-600">{group.name}</td>
      <td className="num">{classCount}</td>
      <td>
        {current ? (
          <>
            <span className="fw-600">{current.fullName}</span>
            <span className="muted text-sm"> · {campusName(current.campusId)}</span>
          </>
        ) : (
          <span className="muted">Chưa phân công</span>
        )}
      </td>
      {!readOnly && (
        <td className="cell--actions">
          {canEdit && (
            <button className="btn btn--primary btn--sm" onClick={() => onOpen(group)}>
              <Crown size={15} /> {current ? 'Đổi tổ trưởng' : 'Phân công'}
            </button>
          )}
        </td>
      )}
    </tr>
  );
}

/**
 * #26 Teacher Assignment (UC 2.6). Teacher part follows "Phân công giáo viên"; team leaders follow the separate VP area "Phân công tổ trưởng nhóm tuổi":
 * FULL (always the Principal) chooses any campus, RESTRICTED works on the own campus.
 */
export default function TeacherAssignmentPage() {
  const { user } = useAuth();
  const toast = useToast();
  const md = useMasterData();
  const { schoolYear: headerYear } = useSchoolYear();
  const [params, setParams] = useSearchParams();
  const yearId = params.get('year') || headerYear;
  const access = permissionAccess(user, ASSIGN_TEACHER);
  const fullScope = access.scope === 'ALL';
  // Phạm vi toàn trường: chọn "Toàn trường" (mặc định của Hiệu trưởng, ?campus=all) hoặc 1 điểm trường;
  // phạm vi điểm trường: đúng điểm trường được giao (có thể khác điểm trường của PHT)
  const campusId = fullScope
    ? params.get('campus') || (user?.role === ROLES.PRINCIPAL ? CAMPUS_ALL : user?.campusId || md.campuses[0]?.id)
    : access.campusId || user?.campusId || '';
  const allCampuses = campusId === CAMPUS_ALL;
  // Hai quyền riêng (chốt 14/10/2026): "Phân công giáo viên" theo điểm trường, "Phân công tổ trưởng nhóm tuổi" toàn trường
  const allowed = canViewTeacherAssignments(campusId, user);
  const leaderAllowed = canViewTeamLeaders(user);
  // Chỉ xem: mở được màn hình nhưng ẩn mọi nút phân công
  const canEdit = canAssignTeachers(campusId, user);
  // Tổ trưởng là của cả trường: quyền theo ô Thêm / Sửa / Xóa, không theo điểm trường
  const leaderActs = teamLeaderActions(user);
  const { years } = useSchoolYears();
  const { data, loading, error, reload } = useTeacherAssignments(allowed ? yearId : null, campusId);
  const leaders = useTeamLeaders(leaderAllowed ? yearId : null);
  // Mở từ nút "Phân công tổ trưởng" (#to-truong): cuộn tới phần tổ trưởng khi dữ liệu đã có
  const leadersReady = !!leaders.data;
  useEffect(() => {
    if (leadersReady && window.location.hash === '#to-truong') document.getElementById('to-truong')?.scrollIntoView({ block: 'start' });
  }, [leadersReady]);
  const [editing, setEditing] = useState(null);
  const [leaderGroup, setLeaderGroup] = useState(null);

  const classes = useMemo(() => data?.classes || [], [data]);
  // Lọc lớp ngay ở đầu bảng "Giáo viên theo lớp" (?class=); đổi điểm trường thì bỏ lọc lớp
  const groupFilter = params.get('group') || '';
  const classFilter = params.get('class') || '';
  const classOptions = groupFilter ? classes.filter((c) => c.ageGroupId === groupFilter) : classes;
  // Tìm theo tên lớp hoặc tên giáo viên (không dấu); lọc tình trạng phân công; phân trang 10 lớp (?page=)
  const query = params.get('q') || '';
  const statusFilter = params.get('status') || '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const kw = normalizeText(query.trim());
  const shownClasses = classOptions.filter(
    (c) =>
      (!classFilter || c.id === classFilter) &&
      (!kw ||
        normalizeText(c.name).includes(kw) ||
        c.teacherIds.some((id) => normalizeText(md.userById(id)?.fullName || '').includes(kw))) &&
      (!statusFilter || (statusFilter === 'MISSING' ? c.teacherIds.length < TEACHERS_PER_CLASS : !c.homeroomTeacherId)),
  );
  const pageRows = paginate(shownClasses, page, CLASS_PAGE_SIZE);
  // Đổi bộ lọc thì về trang 1
  const setFilter = (patch) =>
    setParams((prev) => Object.fromEntries(Object.entries({ ...Object.fromEntries(prev), page: '', ...patch }).filter(([, v]) => v)));
  const classesOf = (teacherId) => classes.filter((c) => c.teacherIds.includes(teacherId));

  if (!allowed && !leaderAllowed)
    return (
      <div className="page">
        <Breadcrumb items={teacherCrumbs()} />
        <h1 className="page__title">Phân công giáo viên</h1>
        <ScNoAccess
          description={
            md.loading ? 'Đang tải…' : 'Bạn chưa được Hiệu trưởng giao quyền "Phân công giáo viên" hoặc "Phân công tổ trưởng nhóm tuổi".'
          }
        />
      </div>
    );

  const year = data?.year || years.find((y) => y.id === yearId);
  const closed = year?.status === YEAR_STATUS.CLOSED;
  const readOnly = closed || !canEdit;
  const leaderReadOnly = closed || !Object.values(leaderActs).some(Boolean);
  const teachers = data?.teachers || [];
  const groups = leaders.data?.leaderGroups || [];
  const unassigned = classes.filter((c) => !c.teacherIds.length).length;
  const campusName = (id) => md.campusById(id)?.shortName || '—';

  const onSaveLeader = async (group, userId) => {
    try {
      await saveTeamLeader({ schoolYear: yearId, ageGroupId: group.id, userId }, user);
      toast.success(userId ? 'Đã lưu thay đổi. Tổ trưởng đã nhận thông báo.' : 'Đã bỏ phân công tổ trưởng.', group.name);
      leaders.reload({ silent: true });
      return true;
    } catch (err) {
      toast.error(err, 'Không lưu được thay đổi');
      return false;
    }
  };

  return (
    <div className="page">
      <Breadcrumb items={teacherCrumbs()} />
      <h1 className="page__title">Phân công giáo viên</h1>

      <div className="card mb-16">
        <div className="filter-bar">
          <YearPicker years={years} value={yearId} onChange={(v) => setParams((prev) => ({ ...Object.fromEntries(prev), year: v }))} />
        </div>
      </div>

      {allowed && !canEdit && (
        <div className="alert alert--warning mb-16">
          <Info size={18} />
          <div>Bạn chỉ có quyền xem phân công giáo viên. Muốn thay đổi, liên hệ Hiệu trưởng để được bật quyền sửa.</div>
        </div>
      )}

      {leaderAllowed &&
        (leaders.error ? (
          <ErrorState error={leaders.error} onRetry={leaders.reload} />
        ) : leaders.loading && !leaders.data ? (
          <LoadingState />
        ) : (
          <section id="to-truong" className="card mb-16 sc-anchor">
            <div className="card__header">
              <h2 className="card__title row gap-2">
                <Crown size={18} /> Tổ trưởng nhóm tuổi
              </h2>
            </div>
            <p className="text-sm muted sc-leader-note">
              Mỗi nhóm tuổi có 1 tổ trưởng cho cả trường (mọi điểm trường), không phụ thuộc bộ lọc điểm trường. Chọn được giáo viên ở bất kỳ
              điểm trường nào.
              {leaderReadOnly && !closed && ' Bạn chỉ xem; quyền phân công tổ trưởng do Hiệu trưởng giao.'}
            </p>
            <div className="table-wrap sc-table-flat">
              <table className="table table--grid table--compact">
                <thead>
                  <tr>
                    <th>Nhóm tuổi</th>
                    <th className="num">Số lớp</th>
                    <th className="sc-col-leader">Tổ trưởng</th>
                    {!leaderReadOnly && <th className="cell--actions">Thao tác</th>}
                  </tr>
                </thead>
                <tbody>
                  {groups.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="muted center">
                        Năm học này chưa có lớp.
                      </td>
                    </tr>
                  ) : (
                    groups.map((g) => {
                      const current = leaders.data.teamLeaders.find((a) => a.ageGroupId === g.id);
                      const person = current && (leaders.data.leaderCandidates || []).find((t) => t.id === current.userId);
                      return (
                        <TeamLeaderRow
                          key={`${g.id}-${current?.userId || ''}`}
                          group={g}
                          classCount={g.classCount}
                          current={current && { ...current, fullName: person?.fullName || '—' }}
                          campusName={campusName}
                          readOnly={leaderReadOnly}
                          acts={leaderActs}
                          onOpen={setLeaderGroup}
                        />
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ))}

      {allowed &&
        (error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : loading && !data ? (
          <LoadingState />
        ) : (
          <section className="card">
            <div className="card__header sc-head-row">
              <h2 className="card__title row gap-2">
                <Users size={18} /> Giáo viên theo lớp
              </h2>
              <div className="sc-head-filters" role="group" aria-label="Lọc theo điểm trường và lớp">
                {fullScope ? (
                  <select
                    className="select"
                    aria-label="Điểm trường"
                    value={campusId}
                    onChange={(e) => setFilter({ campus: e.target.value, group: '', class: '' })}
                  >
                    <option value={CAMPUS_ALL}>Toàn trường</option>
                    {md.campuses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.shortName || c.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="chip chip--gray">{campusName(campusId)}</span>
                )}
                <select
                  className="select"
                  aria-label="Nhóm tuổi"
                  value={groupFilter}
                  onChange={(e) => setFilter({ group: e.target.value, class: '' })}
                >
                  <option value="">Tất cả nhóm tuổi</option>
                  {(data?.ageGroups || []).map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <select className="select" aria-label="Lớp" value={classFilter} onChange={(e) => setFilter({ class: e.target.value })}>
                  <option value="">Tất cả lớp</option>
                  {classOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {allCampuses ? ` · ${campusName(c.campusId)}` : ''}
                    </option>
                  ))}
                </select>
                <select
                  className="select"
                  aria-label="Tình trạng phân công"
                  value={statusFilter}
                  onChange={(e) => setFilter({ status: e.target.value })}
                >
                  <option value="">Mọi tình trạng</option>
                  <option value="MISSING">Chưa đủ {TEACHERS_PER_CLASS} giáo viên</option>
                  <option value="NO_HOMEROOM">Chưa có chủ nhiệm</option>
                </select>
                <SearchSubmit
                  className="sc-head-search"
                  value={query}
                  placeholder="Tìm lớp, giáo viên"
                  onSearch={(text) => setFilter({ q: text })}
                />
                {(groupFilter || classFilter || query || statusFilter || (fullScope && campusId !== CAMPUS_ALL)) && (
                  <button
                    className="btn btn--sm"
                    type="button"
                    onClick={() => setFilter({ campus: fullScope ? CAMPUS_ALL : '', group: '', class: '', q: '', status: '' })}
                  >
                    Đặt lại bộ lọc
                  </button>
                )}
              </div>
              {unassigned > 0 && <span className="chip chip--orange sc-head-filters__end">{unassigned} lớp chưa có giáo viên</span>}
            </div>
            <div className="table-wrap sc-table-flat">
              <table className="table table--grid table--compact">
                <thead>
                  <tr>
                    <th>Lớp</th>
                    {allCampuses && <th>Điểm trường</th>}
                    <th>Nhóm tuổi</th>
                    <th className="num">Sĩ số</th>
                    <th>Chủ nhiệm</th>
                    <th>Giáo viên</th>
                    {!readOnly && <th className="cell--actions">Thao tác</th>}
                  </tr>
                </thead>
                <tbody>
                  {shownClasses.length === 0 ? (
                    <tr>
                      <td colSpan={allCampuses ? 7 : 6}>
                        {classes.length ? (
                          <EmptyState icon={Search} title="Không có lớp phù hợp" description="Thử đổi từ khóa hoặc bộ lọc." />
                        ) : (
                          <EmptyState
                            icon={Users}
                            title="Chưa có lớp để phân công"
                            description="Hiệu trưởng cần tạo lớp của điểm trường trong năm học này trước."
                          />
                        )}
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((c) => (
                      <tr key={c.id}>
                        <td className="fw-600">{c.name}</td>
                        {allCampuses && <td>{campusName(c.campusId)}</td>}
                        <td>{data.ageGroups.find((g) => g.id === c.ageGroupId)?.shortName}</td>
                        <td className="num">
                          {c.childCount}/{c.capacity}
                        </td>
                        <td>{md.userById(c.homeroomTeacherId)?.fullName || <UnassignedBadge label="Chưa có" />}</td>
                        <td className="text-sm sc-wrap">
                          {c.teacherIds
                            .map((id) => md.userById(id)?.fullName)
                            .filter(Boolean)
                            .join(', ') || <span className="muted">—</span>}
                        </td>
                        {!readOnly && (
                          <td className="cell--actions">
                            {canAssignClass(c, user) && (
                              <button className={`btn btn--sm ${c.teacherIds.length ? '' : 'btn--primary'}`} onClick={() => setEditing(c)}>
                                <UserCheck size={15} /> {c.teacherIds.length ? 'Đổi giáo viên' : 'Phân công'}
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {shownClasses.length > CLASS_PAGE_SIZE && (
              <Pagination
                page={Math.min(page, Math.ceil(shownClasses.length / CLASS_PAGE_SIZE))}
                total={shownClasses.length}
                pageSize={CLASS_PAGE_SIZE}
                onChange={(p) => setParams((prev) => ({ ...Object.fromEntries(prev), page: String(p) }), { replace: true })}
                unit="lớp"
              />
            )}
          </section>
        ))}

      {leaderGroup && (
        <TeamLeaderModal
          group={leaderGroup}
          current={leaders.data?.teamLeaders.find((x) => x.ageGroupId === leaderGroup.id)}
          teachers={leaders.data?.leaderCandidates || []}
          campuses={md.campuses}
          campusName={campusName}
          acts={leaderActs}
          onSave={onSaveLeader}
          onClose={() => setLeaderGroup(null)}
        />
      )}
      {editing && (
        <ClassTeachersModal
          cls={editing}
          teachers={teachers.filter((t) => t.campusId === editing.campusId)}
          classesOf={classesOf}
          onClose={(changed) => {
            setEditing(null);
            if (changed) reload({ silent: true });
          }}
        />
      )}
    </div>
  );
}
