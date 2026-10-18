import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { UserCog, AlertTriangle, Save, Utensils, Plus, X } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useSchoolYears, useViceAssignments } from '@/hooks/school-config/useSchoolConfig';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, ErrorState, SkeletonRows, Spinner } from '@/components/ui/States';
import { FormField } from '@/components/form/FormField';
import { YearPicker } from '@/components/school-config/YearPicker';
import { YearStatusBadge } from '@/components/school-config/SchoolConfigBadges';
import { ScNoAccess } from '@/components/school-config/ScNoAccess';
import { saveViceAssignment } from '@/services/school-config/schoolConfigService';
import {
  AREA_ACTIONS,
  AREA_ACTION_LABELS,
  AREA_SCOPE_ALL,
  PERMISSION_ACCESS,
  SHARED_SERVICE_LABEL,
  VP_AREAS,
  YEAR_STATUS,
  actionsText,
  composeAreaGrant,
  parseAreaGrant,
  vpAreasOf,
} from '@/models/school-config/schoolConfigConstants';
import { canAssignVicePrincipal } from '@/utils/school-config/schoolConfigPermissions';
import { validateVpAssignment, hasErrors } from '@/utils/school-config/schoolConfigValidation';
import { vpCrumbs } from '@/utils/school-config/breadcrumbs';
import { formatDateTime } from '@/utils/format';
import '@/styles/modules/school-config.css';

const areaOf = (key) => VP_AREAS.find((a) => a.key === key);
const writes = (actions) => AREA_ACTIONS.some((k) => k !== 'view' && actions[k]);

/** Quyền đã lưu -> các dòng { key, campusId ('ALL' = toàn trường), actions }; mảng không có thì bỏ. */
const rowsOf = (assignment) =>
  assignment
    ? VP_AREAS.map((area) => ({ key: area.key, ...parseAreaGrant(vpAreasOf(assignment)[area.key], assignment.campusId) }))
        .filter((g) => g.access !== PERMISSION_ACCESS.NONE)
        .map((g) => ({ key: g.key, campusId: g.campusId || AREA_SCOPE_ALL, actions: g.actions }))
    : [];

/** Phạm vi mặc định của dòng mới: điểm trường phụ trách (thực đơn chỉ có toàn trường). */
const defaultScope = (area, campusId) => (area.scopes.includes('CAMPUS') && campusId ? campusId : AREA_SCOPE_ALL);

/** Tóm tắt 1 quyền: "Hồ sơ trẻ · Campus 1 · Xem, Thêm, Sửa". */
const grantText = (area, g, campusName) =>
  `${area.label} · ${g.campusId === AREA_SCOPE_ALL ? 'Toàn trường' : campusName(g.campusId)} · ${actionsText(g.actions)}`;

