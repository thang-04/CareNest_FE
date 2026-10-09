import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, RotateCcw, Info, Lock } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useRolePermissions } from '@/hooks/school-config/useSchoolConfig';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { FormField } from '@/components/form/FormField';
import { PermissionLevelBadge } from '@/components/school-config/SchoolConfigBadges';
import { ScNoAccess } from '@/components/school-config/ScNoAccess';
import { saveRolePermissions } from '@/services/school-config/schoolConfigService';
import {
  CONFIG_ROLE_LABELS,
  CONFIG_ROLES,
  PERMISSION_LEVEL,
  PERMISSION_LEVEL_LABELS,
  PERMISSION_MODULES,
  ROLE_SCOPE_NOTES,
} from '@/models/school-config/schoolConfigConstants';
import { PERMISSION_CATALOG, defaultGrants, isLockedGrant, permissionByCode } from '@/models/school-config/permissionCatalog';
import { canManageRolePermissions } from '@/utils/school-config/schoolConfigPermissions';
import { validatePermissionChange, hasErrors } from '@/utils/school-config/schoolConfigValidation';
import { roleCrumbs } from '@/utils/school-config/breadcrumbs';
import { formatDateTime } from '@/utils/format';
import '@/styles/modules/school-config.css';

const LEVELS = [PERMISSION_LEVEL.FULL, PERMISSION_LEVEL.RESTRICTED, PERMISSION_LEVEL.NONE];

function LevelSwitch({ code, value, onChange, disabled, label }) {
  return (
    <div className="sc-level" role="radiogroup" aria-label={label}>
      {LEVELS.map((lv) => (
        <label key={lv} className={`sc-level__opt sc-level__opt--${lv.toLowerCase()} ${value === lv ? 'sc-level__opt--on' : ''}`}>
          <input type="radio" name={`lv-${code}`} checked={value === lv} disabled={disabled} onChange={() => onChange(lv)} />
          {PERMISSION_LEVEL_LABELS[lv]}
        </label>
      ))}
    </div>
  );
}

