import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, Play, Info, AlertTriangle, Lock, Eye, Search, MapPin, Boxes, Users } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useAsync } from '@/hooks/useAsync';
import { useMasterData } from '@/hooks/useMasterData';
import { SignaturePicker } from '@/components/signature/SignaturePicker';
import { ConditionBadge } from '@/components/asset/AssetVisuals';
import { useInspection, useLockedLocations } from '@/hooks/inventory-inspection/useInspections';
import {
  getScopeAssets,
  getActiveTransfersAt,
  saveInspectionDraft,
  startInspection,
} from '@/services/inventory-inspection/inspectionService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { Modal } from '@/components/ui/Modal';
import { createEmptyRoundForm } from '@/models/inventory-inspection/InspectionRound';
import { ROUND_TYPES, ROUND_TYPE_LABELS, ROUND_STATUS } from '@/models/inventory-inspection/inspectionConstants';
import { validateRound, hasErrors, firstError } from '@/utils/inventory-inspection/inspectionValidation';
import {
  LOCATION_MODES,
  LOCATION_MODE_LABELS,
  ASSET_MODES,
  ASSET_MODE_LABELS,
  LOCATION_TYPE_ORDER,
  candidateLocations,
  matchesAssetScope,
  describeScope,
} from '@/utils/inventory-inspection/inspectionScope';
import { inspectionCrumbs } from '@/utils/inventory-inspection/breadcrumbs';
import { LOCATION_TYPE_LABELS, locationLabel } from '@/models/Location';
import { ROLE_LABELS, ROLES } from '@/models/User';
import { normalizeText } from '@/utils/format';
import '@/styles/modules/inventory-inspection.css';

const toggleIn = (list, value) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

function CheckChip({ checked, onChange, children, disabled }) {
  return (
    <label className={`kk-chip ${checked ? 'kk-chip--on' : ''} ${disabled ? 'kk-chip--disabled' : ''}`}>
      <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} />
      {children}
    </label>
  );
}

