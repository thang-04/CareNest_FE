import { useState } from 'react';
import { ArrowLeft, CheckCircle2, ImageOff, Phone, Save, ThumbsUp, UserCheck, XCircle } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { FormField } from '@/components/form/FormField';
import { EmptyState, ErrorState, LoadingState, Spinner } from '@/components/ui/States';
import { recordPickupResult } from '@/services/pickup/pickupService';
import { usePickupChild } from '@/hooks/pickup/usePickups';
import {
  CALL_NOTE_PERSON_LABEL,
  PICKUP_STATUS,
  PICKUP_STATUS_MESSAGES,
  VERIFICATION,
  VERIFICATION_LABELS,
} from '@/models/pickup/pickupConstants';
import { callNoteError, validatePickupResult } from '@/utils/pickup/pickupValidation';
import { formatDateTime, initials } from '@/utils/format';
import { PickupOutcomeBadge } from './PickupBadges';

const nowTime = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

function GuardianPhoto({ guardian }) {
  if (guardian.photoUrl) return <img className="dt-photo" src={guardian.photoUrl} alt={`Ảnh đăng ký của ${guardian.fullName}`} />;
  return (
    <div className="dt-photo dt-photo--empty" role="img" aria-label={`${guardian.fullName} chưa có ảnh đăng ký`}>
      <span className="dt-photo__initials">{initials(guardian.fullName)}</span>
      <span className="text-xs muted dt-photo__note">
        <ImageOff size={13} /> Chưa có ảnh
      </span>
    </div>
  );
}

/** Trẻ của hôm nay còn chờ đón thì hiện nội dung; đã đón hoặc vắng thì báo. Kèm lần không trả gần nhất. */
function WaitingChild({ childId, children }) {
  const { context, loading, error, reload } = usePickupChild(childId);
  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!context) return null;
  if (context.status !== PICKUP_STATUS.WAITING)
    return (
      <EmptyState
        icon={CheckCircle2}
        title={PICKUP_STATUS_MESSAGES[context.status]}
        description={
          context.pickup
            ? `${
                context.pickup.pickupPersonName
                  ? `${context.pickup.pickupPersonName} (${context.pickup.pickupPersonRelation})`
                  : `Người đón (${CALL_NOTE_PERSON_LABEL.toLowerCase()})`
              } đón lúc ${formatDateTime(context.pickup.handedOverAt)}.`
            : undefined
        }
      />
    );
  const lastFail = [...context.attempts].reverse().find((a) => a.outcome !== 'HANDED_OVER');
  return (
    <>
      {lastFail && (
        <div className="alert alert--warning mb-16">
          <PickupOutcomeBadge status={lastFail.outcome} />
          <div>
            Lần trước ({formatDateTime(lastFail.recordedAt)}): {lastFail.pickupPersonName || 'người đón'} –{' '}
            {VERIFICATION_LABELS[lastFail.verification]}. {lastFail.note}
          </div>
        </div>
      )}
      {children(context)}
    </>
  );
}

/**
 * Màn 100 Pickup Verification (UC 3.15), nút "Trả trẻ" của danh sách Đón trẻ (user yêu cầu 2026-10-23): so người đón với ảnh
 * phụ huynh đã đăng ký; khớp thì ghi giờ trả ngay trong modal. Không khớp thì dùng nút "Gọi phụ huynh" của dòng. onDone: đã ghi nhận.
 */