function AssignModal({ row, year, campuses, sharedHolder, onClose }) {
  const { user } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({
    campusId: row.assignment?.campusId || row.user.campusId || '',
    note: '',
  });
  const [grants, setGrants] = useState(() => rowsOf(row.assignment));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  // Bảng chọn chức năng: tích nhiều chức năng rồi "Thêm"
  const [picked, setPicked] = useState(null);
  const used = grants.map((g) => g.key);
  const free = VP_AREAS.filter((a) => !used.includes(a.key));
  const menuClash = grants.some((g) => g.key === 'menu' && writes(g.actions)) && sharedHolder && sharedHolder.id !== row.user.id;
  const incomplete = grants.some((g) => !g.campusId);

  const setGrant = (i, patch) => {
    setErrors({});
    setGrants((list) => list.map((g, j) => (j === i ? { ...g, ...patch } : g)));
  };
  // Đổi điểm trường phụ trách: dòng đang theo điểm trường cũ chuyển theo
  const setCampus = (campusId) => {
    setGrants((list) => list.map((g) => (form.campusId && g.campusId === form.campusId ? { ...g, campusId: campusId || '' } : g)));
    setForm((f) => ({ ...f, campusId }));
  };
  const toggleAction = (i, action) => {
    const g = grants[i];
    const area = areaOf(g.key);
    const on = !g.actions[action];
    // Mảng "linked": Thêm / Sửa / Xóa bật tắt cùng nhau; luôn kèm Xem
    const keys = area.linked ? area.actions.filter((k) => k !== 'view') : [action];
    setGrant(i, { actions: { ...g.actions, ...Object.fromEntries(keys.map((k) => [k, on])), view: true } });
  };
  const togglePick = (key) => setPicked((list) => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]));
  const addPicked = () => {
    setErrors({});
    setGrants((list) => [
      ...list,
      ...picked.map((key) => ({
        key,
        campusId: defaultScope(areaOf(key), form.campusId),
        actions: { view: true, create: false, update: false, delete: false },
      })),
    ]);
    setPicked(null);
  };
  const removeGrant = (i) => setGrants((list) => list.filter((_, j) => j !== i));

  const submit = async () => {
    const e = validateVpAssignment(form);
    if (incomplete) e.areas = 'Chọn phạm vi cho từng dòng';
    if (menuClash)
      e.areas = `Thực đơn & dịch vụ bán trú đang do ${sharedHolder.fullName} quản lý. Mỗi năm học chỉ một Phó hiệu trưởng được thêm, sửa, xóa thực đơn.`;
    setErrors(e);
    if (hasErrors(e)) return;
    setSaving(true);
    try {
      const areas = Object.fromEntries(
        grants.map((g) => [g.key, composeAreaGrant({ actions: g.actions, campusId: g.campusId === AREA_SCOPE_ALL ? null : g.campusId })]),
      );
      await saveViceAssignment(year.id, row.user.id, { ...form, areas }, user);
      toast.success(`Đã lưu thay đổi. ${row.user.fullName} đã được thông báo.`, 'Phân công Phó hiệu trưởng');
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
        Năm học <b>{year.name}</b>. Phó hiệu trưởng chỉ làm được các chức năng Hiệu trưởng thêm dưới đây.
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
        <span className="field__label">Quyền quản lý ({grants.length})</span>
        {grants.length === 0 && <p className="muted text-sm">Chưa có quyền nào. Phó hiệu trưởng chưa làm được chức năng nào.</p>}
        <div className="sc-grants">
          {grants.map((g, i) => {
            const area = areaOf(g.key);
            return (
              <div key={g.key} className="sc-grant">
                <div className="sc-grant__name">
                  <div className="fw-600">{area.label}</div>
                  <div className="text-xs muted">{area.hint}</div>
                </div>
                <select
                  className={`select ${errors.areas && !g.campusId ? 'is-invalid' : ''}`}
                  aria-label={`Phạm vi ${area.label}`}
                  value={g.campusId}
                  onChange={(e) => setGrant(i, { campusId: e.target.value })}
                >
                  <option value="">Chọn phạm vi…</option>
                  {area.scopes.includes('CAMPUS') &&
                    campuses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.shortName || c.name}
                      </option>
                    ))}
                  {area.scopes.includes('ALL') && <option value={AREA_SCOPE_ALL}>Toàn trường</option>}
                </select>
                <div className="sc-acts" role="group" aria-label={`Thao tác ${area.label}`}>
                  {AREA_ACTIONS.map((k) => {
                    const applies = area.actions.includes(k);
                    const title =
                      k === 'view'
                        ? 'Luôn có khi đã thêm chức năng'
                        : !applies
                          ? 'Không áp dụng cho chức năng này'
                          : area.actionHints?.[k] || (area.linked ? 'Thêm, sửa, xóa đi cùng nhau' : undefined);
                    return (
                      <label key={k} className={`sc-act ${applies ? '' : 'is-off'}`} title={title}>
                        <input
                          type="checkbox"
                          checked={applies && !!g.actions[k]}
                          disabled={k === 'view' || !applies}
                          onChange={() => toggleAction(i, k)}
                        />
                        {AREA_ACTION_LABELS[k]}
                      </label>
                    );
                  })}
                </div>
                <button
                  className="icon-btn"
                  type="button"
                  title="Bỏ quyền"
                  aria-label={`Bỏ quyền ${area.label}`}
                  onClick={() => removeGrant(i)}
                >
                  <X size={17} />
                </button>
              </div>
            );
          })}
        </div>
        {picked ? (
          <div className="sc-picker" role="group" aria-label="Chọn chức năng cần thêm">
            <div className="fw-600">Chọn chức năng cần thêm</div>
            <div className="text-xs muted mb-8">
              Tích một hoặc nhiều chức năng. Mỗi chức năng thêm vào mặc định phạm vi là điểm trường phụ trách, chỉ có quyền Xem; đổi ở từng
              dòng.
            </div>
            <div className="sc-picker__list">
              {free.map((a) => (
                <label key={a.key} className={`sc-picker__item ${picked.includes(a.key) ? 'is-on' : ''}`}>
                  <input type="checkbox" checked={picked.includes(a.key)} onChange={() => togglePick(a.key)} />
                  <span>
                    <span className="fw-600">{a.label}</span>
                    <span className="text-xs muted sc-picker__hint">{a.hint}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="sc-picker__actions">
              <button className="btn" type="button" onClick={() => setPicked(null)}>
                Hủy
              </button>
              <button className="btn btn--primary" type="button" onClick={addPicked} disabled={picked.length === 0}>
                <Plus size={16} /> Thêm{picked.length ? ` (${picked.length})` : ''}
              </button>
            </div>
          </div>
        ) : (
          // Luôn hiện nút; đã thêm đủ chức năng thì khóa và nhắc đổi ở dòng có sẵn
          <button
            className="btn sc-grants__add"
            type="button"
            onClick={() => setPicked([])}
            disabled={free.length === 0}
            title={free.length === 0 ? 'Đã thêm đủ các chức năng. Đổi phạm vi hoặc thao tác ở dòng tương ứng.' : undefined}
          >
            <Plus size={16} /> {free.length === 0 ? 'Đã thêm đủ các chức năng' : 'Thêm quyền quản lý'}
          </button>
        )}
        {errors.areas ? (
          <p className="field__error mt-8" role="alert">
            {errors.areas}
          </p>
        ) : (
          <div className="field__hint">
            Chức năng không thêm = Phó hiệu trưởng không thấy. Chỉ tích Xem = chỉ xem. Thực đơn: mỗi năm học chỉ một Phó hiệu trưởng được
            thêm, sửa, xóa ({SHARED_SERVICE_LABEL.toLowerCase()}).
          </div>
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

  return (
    <div className="page">
      <Breadcrumb items={vpCrumbs()} />
      <div className="row" style={{ gap: 12 }}>
        <h1 className="page__title">Phân công Phó hiệu trưởng</h1>
        {year && <YearStatusBadge status={year.status} />}
      </div>

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

      <div className="card">
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <div className="table-wrap sc-table-flat">
            <table className="table table--grid table--compact">
              <thead>
                <tr>
                  <th>Phó hiệu trưởng</th>
                  <th>Điểm trường phụ trách</th>
                  <th>Quyền theo mảng</th>
                  <th>Phân công lúc</th>
                  {!readOnly && <th className="right">Thao tác</th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows rows={2} cols={5} />
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <EmptyState
                        icon={UserCog}
                        title="Chưa có tài khoản Phó hiệu trưởng"
                        description="Tạo tài khoản Phó hiệu trưởng trước khi phân công."
                      />
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.user.id}>
                      <td>
                        <div className="sc-person">
                          <Avatar user={r.user} size="sm" />
                          <div className="sc-person__text">
                            <div className="fw-600">{r.user.fullName}</div>
                            <div className="text-xs muted">{r.user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        {r.assignment ? (
                          <span className="fw-600">{md.campusById(r.assignment.campusId)?.shortName}</span>
                        ) : (
                          <span className="chip chip--orange">Chưa phân công</span>
                        )}
                      </td>
                      <td>
                        {r.assignment ? (
                          <div className="sc-area-chips">
                            {rowsOf(r.assignment).length ? (
                              rowsOf(r.assignment).map((g) => (
                                <span key={g.key} className={`chip ${writes(g.actions) ? 'chip--green' : 'chip--blue'}`}>
                                  {grantText(areaOf(g.key), g, (id) => md.campusById(id)?.shortName || id)}
                                </span>
                              ))
                            ) : (
                              <span className="muted text-xs">Chưa có quyền nào</span>
                            )}
                          </div>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td className="text-sm nowrap">
                        {r.assignment ? (
                          <>
                            {formatDateTime(r.assignment.assignedAt)}
                            <div className="text-xs muted">{md.userById(r.assignment.assignedBy)?.fullName}</div>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      {!readOnly && (
                        <td className="right">
                          <button className={`btn btn--sm ${r.assignment ? '' : 'btn--primary'}`} onClick={() => setEditing(r)}>
                            <UserCog size={15} /> {r.assignment ? 'Đổi phân công' : 'Phân công'}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
