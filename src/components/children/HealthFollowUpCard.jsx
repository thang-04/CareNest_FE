import { Link } from 'react-router-dom';
import { FollowUpDueBadge, FollowUpLevelBadge, FollowUpStatusBadge } from './ChildBadges';
import { FOLLOW_UP_STATUS } from '@/models/children/healthCheckConstants';
import { formatDate } from '@/utils/format';

/** Căn cứ của mức hiện tại BE trả (latestHealth.source): lần khám, phiếu đang mở, phiếu đóng theo lời bác sĩ. */
const basisText = (health) => {
  if (health.source === 'FOLLOW_UP_OPEN') return `Phiếu theo dõi đang mở, từ lần khám ngày ${formatDate(health.date)}`;
  if (health.source === 'FOLLOW_UP_CLOSED')
    return health.resultOn
      ? `Kết quả khám chuyên khoa ngày ${formatDate(health.resultOn)}, phiếu theo dõi đã đóng`
      : `Phiếu theo dõi đóng ngày ${formatDate(health.date)}`;
  return `Lần khám ngày ${formatDate(health.date)}${health.campaignName ? ` · ${health.campaignName}` : ''}`;
};

/**
 * Theo dõi sức khỏe hiện tại của trẻ ở Sổ sức khỏe (chuyển từ danh sách trẻ, user yêu cầu 2026-10-31).
 * health: latestHealth của trẻ (BE tính); openFollowUp: phiếu đang mở (trạng thái, hạn trao đổi). UI không tự tính mức.
 */
export function HealthFollowUpCard({ health, openFollowUp }) {
  return (
    <section className="card mb-16" aria-labelledby="health-follow-up-title">
      <div className="card__header row row--between row--wrap gap-2">
        <h2 className="card__title" id="health-follow-up-title">
          Theo dõi sức khỏe
        </h2>
        {health && <FollowUpLevelBadge status={health.followUpLevel} />}
      </div>
      <div className="card__body">
        {health ? (
          <dl className="info-list">
            <dt>Căn cứ</dt>
            <dd>{basisText(health)}</dd>
            {health.knownCondition && (
              <>
                <dt>Vấn đề đã biết</dt>
                <dd>{health.knownCondition}</dd>
              </>
            )}
            <dt>Phiếu theo dõi</dt>
            <dd>
              {openFollowUp ? (
                <span className="row row--wrap gap-2">
                  <FollowUpStatusBadge status={openFollowUp.status} />
                  {openFollowUp.status === FOLLOW_UP_STATUS.WAITING_PARENT_CONTACT && (
                    <FollowUpDueBadge dueOn={openFollowUp.dueOn} overdueDays={openFollowUp.overdueDays} />
                  )}
                  <Link className="text-primary fw-600" to={`/children/health-follow-ups/${openFollowUp.id}`}>
                    Mở phiếu theo dõi
                  </Link>
                </span>
              ) : health.followUpId ? (
                <span className="row row--wrap gap-2">
                  <span>
                    {health.closedWithoutResultOn
                      ? `Đã đóng ngày ${formatDate(health.closedWithoutResultOn)}, chưa có kết quả chuyên khoa`
                      : 'Đã đóng'}
                  </span>
                  <Link className="text-primary" to={`/children/health-follow-ups/${health.followUpId}`}>
                    Xem phiếu
                  </Link>
                </span>
              ) : (
                <span className="muted">Không có phiếu đang mở</span>
              )}
            </dd>
          </dl>
        ) : (
          <p className="muted m-0">Chưa có kết quả khám có kết luận của bác sĩ.</p>
        )}
        <p className="muted text-xs mt-12">
          Mức theo lần khám gần nhất có kết luận của bác sĩ (hoặc kết quả mẫu cũ) và phiếu theo dõi. Số đo của kỳ cân đo không đổi mức; trẻ
          giữ mức tới lần khám sau.
        </p>
      </div>
    </section>
  );
}
