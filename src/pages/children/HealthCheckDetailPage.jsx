import { Fragment, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Lock, Unlock, CircleX, Info, Users, CheckCircle2, ChevronDown } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useHealthCheck } from '@/hooks/children/useHealthChecks';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { Modal } from '@/components/ui/Modal';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { EmptyState, LoadingState, Spinner } from '@/components/ui/States';
import { RowActions } from '@/components/ui/RowActions';
import { FormField } from '@/components/form/FormField';
import {
  CampaignStatusBadge,
  ConclusionCategoryBadge,
  FollowUpDueBadge,
  FollowUpLevelShortBadge,
  FollowUpStatusBadge,
} from '@/components/children/ChildBadges';
import { ChildAccessState, HEALTH_CHECK_ACCESS_TEXT } from '@/components/children/ChildAccessState';
import { HealthCheckClassRoster } from '@/components/children/HealthCheckClassRoster';
import { cancelHealthCheck, closeHealthCheck, reopenHealthCheck } from '@/services/children/healthCheckService';
import { SCREENING_CRITERIA_LABELS } from '@/models/children/childrenConstants';
import { CAMPAIGN_ACTION_LABELS, CAMPAIGN_STATUS } from '@/models/children/healthCheckConstants';
import { formatDate, formatDateTime } from '@/utils/format';
import { canManageHealthCheck, isTeacherRole } from '@/utils/children/childrenPermissions';
import { healthCheckCrumbs } from '@/utils/children/breadcrumbs';
import '@/styles/modules/children.css';

const STAT_TONES = [
  { key: 'recorded', label: 'Đã có kết luận', tone: 'green' },
  { key: 'inProgress', label: 'Đang khám', tone: 'blue' },
  { key: 'notRecorded', label: 'Chưa khám', tone: 'gray' },
  { key: 'absent', label: 'Vắng khám', tone: 'gray' },
  { key: 'notConcluded', label: 'Chưa kết luận', tone: 'orange', hideZero: true },
];

function StatusBanner({ campaign, teacher }) {
  if (campaign.status === CAMPAIGN_STATUS.IN_PROGRESS)
    return teacher ? (
      <div className="alert alert--info mb-16">
        <Info size={18} />
        <div>
          Bấm <b>Khám</b> cạnh tên trẻ ở danh sách lớp bên dưới để nhập phiếu theo mẫu Phụ lục II cùng bác sĩ. Lưu kết luận là công bố cho
          phụ huynh ngay.
        </div>
      </div>
    ) : null;
  if (campaign.status === CAMPAIGN_STATUS.UPCOMING)
    return (
      <div className="alert alert--info mb-16">
        <Info size={18} />
        <div>Đợt khám chưa bắt đầu. Giáo viên nhập kết quả từ ngày {formatDate(campaign.startDate)}.</div>
      </div>
    );
  if (campaign.status === CAMPAIGN_STATUS.CLOSED)
    return (
      <div className="alert alert--info mb-16">
        <Lock size={18} />
        <div>
          Đợt khám đã đóng, phiếu khám đã khóa. Hiệu trưởng mở lại đợt nếu cần nhập hoặc sửa phiếu.
          {campaign.progress.absent > 0 && ` ${campaign.progress.absent} trẻ vắng khám.`}
          {campaign.progress.notConcluded > 0 && ` ${campaign.progress.notConcluded} phiếu chưa kết luận.`}
        </div>
      </div>
    );
  return (
    <div className="alert alert--warning mb-16">
      <CircleX size={18} />
      <div>Đợt khám đã hủy.</div>
    </div>
  );
}

