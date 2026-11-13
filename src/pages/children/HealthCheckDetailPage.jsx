import { Fragment, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Lock, Unlock, CircleX, Info, Users, CheckCircle2, ChevronDown, HeartPulse } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useHealthCheck } from '@/hooks/children/useHealthChecks';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { Modal } from '@/components/ui/Modal';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { EmptyState, LoadingState, Spinner } from '@/components/ui/States';
import { Tabs } from '@/components/ui/Tabs';
import { RowActions } from '@/components/ui/RowActions';
import { FormField } from '@/components/form/FormField';
import { DateInput } from '@/components/form/DateInput';
import {
  BmiStatusBadge,
  CampaignKindBadge,
  CampaignStatusBadge,
  ConclusionCategoryBadge,
  FollowUpLevelShortBadge,
} from '@/components/children/ChildBadges';
import { ChildAccessState, HEALTH_CHECK_ACCESS_TEXT } from '@/components/children/ChildAccessState';
import { HealthCheckClassRoster } from '@/components/children/HealthCheckClassRoster';
import { MeasurementRoundRoster } from '@/components/children/MeasurementRoundRoster';
import { cancelHealthCheck, closeHealthCheck, reopenHealthCheck } from '@/services/children/healthCheckService';
import { BMI_PROGRESS_KEYS, BMI_STATUS, BMI_STATUS_LABELS } from '@/models/children/childrenConstants';
import { CAMPAIGN_KIND, CAMPAIGN_STATUS, campaignActionLabelOf } from '@/models/children/healthCheckConstants';
import { formatDate, formatDateTime, isIsoDate, todayInput } from '@/utils/format';
import { canManageHealthCheck, isTeacherRole } from '@/utils/children/childrenPermissions';
import { formatNumber } from '@/utils/children/childrenHelpers';
import { healthCheckCrumbs } from '@/utils/children/breadcrumbs';
import { StatCard } from '@/components/ui/StatCard';
import '@/styles/modules/children.css';

const STAT_TONES = [
  { key: 'recorded', label: 'Đã có kết luận', tone: 'green' },
  { key: 'inProgress', label: 'Đang khám', tone: 'blue' },
  { key: 'notRecorded', label: 'Chưa khám', tone: 'gray' },
  { key: 'absent', label: 'Vắng khám', tone: 'gray' },
  { key: 'notConcluded', label: 'Chưa kết luận', tone: 'orange', hideZero: true },
];

// Kỳ cân đo không có phiếu nháp, kết luận (user chốt 2026-10-31).
const ROUND_STAT_TONES = [
  { key: 'recorded', label: 'Đã cân đo', tone: 'green' },
  { key: 'notRecorded', label: 'Chưa cân đo', tone: 'gray' },
  { key: 'absent', label: 'Vắng cân đo', tone: 'gray' },
];

// Số trẻ theo mức BMI của kỳ cân đo BE trả (progress.bmi, HLT-18); tông như badge mức BMI.
const BMI_STAT_TONES = Object.entries(BMI_PROGRESS_KEYS).map(([status, key]) => ({
  key,
  label: BMI_STATUS_LABELS[status],
  tone: status === BMI_STATUS.SEVERE_THINNESS || status === BMI_STATUS.OBESE ? 'red' : 'orange',
}));

/** Từ ngữ theo loại: đợt khám (bác sĩ khám) hay kỳ cân đo (giáo viên cân đo). */
const wordsOf = (isRound) =>
  isRound
    ? {
        unit: 'kỳ',
        name: 'kỳ cân đo',
        title: 'Kỳ cân đo',
        date: 'Ngày cân đo',
        absent: 'vắng cân đo',
        notYet: 'chưa cân đo',
        results: 'số đo',
      }
    : {
        unit: 'đợt',
        name: 'đợt khám',
        title: 'Đợt khám',
        date: 'Ngày khám',
        absent: 'vắng khám',
        notYet: 'chưa khám',
        results: 'phiếu khám',
      };