export function PickupPhotoFlow({ childId, onDone }) {
  const { user } = useAuth();
  const toast = useToast();
  const [guardian, setGuardian] = useState(null);
  const [form, setForm] = useState({ handoverTime: nowTime(), note: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const payload = {
      childId,
      verification: VERIFICATION.PHOTO_MATCH,
      pickupPersonName: guardian.fullName,
      pickupPersonRelation: guardian.relation,
      pickupPersonPhone: '',
      ...form,
    };
    const errs = validatePickupResult(payload);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await recordPickupResult(payload, user);
      toast.success('Đã ghi nhận trả trẻ và thông báo cho phụ huynh.', 'Ghi nhận thành công');
      onDone?.();
    } catch (err) {
      if (err.details) setErrors(err.details);
      toast.error(err, 'Không ghi nhận được kết quả');
    } finally {
      setBusy(false);
    }
  };

  return (
    <WaitingChild childId={childId}>
      {(context) =>
        guardian ? (
          <section aria-label="Ghi nhận trả trẻ">
            <div className="alert alert--success mb-16">
              <ThumbsUp size={18} />
              <div>
                <b>Khớp ảnh đăng ký:</b> trả {context.child.fullName} cho {guardian.fullName} ({guardian.relation}).
              </div>
            </div>
            <div className="grid-2">
              <FormField label="Giờ trả trẻ" required error={errors.handoverTime}>
                <input
                  className="input"
                  type="time"
                  value={form.handoverTime}
                  onChange={(e) => setForm({ ...form, handoverTime: e.target.value })}
                />
              </FormField>
            </div>
            <FormField label="Ghi chú" hint="Không bắt buộc" error={errors.note} className="mt-12">
              <textarea
                className="textarea"
                rows={2}
                maxLength={500}
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </FormField>
            <div className="dt-call__actions mt-16">
              <button className="btn" onClick={() => setGuardian(null)} disabled={busy}>
                <ArrowLeft size={16} /> Chọn lại
              </button>
              <button className="btn btn--primary" onClick={save} disabled={busy}>
                {busy ? <Spinner small /> : <Save size={16} />} Ghi nhận trả trẻ
              </button>
            </div>
          </section>
        ) : (
          <section aria-label="So sánh người đón với ảnh phụ huynh">
            <h3 className="subsection-title">So sánh người đón với ảnh phụ huynh đã đăng ký</h3>
            {context.guardians.length === 0 ? (
              <div className="alert alert--warning">Trẻ chưa có phụ huynh đăng ký. Gọi phụ huynh hoặc liên hệ Phó hiệu trưởng.</div>
            ) : (
              <div className="dt-guardians">
                {context.guardians.map((g) => (
                  <div key={g.index} className="dt-guardian">
                    <GuardianPhoto guardian={g} />
                    <div className="dt-guardian__info">
                      <div className="fw-600">{g.fullName}</div>
                      <div className="text-sm muted">{g.relation}</div>
                    </div>
                    <button className="btn btn--outline-primary btn--block" onClick={() => setGuardian(g)}>
                      <ThumbsUp size={16} /> Khớp ảnh – trả trẻ
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )
      }
    </WaitingChild>
  );
}

/**
 * Nút "Gọi phụ huynh" (user chốt 2026-10-23): ghi nội dung cuộc gọi (bắt buộc), rồi "Trả trẻ" hoặc "Không trả", cả hai xác nhận rồi
 * ghi nhận ngay trong modal (trả trẻ ghi luôn: user chốt 2026-10-24). Người đón, lý do không trả ghi trong nội dung cuộc gọi.
 * onDone: đã ghi nhận.
 */
export function PickupCallFlow({ childId, onDone }) {
  const { user } = useAuth();
  const toast = useToast();
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  // Kết quả đang chờ xác nhận: PHONE_CONFIRMED (trả) hoặc PHONE_DECLINED (không trả).
  const [confirming, setConfirming] = useState(null);
  const [handoverTime, setHandoverTime] = useState('');

  const checkNote = () => {
    const msg = callNoteError(note);
    setError(msg || '');
    return !msg;
  };

  const ask = (verification) => {
    if (!checkNote()) return;
    setHandoverTime(nowTime());
    setConfirming(verification);
  };

  const record = async () => {
    const handedOver = confirming === VERIFICATION.PHONE_CONFIRMED;
    try {
      await recordPickupResult(
        {
          childId,
          verification: confirming,
          pickupPersonName: '',
          pickupPersonRelation: '',
          pickupPersonPhone: '',
          handoverTime: handedOver ? handoverTime : '',
          note: note.trim(),
        },
        user,
      );
      toast.success(
        handedOver ? 'Đã ghi nhận trả trẻ và thông báo cho phụ huynh.' : 'Đã ghi nhận không trả trẻ và thông báo cho phụ huynh.',
        'Ghi nhận thành công',
      );
      setConfirming(null);
      onDone?.();
    } catch (err) {
      setConfirming(null);
      if (err.details?.note) setError(err.details.note);
      toast.error(err, 'Không ghi nhận được kết quả');
    }
  };

  return (
    <WaitingChild childId={childId}>
      {(context) => (
        <section aria-label="Gọi điện xác nhận với phụ huynh">
          <p className="text-2 mb-12">Gọi cho phụ huynh, mô tả người đón và hỏi phụ huynh có đồng ý cho người này đón trẻ không.</p>
          {context.guardians.length === 0 ? (
            <div className="alert alert--warning">Trẻ chưa có số điện thoại phụ huynh. Liên hệ Phó hiệu trưởng.</div>
          ) : (
            <ul className="dt-phones">
              {context.guardians.map((g) => (
                <li key={g.index}>
                  <span>
                    <b>{g.fullName}</b> <span className="muted">({g.relation})</span>
                  </span>
                  <a className="btn btn--sm" href={`tel:${g.phone.replace(/\s/g, '')}`}>
                    <Phone size={15} /> {g.phone}
                  </a>
                </li>
              ))}
            </ul>
          )}
          <FormField
            label="Nội dung cuộc gọi"
            required
            error={error}
            className="mt-16"
            hint="Ghi ai nghe máy, phụ huynh nói gì; không liên lạc được thì ghi rõ đã gọi số nào, lúc nào."
          >
            <textarea
              className="textarea"
              rows={3}
              maxLength={500}
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                if (error) setError('');
              }}
              placeholder="Ví dụ: Gọi mẹ lúc 16:40, mẹ nhờ chú Hùng đón; mô tả khớp với người đón."
            />
          </FormField>
          <div className="dt-call__actions mt-16">
            <button className="btn btn--danger" onClick={() => ask(VERIFICATION.PHONE_DECLINED)}>
              <XCircle size={16} /> Không trả
            </button>
            <button className="btn btn--primary" onClick={() => ask(VERIFICATION.PHONE_CONFIRMED)}>
              <UserCheck size={16} /> Trả trẻ
            </button>
          </div>
          <ConfirmationModal
            open={confirming === VERIFICATION.PHONE_DECLINED}
            danger
            title="Ghi nhận không trả trẻ?"
            message={`${context.child.fullName} ở lại lớp. Nội dung cuộc gọi được lưu; phụ huynh sẽ nhận thông báo.`}
            confirmLabel="Ghi nhận không trả trẻ"
            onConfirm={record}
            onClose={() => setConfirming(null)}
          />
          <ConfirmationModal
            open={confirming === VERIFICATION.PHONE_CONFIRMED}
            title="Ghi nhận trả trẻ?"
            message={`Trả ${context.child.fullName} lúc ${handoverTime} theo nội dung cuộc gọi. Phụ huynh sẽ nhận thông báo.`}
            confirmLabel="Ghi nhận trả trẻ"
            onConfirm={record}
            onClose={() => setConfirming(null)}
          />
        </section>
      )}
    </WaitingChild>
  );
}