export default function HealthCheckDetailPage() {
  const { campaignId } = useParams();
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const toast = useToast();
  const { detail, loading, error, reload } = useHealthCheck(campaignId);
  const [tab, setTab] = useState('classes');
  const [confirm, setConfirm] = useState(null);
  const [reopen, setReopen] = useState(null);
  const [busy, setBusy] = useState(false);

  const campaign = detail?.campaign;
  const crumbs = healthCheckCrumbs(campaign?.name || 'Chi tiết đợt khám');

  if (loading)
    return (
      <div className="page">
        <Breadcrumb items={crumbs} />
        <LoadingState />
      </div>
    );
  if (error || !campaign)
    return (
      <div className="page">
        <Breadcrumb items={crumbs} />
        <ChildAccessState error={error || { status: 404 }} onRetry={reload} text={HEALTH_CHECK_ACCESS_TEXT} />
      </div>
    );

  const { classes, watchList } = detail;
  const manage = canManageHealthCheck(user);
  const teacher = isTeacherRole(user);
  const unclosed = [CAMPAIGN_STATUS.UPCOMING, CAMPAIGN_STATUS.IN_PROGRESS].includes(campaign.status);
  // Đợt đã đóng/hủy: thanh tiến độ tĩnh, không như đang diễn ra (user yêu cầu 2026-10-23).
  const ended = !unclosed;
  const classId = params.get('classId') || '';
  const selectClass = (id) => setParams(id ? { classId: id } : {});

  const run = async (action, success) => {
    try {
      const result = await action();
      toast.success(typeof success === 'function' ? success(result) : success);
      return true;
    } catch (err) {
      toast.error(err, 'Không thực hiện được');
      return false;
    }
  };

  const doClose = () =>
    run(
      () => closeHealthCheck(campaign.id, user),
      (r) =>
        `Đã đóng đợt khám${r.absentCount ? `; ${r.absentCount} trẻ ghi vắng khám` : ''}${
          r.notConcludedCount ? `; ${r.notConcludedCount} phiếu chưa kết luận` : ''
        }.`,
    ).then(() => setConfirm(null));
  const doCancel = () => run(() => cancelHealthCheck(campaign.id, user), 'Đã hủy đợt khám.').then(() => setConfirm(null));
  const doReopen = async () => {
    if (!reopen.reason.trim()) {
      setReopen({ ...reopen, error: 'Nhập lý do mở lại đợt khám' });
      return;
    }
    setBusy(true);
    try {
      await reopenHealthCheck(campaign.id, { reason: reopen.reason }, user);
      toast.success('Đã mở lại đợt khám. Giáo viên của điểm trường đã nhận thông báo.');
      setReopen(null);
    } catch (err) {
      if (err.details?.reason) setReopen({ ...reopen, error: err.details.reason });
      else toast.error(err, 'Không mở lại được đợt khám');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <Breadcrumb items={crumbs} />
      <div className="page__head">
        <div className="row row--wrap gap-2">
          <h1 className="page__title">{campaign.name}</h1>
          <CampaignStatusBadge status={campaign.status} size="lg" />
        </div>
        {manage && (
          <div className="row row--wrap gap-2">
            {unclosed && (
              <Link className="btn" to={`/children/health-checks/${campaign.id}/edit`}>
                <Pencil size={16} /> Sửa thông tin
              </Link>
            )}
            {unclosed && !campaign.hasResults && (
              <button className="btn btn--outline-danger" onClick={() => setConfirm('cancel')}>
                <CircleX size={16} /> Hủy đợt
              </button>
            )}
            {campaign.status === CAMPAIGN_STATUS.CLOSED && (
              <button className="btn" onClick={() => setReopen({ reason: '', error: '' })}>
                <Unlock size={16} /> Mở lại đợt
              </button>
            )}
            {campaign.status === CAMPAIGN_STATUS.IN_PROGRESS && (
              <button className="btn btn--primary" onClick={() => setConfirm('close')}>
                <Lock size={16} /> Đóng đợt khám
              </button>
            )}
          </div>
        )}
      </div>

      <StatusBanner campaign={campaign} teacher={teacher} />

      <div className="detail-layout">
        <div className="detail-layout__main">
          <section className="card">
            <div className="card__header">
              <h2 className="card__title">Thông tin đợt khám</h2>
            </div>
            <div className="card__body">
              <dl className="info-list">
                <dt>Điểm trường</dt>
                <dd>{campaign.campusName}</dd>
                <dt>Ngày khám</dt>
                <dd>
                  {formatDate(campaign.startDate)} – {formatDate(campaign.endDate)}
                </dd>
                <dt>Đơn vị khám / bác sĩ</dt>
                <dd>{campaign.examiner || <span className="muted">Chưa cập nhật</span>}</dd>
                <dt>Ghi chú</dt>
                <dd>{campaign.note || <span className="muted">Không có</span>}</dd>
                <dt>Tiến độ{teacher ? ' lớp của bạn' : ''}</dt>
                <dd className="tr-progress-cell">
                  <ProgressBar value={campaign.progress.recorded} total={campaign.progress.total} ended={ended} />
                </dd>
              </dl>
            </div>
          </section>
          {/* Giáo viên xem tiến độ ở thanh "Tiến độ" và tiêu đề danh sách lớp, không cần hàng thẻ (user chốt 2026-10-22). */}
          {!teacher && (
            <div className="stat-grid mt-16">
              {STAT_TONES.filter((s) => !s.hideZero || campaign.progress[s.key] > 0).map((s) => (
                <div key={s.key} className={`stat-card stat-card--${s.tone}`}>
                  <div className="stat-card__value">{campaign.progress[s.key]}</div>
                  <div className="stat-card__label">{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <aside className="detail-layout__aside">
          <section className="card">
            <div className="card__header">
              <h2 className="card__title">Lịch sử</h2>
            </div>
            <div className="card__body">
              <ul className="history-list">
                {[...campaign.history].reverse().map((h, i) => (
                  <li key={`${h.at}${i}`}>
                    <span className="history-list__dot" />
                    <div>
                      <div className="fw-600">{CAMPAIGN_ACTION_LABELS[h.action] || h.action}</div>
                      <div className="muted text-sm">
                        {h.userName || '—'} · {formatDateTime(h.at)}
                      </div>
                      {h.reason && <div className="text-sm">Lý do: {h.reason}</div>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </aside>
      </div>

      {/* Giáo viên: danh sách trẻ của lớp hiện thẳng, không qua bảng tiến độ theo lớp và tab (user chốt 2026-10-22). */}
      {teacher ? (
        classes.length === 0 ? (
          <section className="card mt-16">
            <EmptyState icon={Users} title="Không có lớp trong phạm vi của bạn" description="Đợt khám này không có lớp bạn phụ trách." />
          </section>
        ) : (
          classes.map((c) => <HealthCheckClassRoster key={c.classId} campaignId={campaign.id} classId={c.classId} />)
        )
      ) : (
        <section className="card mt-16">
          <div className="tr-chart-toolbar">
            <div className="tabs" role="tablist" aria-label="Nội dung đợt khám">
              <button
                role="tab"
                aria-selected={tab === 'classes'}
                className={`tab ${tab === 'classes' ? 'tab--active' : ''}`}
                onClick={() => setTab('classes')}
              >
                Tiến độ theo lớp
              </button>
              <button
                role="tab"
                aria-selected={tab === 'watch'}
                className={`tab ${tab === 'watch' ? 'tab--active' : ''}`}
                onClick={() => setTab('watch')}
              >
                Trẻ cần theo dõi <span className="tab__count">{watchList.length}</span>
              </button>
            </div>
          </div>
          {tab === 'classes' ? (
            classes.length === 0 ? (
              <EmptyState icon={Users} title="Không có lớp trong phạm vi của bạn" description="Đợt khám này không có lớp bạn phụ trách." />
            ) : (
              <div className="table-wrap tr-table-flat">
                <table className="table table--grid">
                  <thead>
                    <tr>
                      <th>Lớp</th>
                      <th>Đã có kết luận</th>
                      <th className="num">Vắng khám</th>
                      <th className="num">Cần theo dõi</th>
                      <th className="num">Cần theo dõi sát</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classes.map((c) => {
                      const open = classId === c.classId;
                      const panelId = `hc-class-${c.classId}`;
                      const toggle = () => selectClass(open ? '' : c.classId);
                      return (
                        <Fragment key={c.classId}>
                          {/* Danh sách trẻ sổ ngay dưới dòng lớp, mỗi lúc một lớp (user yêu cầu 2026-10-23); bấm dòng hoặc nút để mở, đóng. */}
                          <tr className={`tr-acc-row ${open ? 'tr-row-selected' : ''}`} onClick={toggle}>
                            <td className="fw-600">
                              <button
                                type="button"
                                className="tr-acc-toggle"
                                aria-expanded={open}
                                aria-controls={open ? panelId : undefined}
                                title={open ? 'Thu gọn danh sách trẻ' : 'Xem danh sách trẻ'}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggle();
                                }}
                              >
                                <ChevronDown
                                  size={16}
                                  className={`tr-acc-chevron ${open ? 'tr-acc-chevron--open' : ''}`}
                                  aria-hidden="true"
                                />
                                {c.className}
                              </button>
                            </td>
                            <td className="tr-progress-cell">
                              <ProgressBar value={c.recorded} total={c.total} ended={ended} />
                            </td>
                            <td className="num">{c.absent || '—'}</td>
                            <td className="num">{c.watch || '—'}</td>
                            <td className="num">{c.closeWatch ? <span className="text-danger fw-600">{c.closeWatch}</span> : '—'}</td>
                          </tr>
                          {open && (
                            <tr id={panelId} className="tr-acc-panel">
                              <td colSpan={5}>
                                <HealthCheckClassRoster campaignId={campaign.id} classId={c.classId} embedded />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : watchList.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Chưa có trẻ cần theo dõi"
              description="Trẻ ở mức Cần theo dõi hoặc Cần theo dõi sát trong đợt này sẽ hiện ở đây."
            />
          ) : (
            <div className="table-wrap tr-table-flat">
              <table className="table table--grid">
                <thead>
                  <tr>
                    <th>Trẻ</th>
                    <th>Lớp</th>
                    <th>Đợt này</th>
                    <th>Lần khám trước</th>
                    <th>Phiếu theo dõi</th>
                    <th className="cell--actions">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {watchList.map((r) => (
                    <tr key={r.childId}>
                      <td>
                        <div className="fw-600">{r.fullName}</div>
                        <div className="muted text-xs">{r.code}</div>
                      </td>
                      <td className="nowrap">{r.className}</td>
                      <td>
                        {r.conclusionCategory ? (
                          <div className="tr-cell-stack">
                            <ConclusionCategoryBadge status={r.conclusionCategory} />
                            <span className="muted text-xs tr-note">
                              {r.conclusion?.specialty ? `Chuyển khám: ${r.conclusion.specialty}` : r.conclusion?.issueText}
                            </span>
                          </div>
                        ) : (
                          <div className="tr-cell-stack">
                            <FollowUpLevelShortBadge status={r.followUpLevel} />
                            <span className="muted text-xs">
                              {r.criteria
                                .filter((c) => c.flagged)
                                .map((c) => SCREENING_CRITERIA_LABELS[c.key])
                                .join(' · ')}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="text-sm">
                        {r.previous ? (
                          <div className="tr-cell-stack">
                            <span className="muted text-xs">
                              {formatDate(r.previous.date)}
                              {r.previous.campaignName ? ` · ${r.previous.campaignName}` : ''}
                            </span>
                            <FollowUpLevelShortBadge status={r.previous.followUpLevel} />
                          </div>
                        ) : (
                          <span className="muted">Chưa có</span>
                        )}
                      </td>
                      <td>
                        {r.followUp ? (
                          <div className="tr-cell-stack">
                            <Link to={`/children/health-follow-ups/${r.followUp.id}`} aria-label={`Mở phiếu theo dõi của ${r.fullName}`}>
                              <FollowUpStatusBadge status={r.followUp.status} />
                            </Link>
                            <FollowUpDueBadge dueOn={r.followUp.dueOn} overdueDays={r.followUp.overdueDays} hideOnTime />
                            {r.followUp.latestExternalResult && (
                              <span className="muted text-xs tr-note">
                                Bác sĩ chuyên khoa ({formatDate(r.followUp.latestExternalResult.on)}):{' '}
                                {r.followUp.latestExternalResult.note}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td className="cell--actions">
                        <RowActions view={{ to: `/children/${r.childId}/health`, label: 'Mở sổ sức khỏe' }} name={r.fullName} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <div className="page-actions">
        <Link className="btn" to="/children/health-checks">
          <ArrowLeft size={16} /> Về danh sách đợt khám
        </Link>
      </div>

      <ConfirmationModal
        open={confirm === 'close'}
        title="Đóng đợt khám?"
        message={`Phiếu khám của đợt sẽ bị khóa. ${
          campaign.progress.notRecorded
            ? `${campaign.progress.notRecorded} trẻ chưa khám sẽ ghi Vắng khám.`
            : 'Tất cả trẻ đã có phiếu khám.'
        }${
          campaign.progress.inProgress
            ? ` ${campaign.progress.inProgress} phiếu đang khám chưa có kết luận sẽ giữ nguyên, hiện "Chưa kết luận".`
            : ''
        }${
          campaign.waitingFollowUpCount
            ? ` Còn ${campaign.waitingFollowUpCount} phiếu theo dõi chờ trao đổi với phụ huynh${
                campaign.overdueFollowUpCount ? ` (${campaign.overdueFollowUpCount} phiếu đã quá hạn)` : ''
              }; phiếu vẫn mở sau khi đóng đợt.`
            : ''
        } Bạn mở lại được đợt nếu cần sửa.`}
        confirmLabel="Đóng đợt khám"
        onConfirm={doClose}
        onClose={() => setConfirm(null)}
      />
      <ConfirmationModal
        open={confirm === 'cancel'}
        danger
        title="Hủy đợt khám?"
        message="Đợt khám chưa có kết quả nào. Sau khi hủy, giáo viên không nhập được kết quả cho đợt này."
        confirmLabel="Hủy đợt khám"
        onConfirm={doCancel}
        onClose={() => setConfirm(null)}
      />
      <Modal
        open={!!reopen}
        title="Mở lại đợt khám"
        onClose={busy ? undefined : () => setReopen(null)}
        footer={
          <>
            <button className="btn" onClick={() => setReopen(null)} disabled={busy}>
              Quay lại
            </button>
            <button className="btn btn--primary" onClick={doReopen} disabled={busy}>
              {busy ? <Spinner small /> : <Unlock size={16} />} Mở lại đợt
            </button>
          </>
        }
      >
        {reopen && (
          <>
            <p className="mb-12">
              Giáo viên nhập hoặc sửa được phiếu khám của đợt cho tới khi bạn đóng lại. Trẻ đã ghi vắng khám sẽ thành Chưa khám.
            </p>
            <FormField label="Lý do mở lại" required error={reopen.error}>
              <textarea
                className="textarea"
                rows={3}
                maxLength={300}
                value={reopen.reason}
                onChange={(e) => setReopen({ reason: e.target.value, error: '' })}
              />
            </FormField>
          </>
        )}
      </Modal>
    </div>
  );
}