function RoundForm({ initial, roundId, md, user }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [assetQuery, setAssetQuery] = useState('');
  const [draftId, setDraftId] = useState(roundId || null);
  // Manual overrides on the computed room list.
  const [inspectors, setInspectors] = useState(() =>
    Object.fromEntries((initial.scope || []).map((s) => [s.locationId, s.inspectorUserId])),
  );
  const [excluded, setExcluded] = useState([]);
  const locked = useLockedLocations();
  const { data: stock } = useAsync(() => getScopeAssets({ assetMode: 'ALL' }), []);

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      Object.keys(patch).forEach((k) => delete next[k]);
      delete next.scope;
      return next;
    });
  };
  const onSignature = useCallback(({ url }) => setForm((f) => ({ ...f, creatorSignatureUrl: url })), []);

  /* ---------- WHERE ---------- */
  const candidates = useMemo(
    () =>
      candidateLocations(form, md.locations, md.campuses).sort(
        (a, b) => a.campusId.localeCompare(b.campusId) || LOCATION_TYPE_ORDER.indexOf(a.type) - LOCATION_TYPE_ORDER.indexOf(b.type),
      ),
    [form, md.locations, md.campuses],
  );

  /* ---------- WHAT ---------- */
  const itemsAt = (locId) => (stock?.[locId]?.items || []).filter((a) => matchesAssetScope(a, form));
  const candidateStock = candidates.flatMap((l) => stock?.[l.id]?.items || []);
  const categoryUnits = (catId) => candidateStock.filter((a) => a.categoryId === catId).reduce((s, a) => s + a.quantity, 0);
  const catalogMap = {};
  candidateStock.forEach((a) => {
    const row = catalogMap[a.code] || (catalogMap[a.code] = { ...a, total: 0, rooms: 0 });
    row.total += a.quantity;
    row.rooms += 1;
  });
  const catalog = Object.values(catalogMap).sort((x, y) => x.code.localeCompare(y.code));
  const visibleCatalog = catalog.filter((a) => !assetQuery || normalizeText(`${a.code} ${a.name}`).includes(normalizeText(assetQuery)));

  /* ---------- Resulting rooms ---------- */
  const rows = candidates.map((loc) => {
    const items = itemsAt(loc.id);
    const reason = locked[loc.id] ? `Đang thuộc đợt ${locked[loc.id]}` : items.length === 0 ? 'Không có tài sản thuộc phạm vi' : null;
    return {
      loc,
      items,
      units: items.reduce((s, a) => s + a.quantity, 0),
      reason,
      included: !reason && !excluded.includes(loc.id),
      inspectorUserId: inspectors[loc.id] ?? loc.managerUserId ?? '',
    };
  });
  const included = rows.filter((r) => r.included);
  const scope = included.map((r) => ({ locationId: r.loc.id, inspectorUserId: r.inspectorUserId || null }));
  const totalUnits = included.reduce((s, r) => s + r.units, 0);
  const staff = md.users.filter((u) => u.role !== ROLES.VICE_PRINCIPAL);
  const payload = () => ({ ...form, scope });

  const scopeKey = scope.map((s) => s.locationId).join(',');
  const { data: activeTransfers } = useAsync(() => getActiveTransfersAt(scope.map((s) => s.locationId)), [scopeKey], {
    enabled: scope.length > 0,
  });

  const saveDraft = async () => {
    setSaving(true);
    try {
      const r = await saveInspectionDraft(draftId, payload(), user);
      setDraftId(r.id);
      toast.success(`Đã lưu nháp đợt ${r.code}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const askStart = () => {
    const e = validateRound(payload());
    if (!form.creatorSignatureUrl) e.signature = 'Vui lòng chọn chữ ký người lập';
    setErrors(e);
    if (hasErrors(e)) {
      toast.error(firstError(e));
      return;
    }
    setConfirmOpen(true);
  };

  const start = async () => {
    try {
      const r = await startInspection(draftId, payload(), user);
      toast.success(`Đã bắt đầu đợt ${r.code} và giao ${r.sheets.length} phiếu kiểm kê`, 'Bắt đầu kiểm kê');
      navigate(`/facility/inspections/${r.id}`);
    } catch (err) {
      setConfirmOpen(false);
      toast.error(err.message, 'Không bắt đầu được');
    }
  };

  const desc = describeScope({ ...form, scope }, md);

  return (
    <>
      <section className="card wizard-card">
        <h2 className="section-title">1.&nbsp; Thông tin đợt kiểm kê</h2>
        <div className="general-grid">
          <div>
            <div className="form-row">
              <label className="form-row__label" htmlFor="kk-name">
                Tên đợt<span className="req">*</span>
              </label>
              <div className="form-row__control">
                <input
                  id="kk-name"
                  className={`input ${errors.name ? 'input--error' : ''}`}
                  value={form.name}
                  onChange={(e) => set({ name: e.target.value })}
                  placeholder="Ví dụ: Kiểm kê cuối năm học 2025 - 2026"
                />
                {errors.name && <span className="field__error">{errors.name}</span>}
              </div>
            </div>
            <div className="form-row">
              <span className="form-row__label">
                Loại kiểm kê<span className="req">*</span>
              </span>
              <div className="form-row__control stack" style={{ gap: 8 }} role="radiogroup">
                {Object.values(ROUND_TYPES).map((t) => (
                  <label key={t} className="radio">
                    <input type="radio" name="kk-type" checked={form.type === t} onChange={() => set({ type: t })} /> {ROUND_TYPE_LABELS[t]}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div>
            <div className="form-row">
              <label className="form-row__label" htmlFor="kk-start">
                Ngày bắt đầu<span className="req">*</span>
              </label>
              <div className="form-row__control">
                <input
                  id="kk-start"
                  type="date"
                  className="input"
                  value={form.startDate}
                  onChange={(e) => set({ startDate: e.target.value })}
                />
              </div>
            </div>
            <div className="form-row">
              <label className="form-row__label" htmlFor="kk-deadline">
                Hạn hoàn thành<span className="req">*</span>
              </label>
              <div className="form-row__control">
                <input
                  id="kk-deadline"
                  type="date"
                  className={`input ${errors.deadline ? 'input--error' : ''}`}
                  min={form.startDate}
                  value={form.deadline}
                  onChange={(e) => set({ deadline: e.target.value })}
                />
                {errors.deadline && <span className="field__error">{errors.deadline}</span>}
              </div>
            </div>
            <div className="form-row">
              <label className="form-row__label" htmlFor="kk-note">
                Ghi chú / Yêu cầu
              </label>
              <div className="form-row__control">
                <textarea
                  id="kk-note"
                  className="textarea"
                  rows={2}
                  maxLength={500}
                  value={form.note}
                  onChange={(e) => set({ note: e.target.value })}
                  placeholder="Hướng dẫn cho người kiểm kê (nếu có)"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="card wizard-card">
        <h2 className="section-title">2.&nbsp; Phạm vi kiểm kê</h2>
        <div className="kk-scope-axes">
          {/* WHERE */}
          <div className="kk-axis">
            <div className="kk-axis__title">
              <MapPin size={18} /> Kiểm kê ở đâu?
            </div>
            <div className="stack" style={{ gap: 8 }} role="radiogroup">
              {Object.values(LOCATION_MODES).map((m) => (
                <label key={m} className="radio">
                  <input type="radio" name="kk-where" checked={form.locationMode === m} onChange={() => set({ locationMode: m })} />{' '}
                  {LOCATION_MODE_LABELS[m]}
                </label>
              ))}
            </div>

            {form.locationMode !== LOCATION_MODES.SCHOOL && (
              <div className="kk-axis__block">
                <div className="field__label">
                  Campus<span className="req">*</span>
                </div>
                <div className="kk-chips">
                  {md.campuses.map((c) => (
                    <CheckChip
                      key={c.id}
                      checked={form.campusIds.includes(c.id)}
                      onChange={() => set({ campusIds: toggleIn(form.campusIds, c.id) })}
                    >
                      {c.shortName}
                    </CheckChip>
                  ))}
                </div>
                {errors.campusIds && <span className="field__error">{errors.campusIds}</span>}
              </div>
            )}

            {form.locationMode === LOCATION_MODES.LOCATION_TYPE && (
              <div className="kk-axis__block">
                <div className="field__label">
                  Loại phòng<span className="req">*</span>
                </div>
                <div className="kk-chips">
                  {LOCATION_TYPE_ORDER.map((t) => (
                    <CheckChip
                      key={t}
                      checked={form.locationTypes.includes(t)}
                      onChange={() => set({ locationTypes: toggleIn(form.locationTypes, t) })}
                    >
                      Tất cả {LOCATION_TYPE_LABELS[t].toLowerCase()}
                    </CheckChip>
                  ))}
                </div>
                {errors.locationTypes && <span className="field__error">{errors.locationTypes}</span>}
              </div>
            )}

            {form.locationMode === LOCATION_MODES.CUSTOM && (
              <div className="kk-axis__block">
                <div className="field__label">
                  Lớp/phòng<span className="req">*</span>
                </div>
                <div className="kk-pick-list">
                  {md.locations
                    .filter((l) => form.campusIds.includes(l.campusId))
                    .map((l) => (
                      <label key={l.id} className="checkbox">
                        <input
                          type="checkbox"
                          checked={form.locationIds.includes(l.id)}
                          onChange={() => set({ locationIds: toggleIn(form.locationIds, l.id) })}
                        />
                        {locationLabel(l)}{' '}
                        <span className="muted text-xs">
                          · {LOCATION_TYPE_LABELS[l.type]}
                          {form.campusIds.length > 1 ? ` · ${md.campusById(l.campusId)?.shortName}` : ''}
                        </span>
                      </label>
                    ))}
                </div>
                {errors.locationIds && <span className="field__error">{errors.locationIds}</span>}
              </div>
            )}
          </div>

          {/* WHAT */}
          <div className="kk-axis">
            <div className="kk-axis__title">
              <Boxes size={18} /> Kiểm kê cơ sở vật chất gì?
            </div>
            <div className="stack" style={{ gap: 8 }} role="radiogroup">
              {Object.values(ASSET_MODES).map((m) => (
                <label key={m} className="radio">
                  <input type="radio" name="kk-what" checked={form.assetMode === m} onChange={() => set({ assetMode: m })} />{' '}
                  {ASSET_MODE_LABELS[m]}
                </label>
              ))}
            </div>

            {form.assetMode === ASSET_MODES.CATEGORY && (
              <div className="kk-axis__block">
                <div className="field__label">
                  Nhóm tài sản<span className="req">*</span>
                </div>
                <div className="kk-chips">
                  {md.categories.map((c) => {
                    const units = categoryUnits(c.id);
                    return (
                      <CheckChip
                        key={c.id}
                        checked={form.categoryIds.includes(c.id)}
                        disabled={!units && !form.categoryIds.includes(c.id)}
                        onChange={() => set({ categoryIds: toggleIn(form.categoryIds, c.id) })}
                      >
                        {c.name} <span className="muted">({units})</span>
                      </CheckChip>
                    );
                  })}
                </div>
                {errors.categoryIds && <span className="field__error">{errors.categoryIds}</span>}
              </div>
            )}

            {form.assetMode === ASSET_MODES.ASSET && (
              <div className="kk-axis__block">
                <div className="row row--between">
                  <span className="field__label">
                    Tài sản<span className="req">*</span> <span className="muted">(đã chọn {form.assetCodes.length})</span>
                  </span>
                  {form.assetCodes.length > 0 && (
                    <button className="link-btn" onClick={() => set({ assetCodes: [] })}>
                      Bỏ chọn
                    </button>
                  )}
                </div>
                <label className="search-box" style={{ minWidth: 0 }}>
                  <Search size={15} className="muted" />
                  <input
                    placeholder="Tìm mã, tên tài sản..."
                    value={assetQuery}
                    onChange={(e) => setAssetQuery(e.target.value)}
                    aria-label="Tìm tài sản"
                  />
                </label>
                <div className="kk-pick-list">
                  {visibleCatalog.length === 0 && <div className="muted">Không có tài sản trong khu vực đã chọn</div>}
                  {visibleCatalog.map((a) => (
                    <label key={a.code} className="checkbox">
                      <input
                        type="checkbox"
                        checked={form.assetCodes.includes(a.code)}
                        onChange={() => set({ assetCodes: toggleIn(form.assetCodes, a.code) })}
                      />
                      <span>
                        <b>{a.code}</b> {a.name}{' '}
                        <span className="muted text-xs">
                          · {a.total} {a.unit} ở {a.rooms} phòng
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                {errors.assetCodes && <span className="field__error">{errors.assetCodes}</span>}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="card wizard-card">
        <div className="row row--between mb-12">
          <h2 className="section-title" style={{ margin: 0 }}>
            3.&nbsp; Lớp/phòng sẽ kiểm kê và người thực hiện
          </h2>
          <button className="btn btn--sm btn--outline-primary" onClick={() => setPreviewOpen(true)} disabled={!included.length}>
            <Eye size={15} /> Xem trước danh sách tài sản
          </button>
        </div>
        <div className="alert alert--info mb-12 text-sm">
          <Info size={17} />
          <div>
            <b>{desc.where}</b> · <b>{desc.what}</b>. Mỗi lớp/phòng có <b>1 phiếu kiểm kê</b> giao cho người phụ trách (có thể đổi hoặc bỏ
            khỏi đợt). Khi bắt đầu, hệ thống <b>chốt số lượng sổ sách</b> và <b>tạm khóa luân chuyển</b> các lớp/phòng này.
          </div>
        </div>
        {errors.scope && <div className="alert alert--danger mb-12">{errors.scope}</div>}
        {!stock ? (
          <LoadingState text="Đang tính phạm vi..." />
        ) : rows.length === 0 ? (
          <EmptyState icon={MapPin} title="Chưa có lớp/phòng nào" description="Chọn campus / loại phòng / lớp phòng ở mục 2." />
        ) : (
          <div className="table-wrap">
            <table className="table table--compact">
              <thead>
                <tr>
                  <th className="center" style={{ width: 50 }}>
                    Kiểm kê
                  </th>
                  {md.campuses.length > 1 && <th>Campus</th>}
                  <th>Lớp/phòng</th>
                  <th>Loại</th>
                  <th className="center">Tài sản thuộc phạm vi</th>
                  <th style={{ minWidth: 260 }}>Người kiểm kê</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const err = errors[`inspector_${r.loc.id}`];
                  return (
                    <tr key={r.loc.id} className={r.reason ? 'kk-row--muted' : ''}>
                      <td className="center">
                        <input
                          type="checkbox"
                          className="cb"
                          checked={r.included}
                          disabled={!!r.reason}
                          onChange={() => setExcluded((x) => toggleIn(x, r.loc.id))}
                          aria-label={`Kiểm kê ${locationLabel(r.loc)}`}
                        />
                      </td>
                      {md.campuses.length > 1 && <td>{md.campusById(r.loc.campusId)?.shortName}</td>}
                      <td>
                        <div className="fw-600">{locationLabel(r.loc)}</div>
                        {r.reason && (
                          <div className={`row text-xs ${locked[r.loc.id] ? 'text-danger' : 'muted'}`} style={{ gap: 4 }}>
                            {locked[r.loc.id] && <Lock size={12} />} {r.reason}
                          </div>
                        )}
                      </td>
                      <td className="text-2">{LOCATION_TYPE_LABELS[r.loc.type]}</td>
                      <td className="center">{r.items.length ? `${r.items.length} loại · ${r.units} cái` : '—'}</td>
                      <td>
                        {r.included && (
                          <>
                            <select
                              className={`select ${err ? 'select--error' : ''}`}
                              value={r.inspectorUserId || ''}
                              onChange={(e) => {
                                setInspectors((m) => ({ ...m, [r.loc.id]: e.target.value }));
                                setErrors((x) => ({ ...x, [`inspector_${r.loc.id}`]: undefined }));
                              }}
                              aria-label={`Người kiểm kê ${locationLabel(r.loc)}`}
                            >
                              <option value="">Chọn người kiểm kê...</option>
                              {staff.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.fullName} – {ROLE_LABELS[u.role]}
                                  {u.id === r.loc.managerUserId ? ' (phụ trách)' : ''}
                                </option>
                              ))}
                            </select>
                            {err && <span className="field__error">{err}</span>}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {activeTransfers?.length > 0 && (
          <div className="alert alert--warning mt-12">
            <AlertTriangle size={18} />
            <div>
              Có phiếu luân chuyển chưa hoàn thành liên quan: <b>{activeTransfers.map((t) => t.code).join(', ')}</b>. Khi kiểm kê bắt đầu,
              các phiếu này bị tạm dừng đến khi kiểm kê xong. Nên hoàn tất luân chuyển trước.
            </div>
          </div>
        )}
        <div className="mt-12 text-2 row" style={{ gap: 6 }}>
          <Users size={15} /> Sẽ tạo <b>{included.length}</b> phiếu kiểm kê · <b>{totalUnits}</b> tài sản cần kiểm đếm
        </div>
      </section>

      <section className="card wizard-card">
        <h2 className="section-title">4.&nbsp; Người lập và chữ ký</h2>
        <div className="review-sign">
          <div style={{ flex: 1 }}>
            <div className="text-2 mb-8">
              Người lập: <b>{user.fullName}</b> ({ROLE_LABELS[user.role]})
            </div>
            <SignaturePicker value={form.creatorSignatureUrl} onChange={onSignature} error={errors.signature} />
          </div>
          <div className="alert alert--info review-sign__note">
            <Info size={18} />
            <div>
              Sau khi ký và bắt đầu, người kiểm kê nhận thông báo và phiếu kiểm kê. Bạn theo dõi tiến độ, duyệt từng phiếu và phê duyệt kết
              quả cuối cùng.
            </div>
          </div>
        </div>
      </section>

      <div className="page-actions">
        <button className="btn btn--lg" onClick={() => navigate('/facility/inspections')}>
          Quay lại
        </button>
        <div className="row" style={{ gap: 10 }}>
          <button className="btn btn--lg" onClick={saveDraft} disabled={saving}>
            <Save size={16} /> Lưu nháp
          </button>
          <button className="btn btn--lg btn--primary" onClick={askStart}>
            <Play size={16} /> Ký và bắt đầu kiểm kê
          </button>
        </div>
      </div>

      <ConfirmationModal
        open={confirmOpen}
        title="Bắt đầu đợt kiểm kê?"
        message={`${desc.where} · ${desc.what}. Hệ thống sẽ tạo ${included.length} phiếu kiểm kê (${totalUnits} tài sản), chốt số lượng sổ sách và tạm khóa luân chuyển các lớp/phòng này. Người kiểm kê nhận thông báo ngay.`}
        confirmLabel="Ký và bắt đầu"
        onConfirm={start}
        onClose={() => setConfirmOpen(false)}
      >
        <ul className="text-sm" style={{ margin: '12px 0 0', paddingLeft: 18, maxHeight: 200, overflowY: 'auto' }}>
          {included.map((r) => (
            <li key={r.loc.id}>
              {locationLabel(r.loc)} ({r.items.length} loại) → {md.userById(r.inspectorUserId)?.fullName || '—'}
            </li>
          ))}
        </ul>
      </ConfirmationModal>

      <Modal open={previewOpen} size="xl" title="Xem trước danh sách tài sản sẽ kiểm kê" onClose={() => setPreviewOpen(false)}>
        <div className="text-2 mb-12">
          {desc.where} · {desc.what} · {included.length} lớp/phòng · {totalUnits} tài sản
        </div>
        <div className="stack" style={{ gap: 16 }}>
          {included.map((r) => (
            <div key={r.loc.id}>
              <div className="fw-600 mb-8">
                {locationLabel(r.loc)}{' '}
                <span className="muted" style={{ fontWeight: 400 }}>
                  · {md.campusById(r.loc.campusId)?.shortName} · {md.userById(r.inspectorUserId)?.fullName || 'chưa chọn người kiểm kê'}
                </span>
              </div>
              <div className="table-wrap">
                <table className="table table--compact">
                  <thead>
                    <tr>
                      <th>Mã</th>
                      <th>Tên tài sản</th>
                      <th>Nhóm</th>
                      <th className="center">SL sổ sách</th>
                      <th className="center">Tình trạng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.items.map((a) => (
                      <tr key={a.code}>
                        <td>{a.code}</td>
                        <td>{a.name}</td>
                        <td className="text-2">{md.categoryById(a.categoryId)?.name}</td>
                        <td className="center">
                          {a.quantity} {a.unit}
                        </td>
                        <td className="center">
                          <ConditionBadge value={a.condition} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}

/** Create a round, or keep editing a draft (/facility/inspections/:id/edit). */
export default function CreateInspectionPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const md = useMasterData();
  const { round, loading, error } = useInspection(id, { live: false });
  const initial = useMemo(() => {
    if (!id) return createEmptyRoundForm(user);
    if (!round) return null;
    return { ...createEmptyRoundForm(user), ...round, scope: round.scope || [], creatorSignatureUrl: null };
  }, [id, round, user]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const title = id ? `Đợt kiểm kê nháp ${round?.code || ''}` : 'Tạo đợt kiểm kê';
  return (
    <div className="page">
      <Breadcrumb items={inspectionCrumbs(title)} />
      <h1 className="page__title">{title}</h1>
      {md.loading || (id && loading) ? (
        <LoadingState />
      ) : md.error || error ? (
        <ErrorState error={md.error || error} />
      ) : id && round?.status !== ROUND_STATUS.DRAFT ? (
        <div className="card">
          <EmptyState icon={Lock} title="Đợt kiểm kê đã bắt đầu, không thể sửa" />
        </div>
      ) : (
        <RoundForm key={id || 'new'} initial={initial} roundId={id} md={md} user={user} />
      )}
    </div>
  );
}
