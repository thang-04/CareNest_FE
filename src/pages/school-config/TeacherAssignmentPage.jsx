import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Users, Info, Save, UserCheck, Crown } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useSchoolYears, useTeacherAssignments, useTeamLeaders } from '@/hooks/school-config/useSchoolConfig';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState, ErrorState, LoadingState, Spinner } from '@/components/ui/States';
import { YearPicker } from '@/components/school-config/YearPicker';
import { YearStatusBadge } from '@/components/school-config/SchoolConfigBadges';
import { ScNoAccess } from '@/components/school-config/ScNoAccess';
import { saveTeamLeader } from '@/services/school-config/schoolConfigService';
import { YEAR_STATUS } from '@/models/school-config/schoolConfigConstants';
import { ROLES } from '@/models/User';
import {
  ASSIGN_TEACHER,
  canAssignClass,
  canAssignTeachers,
  leaderOptionAllowed,
  canViewTeacherAssignments,
  canViewTeamLeaders,
  permissionAccess,
  teamLeaderActions,
} from '@/utils/school-config/schoolConfigPermissions';
import { teacherCrumbs } from '@/utils/school-config/breadcrumbs';
import { ClassTeachersModal } from '@/components/school-config/ClassTeachersModal';
import '@/styles/modules/school-config.css';

const CAMPUS_ALL = 'all';

