import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Send, Info, Lock, ArrowLeft } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useFacilityAssets, useFacilityLocations } from '@/hooks/facility/useFacility';
import { submitRequest } from '@/services/facility/facilityService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { EmptyState, ErrorState, LoadingState, Spinner } from '@/components/ui/States';
import { FormField } from '@/components/form/FormField';
import { AssetThumb, ConditionBadge } from '@/components/asset/AssetVisuals';
import { locationLabel } from '@/models/Location';
import { REQUEST_ITEM_MODES } from '@/models/facility/facilityConstants';
import { validateRequest, hasErrors } from '@/utils/facility/facilityValidation';
import { canCreateRequest } from '@/utils/facility/facilityPermissions';
import { myReportCrumbs } from '@/utils/facility/breadcrumbs';
import '@/styles/modules/facility.css';

const EMPTY = {
  locationId: '',
  itemMode: REQUEST_ITEM_MODES.EXISTING,
  assetId: '',
  itemName: '',
  unit: 'Cái',
  categoryId: '',
  quantity: '1',
  reason: '',
};

/** #111 Additional Facility Request (UC 7.3): request more units of an item, or a new item, for the class / kitchen. */
export default function RequestFormPage() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const md = useMasterData();
  const [params] = useSearchParams();
  const { assets, loading, error, reload } = useFacilityAssets({});
  const { locations, loading: locLoading } = useFacilityLocations();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const myLocations = locations;
  useEffect(() => {
    if (form.locationId || loading || locLoading) return;
    const fromList = assets.find((a) => a.id === params.get('assetId'));
    if (fromList) setForm((f) => ({ ...f, locationId: fromList.locationId, assetId: fromList.id }));
    else if (myLocations.length === 1) setForm((f) => ({ ...f, locationId: myLocations[0].id }));
  }, [assets, myLocations, loading, locLoading, params, form.locationId]);

  const asset = assets.find((a) => a.id === form.assetId);
  const options = assets
    .filter((a) => a.locationId === form.locationId)
    .map((a) => ({ value: a.id, label: `${a.name} (${a.code})`, searchText: `${a.name} ${a.code}` }));

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      Object.keys(patch).forEach((k) => delete next[k]);
      return next;
    });
  };

  const askSubmit = () => {
    const e = validateRequest(form);
    setErrors(e);
    if (hasErrors(e)) {
      toast.error('Vui lòng kiểm tra các ô được đánh dấu.', 'Chưa gửi được đề nghị');
      return;
    }
    setConfirmOpen(true);
  };

  const submit = async () => {
    setBusy(true);
    try {
      const req = await submitRequest(form, user);
      setConfirmOpen(false);
      toast.success(`Đã gửi đề nghị ${req.code} tới Phó hiệu trưởng.`, 'Gửi đề nghị thành công');
      navigate('/facility/my-reports?tab=requests');
    } catch (err) {
      toast.error(err.message, 'Không gửi được đề nghị');
      if (err.details) setErrors(err.details);
    } finally {
      setBusy(false);
    }
  };

  if (!canCreateRequest(user))
    return (
      <div className="page">
        <Breadcrumb items={myReportCrumbs('Đề nghị bổ sung')} />
        <EmptyState
          icon={Lock}
          title="Bạn không có quyền gửi đề nghị"
          description="Chỉ giáo viên và nhân viên bếp đề nghị bổ sung cơ sở vật chất."
        />
      </div>
    );
  if (loading || locLoading || md.loading)
    return (
      <div className="page">
        <LoadingState />
      </div>
    );
  if (error)
    return (
      <div className="page">
        <ErrorState error={error} onRetry={reload} />
      </div>
    );

  const itemText = form.itemMode === REQUEST_ITEM_MODES.EXISTING ? asset?.name : form.itemName.trim();
  const unitText = (form.itemMode === REQUEST_ITEM_MODES.EXISTING ? asset?.unit : form.unit) || '';

  return (
    <div className="page">
      <Breadcrumb items={myReportCrumbs('Đề nghị bổ sung')} />
      <h1 className="page__title">Đề nghị bổ sung cơ sở vật chất</h1>
      <div className="alert alert--info mb-16">
        <Info size={18} />
        <div>
          Đề nghị được gửi tới Phó hiệu trưởng phụ trách campus. Phó hiệu trưởng duyệt trong thẩm quyền hoặc chuyển Hiệu trưởng quyết định.
          Việc mua sắm, nhận hàng thực hiện ngoài hệ thống.
        </div>
      </div>

      {myLocations.length === 0 ? (
        <div className="card">
          <EmptyState title="Chưa có lớp/phòng phụ trách" description="Bạn chưa được phân công lớp/phòng nào. Liên hệ Phó hiệu trưởng." />
        </div>
      ) : (
        <>
          <section className="card wizard-card">
            <h2 className="section-title">1.&nbsp; Tài sản cần bổ sung</h2>
            <div className="grid-2">
              <FormField label="Lớp/phòng" required error={errors.locationId}>
                <select className="select" value={form.locationId} onChange={(e) => set({ locationId: e.target.value, assetId: '' })}>
                  <option value="">Chọn lớp/phòng...</option>
                  {myLocations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {locationLabel(l)}
                    </option>
                  ))}
                </select>
              </FormField>
              <div className="field">
                <span className="field__label" id="bh-mode-label">
                  Loại đề nghị<span className="req">*</span>
                </span>
                <div className="row row--wrap" style={{ gap: 16, minHeight: 38 }} role="radiogroup" aria-labelledby="bh-mode-label">
                  <label className="radio">
                    <input
                      type="radio"
                      name="bh-mode"
                      checked={form.itemMode === REQUEST_ITEM_MODES.EXISTING}
                      onChange={() => set({ itemMode: REQUEST_ITEM_MODES.EXISTING })}
                    />{' '}
                    Thêm số lượng tài sản đang có
                  </label>
                  <label className="radio">
                    <input
                      type="radio"
                      name="bh-mode"
                      checked={form.itemMode === REQUEST_ITEM_MODES.NEW}
                      onChange={() => set({ itemMode: REQUEST_ITEM_MODES.NEW })}
                    />{' '}
                    Tài sản mới
                  </label>
                </div>
              </div>
            </div>

            {form.itemMode === REQUEST_ITEM_MODES.EXISTING ? (
              <div className="mt-12">
                <div className="field">
                  <span className="field__label">
                    Tài sản<span className="req">*</span>
                  </span>
                  <SearchSelect
                    options={options}
                    value={form.assetId}
                    onChange={(v) => set({ assetId: v })}
                    placeholder={form.locationId ? 'Chọn tài sản...' : 'Chọn lớp/phòng trước'}
                    disabled={!form.locationId}
                    error={!!errors.assetId}
                    ariaLabel="Tài sản"
                  />
                  {errors.assetId && (
                    <span className="field__error" role="alert">
                      {errors.assetId}
                    </span>
                  )}
                </div>
                {asset && (
                  <div className="bh-asset-summary mt-12">
                    <AssetThumb asset={asset} />
                    <div className="bh-asset-summary__body">
                      <div className="fw-600">
                        {asset.name} <span className="muted">· {asset.code}</span>
                      </div>
                      <div className="row row--wrap text-sm" style={{ gap: 8, marginTop: 4 }}>
                        <span>
                          Đang có: <b>{asset.quantity}</b> {asset.unit.toLowerCase()}
                        </span>
                        <ConditionBadge value={asset.condition} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid-3 mt-12">
                <FormField label="Tên tài sản" required error={errors.itemName}>
                  <input
                    className="input"
                    maxLength={120}
                    value={form.itemName}
                    onChange={(e) => set({ itemName: e.target.value })}
                    placeholder="Ví dụ: Máy lọc không khí"
                  />
                </FormField>
                <FormField label="Đơn vị tính" required error={errors.unit}>
                  <input className="input" maxLength={20} value={form.unit} onChange={(e) => set({ unit: e.target.value })} />
                </FormField>
                <FormField label="Nhóm tài sản">
                  <select className="select" value={form.categoryId} onChange={(e) => set({ categoryId: e.target.value })}>
                    <option value="">Chọn nhóm...</option>
                    {md.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>
            )}
          </section>

          <section className="card wizard-card">
            <h2 className="section-title">2.&nbsp; Số lượng và lý do</h2>
            <div className="bh-qty-pair">
              <FormField
                label="Số lượng đề nghị"
                required
                error={errors.quantity}
                hint={unitText ? `Đơn vị: ${unitText.toLowerCase()}` : undefined}
              >
                <input
                  className="input"
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={form.quantity}
                  onChange={(e) => set({ quantity: e.target.value })}
                />
              </FormField>
            </div>
            <FormField className="mt-12" label="Lý do đề nghị" required error={errors.reason} hint={`${form.reason.length}/500 ký tự`}>
              <textarea
                className="textarea"
                rows={4}
                maxLength={500}
                value={form.reason}
                onChange={(e) => set({ reason: e.target.value })}
                placeholder="Ví dụ: Lớp nhận thêm 4 trẻ, không đủ ghế cho giờ ăn"
              />
            </FormField>
          </section>

          <div className="page-actions">
            <button className="btn btn--lg" onClick={() => navigate(-1)}>
              <ArrowLeft size={16} /> Quay lại
            </button>
            <button className="btn btn--lg btn--primary" onClick={askSubmit} disabled={busy}>
              {busy ? <Spinner small /> : <Send size={16} />} Gửi đề nghị
            </button>
          </div>
        </>
      )}

      <ConfirmationModal
        open={confirmOpen}
        title="Gửi đề nghị bổ sung?"
        message={`Đề nghị bổ sung ${form.quantity} ${unitText.toLowerCase()} ${itemText || ''} cho ${locationLabel(
          md.locationById(form.locationId),
        )}. Đề nghị sẽ được gửi tới Phó hiệu trưởng phụ trách campus.`}
        confirmLabel="Gửi đề nghị"
        onConfirm={submit}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}
