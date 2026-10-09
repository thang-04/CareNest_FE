import { PenLine, CheckCircle2, Clock, ShieldOff } from '@/components/ui/icons';
import { ROLE_LABELS } from '@/models/User';
import { formatDateTime } from '@/utils/format';
import { SIGNATURE_TYPES, SIGNATURE_TYPE_LABELS } from '@/models/facility-transfer/transferConstants';
import { getValidSignature } from '@/models/facility-transfer/TransferSignature';

/**
 * "Chữ ký xác nhận": creator / handover / receiver signatures of a transfer,
 * shown on the detail page and on the staff pages.
 */
export function TransferSignaturesCard({ transfer, md, highlightUserId }) {
  const slots = [
    [SIGNATURE_TYPES.CREATOR, transfer.createdBy],
    [SIGNATURE_TYPES.HANDOVER, transfer.handoverUserId],
    [SIGNATURE_TYPES.RECEIVER, transfer.receiverUserId],
  ];

  return (
    <div className="card card--soft-header">
      <div className="card__header">
        <div className="card__title">
          <PenLine size={20} /> Chữ ký xác nhận
        </div>
        <span className="muted text-sm">Phiên bản phiếu v{transfer.version}</span>
      </div>
      <div className="card__body sig-slots">
        {slots.map(([type, userId]) => {
          const sig = getValidSignature(transfer, type);
          const user = md.userById(sig?.signedBy || userId);
          const invalid = (transfer.signatures || []).filter((s) => s.type === type && !s.valid).slice(-1)[0];
          const isMe = highlightUserId && userId === highlightUserId;
          return (
            <div key={type} className={`sig-slot ${sig ? 'sig-slot--signed' : ''} ${isMe ? 'sig-slot--me' : ''}`}>
              <div className="sig-slot__title">
                {SIGNATURE_TYPE_LABELS[type]}
                {isMe && <span className="chip chip--teal text-2xs">Tôi</span>}
              </div>
              <div className="sig-slot__role">({ROLE_LABELS[user?.role] || '—'})</div>
              <div className="sig-slot__img">
                {sig ? (
                  <img src={sig.signatureUrl} alt={`Chữ ký ${sig.signedByName}`} />
                ) : (
                  <span className="muted" style={{ fontStyle: 'italic' }}>
                    Chưa xác nhận
                  </span>
                )}
              </div>
              <div className="fw-600">{sig?.signedByName || user?.fullName || '—'}</div>
              {sig ? (
                <div className="sig-slot__status text-success">
                  <CheckCircle2 size={14} /> Đã ký {formatDateTime(sig.signedAt)}
                </div>
              ) : (
                <div className="sig-slot__status muted">
                  <Clock size={14} /> Chờ ký
                </div>
              )}
              {!sig && invalid && (
                <div className="sig-slot__status text-danger text-xs">
                  <ShieldOff size={13} /> Chữ ký cũ (v{invalid.documentVersion}) đã vô hiệu
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
