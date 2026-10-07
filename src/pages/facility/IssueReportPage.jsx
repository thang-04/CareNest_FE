import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Send, AlertTriangle, Info, Lock, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useFacilityAssets, useFacilityLocations } from '@/hooks/facility/useFacility';
import { checkOpenIssue, reportIssue } from '@/services/facility/facilityService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { EmptyState, ErrorState, LoadingState, Spinner } from '@/components/ui/States';
import { FormField } from '@/components/form/FormField';
import { ImageUploader } from '@/components/upload/ImageUploader';
import { AssetThumb, ConditionBadge } from '@/components/asset/AssetVisuals';
import { LockChip } from '@/components/facility/FacilityBadges';
import { locationLabel } from '@/models/Location';
import { ISSUE_TYPES, ISSUE_TYPE_LABELS, ISSUE_TYPE_HINTS, MAX_ISSUE_PHOTOS } from '@/models/facility/facilityConstants';
import { validateIssue, hasErrors } from '@/utils/facility/facilityValidation';
import { canReportIssue } from '@/utils/facility/facilityPermissions';
import { myReportCrumbs } from '@/utils/facility/breadcrumbs';
import { formatDate } from '@/utils/format';
import '@/styles/modules/facility.css';

const EMPTY = { locationId: '', assetId: '', type: '', quantity: '1', currentQuantity: '', description: '', images: [] };

