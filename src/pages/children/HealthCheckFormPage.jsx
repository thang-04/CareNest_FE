import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Info } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useHealthCheck } from '@/hooks/children/useHealthChecks';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { LoadingState, Spinner } from '@/components/ui/States';
import { StatusPage } from '@/components/ui/StatusPage';
import { FormField } from '@/components/form/FormField';
import { ChildAccessState, HEALTH_CHECK_ACCESS_TEXT } from '@/components/children/ChildAccessState';
import { createHealthCheck, getScheduleWarnings, updateHealthCheck } from '@/services/children/healthCheckService';
import { CAMPAIGN_KIND, CAMPAIGN_KIND_LABELS, CAMPAIGN_STATUS, SCHEDULE_WARNING } from '@/models/children/healthCheckConstants';
import { formatDate, todayInput } from '@/utils/format';
import { hasErrors, validateHealthCheck } from '@/utils/children/childrenValidation';
import { canManageHealthCheck, isVicePrincipal } from '@/utils/children/childrenPermissions';
import { healthCheckCrumbs } from '@/utils/children/breadcrumbs';
import '@/styles/modules/children.css';

const isRoundKind = (kind) => kind === CAMPAIGN_KIND.MEASUREMENT;

// Gợi ý tên theo loại và tháng của ngày bắt đầu; người tạo sửa được.
const suggestName = (kind, startDate) =>
  startDate
    ? `${isRoundKind(kind) ? 'Cân đo định kỳ' : 'Khám sức khỏe định kỳ'} tháng ${Number(startDate.slice(5, 7))}/${startDate.slice(0, 4)}`
    : '';

const emptyForm = (kind, campusId) => {
  const start = todayInput();
  return { kind, name: suggestName(kind, start), campusId, startDate: start, endDate: start, examiner: '', note: '' };
};

/** Câu cảnh báo BE trả (user chốt 2026-10-31): kỳ/đợt sát nhau, hoặc năm học đã có đợt khám. */
const warningText = (w) =>
  w.code === SCHEDULE_WARNING.EXAM_IN_SCHOOL_YEAR
    ? `Năm học này đã có đợt khám "${w.name}" (bắt đầu ${formatDate(w.startDate)}).`
    : `${CAMPAIGN_KIND_LABELS[w.kind]} "${w.name}" bắt đầu ${formatDate(w.startDate)}, cách chưa tới 2 tháng 15 ngày.`;

