import { useMemo, useState } from 'react';
import { Save } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useTeacherAssignments, useTeamLeaders } from '@/hooks/school-config/useSchoolConfig';
import { FormField } from '@/components/form/FormField';
import { ErrorState, LoadingState, Spinner } from '@/components/ui/States';
import { saveClassTeachers, saveTeamLeader } from '@/services/school-config/schoolConfigService';
import { hasErrors, validateClassTeachers } from '@/utils/school-config/schoolConfigValidation';

const SLOTS = [0, 1];
const leaderKey = (groupId) => `leader-${groupId}`;

/**
 * Thiết lập năm học › bước Giáo viên & tổ trưởng (Cần chọn "Bảng nhập nhanh" 30/10/2026): mỗi lớp một dòng, chọn
 * GV 1, GV 2 và chủ nhiệm ngay trên dòng; tổ trưởng mỗi nhóm tuổi chọn ở bảng trên; "Lưu tất cả" lưu mọi dòng đã đổi.
 * Mỗi giáo viên chỉ dạy một lớp nên giáo viên đã chọn ở lớp khác bị khóa trong danh sách.
 */
export function YearTeachersQuickEdit({ yearId }) {
  const { user } = useAuth();
  const toast = useToast();
  const md = useMasterData();
  const campuses = useMemo(() => md.campuses.filter((c) => c.status !== 'INACTIVE'), [md.campuses]);
  const [campusPick, setCampusPick] = useState('');
  const campusId = campusPick || campuses[0]?.id || '';
  const { data, loading, error, reload } = useTeacherAssignments(yearId, campusId);
  const leaders = useTeamLeaders(yearId);
  const [drafts, setDrafts] = useState({}); // classId → { teacherIds, homeroomTeacherId }; leader-{groupId} → userId
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const savedClasses = useMemo(() => data?.classes || [], [data]);
  const classes = savedClasses.map((c) => ({ ...c, ...drafts[c.id] }));
  const teachers = (data?.teachers || []).filter((t) => t.campusId === campusId);
  const groupName = (id) => (data?.ageGroups || []).find((g) => g.id === id)?.shortName || '';
  const nameOf = (id) => teachers.find((t) => t.id === id)?.fullName || md.userById(id)?.fullName || id;
  const takenIn = (teacherId, classId) => classes.find((c) => c.id !== classId && c.teacherIds.includes(teacherId));
  const dirtyClasses = savedClasses.filter((c) => drafts[c.id]);
  const dirtyLeaders = Object.keys(drafts).filter((k) => k.startsWith('leader-'));
  const dirty = dirtyClasses.length + dirtyLeaders.length;

  if (error || leaders.error) return <ErrorState error={error || leaders.error} onRetry={reload} />;
  if ((loading && !data) || (leaders.loading && !leaders.data)) return <LoadingState />;

  const editClass = (c, patch) => {
    const next = { teacherIds: c.teacherIds, homeroomTeacherId: c.homeroomTeacherId || '', ...patch };
    if (!next.teacherIds.includes(next.homeroomTeacherId)) next.homeroomTeacherId = next.teacherIds.length === 1 ? next.teacherIds[0] : '';
    setDrafts((d) => ({ ...d, [c.id]: next }));
    setErrors(({ [c.id]: _c, ...rest }) => rest);
  };
  const setSlot = (c, slot, teacherId) => {
    const ids = [c.teacherIds[0] || '', c.teacherIds[1] || ''];
    ids[slot] = teacherId;
    editClass(c, { teacherIds: ids.filter(Boolean) });
  };

  const saveAll = async () => {
    const found = {};
    dirtyClasses.forEach((saved) => {
      const e = validateClassTeachers(drafts[saved.id]);
      if (hasErrors(e)) found[saved.id] = e;
    });
    setErrors(found);
    if (hasErrors(found)) return;
    setSaving(true);
    const failed = {};
    let done = 0;
    // Đổi giáo viên giữa hai lớp: lớp bỏ người lưu trước để người đó được nhận ở lớp kia; lỗi thì thử lại một lần
    const order = [...dirtyClasses].sort((a, b) => drafts[a.id].teacherIds.length - drafts[b.id].teacherIds.length);
    let pending = order;
    for (let round = 0; round < 2 && pending.length; round += 1) {
      const retry = [];
      for (const c of pending) {
        try {
          await saveClassTeachers(c.id, drafts[c.id], user);
          done += 1;
          delete failed[c.id];
          setDrafts(({ [c.id]: _c, ...rest }) => rest);
        } catch (err) {
          failed[c.id] = err.details?.teacherIds || err.details?.homeroomTeacherId ? err.details : { teacherIds: err.message };
          retry.push(c);
        }
      }
      pending = retry;
    }
    for (const key of dirtyLeaders) {
      const ageGroupId = key.slice('leader-'.length);
      try {
        await saveTeamLeader({ schoolYear: yearId, ageGroupId, userId: drafts[key] || null }, user);
        done += 1;
        setDrafts(({ [key]: _k, ...rest }) => rest);
      } catch (err) {
        failed[key] = { userId: err.message };
      }
    }
    setErrors(failed);
    setSaving(false);
    reload({ silent: true });
    leaders.reload({ silent: true });
    if (done) toast.success(`Đã lưu ${done} dòng.`);
    if (hasErrors(failed)) toast.error('Một số dòng chưa lưu được, xem lỗi đỏ trên bảng.');
  };

  const groups = leaders.data?.leaderGroups || [];
  const candidates = leaders.data?.leaderCandidates || [];
  const currentLeader = (g) => {
    const key = leaderKey(g.id);
    if (key in drafts) return drafts[key];
    return leaders.data?.teamLeaders.find((a) => a.ageGroupId === g.id)?.userId || '';
  };
  const campusName = (id) => md.campusById(id)?.shortName || '';

  return (
    <>
      {campuses.length > 1 && (
        <div className="row gap-2 mb-16">
          {campuses.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`btn ${c.id === campusId ? 'btn--primary' : ''}`}
              onClick={() => setCampusPick(c.id)}
            >
              {c.shortName || c.name}
            </button>
          ))}
        </div>
      )}

      <section className="card mb-16">
        <div className="card__header">
          <h2 className="card__title">Tổ trưởng nhóm tuổi</h2>
        </div>
        <div className="table-wrap sc-table-flat">
          <table className="table table--grid table--compact sc-quick">
            <thead>
              <tr>
                <th>Nhóm tuổi</th>
                <th className="num">Số lớp</th>
                <th>Tổ trưởng</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.id}>
                  <td className="fw-600">{g.name}</td>
                  <td className="num">{g.classCount}</td>
                  <td>
                    <FormField error={errors[leaderKey(g.id)]?.userId}>
                      <select
                        className="select"
                        aria-label={`Tổ trưởng ${g.name}`}
                        value={currentLeader(g)}
                        onChange={(e) => {
                          const key = leaderKey(g.id);
                          setDrafts((d) => ({ ...d, [key]: e.target.value }));
                          setErrors(({ [key]: _k, ...rest }) => rest);
                        }}
                      >
                        <option value="">Chưa phân công</option>
                        {candidates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.fullName}
                            {campusName(t.campusId) ? ` · ${campusName(t.campusId)}` : ''}
                          </option>
                        ))}
                      </select>
                    </FormField>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card mb-16">
        <div className="card__header">
          <h2 className="card__title">Giáo viên theo lớp ({classes.length})</h2>
        </div>
        <div className="table-wrap sc-table-flat">
          <table className="table table--grid table--compact sc-quick">
            <thead>
              <tr>
                <th>Lớp</th>
                <th>Nhóm tuổi</th>
                <th>Giáo viên 1</th>
                <th>Giáo viên 2</th>
                <th>Chủ nhiệm</th>
              </tr>
            </thead>
            <tbody>
              {classes.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted">
                    Điểm trường chưa có lớp trong năm học này.
                  </td>
                </tr>
              )}
              {classes.map((c) => (
                <tr key={c.id}>
                  <td className="fw-600">{c.name}</td>
                  <td>{groupName(c.ageGroupId)}</td>
                  {SLOTS.map((slot) => (
                    <td key={slot}>
                      <FormField error={slot === 0 ? errors[c.id]?.teacherIds : undefined}>
                        <select
                          className="select"
                          aria-label={`Giáo viên ${slot + 1} lớp ${c.name}`}
                          value={c.teacherIds[slot] || ''}
                          disabled={slot === 1 && !c.teacherIds[0]}
                          onChange={(e) => setSlot(c, slot, e.target.value)}
                        >
                          <option value="">Chưa chọn</option>
                          {teachers
                            .filter((t) => t.id === c.teacherIds[slot] || !c.teacherIds.includes(t.id))
                            .map((t) => {
                              const other = takenIn(t.id, c.id);
                              return (
                                <option key={t.id} value={t.id} disabled={!!other}>
                                  {t.fullName}
                                  {other ? ` · ${other.name}` : ''}
                                </option>
                              );
                            })}
                        </select>
                      </FormField>
                    </td>
                  ))}
                  <td>
                    <FormField error={errors[c.id]?.homeroomTeacherId}>
                      <select
                        className="select"
                        aria-label={`Chủ nhiệm lớp ${c.name}`}
                        value={c.homeroomTeacherId || ''}
                        disabled={!c.teacherIds.length}
                        onChange={(e) => editClass(c, { homeroomTeacherId: e.target.value })}
                      >
                        <option value="">{c.teacherIds.length ? 'Chọn chủ nhiệm' : '—'}</option>
                        {c.teacherIds.map((id) => (
                          <option key={id} value={id}>
                            {nameOf(id)}
                          </option>
                        ))}
                      </select>
                    </FormField>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="row sc-end mb-16">
        <button className="btn btn--primary" type="button" onClick={saveAll} disabled={saving || !dirty}>
          {saving ? <Spinner small /> : <Save size={16} />} Lưu tất cả{dirty ? ` (${dirty})` : ''}
        </button>
      </div>
    </>
  );
}