/** #110 Facility Issue Report (UC 7.2): a Teacher / Kitchen Staff reports a damaged, missing or insufficient item. */
export default function IssueReportPage() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const md = useMasterData();
  const [params] = useSearchParams();
  const { assets, loading, error, reload } = useFacilityAssets({});
  const { locations } = useFacilityLocations();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [duplicate, setDuplicate] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Locations that have items to report, preselected when there is only one or when coming from the facility list.
  const myLocations = useMemo(() => locations.filter((l) => assets.some((a) => a.locationId === l.id)), [locations, assets]);
  useEffect(() => {
    if (form.locationId || loading) return;
    const fromList = assets.find((a) => a.id === params.get('assetId'));
    if (fromList) setForm((f) => ({ ...f, locationId: fromList.locationId, assetId: fromList.id }));
    else if (myLocations.length === 1) setForm((f) => ({ ...f, locationId: myLocations[0].id }));
  }, [assets, myLocations, loading, params, form.locationId]);

  const asset = assets.find((a) => a.id === form.assetId);
  const options = assets
    .filter((a) => a.locationId === form.locationId)
    .map((a) => ({ value: a.id, label: `${a.name} (${a.code})`, searchText: `${a.name} ${a.code}` }));

  // GBR-FAC-04: warn before sending that the same open issue already exists.
  useEffect(() => {
    let alive = true;
    setDuplicate(null);
    if (!form.assetId || !form.type) return undefined;
    checkOpenIssue(form.assetId, form.type, user)
      .then((found) => alive && setDuplicate(found))
      .catch(() => alive && setDuplicate(null));
    return () => {
      alive = false;
    };
  }, [form.assetId, form.type, user]);

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      Object.keys(patch).forEach((k) => delete next[k]);
      return next;
    });
  };
  const pickType = (type) =>
    set({
      type,
      quantity: type === ISSUE_TYPES.INSUFFICIENT ? '' : '1',
      currentQuantity: type === ISSUE_TYPES.INSUFFICIENT ? String(asset?.quantity ?? '') : '',
    });

  const askSubmit = () => {
    const e = validateIssue(form, asset);
    setErrors(e);
    if (hasErrors(e)) {
      toast.error('Vui lòng kiểm tra các ô được đánh dấu.', 'Chưa gửi được báo cáo');
      return;
    }
    setConfirmOpen(true);
  };

  const submit = async () => {
    setBusy(true);
    try {
      const res = await reportIssue(form, user);
      setConfirmOpen(false);
      if (res.duplicate) {
        toast.info(
          res.alreadyLinked
            ? `Bạn đã báo sự cố này trong báo cáo ${res.issue.code}.`
            : `Sự cố đã được báo trong ${res.issue.code}. Bạn được liên kết để nhận kết quả xử lý.`,
          'Không tạo báo cáo mới',
        );
      } else {
        toast.success(`Đã gửi báo cáo ${res.issue.code} tới Phó hiệu trưởng.`, 'Gửi báo cáo thành công');
      }
      navigate('/facility/my-reports');
    } catch (err) {
      toast.error(err.message, 'Không gửi được báo cáo');
      if (err.details) setErrors(err.details);
    } finally {
      setBusy(false);
    }
  };

  if (!canReportIssue(user))
    return (
      <div className="page">
        <Breadcrumb items={myReportCrumbs('Báo sự cố')} />
        <EmptyState
          icon={Lock}
          title="Bạn không có quyền báo sự cố"
          description="Chỉ giáo viên và nhân viên bếp báo sự cố cơ sở vật chất."
        />
      </div>
    );
  if (loading || md.loading)
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

  const type = form.type;
  return (
    <div className="page">
      <Breadcrumb items={myReportCrumbs('Báo sự cố')} />
      <h1 className="page__title">Báo sự cố cơ sở vật chất</h1>
      <div className="alert alert--info mb-16">
        <Info size={18} />
        <div>
          Báo cáo được gửi tới Phó hiệu trưởng phụ trách campus. Tình trạng tài sản chỉ cập nhật sau khi được duyệt; bạn theo dõi kết quả ở{' '}
          <b>Lịch sử báo cáo & đề nghị</b>.
        </div>
      </div>

      {myLocations.length === 0 ? (
        <div className="card">
          <EmptyState
            title="Không có tài sản để báo"
            description="Bạn chưa được phân công lớp/phòng nào có tài sản. Liên hệ Phó hiệu trưởng nếu thông tin chưa đúng."
          />
        </div>
      ) : (
        <>
          <section className="card wizard-card">
            <h2 className="section-title">1.&nbsp; Tài sản gặp sự cố</h2>
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
                <span className="field__label" id="bh-asset-label">
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
                    <LockChip code={asset.lockedBy} />
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="card wizard-card">
            <h2 className="section-title">2.&nbsp; Nội dung sự cố</h2>
            <div className="field">
              <span className="field__label" id="bh-type-label">
                Loại sự cố<span className="req">*</span>
              </span>
              <div className="bh-type-options" role="radiogroup" aria-labelledby="bh-type-label">
                {Object.values(ISSUE_TYPES).map((t) => (
                  <label key={t} className={`bh-type-option ${type === t ? 'bh-type-option--active' : ''}`}>
                    <input type="radio" name="bh-type" checked={type === t} onChange={() => pickType(t)} />
                    <span>
                      <span className="bh-type-option__title">{ISSUE_TYPE_LABELS[t]}</span>
                      <span className="bh-type-option__hint" style={{ display: 'block' }}>
                        {ISSUE_TYPE_HINTS[t]}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              {errors.type && (
                <span className="field__error" role="alert">
                  {errors.type}
                </span>
              )}
            </div>

            {duplicate && (
              <div className="alert alert--warning mt-12">
                <AlertTriangle size={18} />
                <div>
                  Sự cố này đã được báo trong <b>{duplicate.code}</b> ({formatDate(duplicate.createdAt)}) và đang chờ duyệt. Nếu gửi, hệ
                  thống không tạo báo cáo mới mà liên kết bạn vào báo cáo đó để cùng nhận kết quả.
                </div>
              </div>
            )}

            {type && (
              <div className="bh-qty-pair mt-12">
                {type === ISSUE_TYPES.INSUFFICIENT && (
                  <FormField label="Số lượng hiện có" required error={errors.currentQuantity}>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={form.currentQuantity}
                      onChange={(e) => set({ currentQuantity: e.target.value })}
                    />
                  </FormField>
                )}
                <FormField
                  label={
                    type === ISSUE_TYPES.INSUFFICIENT
                      ? 'Số lượng cần bổ sung'
                      : type === ISSUE_TYPES.MISSING
                        ? 'Số lượng bị mất'
                        : 'Số lượng bị hỏng'
                  }
                  required
                  error={errors.quantity}
                  hint={asset && type !== ISSUE_TYPES.INSUFFICIENT ? `Tối đa ${asset.quantity} ${asset.unit.toLowerCase()}` : undefined}
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
            )}

            <FormField
              className="mt-12"
              label="Mô tả sự cố"
              required
              error={errors.description}
              hint={`${form.description.length}/1000 ký tự – ghi rõ hiện trạng, vị trí, thời điểm phát hiện`}
            >
              <textarea
                className="textarea"
                rows={4}
                maxLength={1000}
                value={form.description}
                onChange={(e) => set({ description: e.target.value })}
                placeholder="Ví dụ: Quạt góc cửa sổ kêu to, quay chậm từ sáng thứ Hai"
              />
            </FormField>

            <div className="field mt-12">
              <span className="field__label">Ảnh hiện trạng{type === ISSUE_TYPES.DAMAGED && <span className="req">*</span>}</span>
              <ImageUploader images={form.images} onChange={(images) => set({ images })} max={MAX_ISSUE_PHOTOS} />
              {errors.images ? (
                <span className="field__error" role="alert">
                  {errors.images}
                </span>
              ) : (
                <span className="field__hint">
                  Tối đa {MAX_ISSUE_PHOTOS} ảnh. {type === ISSUE_TYPES.DAMAGED ? 'Báo hư hỏng cần ít nhất 1 ảnh.' : 'Không bắt buộc.'}
                </span>
              )}
            </div>
          </section>

          <div className="page-actions">
            <button className="btn btn--lg" onClick={() => navigate(-1)}>
              <ArrowLeft size={16} /> Quay lại
            </button>
            <button className="btn btn--lg btn--primary" onClick={askSubmit} disabled={busy}>
              {busy ? <Spinner small /> : <Send size={16} />} Gửi báo cáo
            </button>
          </div>
        </>
      )}

      <ConfirmationModal
        open={confirmOpen}
        title="Gửi báo cáo sự cố?"
        message={
          asset
            ? `${ISSUE_TYPE_LABELS[type]}: ${asset.name} – ${locationLabel(md.locationById(asset.locationId))}. Báo cáo sẽ được gửi tới Phó hiệu trưởng phụ trách campus.`
            : ''
        }
        confirmLabel="Gửi báo cáo"
        onConfirm={submit}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}
