import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Users, Info, Save, UserCheck, Crown } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useSchoolYears, useTeacherAssignments } from '@/hooks/school-config/useSchoolConfig';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, ErrorState, LoadingState, Spinner } from '@/components/ui/States';
import { YearPicker } from '@/components/school-config/YearPicker';
import { YearStatusBadge } from '@/components/school-config/SchoolConfigBadges';
import { ScNoAccess } from '@/components/school-config/ScNoAccess';
import { saveClassTeachers, saveTeamLeader } from '@/services/school-config/schoolConfigService';
import { YEAR_STATUS } from '@/models/school-config/schoolConfigConstants';
import { canAssignTeachers } from '@/utils/school-config/schoolConfigPermissions';
import { validateClassTeachers, hasErrors } from '@/utils/school-config/schoolConfigValidation';
import { teacherCrumbs } from '@/utils/school-config/breadcrumbs';
import '@/styles/modules/school-config.css';

function ClassTeachersModal({ cls, teachers, classesOf, onClose }) {
  const { user } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ teacherIds: [...cls.teacherIds], homeroomTeacherId: cls.homeroomTeacherId || '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const toggle = (id) => {
    setErrors({});
    setForm((f) => {
      const teacherIds = f.teacherIds.includes(id) ? f.teacherIds.filter((x) => x !== id) : [...f.teacherIds, id];
      // The homeroom teacher must stay one of the class teachers.
      const homeroomTeacherId = teacherIds.includes(f.homeroomTeacherId) ? f.homeroomTeacherId : teacherIds[0] || '';
      return { teacherIds, homeroomTeacherId };
    });
  };

  const submit = async () => {
    const e = validateClassTeachers(form);
    setErrors(e);
    if (hasErrors(e)) return;
    setSaving(true);
    try {
      await saveClassTeachers(cls.id, form, user);
      toast.success('Đã lưu thay đổi. Giáo viên mới được phân công đã nhận thông báo.', cls.name);
      onClose(true);
    } catch (err) {
      if (err.details) setErrors(err.details);
      toast.error(err.message, 'Không lưu được thay đổi');
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      size="lg"
      title={`Phân công giáo viên – ${cls.name}`}
      onClose={saving ? undefined : () => onClose(false)}
      footer={
        <>
          <button className="btn" onClick={() => onClose(false)} disabled={saving}>
            Hủy
          </button>
          <button className="btn btn--primary" onClick={submit} disabled={saving}>
            {saving ? <Spinner small /> : <Save size={16} />} Lưu phân công
          </button>
        </>
      }
    >
      {teachers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Điểm trường chưa có giáo viên"
          description="Cần có tài khoản giáo viên thuộc điểm trường để phân công."
        />
      ) : (
        <div className="table-wrap">
          <table className="table table--compact">
            <thead>
              <tr>
                <th>Phụ trách lớp</th>
                <th>Giáo viên</th>
                <th>Lớp khác đang phụ trách</th>
                <th className="center">Chủ nhiệm</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((t) => {
                const checked = form.teacherIds.includes(t.id);
                const others = classesOf(t.id).filter((c) => c.id !== cls.id);
                return (
                  <tr key={t.id} className={checked ? 'row--selected' : ''}>
                    <td>
                      <label className="checkbox">
                        <input type="checkbox" checked={checked} onChange={() => toggle(t.id)} aria-label={`Phân công ${t.fullName}`} />
                      </label>
                    </td>
                    <td className="fw-600">{t.fullName}</td>
                    <td className="text-sm">{others.length ? others.map((c) => c.name).join(', ') : <span className="muted">—</span>}</td>
                    <td className="center">
                      <input
                        type="radio"
                        name="sc-homeroom"
                        checked={form.homeroomTeacherId === t.id}
                        disabled={!checked}
                        onChange={() => setForm((f) => ({ ...f, homeroomTeacherId: t.id }))}
                        aria-label={`Chọn ${t.fullName} làm chủ nhiệm`}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {(errors.homeroomTeacherId || errors.teacherIds) && (
        <span className="field__error mt-8" role="alert">
          {errors.homeroomTeacherId || errors.teacherIds}
        </span>
      )}
    </Modal>
  );
}

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

/** #26 Teacher Assignment (UC 2.6). Vice Principal of the campus only (matrix: Principal "No"). */
export default function TeacherAssignmentPage() {
  const { user } = useAuth();
  const toast = useToast();
  const md = useMasterData();
  const { schoolYear: headerYear } = useSchoolYear();
  const [params, setParams] = useSearchParams();
  const yearId = params.get('year') || headerYear;
  const campusId = user?.campusId;
  const allowed = canAssignTeachers(campusId, user);
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
        <ScNoAccess description="Chỉ Phó hiệu trưởng được phân công giáo viên và tổ trưởng cho điểm trường của mình." />
      </div>
    );

  const year = data?.year;
  const readOnly = year?.status === YEAR_STATUS.CLOSED;
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
          <YearPicker years={years} value={yearId} onChange={(v) => setParams({ year: v })} />
          <div className="sc-inline-field">
            <span className="field__label">Điểm trường</span>
            <span className="fw-600">{md.campusById(campusId)?.shortName || '—'}</span>
          </div>
        </div>
      </div>

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