/** #25 Role Permission Form (UC 2.4). Configuration display only: real route guards are not changed by it. */
export default function RolePermissionFormPage() {
  const { role } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const md = useMasterData();
  const { roles, loading, error, reload } = useRolePermissions({ live: false });
  const entry = roles.find((r) => r.role === role);
  const [grants, setGrants] = useState(null);
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState({});
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (entry) setGrants({ ...entry.grants });
  }, [entry]);

  const changes = useMemo(
    () => (grants && entry ? PERMISSION_CATALOG.filter((p) => grants[p.code] !== entry.grants[p.code]) : []),
    [grants, entry],
  );

  const title = `Quyền của ${CONFIG_ROLE_LABELS[role] || 'vai trò'}`;
  const head = (
    <>
      <Breadcrumb items={roleCrumbs(CONFIG_ROLE_LABELS[role] || 'Vai trò')} />
      <h1 className="page__title">{title}</h1>
    </>
  );

  if (!canManageRolePermissions(user))
    return (
      <div className="page">
        {head}
        <ScNoAccess description="Chỉ Hiệu trưởng được thay đổi quyền theo vai trò." />
      </div>
    );
  if (!CONFIG_ROLES.includes(role))
    return (
      <div className="page">
        {head}
        <div className="card">
          <EmptyState
            title="Không tìm thấy vai trò"
            description="Vai trò này không có trong ma trận quyền."
            action={<Link to="/school/roles">Về danh sách vai trò</Link>}
          />
        </div>
      </div>
    );

  const ask = () => {
    const e = validatePermissionChange({ reason });
    if (!changes.length) e.changes = 'Chưa có thay đổi nào để lưu';
    setErrors(e);
    if (!hasErrors(e)) setConfirmOpen(true);
  };

  const save = async () => {
    try {
      await saveRolePermissions(role, { grants, reason }, user);
      toast.success('Đã lưu thay đổi.', title);
      setConfirmOpen(false);
      navigate('/school/roles');
    } catch (err) {
      setConfirmOpen(false);
      if (err.details) setErrors(err.details);
      toast.error(err.message, 'Không lưu được thay đổi');
    }
  };

  const setLevel = (code, lv) => {
    setGrants((g) => ({ ...g, [code]: lv }));
    setErrors((e) => ({ ...e, changes: undefined }));
  };
  const resetToSrs = () => {
    setGrants(defaultGrants(role));
    setErrors({});
  };

  return (
    <div className="page">
      {head}
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading || !grants ? (
        <LoadingState />
      ) : (
        <>
          <div className="alert alert--info mb-16">
            <Info size={18} />
            <div>
              <b>Theo phạm vi</b> với vai trò này: {ROLE_SCOPE_NOTES[role]} Thay đổi được ghi lại người sửa, thời điểm và giá trị cũ.
            </div>
          </div>

          {Object.entries(PERMISSION_MODULES).map(([m, label]) => {
            const items = PERMISSION_CATALOG.filter((p) => p.module === m);
            if (!items.length) return null;
            return (
              <section key={m} className="card mb-16">
                <div className="card__header">
                  <h2 className="card__title">{label}</h2>
                </div>
                <div className="table-wrap sc-table-flat">
                  <table className="table table--compact">
                    <thead>
                      <tr>
                        <th>Chức năng / thao tác</th>
                        <th>Mặc định SRS</th>
                        <th>Mức quyền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((p) => {
                        const locked = isLockedGrant(role, p.code);
                        const changed = grants[p.code] !== entry.grants[p.code];
                        return (
                          <tr key={p.code} className={changed ? 'row--selected' : ''}>
                            <td>
                              <div>
                                {p.entity} <span className="muted">– {p.action}</span>
                              </div>
                              <div className="text-xs muted">
                                <code>{p.code}</code> · {p.source}
                                {p.notes.map((n) => (
                                  <div key={n}>{n}</div>
                                ))}
                              </div>
                            </td>
                            <td>
                              <PermissionLevelBadge status={p.defaults[role]} />
                            </td>
                            <td>
                              <LevelSwitch
                                code={p.code}
                                value={grants[p.code]}
                                disabled={locked}
                                label={`${p.entity} – ${p.action}`}
                                onChange={(lv) => setLevel(p.code, lv)}
                              />
                              {locked && (
                                <div className="text-xs muted row mt-8" style={{ gap: 4 }}>
                                  <Lock size={12} /> Hiệu trưởng luôn giữ quyền này
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}

          <section className="card wizard-card">
            <FormField label="Lý do thay đổi" required error={errors.reason} hint={`${changes.length} quyền đã thay đổi`}>
              <textarea
                className="textarea"
                rows={2}
                maxLength={300}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setErrors((er) => ({ ...er, reason: undefined }));
                }}
              />
            </FormField>
            {errors.changes && (
              <span className="field__error" role="alert">
                {errors.changes}
              </span>
            )}
          </section>

          {entry.history?.length > 0 && (
            <section className="card wizard-card">
              <h2 className="section-title">Lịch sử thay đổi</h2>
              <ul className="sc-history">
                {entry.history.map((h, i) => (
                  <li key={i}>
                    <span className="fw-600">{h.userName || md.userById(h.userId)?.fullName}</span>
                    <span className="muted text-sm"> · {formatDateTime(h.at)}</span>
                    <div className="text-sm">Lý do: {h.reason}</div>
                    <div className="text-xs text-2">
                      {h.changes
                        .map(
                          (c) =>
                            `${permissionByCode(c.code)?.entity || c.code}: ${PERMISSION_LEVEL_LABELS[c.from]} → ${PERMISSION_LEVEL_LABELS[c.to]}`,
                        )
                        .join('; ')}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="page-actions">
            <Link className="btn" to="/school/roles">
              <ArrowLeft size={16} /> Quay lại
            </Link>
            <div className="row">
              <button className="btn" onClick={resetToSrs}>
                <RotateCcw size={16} /> Khôi phục theo SRS
              </button>
              <button className="btn btn--primary" onClick={ask}>
                <Save size={16} /> Lưu quyền
              </button>
            </div>
          </div>
        </>
      )}

      <ConfirmationModal
        open={confirmOpen}
        title="Lưu quyền"
        message={
          <>
            Lưu <b>{changes.length}</b> thay đổi quyền của <b>{CONFIG_ROLE_LABELS[role]}</b>?
            <ul className="sc-change-list">
              {changes.slice(0, 8).map((p) => (
                <li key={p.code}>
                  {p.entity} – {p.action}: {PERMISSION_LEVEL_LABELS[entry?.grants[p.code]]} →{' '}
                  <b>{PERMISSION_LEVEL_LABELS[grants?.[p.code]]}</b>
                </li>
              ))}
              {changes.length > 8 && <li>… và {changes.length - 8} thay đổi khác</li>}
            </ul>
          </>
        }
        confirmLabel="Lưu quyền"
        onConfirm={save}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}
