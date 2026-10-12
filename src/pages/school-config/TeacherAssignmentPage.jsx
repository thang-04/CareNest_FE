import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Users, Info, Save, UserCheck, Crown } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useSchoolYears, useTeacherAssignments } from '@/hooks/school-config/useSchoolConfig';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState, ErrorState, LoadingState, Spinner } from '@/components/ui/States';
import { YearPicker } from '@/components/school-config/YearPicker';
import { YearStatusBadge } from '@/components/school-config/SchoolConfigBadges';
import { ScNoAccess } from '@/components/school-config/ScNoAccess';
import { saveTeamLeader } from '@/services/school-config/schoolConfigService';
import { YEAR_STATUS } from '@/models/school-config/schoolConfigConstants';
import {
  ASSIGN_TEACHER,
  canAssignTeachers,
  canViewTeacherAssignments,
  permissionAccess,
} from '@/utils/school-config/schoolConfigPermissions';
import { teacherCrumbs } from '@/utils/school-config/breadcrumbs';
import { ClassTeachersModal } from '@/components/school-config/ClassTeachersModal';
import '@/styles/modules/school-config.css';

function TeamLeaderRow({ group, classCount, current, teachers, readOnly, onSave }) {
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
          disabled={readOnly || saving}
          onChange={(e) => setValue(e.target.value)}
          aria-label={`Tổ trưởng ${group.shortName}`}
        >
          <option value="">Chưa phân công</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.fullName}
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
 * #26 Teacher Assignment (UC 2.6). Follows the permission "Phân công giáo viên / tổ trưởng" (Role & Permission screen):
 * FULL (always the Principal) chooses any campus, RESTRICTED works on the own campus.
 */
