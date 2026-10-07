import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ImageOff, Phone, PhoneOff, ThumbsDown, ThumbsUp, UserX } from 'lucide-react';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { PickupOutcomeBadge, PickupStatusBadge } from '@/components/pickup/PickupBadges';
import { usePickupChild } from '@/hooks/pickup/usePickups';
import { PICKUP_STATUS, VERIFICATION, VERIFICATION_LABELS } from '@/models/pickup/pickupConstants';
import { pickupCrumbs } from '@/utils/pickup/breadcrumbs';
import { formatDateTime, initials } from '@/utils/format';
import '@/styles/modules/pickup.css';

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

/** #100 Pickup Verification (UC 3.15): compare the pickup person with the registered photo; otherwise call the parent. */
export default function PickupVerifyPage() {
  const { childId } = useParams();
  const navigate = useNavigate();
  const { context, loading, error, reload } = usePickupChild(childId);
  const [mismatch, setMismatch] = useState(false);

  const goResult = (verification, guardianIndex) => {
    const q = new URLSearchParams({ childId, verification });
    if (guardianIndex != null) q.set('guardian', String(guardianIndex));
    navigate(`/pickup/result?${q.toString()}`);
  };

  const title = 'Xác minh người đón';
  if (loading) return <LoadingState />;
  if (error)
    return (
      <div className="page">
        <Breadcrumb items={pickupCrumbs(title)} />
        <h1 className="page__title">{title}</h1>
        <div className="card">
          {error.status === 404 || error.status === 403 ? (
            <EmptyState
              icon={UserX}
              title="Không tìm thấy trẻ"
              description={error.message}
              action={
                <Link className="btn" to="/pickup">
                  Quay lại danh sách
                </Link>
              }
            />
          ) : (
            <ErrorState error={error} onRetry={reload} />
          )}
        </div>
      </div>
    );
  if (!context) return null;

  const blocked = context.status !== PICKUP_STATUS.WAITING;
  const lastFail = [...context.attempts].reverse().find((a) => a.outcome !== 'HANDED_OVER');

  return (
    <div className="page">
      <Breadcrumb items={pickupCrumbs({ label: context.className, to: `/pickup?classId=${context.classId}` }, title)} />
      <div className="page__head">
        <h1 className="page__title">
          {title}: {context.child.fullName}
        </h1>
        <div className="mt-8">
          <PickupStatusBadge status={context.status} size="lg" />
        </div>
      </div>

      {blocked ? (
        <div className="card">
          <EmptyState
            icon={CheckCircle2}
            title={context.status === PICKUP_STATUS.PICKED_UP ? 'Trẻ đã được trả hôm nay' : 'Trẻ vắng mặt hôm nay'}
            description={
              context.pickup
                ? `${context.pickup.pickupPersonName} (${context.pickup.pickupPersonRelation}) đón lúc ${formatDateTime(context.pickup.handedOverAt)}.`
                : undefined
            }
            action={
              <Link className="btn" to={`/pickup?classId=${context.classId}`}>
                Quay lại danh sách
              </Link>
            }
          />
        </div>
      ) : (
        <>
          {lastFail && (
            <div className="alert alert--warning mb-16">
              <PickupOutcomeBadge status={lastFail.outcome} />
              <div>
                Lần trước ({formatDateTime(lastFail.recordedAt)}): {lastFail.pickupPersonName} –{' '}
                {VERIFICATION_LABELS[lastFail.verification]}. {lastFail.note}
              </div>
            </div>
          )}
          <div className="card mb-16">
            <div className="card__header">
              <div className="card__title">Bước 1. So sánh người đón với ảnh phụ huynh đã đăng ký</div>
            </div>
            <div className="card__body">
              {context.guardians.length === 0 ? (
                <div className="alert alert--warning">Trẻ chưa có phụ huynh đăng ký. Liên hệ Phó hiệu trưởng trước khi trả trẻ.</div>
              ) : (
                <div className="dt-guardians">
                  {context.guardians.map((g) => (
                    <div key={g.index} className="dt-guardian">
                      <GuardianPhoto guardian={g} />
                      <div className="dt-guardian__info">
                        <div className="fw-600">{g.fullName}</div>
                        <div className="text-sm muted">{g.relation}</div>
                      </div>
                      <button className="btn btn--outline-primary btn--block" onClick={() => goResult(VERIFICATION.PHOTO_MATCH, g.index)}>
                        <ThumbsUp size={16} /> Khớp ảnh – trả trẻ
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {!mismatch && (
                <div className="row mt-16">
                  <button className="btn btn--outline-danger" onClick={() => setMismatch(true)}>
                    <ThumbsDown size={16} /> Người đón không khớp ảnh
                  </button>
                </div>
              )}
            </div>
          </div>

          {mismatch && (
            <div className="card dt-call">
              <div className="card__header">
                <div className="card__title">Bước 2. Gọi điện xác nhận với phụ huynh</div>
              </div>
              <div className="card__body">
                <p className="text-2 mb-12">Gọi cho phụ huynh, mô tả người đón và hỏi phụ huynh có đồng ý cho người này đón trẻ không.</p>
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
                <div className="dt-call__actions mt-16">
                  <button className="btn btn--outline-danger" onClick={() => goResult(VERIFICATION.PHONE_UNREACHABLE)}>
                    <PhoneOff size={16} /> Không liên lạc được
                  </button>
                  <button className="btn btn--danger" onClick={() => goResult(VERIFICATION.PHONE_DECLINED)}>
                    <ThumbsDown size={16} /> Phụ huynh không đồng ý
                  </button>
                  <button className="btn btn--primary" onClick={() => goResult(VERIFICATION.PHONE_CONFIRMED)}>
                    <ThumbsUp size={16} /> Phụ huynh đồng ý – trả trẻ
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
      <div className="page-actions">
        <Link className="btn" to={`/pickup?classId=${context.classId}`}>
          <ArrowLeft size={16} /> Quay lại danh sách
        </Link>
      </div>
    </div>
  );
}
