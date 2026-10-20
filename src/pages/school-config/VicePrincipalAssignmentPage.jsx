import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { UserCog, AlertTriangle, Save, Utensils } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useSchoolYears, useViceAssignments } from '@/hooks/school-config/useSchoolConfig';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, ErrorState, SkeletonRows, Spinner } from '@/components/ui/States';
import { FormField } from '@/components/form/FormField';
import { YearPicker } from '@/components/school-config/YearPicker';
import { ScNoAccess } from '@/components/school-config/ScNoAccess';
import { VicePrincipalCard } from '@/components/school-config/VicePrincipalCard';
import { saveViceAssignment } from '@/services/school-config/schoolConfigService';
import { AREA_SCOPE_ALL, YEAR_STATUS, composeAreaGrant } from '@/models/school-config/schoolConfigConstants';
import { canAssignVicePrincipal } from '@/utils/school-config/schoolConfigPermissions';
import { validateVpAssignment, hasErrors } from '@/utils/school-config/schoolConfigValidation';
import { areaTasks, taskOn, visibleVpAreas, vpGrantsOf } from '@/utils/school-config/vpAssignmentView';
import { vpCrumbs } from '@/utils/school-config/breadcrumbs';
import '@/styles/modules/school-config.css';

const NOT_GIVEN = 'NONE';
const VIEW_ONLY = { view: true, create: false, update: false, delete: false };
const writes = (actions) => Object.entries(actions).some(([k, on]) => k !== 'view' && on);