export default function TeacherAssignmentPage() {
  const { user } = useAuth();
  const toast = useToast();
  const md = useMasterData();
  const { schoolYear: headerYear } = useSchoolYear();
  const [params, setParams] = useSearchParams();
  const yearId = params.get('year') || headerYear;
  const fullScope = permissionAccess(user, ASSIGN_TEACHER).scope === 'ALL';
  // Toàn quyền: chọn điểm trường (mặc định điểm trường của mình hoặc điểm trường đầu tiên); theo phạm vi: điểm trường của mình
  const campusId = (fullScope && params.get('campus')) || user?.campusId || (fullScope ? md.campuses[0]?.id : '');
  const allowed = canViewTeacherAssignments(campusId, user);
  // Chỉ xem: mở được màn hình nhưng ẩn mọi nút phân công
  const canEdit = canAssignTeachers(campusId, user);
  const { years } = useSchoolYears();
  const { data, loading, error, reload } = useTeacherAssignments(allowed ? yearId : null, campusId);
  const [editing, setEditing] = useState(null);

  const classes = useMemo(() => data?.classes || [], [data]);
  const classesOf = (teacherId) => classes.filter((c) => c.teacherIds.includes(teacherId));

  if (!allowed)
    return (
      <div className="page">
        <Breadcrumb items={teacherCrumbs()} />
        <h1 className="page__title">Phân công giáo viên</h1>
        <ScNoAccess
          description={
            md.loading ? 'Đang tải…' : 'Vai trò của bạn chưa được bật quyền "Phân công giáo viên / tổ trưởng" cho điểm trường này.'
          }
        />
      </div>
    );

  const year = data?.year;
  const readOnly = year?.status === YEAR_STATUS.CLOSED || !canEdit;
  const teachers = data?.teachers || [];
  const groups = (data?.ageGroups || []).filter((g) => classes.some((c) => c.ageGroupId === g.id));
  const unassigned = classes.filter((c) => !c.teacherIds.length).length;

  const onSaveLeader = async (group, userId) => {
    try {
      await saveTeamLeader({ schoolYear: yearId, campusId, ageGroupId: group.id, userId }, user);
      toast.success(userId ? 'Đã lưu thay đổi. Tổ trưởng đã nhận thông báo.' : 'Đã bỏ phân công tổ trưởng.', group.name);
      reload({ silent: true });
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
          {fullScope ? (
            <div className="sc-inline-field">
              <label className="field__label" htmlFor="ta-campus">
                Điểm trường
              </label>
              <select
                id="ta-campus"
                className="select"
                value={campusId}
                onChange={(e) => setParams((prev) => ({ ...Object.fromEntries(prev), campus: e.target.value }))}
              >
                {md.campuses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.shortName || c.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="sc-inline-field">
              <span className="field__label">Điểm trường</span>
              <span className="fw-600">{md.campusById(campusId)?.shortName || '—'}</span>
            </div>
          )}
        </div>
      </div>

      {!canEdit && (
        <div className="alert alert--warning mb-16">
          <Info size={18} />
          <div>Bạn chỉ có quyền xem phân công giáo viên / tổ trưởng. Muốn thay đổi, liên hệ Hiệu trưởng để được bật quyền sửa.</div>
        </div>
      )}
      <div className="alert alert--info mb-16">
        <Info size={18} />
        <div>
          Phân công có hiệu lực trong năm học đã chọn. Giáo viên chỉ ghi nhận dữ liệu cho lớp được phân công; tổ trưởng điều phối kế hoạch
          của nhóm tuổi. Người được phân công sẽ nhận thông báo.
        </div>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading && !data ? (
        <LoadingState />
      ) : (
        <>
          <section className="card mb-16">
            <div className="card__header">
              <h2 className="card__title row" style={{ gap: 8 }}>
                <Crown size={18} /> Tổ trưởng nhóm tuổi
              </h2>
            </div>
            <div className="table-wrap sc-table-flat">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nhóm tuổi</th>
                    <th className="center">Số lớp</th>
                    <th style={{ minWidth: 220 }}>Tổ trưởng</th>
                    {!readOnly && <th className="right">Thao tác</th>}
                  </tr>
                </thead>
                <tbody>
                  {groups.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="muted center">
                        Điểm trường chưa có lớp trong năm học này.
                      </td>
                    </tr>
                  ) : (
                    groups.map((g) => {
                      const current = data.teamLeaders.find((a) => a.ageGroupId === g.id);
                      return (
                        <TeamLeaderRow
                          key={`${g.id}-${current?.userId || ''}`}
                          group={g}
                          classCount={classes.filter((c) => c.ageGroupId === g.id).length}
                          current={current}
                          teachers={teachers}
                          readOnly={readOnly}
                          onSave={onSaveLeader}
                        />
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <div className="card__header">
              <h2 className="card__title row" style={{ gap: 8 }}>
                <Users size={18} /> Giáo viên theo lớp
              </h2>
              {unassigned > 0 && <span className="chip chip--orange">{unassigned} lớp chưa có giáo viên</span>}
            </div>
            <div className="table-wrap sc-table-flat">
              <table className="table">
                <thead>
                  <tr>
                    <th>Lớp</th>
                    <th>Nhóm tuổi</th>
                    <th className="center">Sĩ số</th>
                    <th>Chủ nhiệm</th>
                    <th>Giáo viên</th>
                    {!readOnly && <th className="right">Thao tác</th>}
                  </tr>
                </thead>
                <tbody>
                  {classes.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <EmptyState
                          icon={Users}
                          title="Chưa có lớp để phân công"
                          description="Hiệu trưởng cần tạo lớp của điểm trường trong năm học này trước."
                        />
                      </td>
                    </tr>
                  ) : (
                    classes.map((c) => (
                      <tr key={c.id}>
                        <td className="fw-600">{c.name}</td>
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
                            <button className={`btn btn--sm ${c.teacherIds.length ? '' : 'btn--primary'}`} onClick={() => setEditing(c)}>
                              <UserCheck size={15} /> Phân công
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {editing && (
        <ClassTeachersModal
          cls={editing}
          teachers={teachers}
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