function StatusBanner({ campaign, teacher, isRound }) {
  const w = wordsOf(isRound);
  // Đợt khám và kỳ cân đo cùng tự đóng sau ngày kết thúc (HLT-17; kỳ cân đo từ 2026-11-04).
  const autoClose = `${w.title} tự đóng sau ngày ${formatDate(campaign.endDate)}`;
  if (campaign.status === CAMPAIGN_STATUS.IN_PROGRESS)
    return (
      <div className="alert alert--info mb-16">
        <Info size={18} />
        <div>
          {teacher &&
            (isRound ? (
              <>
                Bấm <b>Nhập số đo</b> cạnh tên trẻ ở danh sách lớp bên dưới để nhập chiều cao, cân nặng. Lưu là công bố cho phụ huynh ngay.
              </>
            ) : (
              <>
                Bấm <b>Khám</b> cạnh tên trẻ ở danh sách lớp bên dưới để nhập phiếu theo mẫu Phụ lục II cùng bác sĩ. Lưu kết luận là công bố
                cho phụ huynh ngay.
              </>
            ))}{' '}
          {autoClose}; {w.results} sẽ khóa khi {w.unit} đóng, kể cả {w.unit} mở lại để nhập bù.
        </div>
      </div>
    );
  if (campaign.status === CAMPAIGN_STATUS.UPCOMING)
    return (
      <div className="alert alert--info mb-16">
        <Info size={18} />
        <div>
          {w.title} chưa bắt đầu. Giáo viên nhập kết quả từ ngày {formatDate(campaign.startDate)}. {autoClose}.
        </div>
      </div>
    );
  if (campaign.status === CAMPAIGN_STATUS.CLOSED)
    return (
      <div className="alert alert--info mb-16">
        <Lock size={18} />
        <div>
          {isRound ? 'Kỳ cân đo' : 'Đợt khám'} đã đóng, {w.results} đã khóa. Hiệu trưởng hoặc Phó hiệu trưởng mở lại {w.unit} nếu cần nhập
          hoặc sửa.
          {campaign.progress.absent > 0 && ` ${campaign.progress.absent} trẻ ${w.absent}.`}
          {campaign.progress.notConcluded > 0 && ` ${campaign.progress.notConcluded} phiếu chưa kết luận.`}
        </div>
      </div>
    );
  return (
    <div className="alert alert--warning mb-16">
      <CircleX size={18} />
      <div>{isRound ? 'Kỳ cân đo' : 'Đợt khám'} đã hủy.</div>
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
  const manage = canManageHealthCheck(user, campaign.campusId);
  const teacher = isTeacherRole(user);
  const isRound = campaign.kind === CAMPAIGN_KIND.MEASUREMENT;
  // Đợt/kỳ đã qua ngày kết thúc: mở lại phải chọn ngày kết thúc mới từ hôm nay (HLT-17, cả kỳ cân đo từ 2026-11-04).
  const reopenNeedsEndDate = campaign.endDate < todayInput();
  const w = wordsOf(isRound);
  const Roster = isRound ? MeasurementRoundRoster : HealthCheckClassRoster;
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
        `Đã đóng ${w.name}${r.absentCount ? `; ${r.absentCount} trẻ ghi ${w.absent}` : ''}${
          r.notConcludedCount ? `; ${r.notConcludedCount} phiếu chưa kết luận` : ''
        }.`,
    ).then(() => setConfirm(null));
  const doCancel = () => run(() => cancelHealthCheck(campaign.id, user), `Đã hủy ${w.name}.`).then(() => setConfirm(null));
  const doReopen = async () => {
    if (!reopen.reason.trim()) {
      setReopen({ ...reopen, error: `Nhập lý do mở lại ${w.name}` });
      return;
    }
    if (reopenNeedsEndDate && (!isIsoDate(reopen.endDate) || reopen.endDate < todayInput())) {
      setReopen({ ...reopen, endDateError: 'Chọn ngày kết thúc mới từ hôm nay theo dd/mm/yyyy' });
      return;
    }
    setBusy(true);
    try {
      await reopenHealthCheck(campaign.id, { reason: reopen.reason, ...(reopenNeedsEndDate ? { endDate: reopen.endDate } : {}) }, user);
      toast.success(`Đã mở lại ${w.name}. Giáo viên của điểm trường đã nhận thông báo.`);
      setReopen(null);
    } catch (err) {
      if (err.details?.reason || err.details?.endDate)
        setReopen({ ...reopen, error: err.details.reason || '', endDateError: err.details.endDate || '' });
      else toast.error(err, `Không mở lại được ${w.name}`);
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
          <CampaignKindBadge status={campaign.kind} size="lg" />
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
                <CircleX size={16} /> Hủy {w.unit}
              </button>
            )}
            {campaign.status === CAMPAIGN_STATUS.CLOSED && (
              <button className="btn" onClick={() => setReopen({ reason: '', error: '', endDate: todayInput(), endDateError: '' })}>
                <Unlock size={16} /> Mở lại {w.unit}
              </button>
            )}
            {campaign.status === CAMPAIGN_STATUS.IN_PROGRESS && (
              <button className="btn btn--primary" onClick={() => setConfirm('close')}>
                <Lock size={16} /> Đóng sớm {w.name}
              </button>
            )}
          </div>
        )}
      </div>

      <StatusBanner campaign={campaign} teacher={teacher} isRound={isRound} />

      <div className="detail-layout">
        <div className="detail-layout__main">
          <section className="card">
            <div className="card__header">
              <h2 className="card__title">Thông tin {w.name}</h2>
            </div>
            <div className="card__body">
              <dl className="info-list">
                <dt>Điểm trường</dt>
                <dd>{campaign.campusName}</dd>
                <dt>{w.date}</dt>
                <dd>
                  {formatDate(campaign.startDate)} – {formatDate(campaign.endDate)}
                </dd>
                {!isRound && (
                  <>
                    <dt>Đơn vị khám / bác sĩ</dt>
                    <dd>{campaign.examiner || <span className="muted">Chưa cập nhật</span>}</dd>
                  </>
                )}
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
              {(isRound ? ROUND_STAT_TONES : STAT_TONES)
                .filter((s) => !s.hideZero || campaign.progress[s.key] > 0)
                .map((s) => (
                  <StatCard key={s.key} tone={s.tone} icon={false} label={s.label} value={campaign.progress[s.key]} />
                ))}
            </div>
          )}
          {!teacher && isRound && (
            <section className="mt-16" aria-labelledby="hc-bmi-title">
              <h2 className="subsection-title" id="hc-bmi-title">
                Cảnh báo BMI theo tuổi
              </h2>
              <div className="stat-grid">
                {BMI_STAT_TONES.map((s) => (
                  <StatCard key={s.key} tone={s.tone} icon={false} label={s.label} value={campaign.progress.bmi?.[s.key] ?? 0} />
                ))}
              </div>
              <p className="muted text-xs m-0">
                Hệ thống tính theo chuẩn WHO (BMI theo tuổi) từ số đo của kỳ, chỉ để sàng lọc, không phải chẩn đoán.
              </p>
            </section>
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
                      <div className="fw-600">{campaignActionLabelOf(campaign.kind, h.action)}</div>
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
            <EmptyState
              icon={Users}
              title="Không có lớp trong phạm vi của bạn"
              description={`${isRound ? 'Kỳ cân đo' : 'Đợt khám'} này không có lớp bạn phụ trách.`}
            />
          </section>
        ) : (
          classes.map((c) => <Roster key={c.classId} campaignId={campaign.id} classId={c.classId} />)
        )
      ) : (
        <section className="card mt-16">
          {/* Trẻ cần chú ý BE trả (watchList): đợt khám theo mức theo dõi, kỳ cân đo theo mức BMI (HLT-19). */}
          <div className="tr-chart-toolbar">
            <Tabs
              items={[
                { key: 'classes', label: 'Tiến độ theo lớp' },
                { key: 'watch', label: isRound ? 'Trẻ có cảnh báo BMI' : 'Trẻ cần theo dõi', count: watchList.length },
              ]}
              value={tab}
              onChange={setTab}
              ariaLabel={`Nội dung ${w.name}`}
            />
          </div>
          {tab === 'classes' ? (
            classes.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Không có lớp trong phạm vi của bạn"
                description={`${isRound ? 'Kỳ cân đo' : 'Đợt khám'} này không có lớp bạn phụ trách.`}
              />
            ) : (
              <div className="table-wrap tr-table-flat">
                <table className="table table--grid">
                  <thead>
                    <tr>
                      <th>Lớp</th>
                      <th>{isRound ? 'Đã cân đo' : 'Đã có kết luận'}</th>
                      <th className="num">{isRound ? 'Vắng cân đo' : 'Vắng khám'}</th>
                      {!isRound && <th className="num">Cần theo dõi</th>}
                      {!isRound && <th className="num">Cần theo dõi sát</th>}
                      {isRound && <th className="num">Cảnh báo BMI</th>}
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
                            {!isRound && <td className="num">{c.watch || '—'}</td>}
                            {!isRound && (
                              <td className="num">{c.closeWatch ? <span className="text-danger fw-600">{c.closeWatch}</span> : '—'}</td>
                            )}
                            {isRound && <td className="num">{c.bmiWarning ? <span className="fw-600">{c.bmiWarning}</span> : '—'}</td>}
                          </tr>
                          {open && (
                            <tr id={panelId} className="tr-acc-panel">
                              <td colSpan={isRound ? 4 : 5}>
                                <Roster campaignId={campaign.id} classId={c.classId} embedded />
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
              title={isRound ? 'Chưa có trẻ có cảnh báo BMI' : 'Chưa có trẻ cần theo dõi'}
              description={
                isRound
                  ? 'Trẻ có số đo của kỳ ở mức gầy còm nặng, gầy còm, nguy cơ thừa cân, thừa cân hoặc béo phì sẽ hiện ở đây.'
                  : 'Trẻ ở mức Cần theo dõi hoặc Cần theo dõi sát trong đợt này sẽ hiện ở đây.'
              }
            />
          ) : isRound ? (
            <div className="table-wrap tr-table-flat">
              <table className="table table--grid">
                <thead>
                  <tr>
                    <th>Trẻ</th>
                    <th>Lớp</th>
                    <th>Ngày đo</th>
                    <th className="num">BMI</th>
                    <th>Cảnh báo BMI</th>
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
                      <td className="nowrap">{r.date ? formatDate(r.date) : '—'}</td>
                      <td className="num">{formatNumber(r.bmi)}</td>
                      <td>
                        <BmiStatusBadge status={r.bmiStatus} />
                      </td>
                      <td className="cell--actions">
                        <RowActions
                          extra={{ to: `/children/${r.childId}/health`, label: 'Mở sổ sức khỏe', icon: HeartPulse }}
                          name={r.fullName}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="table-wrap tr-table-flat">
              <table className="table table--grid">
                <thead>
                  <tr>
                    <th>Trẻ</th>
                    <th>Lớp</th>
                    <th>Đợt này</th>
                    <th>Lần khám trước</th>
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
                        <div className="tr-cell-stack">
                          <ConclusionCategoryBadge status={r.conclusionCategory} />
                          <span className="muted text-xs tr-note">
                            {r.conclusion?.specialty ? `Chuyển khám: ${r.conclusion.specialty}` : r.conclusion?.issueText}
                          </span>
                        </div>
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
                      <td className="cell--actions">
                        <RowActions
                          extra={{ to: `/children/${r.childId}/health`, label: 'Mở sổ sức khỏe', icon: HeartPulse }}
                          name={r.fullName}
                        />
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
          <ArrowLeft size={16} /> Về danh sách đợt khám, kỳ cân đo
        </Link>
      </div>

      <ConfirmationModal
        open={confirm === 'close'}
        title={`Đóng ${w.name}?`}
        message={`${isRound ? 'Số đo của kỳ' : 'Phiếu khám của đợt'} sẽ bị khóa. ${
          campaign.progress.notRecorded
            ? `${campaign.progress.notRecorded} trẻ ${w.notYet} sẽ ghi ${isRound ? 'Vắng cân đo' : 'Vắng khám'}.`
            : `Tất cả trẻ đã có ${w.results}.`
        }${
          campaign.progress.inProgress
            ? ` ${campaign.progress.inProgress} phiếu đang khám chưa có kết luận sẽ giữ nguyên, hiện "Chưa kết luận".`
            : ''
        } Bạn mở lại được ${w.unit} nếu cần sửa.`}
        confirmLabel={`Đóng ${w.name}`}
        onConfirm={doClose}
        onClose={() => setConfirm(null)}
      />
      <ConfirmationModal
        open={confirm === 'cancel'}
        danger
        title={`Hủy ${w.name}?`}
        message={`${isRound ? 'Kỳ cân đo' : 'Đợt khám'} chưa có kết quả nào. Sau khi hủy, giáo viên không nhập được kết quả cho ${w.unit} này.`}
        confirmLabel={`Hủy ${w.name}`}
        onConfirm={doCancel}
        onClose={() => setConfirm(null)}
      />
      <Modal
        open={!!reopen}
        title={`Mở lại ${w.name}`}
        onClose={busy ? undefined : () => setReopen(null)}
        footer={
          <>
            <button className="btn" onClick={() => setReopen(null)} disabled={busy}>
              Quay lại
            </button>
            <button className="btn btn--primary" onClick={doReopen} disabled={busy}>
              {busy ? <Spinner small /> : <Unlock size={16} />} Mở lại {w.unit}
            </button>
          </>
        }
      >
        {reopen && (
          <>
            <p className="mb-12">
              Giáo viên nhập hoặc sửa {w.results} để nhập bù. {isRound ? 'Kỳ' : 'Đợt'} sẽ tự đóng khi qua ngày kết thúc. Trẻ đã ghi{' '}
              {w.absent} sẽ thành {isRound ? 'Chưa cân đo' : 'Chưa khám'}.
            </p>
            {reopenNeedsEndDate && (
              <FormField label="Ngày kết thúc mới" required error={reopen.endDateError} className="mb-12">
                <DateInput
                  value={reopen.endDate}
                  min={todayInput()}
                  onChange={(endDate) => setReopen({ ...reopen, endDate, endDateError: '' })}
                />
              </FormField>
            )}
            <FormField label="Lý do mở lại" required error={reopen.error}>
              <textarea
                className="textarea"
                rows={3}
                maxLength={300}
                value={reopen.reason}
                onChange={(e) => setReopen({ ...reopen, reason: e.target.value, error: '' })}
              />
            </FormField>
          </>
        )}
      </Modal>
    </div>
  );
}
