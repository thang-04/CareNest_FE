import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { UserCog, Info, AlertTriangle, Save, Utensils } from '@/components/ui/icons';
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
import { PermissionLevelBadge, YearStatusBadge } from '@/components/school-config/SchoolConfigBadges';
import { ScNoAccess } from '@/components/school-config/ScNoAccess';
import { saveViceAssignment } from '@/services/school-config/schoolConfigService';
import {
  PERMISSION_ACCESS,
  PERMISSION_ACCESS_LABELS,
  PERMISSION_SCOPE_LABELS,
  SHARED_SERVICE_LABEL,
  VP_AREAS,
  YEAR_STATUS,
  composeGrant,
  parseGrant,
  vpAreasOf,
} from '@/models/school-config/schoolConfigConstants';
import { canAssignVicePrincipal } from '@/utils/school-config/schoolConfigPermissions';
import { validateVpAssignment, hasErrors } from '@/utils/school-config/schoolConfigValidation';
import { vpCrumbs } from '@/utils/school-config/breadcrumbs';
import { formatDateTime } from '@/utils/format';
import '@/styles/modules/school-config.css';

function AssignModal({ row, year, campuses, sharedHolder, onClose }) {
  const { user } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({
    campusId: row.assignment?.campusId || row.user.campusId || '',
    areas: { ...vpAreasOf(row.assignment), ...(row.assignment?.areas || {}) },
    note: '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const menuEdit = parseGrant(form.areas.menu).access === PERMISSION_ACCESS.EDIT;
  const movesShared = menuEdit && sharedHolder && sharedHolder.id !== row.user.id;
  const setArea = (key, patch) =>
    setForm((f) => ({ ...f, areas: { ...f.areas, [key]: composeGrant({ ...parseGrant(f.areas[key]), ...patch }) } }));

  const submit = async () => {
    const e = validateVpAssignment(form);
    setErrors(e);
    if (hasErrors(e)) return;
    setSaving(true);
    try {
      await saveViceAssignment(year.id, row.user.id, form, user);
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
        Năm học <b>{year.name}</b>. Phó hiệu trưởng chỉ xem và xử lý dữ liệu của điểm trường được phân công.
      </p>
      <FormField label="Điểm trường phụ trách" required error={errors.campusId}>
        <select className="select" value={form.campusId} onChange={(e) => setForm((f) => ({ ...f, campusId: e.target.value }))}>
          <option value="">Chọn điểm trường</option>
          {campuses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.shortName} – {c.name}
            </option>
          ))}
        </select>
      </FormField>
      <div className="mt-16">
        <span className="field__label">Quyền theo mảng phụ trách</span>
        <div className="table-wrap sc-table-flat">
          <table className="table table--compact">
            <tbody>
              {VP_AREAS.map((area) => {
                const g = parseGrant(form.areas[area.key]);
                return (
                  <tr key={area.key}>
                    <td className="text-sm">{area.label}</td>
                    <td>
                      <div className="sc-access">
                        <select
                          className="select"
                          aria-label={`${area.label}: quyền`}
                          value={g.access}
                          onChange={(e) =>
                            setArea(area.key, {
                              access: e.target.value,
                              scope: area.scopes.includes(g.scope) ? g.scope : area.scopes[0],
                            })
                          }
                        >
                          {Object.entries(PERMISSION_ACCESS_LABELS).map(([k, l]) => (
                            <option key={k} value={k}>
                              {l}
                            </option>
                          ))}
                        </select>
                        {area.scopes.length > 1 ? (
                          <select
                            className="select"
                            aria-label={`${area.label}: phạm vi`}
                            value={g.scope}
                            disabled={g.access === PERMISSION_ACCESS.NONE}
                            onChange={(e) => setArea(area.key, { scope: e.target.value })}
                          >
                            {area.scopes.map((sc) => (
                              <option key={sc} value={sc}>
                                {PERMISSION_SCOPE_LABELS[sc]}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-sm muted">{PERMISSION_SCOPE_LABELS[area.scopes[0]]}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="field__hint">
          "Được sửa" Thực đơn = {SHARED_SERVICE_LABEL.toLowerCase()}: chỉ một Phó hiệu trưởng mỗi năm (GBR-GEN-10). Các mảng không chỉnh giữ
          mặc định theo màn Vai trò &amp; quyền.
        </div>
        {movesShared && (
          <div className="alert alert--warning mt-8">
            <AlertTriangle size={18} />
            <div>
              Quyền sửa thực đơn (dịch vụ chung) sẽ chuyển từ <b>{sharedHolder.fullName}</b> sang <b>{row.user.fullName}</b>;{' '}
              {sharedHolder.fullName} còn quyền xem.
            </div>
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

      <div className="alert alert--info mb-16">
        <Info size={18} />
        <div>
          Phân công có hiệu lực trong một năm học. Khi lưu, hệ thống cấp quyền theo điểm trường cho Phó hiệu trưởng và gửi thông báo cho
          người được phân công.
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
            <table className="table">
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
                            {VP_AREAS.map((area) => (
                              <span key={area.key} className="text-xs">
                                <span className="muted">{area.label.split(' (')[0]}:</span>{' '}
                                <PermissionLevelBadge status={r.assignment.areas?.[area.key] || 'NONE'} />
                              </span>
                            ))}
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