function TeamLeaderRow({ group, classCount, current, teachers, campusName, readOnly, acts, onSave }) {
  const [value, setValue] = useState(current?.userId || '');
  const [saving, setSaving] = useState(false);
  const changed = value !== (current?.userId || '');
  const save = async () => {
    setSaving(true);
    await onSave(group, value || null);
    setSaving(false);
  };
  return (
    <tr>
      <td className="fw-600">{group.name}</td>
      <td className="center">{classCount}</td>
      <td>
        <select
          className="select"
          value={value}
          disabled={readOnly || saving || !(current ? acts.update || acts.delete : acts.create)}
          onChange={(e) => setValue(e.target.value)}
          aria-label={`Tổ trưởng ${group.shortName}`}
        >
          <option value="" disabled={!leaderOptionAllowed(acts, current?.userId, '')}>
            Chưa phân công
          </option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id} disabled={!leaderOptionAllowed(acts, current?.userId, t.id)}>
              {t.fullName} · {campusName(t.campusId)}
              {t.leadsGroup && t.leadsAgeGroupId !== group.id ? ` · đang tổ trưởng ${t.leadsGroup} (sẽ chuyển)` : ''}
            </option>
          ))}
        </select>
      </td>
      {!readOnly && (
        <td className="right">
          <button className="btn btn--sm" onClick={save} disabled={!changed || saving}>
            {saving ? <Spinner small /> : <Save size={15} />} Lưu tổ trưởng
          </button>
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
  const [editing, setEditing] = useState(null);

  const classes = useMemo(() => data?.classes || [], [data]);
  // Lọc lớp ngay ở đầu bảng "Giáo viên theo lớp" (?class=); đổi điểm trường thì bỏ lọc lớp
  const groupFilter = params.get('group') || '';
  const classFilter = params.get('class') || '';
  const classOptions = groupFilter ? classes.filter((c) => c.ageGroupId === groupFilter) : classes;
  const shownClasses = classOptions.filter((c) => !classFilter || c.id === classFilter);
  const setFilter = (patch) =>
    setParams((prev) => Object.fromEntries(Object.entries({ ...Object.fromEntries(prev), ...patch }).filter(([, v]) => v)));
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
    } catch (err) {
      toast.error(err.message, 'Không lưu được thay đổi');
    }
  };

  return (
    <div className="page">
      <Breadcrumb items={teacherCrumbs()} />
      <div className="row" style={{ gap: 12 }}>
        <h1 className="page__title">Phân công giáo viên</h1>
        {year && <YearStatusBadge status={year.status} />}
      </div>

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
      <div className="alert alert--info mb-16">
        <Info size={18} />
        <div>
          Phân công có hiệu lực trong năm học đã chọn. Giáo viên chỉ ghi nhận dữ liệu cho lớp được phân công; tổ trưởng điều phối kế hoạch
          của nhóm tuổi. Người được phân công sẽ nhận thông báo.
        </div>
      </div>

      {leaderAllowed &&
        (leaders.error ? (
          <ErrorState error={leaders.error} onRetry={leaders.reload} />
        ) : leaders.loading && !leaders.data ? (
          <LoadingState />
        ) : (
          <section className="card mb-16">
            <div className="card__header">
              <h2 className="card__title row" style={{ gap: 8 }}>
                <Crown size={18} /> Tổ trưởng nhóm tuổi
              </h2>
            </div>
            <p className="text-sm muted sc-leader-note">
              Mỗi nhóm tuổi có 1 tổ trưởng cho cả trường (mọi điểm trường), không phụ thuộc bộ lọc điểm trường. Chọn được giáo viên ở bất kỳ
              điểm trường nào.
              {leaderReadOnly && !closed && ' Bạn chỉ xem; quyền phân công tổ trưởng do Hiệu trưởng giao.'}
            </p>
            <div className="table-wrap sc-table-flat">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nhóm tuổi</th>
                    <th className="center">Số lớp</th>
                    <th style={{ minWidth: 260 }}>Tổ trưởng</th>
                    {!leaderReadOnly && <th className="right">Thao tác</th>}
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
                      return (
                        <TeamLeaderRow
                          key={`${g.id}-${current?.userId || ''}`}
                          group={g}
                          classCount={g.classCount}
                          current={current}
                          teachers={leaders.data.leaderCandidates || []}
                          campusName={campusName}
                          readOnly={leaderReadOnly}
                          acts={leaderActs}
                          onSave={onSaveLeader}
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
              <h2 className="card__title row" style={{ gap: 8 }}>
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
                {(groupFilter || classFilter || (fullScope && campusId !== CAMPUS_ALL)) && (
                  <button
                    className="btn btn--sm"
                    type="button"
                    onClick={() => setFilter({ campus: fullScope ? CAMPUS_ALL : '', group: '', class: '' })}
                  >
                    Bỏ lọc
                  </button>
                )}
              </div>
              {unassigned > 0 && <span className="chip chip--orange sc-head-filters__end">{unassigned} lớp chưa có giáo viên</span>}
            </div>
            <div className="table-wrap sc-table-flat">
              <table className="table">
                <thead>
                  <tr>
                    <th>Lớp</th>
                    {allCampuses && <th>Điểm trường</th>}
                    <th>Nhóm tuổi</th>
                    <th className="center">Sĩ số</th>
                    <th>Chủ nhiệm</th>
                    <th>Giáo viên</th>
                    {!readOnly && <th className="right">Thao tác</th>}
                  </tr>
                </thead>
                <tbody>
                  {shownClasses.length === 0 ? (
                    <tr>
                      <td colSpan={allCampuses ? 7 : 6}>
                        <EmptyState
                          icon={Users}
                          title="Chưa có lớp để phân công"
                          description="Hiệu trưởng cần tạo lớp của điểm trường trong năm học này trước."
                        />
                      </td>
                    </tr>
                  ) : (
                    shownClasses.map((c) => (
                      <tr key={c.id}>
                        <td className="fw-600">{c.name}</td>
                        {allCampuses && <td>{campusName(c.campusId)}</td>}
                        <td>{data.ageGroups.find((g) => g.id === c.ageGroupId)?.shortName}</td>
                        <td className="center">
                          {c.childCount}/{c.capacity}
                        </td>
                        <td>{md.userById(c.homeroomTeacherId)?.fullName || <span className="chip chip--orange">Chưa có</span>}</td>
                        <td className="text-sm sc-wrap">
                          {c.teacherIds
                            .map((id) => md.userById(id)?.fullName)
                            .filter(Boolean)
                            .join(', ') || <span className="muted">—</span>}
                        </td>
                        {!readOnly && (
                          <td className="right">
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
          </section>
        ))}

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