export default function HealthCheckFormPage() {
  const { campaignId } = useParams();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const md = useMasterData();
  const editing = !!campaignId;
  const { detail, loading, error, reload } = useHealthCheck(campaignId, { live: false });
  // PHT chỉ tạo cho điểm trường của mình (user chốt 2026-10-31): chọn sẵn, không đổi.
  const ownCampusId = isVicePrincipal(user) ? user.campusId : '';
  const initialKind = params.get('kind') === CAMPAIGN_KIND.EXAM ? CAMPAIGN_KIND.EXAM : CAMPAIGN_KIND.MEASUREMENT;
  const [form, setForm] = useState(() => emptyForm(initialKind, ownCampusId || ''));
  const [nameTouched, setNameTouched] = useState(false);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [warnings, setWarnings] = useState(null);

  const campaign = detail?.campaign;
  useEffect(() => {
    if (campaign)
      setForm({
        kind: campaign.kind,
        name: campaign.name,
        campusId: campaign.campusId,
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        examiner: campaign.examiner || '',
        note: campaign.note || '',
      });
  }, [campaign]);

  const isRound = isRoundKind(form.kind);
  const kindName = CAMPAIGN_KIND_LABELS[form.kind].toLowerCase();
  const title = editing ? `Sửa ${kindName}` : `Tạo ${kindName}`;
  const crumbs = healthCheckCrumbs(campaign ? { label: campaign.name, to: `/children/health-checks/${campaign.id}` } : null, title);

  if (!canManageHealthCheck(user, campaign?.campusId))
    return (
      <div className="page">
        <Breadcrumb items={crumbs} />
        <h1 className="page__title">{title}</h1>
        <StatusPage
          kind="403"
          title="Bạn không tạo hoặc sửa được đợt khám, kỳ cân đo"
          description="Hiệu trưởng quản lý mọi điểm trường; Phó hiệu trưởng quản lý điểm trường của mình."
          action={
            <Link className="btn" to="/children/health-checks">
              <ArrowLeft size={16} /> Về danh sách
            </Link>
          }
        />
      </div>
    );
  if (editing && loading)
    return (
      <div className="page">
        <Breadcrumb items={crumbs} />
        <LoadingState />
      </div>
    );
  if (editing && (error || !campaign))
    return (
      <div className="page">
        <Breadcrumb items={crumbs} />
        <ChildAccessState error={error || { status: 404 }} onRetry={reload} text={HEALTH_CHECK_ACCESS_TEXT} />
      </div>
    );
  const locked = editing && [CAMPAIGN_STATUS.CLOSED, CAMPAIGN_STATUS.CANCELLED].includes(campaign.status);
  const campuses = ownCampusId ? md.campuses.filter((c) => c.id === ownCampusId) : md.campuses;

  const set = (field, value) => {
    const next = { ...form, [field]: value };
    // Tên chưa sửa tay thì đi theo loại và ngày bắt đầu
    if ((field === 'startDate' || field === 'kind') && !editing && !nameTouched) next.name = suggestName(next.kind, next.startDate);
    if (field === 'startDate' && next.endDate < value) next.endDate = value;
    if (field === 'name') setNameTouched(true);
    setForm(next);
    const nextErrors = validateHealthCheck(next);
    setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => nextErrors[k])));
  };
  const blur = (field) => {
    const e = validateHealthCheck(form)[field];
    if (e) setErrors((prev) => ({ ...prev, [field]: e }));
  };

  const submit = async () => {
    setBusy(true);
    try {
      const saved = editing ? await updateHealthCheck(campaign.id, form, user) : await createHealthCheck(form, user);
      toast.success(editing ? `Đã lưu thông tin ${kindName}.` : `Đã tạo ${kindName}. Giáo viên của điểm trường đã nhận thông báo.`);
      navigate(`/children/health-checks/${saved.id}`);
    } catch (err) {
      setWarnings(null);
      if (err.details) setErrors(err.details);
      toast.error(err, editing ? `Không lưu được ${kindName}` : `Không tạo được ${kindName}`);
    } finally {
      setBusy(false);
    }
  };

  // Hỏi BE cảnh báo trước khi lưu; có cảnh báo thì người dùng xác nhận mới lưu (không chặn).
  const save = async () => {
    const errs = validateHealthCheck(form);
    setErrors(errs);
    if (hasErrors(errs)) return;
    setBusy(true);
    try {
      const { warnings: found } = await getScheduleWarnings(
        { campusId: form.campusId, kind: form.kind, startDate: form.startDate, excludeId: campaign?.id },
        user,
      );
      setBusy(false);
      if (found.length > 0) setWarnings(found);
      else await submit();
    } catch (err) {
      setBusy(false);
      toast.error(err, 'Không kiểm tra được lịch của điểm trường');
    }
  };

  const back = editing ? `/children/health-checks/${campaign.id}` : '/children/health-checks';

  return (
    <div className="page">
      <Breadcrumb items={crumbs} />
      <h1 className="page__title">{title}</h1>
      {locked ? (
        <div className="alert alert--warning mb-16">
          <Info size={18} />
          <div>{CAMPAIGN_KIND_LABELS[form.kind]} đã đóng hoặc đã hủy nên không sửa được thông tin.</div>
        </div>
      ) : (
        <div className="alert alert--info mb-16">
          <Info size={18} />
          <div>
            {isRound
              ? 'Kỳ cân đo khoảng 3 tháng/lần: giáo viên phụ trách lớp nhập chiều cao, cân nặng của trẻ trong khoảng ngày cân đo.'
              : 'Đợt khám sức khỏe thường 1 lần/năm học: giáo viên phụ trách lớp nhập phiếu khám cùng bác sĩ trong khoảng ngày khám.'}{' '}
            Mỗi điểm trường chỉ có một đợt khám hoặc kỳ cân đo chưa đóng.
          </div>
        </div>
      )}
      <section className="card wizard-card">
        <div className="grid-2">
          <FormField
            label="Loại"
            required
            error={errors.kind}
            className="tr-span-2"
            hint={editing ? 'Không đổi được loại sau khi tạo.' : undefined}
          >
            <select className="select" value={form.kind} disabled={editing} onChange={(e) => set('kind', e.target.value)}>
              <option value={CAMPAIGN_KIND.MEASUREMENT}>{CAMPAIGN_KIND_LABELS.MEASUREMENT} (giáo viên cân đo tại lớp)</option>
              <option value={CAMPAIGN_KIND.EXAM}>{CAMPAIGN_KIND_LABELS.EXAM} (bác sĩ khám, phiếu Phụ lục II)</option>
            </select>
          </FormField>
          <FormField label={isRound ? 'Tên kỳ cân đo' : 'Tên đợt khám'} required error={errors.name} className="tr-span-2">
            <input
              className="input"
              maxLength={150}
              value={form.name}
              disabled={locked}
              onChange={(e) => set('name', e.target.value)}
              onBlur={() => blur('name')}
            />
          </FormField>
          <FormField
            label="Điểm trường"
            required
            error={errors.campusId}
            hint={
              editing
                ? 'Không đổi được điểm trường sau khi tạo.'
                : ownCampusId
                  ? 'Phó hiệu trưởng tạo cho điểm trường của mình.'
                  : undefined
            }
          >
            <select
              className="select"
              value={form.campusId}
              disabled={editing || !!ownCampusId}
              onChange={(e) => set('campusId', e.target.value)}
              onBlur={() => blur('campusId')}
            >
              <option value="">Chọn điểm trường</option>
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </FormField>
          {/* Kỳ cân đo không có đơn vị khám: giữ ô trống để ngày bắt đầu, kết thúc chung một hàng. */}
          {isRound ? (
            <div aria-hidden="true" />
          ) : (
            <FormField label="Đơn vị khám / bác sĩ" error={errors.examiner} hint="Ví dụ: Trạm Y tế phường, bác sĩ khám định kỳ.">
              <input
                className="input"
                maxLength={150}
                value={form.examiner}
                disabled={locked}
                onChange={(e) => set('examiner', e.target.value)}
              />
            </FormField>
          )}
          <FormField label={isRound ? 'Ngày bắt đầu cân đo' : 'Ngày bắt đầu khám'} required error={errors.startDate}>
            <input
              type="date"
              className="input"
              value={form.startDate}
              disabled={locked}
              onChange={(e) => set('startDate', e.target.value)}
              onBlur={() => blur('startDate')}
            />
          </FormField>
          <FormField label={isRound ? 'Ngày kết thúc cân đo' : 'Ngày kết thúc khám'} required error={errors.endDate}>
            <input
              type="date"
              className="input"
              value={form.endDate}
              min={form.startDate || undefined}
              disabled={locked}
              onChange={(e) => set('endDate', e.target.value)}
              onBlur={() => blur('endDate')}
            />
          </FormField>
        </div>
        <FormField
          label="Ghi chú"
          error={errors.note}
          className="mt-12"
          hint={isRound ? 'Ví dụ: cân đo buổi sáng, trước giờ ăn.' : 'Ví dụ: giáo viên có mặt cùng bác sĩ để ghi kết quả.'}
        >
          <textarea
            className="textarea"
            rows={2}
            maxLength={500}
            value={form.note}
            disabled={locked}
            onChange={(e) => set('note', e.target.value)}
          />
        </FormField>
      </section>
      <div className="page-actions">
        <Link className="btn wizard-actions__back" to={back}>
          <ArrowLeft size={16} /> Hủy
        </Link>
        {!locked && (
          <button className="btn btn--primary" onClick={save} disabled={busy}>
            {busy ? <Spinner small /> : editing ? <Save size={16} /> : <Plus size={16} />} {editing ? 'Lưu thay đổi' : title}
          </button>
        )}
      </div>
      <ConfirmationModal
        open={!!warnings}
        title="Lịch sát với đợt khám, kỳ cân đo khác"
        message="Kiểm tra lại ngày trước khi lưu:"
        confirmLabel={editing ? 'Vẫn lưu' : 'Vẫn tạo'}
        onConfirm={submit}
        onClose={() => setWarnings(null)}
      >
        <ul className="mt-8">
          {(warnings || []).map((w) => (
            <li key={`${w.code}${w.campaignId}`}>{warningText(w)}</li>
          ))}
        </ul>
      </ConfirmationModal>
    </div>
  );
}
