import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ClipboardList, Save, ShieldCheck, ShieldAlert, UserX } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { EmptyState, ErrorState, LoadingState, SkeletonRows } from '@/components/ui/States';
import { FormField } from '@/components/form/FormField';
import { PickupOutcomeBadge } from '@/components/pickup/PickupBadges';
import { usePickupChild, usePickupResults } from '@/hooks/pickup/usePickups';
import { recordPickupResult } from '@/services/pickup/pickupService';
import { PICKUP_OUTCOME, PICKUP_STATUS, RELATIONS, VERIFICATION, VERIFICATION_LABELS, outcomeOf } from '@/models/pickup/pickupConstants';
import { validatePickupResult } from '@/utils/pickup/pickupValidation';
import { pickupCrumbs } from '@/utils/pickup/breadcrumbs';
import { formatDate, formatDateTime, todayInput } from '@/utils/format';
import '@/styles/modules/pickup.css';

const nowTime = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

/** Today's results of the teacher's classes (shown when no child is selected). */
function ResultList() {
  const today = todayInput();
  const { results, loading, error, reload } = usePickupResults(today);
  return (
    <div className="card">
      <div className="card__header">
        <div className="card__title">Kết quả trả trẻ ngày {formatDate(today)}</div>
      </div>
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <div className="table-wrap dt-table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Trẻ</th>
                <th>Lớp</th>
                <th>Người đón</th>
                <th>Xác minh</th>
                <th>Kết quả</th>
                <th>Ghi nhận lúc</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows rows={4} cols={6} />
              ) : results.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      icon={ClipboardList}
                      title="Chưa có kết quả trả trẻ hôm nay"
                      description="Chọn trẻ trong danh sách đón trẻ để xác minh người đón."
                      action={
                        <Link className="btn btn--primary" to="/pickup">
                          Mở danh sách đón trẻ
                        </Link>
                      }
                    />
                  </td>
                </tr>
              ) : (
                results.map((r) => (
                  <tr key={r.id}>
                    <td className="fw-600">{r.childName}</td>
                    <td>{r.className}</td>
                    <td>
                      <div>{r.pickupPersonName}</div>
                      <div className="text-xs muted">{r.pickupPersonRelation}</div>
                    </td>
                    <td className="text-sm">{VERIFICATION_LABELS[r.verification]}</td>
                    <td>
                      <PickupOutcomeBadge status={r.outcome} />
                      {r.note && <div className="text-xs muted mt-8 dt-note">{r.note}</div>}
                    </td>
                    <td className="nowrap text-sm">{formatDateTime(r.recordedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ResultForm({ childId, verification, guardianIndex }) {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { context, loading, error, reload } = usePickupChild(childId, { live: false });
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!context || form) return;
    const g = guardianIndex != null ? context.guardians.find((x) => x.index === guardianIndex) : null;
    setForm({
      childId,
      verification,
      pickupPersonName: g?.fullName || '',
      pickupPersonRelation: g?.relation || '',
      pickupPersonPhone: '',
      handoverTime: nowTime(),
      note: '',
    });
  }, [context, form, childId, verification, guardianIndex]);

  if (loading || (!form && !error)) return <LoadingState />;
  if (error)
    return (
      <div className="card">
        {error.status === 404 || error.status === 403 ? (
          <EmptyState icon={UserX} title="Không tìm thấy trẻ" description={error.message} />
        ) : (
          <ErrorState error={error} onRetry={reload} />
        )}
      </div>
    );

  const handedOver = outcomeOf(verification) === PICKUP_OUTCOME.HANDED_OVER;
  const fromPhoto = verification === VERIFICATION.PHOTO_MATCH;
  const set = (k) => (e) => {
    setForm({ ...form, [k]: e.target.value });
    if (errors[k]) setErrors({ ...errors, [k]: undefined });
  };

  if (context.status !== PICKUP_STATUS.WAITING)
    return (
      <div className="card">
        <EmptyState
          title={context.status === PICKUP_STATUS.PICKED_UP ? 'Trẻ đã được trả hôm nay' : 'Trẻ vắng mặt hôm nay'}
          action={
            <Link className="btn" to={`/pickup?classId=${context.classId}`}>
              Quay lại danh sách
            </Link>
          }
        />
      </div>
    );

  const openConfirm = () => {
    const errs = validatePickupResult(form);
    setErrors(errs);
    if (Object.keys(errs).length === 0) setConfirmOpen(true);
  };

  const save = async () => {
    try {
      await recordPickupResult(form, user);
      toast.success(
        handedOver ? 'Đã ghi nhận trả trẻ và thông báo cho phụ huynh.' : 'Đã ghi nhận không trả trẻ và thông báo cho phụ huynh.',
        'Ghi nhận thành công',
      );
      navigate(`/pickup?classId=${context.classId}`);
    } catch (err) {
      setConfirmOpen(false);
      if (err.details) setErrors(err.details);
      toast.error(err.message, 'Không ghi nhận được kết quả');
    }
  };

  return (
    <>
      <div className={`alert ${handedOver ? 'alert--success' : 'alert--danger'} mb-16`}>
        {handedOver ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
        <div>
          <b>{VERIFICATION_LABELS[verification]}.</b>{' '}
          {handedOver ? 'Trẻ được trả cho người đón.' : 'Không trả trẻ. Trẻ ở lại lớp; ghi rõ lý do để phụ huynh nắm thông tin.'}
        </div>
      </div>
      <div className="card wizard-card">
        <div className="card__header">
          <div className="card__title">
            {context.child.fullName} · {context.className}
          </div>
          <PickupOutcomeBadge status={outcomeOf(verification)} />
        </div>
        <div className="card__body">
          <div className="grid-2">
            <FormField label="Họ tên người đón" required error={errors.pickupPersonName}>
              <input
                className="input"
                value={form.pickupPersonName}
                onChange={set('pickupPersonName')}
                readOnly={fromPhoto}
                maxLength={100}
              />
            </FormField>
            <FormField label="Quan hệ với trẻ" required error={errors.pickupPersonRelation}>
              {fromPhoto ? (
                <input className="input" value={form.pickupPersonRelation} readOnly />
              ) : (
                <select className="select" value={form.pickupPersonRelation} onChange={set('pickupPersonRelation')}>
                  <option value="">Chọn quan hệ</option>
                  {RELATIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              )}
            </FormField>
            {!fromPhoto && (
              <FormField label="Số điện thoại người đón" error={errors.pickupPersonPhone} hint="Không bắt buộc">
                <input
                  className="input"
                  type="tel"
                  value={form.pickupPersonPhone}
                  onChange={set('pickupPersonPhone')}
                  placeholder="09xx xxx xxx"
                />
              </FormField>
            )}
            {handedOver && (
              <FormField label="Giờ trả trẻ" required error={errors.handoverTime}>
                <input className="input" type="time" value={form.handoverTime} onChange={set('handoverTime')} />
              </FormField>
            )}
          </div>
          <div className="dt-confirm-row mt-12">
            <span className="text-sm text-2">Xác nhận qua điện thoại:</span>{' '}
            <b>{verification === VERIFICATION.PHONE_CONFIRMED ? 'Có – phụ huynh đồng ý' : fromPhoto ? 'Không cần (khớp ảnh)' : 'Không'}</b>
          </div>
          <FormField label="Ghi chú" required={!handedOver} error={errors.note} className="mt-12">
            <textarea
              className="textarea"
              rows={3}
              maxLength={500}
              value={form.note}
              onChange={set('note')}
              placeholder={handedOver ? '' : 'Ví dụ: Người đón không có trong danh sách, phụ huynh không nghe máy'}
            />
          </FormField>
        </div>
      </div>
      <div className="page-actions">
        <Link className="btn" to={`/pickup/${childId}/verify`}>
          <ArrowLeft size={16} /> Quay lại xác minh
        </Link>
        <button className={`btn btn--lg ${handedOver ? 'btn--primary' : 'btn--danger'}`} onClick={openConfirm}>
          <Save size={18} /> {handedOver ? 'Ghi nhận trả trẻ' : 'Ghi nhận không trả trẻ'}
        </button>
      </div>
      <ConfirmationModal
        open={confirmOpen}
        title={handedOver ? 'Ghi nhận trả trẻ' : 'Ghi nhận không trả trẻ'}
        message={
          handedOver
            ? `Trả ${context.child.fullName} cho ${form.pickupPersonName} (${form.pickupPersonRelation}) lúc ${form.handoverTime}? Phụ huynh sẽ nhận thông báo.`
            : `Ghi nhận không trả ${context.child.fullName} cho ${form.pickupPersonName}? Phụ huynh sẽ nhận thông báo.`
        }
        confirmLabel={handedOver ? 'Ghi nhận trả trẻ' : 'Ghi nhận không trả trẻ'}
        danger={!handedOver}
        onConfirm={save}
        onClose={() => setConfirmOpen(false)}
      />
    </>
  );
}

/** #101 Pickup Result (UC 3.16): records the pickup person, time and phone confirmation; the parent is notified. */
export default function PickupResultPage() {
  const [params] = useSearchParams();
  const childId = params.get('childId');
  const verification = params.get('verification');
  const guardian = params.get('guardian');
  const validStart = childId && Object.values(VERIFICATION).includes(verification);
  const title = 'Kết quả trả trẻ';
  return (
    <div className="page">
      <Breadcrumb items={pickupCrumbs(title)} />
      <h1 className="page__title">{validStart ? 'Ghi nhận kết quả trả trẻ' : title}</h1>
      {validStart ? (
        <ResultForm childId={childId} verification={verification} guardianIndex={guardian != null ? Number(guardian) : null} />
      ) : (
        <ResultList />
      )}
    </div>
  );
}