function AssignModal({ row, year, campuses, sharedHolder, onClose }) {
  const { user } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({
    campusId: row.assignment?.campusId || row.user.campusId || '',
    note: '',
  });
  // Giữ cả mảng đang ẩn (CSVC khi tắt) để lưu không làm mất quyền cũ
  const [grants, setGrants] = useState(() => vpGrantsOf(row.assignment));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const menuHeldByOther = sharedHolder && sharedHolder.id !== row.user.id;
  const menuClash = menuHeldByOther && !!grants.menu && writes(grants.menu.actions);

  const setGrant = (key, value) => {
    setErrors({});
    setGrants((all) => {
      const next = { ...all };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
  };
  // Đổi điểm trường phụ trách: việc đang theo điểm trường cũ chuyển theo
  const setCampus = (campusId) => {
    setGrants((all) =>
      Object.fromEntries(
        Object.entries(all).map(([k, g]) => [k, form.campusId && g.campusId === form.campusId ? { ...g, campusId: campusId || '' } : g]),
      ),
    );
    setForm((f) => ({ ...f, campusId }));
  };
  const setScope = (area, scope) => {
    if (scope === NOT_GIVEN) return setGrant(area.key, null);
    const g = grants[area.key];
    setGrant(area.key, { campusId: scope, actions: g ? g.actions : VIEW_ONLY });
  };
  const toggleTask = (area, task) => {
    const g = grants[area.key];
    const on = !taskOn(task, g.actions);
    setGrant(area.key, { ...g, actions: { ...g.actions, ...Object.fromEntries(task.keys.map((k) => [k, on])), view: true } });
  };

  const submit = async () => {
    const e = validateVpAssignment(form);
    if (Object.values(grants).some((g) => !g.campusId)) e.areas = 'Chọn "Ở đâu" cho từng công việc được giao';
    if (menuClash)
      e.areas = `Thực đơn & dịch vụ bán trú đang do ${sharedHolder.fullName} quản lý. Mỗi năm học chỉ một Phó hiệu trưởng được lập, sửa, xóa thực đơn.`;
    setErrors(e);
    if (hasErrors(e)) return;
    setSaving(true);
    try {
      const areas = Object.fromEntries(
        Object.entries(grants).map(([k, g]) => [
          k,
          composeAreaGrant({ actions: g.actions, campusId: g.campusId === AREA_SCOPE_ALL ? null : g.campusId }),
        ]),
      );
      await saveViceAssignment(year.id, row.user.id, { ...form, areas }, user);
      toast.success(`Đã lưu thay đổi. ${row.user.fullName} đã được thông báo.`, 'Phân công Phó hiệu trưởng');
      onClose(true);
    } catch (err) {
      if (err.details) setErrors(err.details);
      toast.error(err, 'Không lưu được thay đổi');
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      size="lg"
      title={`Phân công ${row.user.fullName}`}
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
      <p className="text-sm text-2 mb-12">
        Năm học <b>{year.name}</b>. Phó hiệu trưởng chỉ thấy và làm được những công việc Hiệu trưởng giao dưới đây.
      </p>
      <FormField label="Điểm trường phụ trách" required error={errors.campusId}>
        <select className="select" value={form.campusId} onChange={(e) => setCampus(e.target.value)}>
          <option value="">Chọn điểm trường</option>
          {campuses.map((c) => (
            <option key={c.id} value={c.id}>
              {!c.shortName || c.name.startsWith(c.shortName) ? c.name : `${c.shortName} – ${c.name}`}
            </option>
          ))}
        </select>
      </FormField>

      <div className="mt-16">
        <span className="field__label">Công việc được giao</span>
        <div className="field__hint mb-8">
          Chọn &quot;Ở đâu&quot; cho từng việc; chọn &quot;Không giao&quot; thì Phó hiệu trưởng không thấy việc đó. Không tích ô nào = chỉ
          được xem.
        </div>
        <div className="sc-vp-edit">
          {visibleVpAreas.map((area) => {
            const g = grants[area.key];
            const lockMenu = area.key === 'menu' && menuHeldByOther;
            return (
              <div key={area.key} className={`sc-vp-edit__row ${g ? '' : 'is-off'}`}>
                <div className="sc-vp-edit__name">
                  <div className="fw-600">{area.label}</div>
                  <div className="text-xs muted">{area.hint}</div>
                </div>
                <select
                  className={`select ${errors.areas && g && !g.campusId ? 'is-invalid' : ''}`}
                  aria-label={`Ở đâu: ${area.label}`}
                  value={g ? g.campusId : NOT_GIVEN}
                  onChange={(e) => setScope(area, e.target.value)}
                >
                  <option value={NOT_GIVEN}>Không giao</option>
                  {g && !g.campusId && <option value="">Chọn nơi…</option>}
                  {area.scopes.includes('CAMPUS') &&
                    campuses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.shortName || c.name}
                      </option>
                    ))}
                  {area.scopes.includes('ALL') && <option value={AREA_SCOPE_ALL}>Toàn trường</option>}
                </select>
                <div className="sc-vp-edit__tasks" role="group" aria-label={`Việc được làm: ${area.label}`}>
                  {g ? (
                    <>
                      {areaTasks(area).map((t) => {
                        const on = taskOn(t, g.actions);
                        return (
                          <label key={t.id} className={`sc-vp-task ${lockMenu && !on ? 'is-off' : ''}`}>
                            <input type="checkbox" checked={on} disabled={lockMenu && !on} onChange={() => toggleTask(area, t)} />
                            {t.label}
                          </label>
                        );
                      })}
                      {lockMenu && (
                        <span className="sc-vp-edit__warn text-xs">
                          <AlertTriangle size={13} /> {sharedHolder.fullName} đang quản lý thực đơn. Mỗi năm học chỉ 1 người.
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="muted text-sm">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {errors.areas && (
          <p className="field__error mt-8" role="alert">
            {errors.areas}
          </p>
        )}
      </div>

      <FormField label="Ghi chú" className="mt-12">
        <textarea
          className="textarea"
          rows={2}
          maxLength={300}
          value={form.note}
          onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
        />
      </FormField>
    </Modal>
  );
}

/** #23 Vice Principal Assignment (UC 2.5, GBR-GEN-03, GBR-GEN-10). Principal only. */
export default function VicePrincipalAssignmentPage() {
  const { user } = useAuth();
  const { schoolYear: headerYear } = useSchoolYear();
  const [params, setParams] = useSearchParams();
  const yearId = params.get('year') || headerYear;
  const md = useMasterData();
  const { years } = useSchoolYears();
  const allowed = canAssignVicePrincipal(user);
  const { data, loading, error, reload } = useViceAssignments(allowed ? yearId : null);
  const [editing, setEditing] = useState(null);

  if (!allowed)
    return (
      <div className="page">
        <Breadcrumb items={vpCrumbs()} />
        <h1 className="page__title">Phân công Phó hiệu trưởng</h1>
        <ScNoAccess description="Chỉ Hiệu trưởng được phân công Phó hiệu trưởng." />
      </div>
    );

  const year = data?.year;
  const rows = data?.rows || [];
  const readOnly = year?.status === YEAR_STATUS.CLOSED;
  const sharedRow = rows.find((r) => r.assignment?.sharedService);
  const uncovered = md.campuses.filter((c) => !rows.some((r) => r.assignment?.campusId === c.id));
  const campusName = (id) => md.campusById(id)?.shortName || id;

  return (
    <div className="page">
      <Breadcrumb items={vpCrumbs()} />
      <h1 className="page__title">Phân công Phó hiệu trưởng</h1>

      <div className="card mb-16">
        <div className="filter-bar">
          <YearPicker years={years} value={yearId} onChange={(v) => setParams({ year: v })} />
        </div>
      </div>

      {!loading && year && !readOnly && uncovered.length > 0 && (
        <div className="alert alert--warning mb-16">
          <AlertTriangle size={18} />
          <div>Chưa có Phó hiệu trưởng phụ trách: {uncovered.map((c) => c.shortName).join(', ')}.</div>
        </div>
      )}
      {!loading && year && !readOnly && !sharedRow && rows.length > 0 && (
        <div className="alert alert--warning mb-16">
          <Utensils size={18} />
          <div>Chưa có Phó hiệu trưởng phụ trách dịch vụ chung (bán trú toàn trường).</div>
        </div>
      )}

      {error ? (
        <div className="card">
          <ErrorState error={error} onRetry={reload} />
        </div>
      ) : loading ? (
        <div className="card">
          <div className="table-wrap">
            <table className="table table--compact">
              <tbody>
                <SkeletonRows rows={4} cols={3} />
              </tbody>
            </table>
          </div>
        </div>
      ) : rows.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={UserCog}
            title="Chưa có tài khoản Phó hiệu trưởng"
            description="Tạo tài khoản Phó hiệu trưởng trước khi phân công."
          />
        </div>
      ) : (
        <div className="sc-vp-grid">
          {rows.map((r) => (
            <VicePrincipalCard
              key={r.user.id}
              row={r}
              campusName={campusName}
              assignerName={r.assignment ? md.userById(r.assignment.assignedBy)?.fullName : null}
              readOnly={readOnly}
              onEdit={() => setEditing(r)}
            />
          ))}
        </div>
      )}

      {editing && year && (
        <AssignModal
          row={editing}
          year={year}
          campuses={md.campuses}
          sharedHolder={sharedRow?.user}
          onClose={(changed) => {
            setEditing(null);
            if (changed) reload({ silent: true });
          }}
        />
      )}
    </div>
  );
}
