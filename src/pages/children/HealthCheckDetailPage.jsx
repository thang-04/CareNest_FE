import { Fragment, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Lock, Unlock, CircleX, Info, Users, CheckCircle2, ChevronDown, History } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useHealthCheck } from '@/hooks/children/useHealthChecks';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, LoadingState, Spinner } from '@/components/ui/States';
import { clickableRowProps } from '@/utils/clickableRow';
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
import { SegmentedProgress } from '@/components/ui/SegmentedProgress';
import { ChildInfoTable } from '@/components/children/ChildInfoTable';
import { SidePanel } from '@/components/ui/SidePanel';
import '@/styles/modules/children.css';

// Các đoạn của thanh tiến độ theo progress BE trả (trạng thái loại trừ nhau); "Chưa khám" là phần còn lại của rãnh.
const EXAM_SEGMENTS = [
  { key: 'recorded', label: 'Đã có kết luận', tone: 'green' },
  { key: 'inProgress', label: 'Đang khám', tone: 'blue' },
  { key: 'notConcluded', label: 'Chưa kết luận', tone: 'orange', hideZero: true },
  { key: 'absent', label: 'Vắng khám', tone: 'gray' },
  { key: 'notRecorded', label: 'Chưa khám', tone: 'rest' },
];

// Kỳ cân đo không có phiếu nháp, kết luận (user chốt 2026-10-31).
const ROUND_SEGMENTS = [
  { key: 'recorded', label: 'Đã cân đo', tone: 'green' },
  { key: 'absent', label: 'Vắng cân đo', tone: 'gray' },
  { key: 'notRecorded', label: 'Chưa cân đo', tone: 'rest' },
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

/** Số đếm ở bảng theo lớp: 0 chữ mờ (không còn "—", user yêu cầu 2026-11-11); > 0 viên số theo tông mức. */
function CountCell({ value, tone }) {
  const n = value || 0;
  if (!n) return <span className="tr-count tr-count--zero">0</span>;
  return <span className={tone ? `tr-count tr-count--${tone}` : 'tr-count'}>{n}</span>;
}

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
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const toast = useToast();
  const { detail, loading, error, reload } = useHealthCheck(campaignId);
  const [tab, setTab] = useState('classes');
  const [confirm, setConfirm] = useState(null);
  const [reopen, setReopen] = useState(null);
  const [busy, setBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

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
  const lastEvent = campaign.history?.[campaign.history.length - 1];
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

      {/* Một khối tổng quan thay cho thẻ thông tin + hàng thẻ số liệu + cột lịch sử (user yêu cầu 2026-11-11): thẻ số liệu lặp
          lại thanh tiến độ và bảng theo lớp; lịch sử chỉ vài dòng nên xem trong panel, không giữ cả một cột trống. */}
      <section className="card tr-hc-overview" aria-label={`Tổng quan ${w.name}`}>
        <div className="tr-hc-overview__grid">
          <div className="stack gap-3">
            <h2 className="card__title">Thông tin {w.name}</h2>
            {/* Thông tin đợt dạng bảng nhãn | giá trị như hồ sơ trẻ (user yêu cầu 2026-11-11) */}
            <ChildInfoTable
              label={`Thông tin ${w.name}`}
              rows={[
                ['Điểm trường', campaign.campusName],
                [w.date, `${formatDate(campaign.startDate)} – ${formatDate(campaign.endDate)}`],
                !isRound && {
                  label: 'Đơn vị khám / bác sĩ',
                  value: campaign.examiner || <span className="muted">Chưa cập nhật</span>,
                },
                { label: 'Ghi chú', value: campaign.note || <span className="muted">Không có</span> },
              ]}
            />
          </div>
          <div className="stack gap-3 tr-hc-overview__progress">
            <div className="tr-hc-headline">
              <h2 className="card__title">Tiến độ{teacher ? ' lớp của bạn' : ''}</h2>
              <span className="muted text-sm">
                <b className="tr-hc-headline__value">{campaign.progress.recorded}</b>/{campaign.progress.total} trẻ{' '}
                {isRound ? 'đã cân đo' : 'đã có kết luận'}
              </span>
            </div>
            <SegmentedProgress
              label={`Tiến độ ${w.name}`}
              total={campaign.progress.total}
              segments={(isRound ? ROUND_SEGMENTS : EXAM_SEGMENTS).map((s) => ({ ...s, value: campaign.progress[s.key] ?? 0 }))}
            />
            {!teacher && isRound && (
              <section className="tr-hc-bmi" aria-labelledby="hc-bmi-title">
                <h3 className="tr-hc-bmi__title" id="hc-bmi-title">
                  Cảnh báo BMI theo tuổi
                </h3>
                <ul className="tr-hc-bmi__list">
                  {BMI_STAT_TONES.map((s) => (
                    <li key={s.key} className={`tr-hc-bmi__item tr-hc-bmi__item--${s.tone}`}>
                      <span>{s.label}</span>
                      <b>{campaign.progress.bmi?.[s.key] ?? 0}</b>
                    </li>
                  ))}
                </ul>
                <p className="muted text-xs m-0">
                  Hệ thống tính theo chuẩn WHO (BMI theo tuổi) từ số đo của kỳ, chỉ để sàng lọc, không phải chẩn đoán.
                </p>
              </section>
            )}
          </div>
        </div>
        {lastEvent && (
          <div className="tr-hc-overview__foot">
            <History size={16} aria-hidden="true" />
            <span className="text-sm">
              <span className="fw-600">{campaignActionLabelOf(campaign.kind, lastEvent.action)}</span>
              <span className="muted">
                {' '}
                · {lastEvent.userName || '—'} · {formatDateTime(lastEvent.at)}
              </span>
            </span>
            <button type="button" className="btn btn--sm" onClick={() => setHistoryOpen(true)}>
              Xem lịch sử ({campaign.history.length})
            </button>
          </div>
        )}
      </section>
      <SidePanel open={historyOpen} title={`Lịch sử ${w.name}`} onClose={() => setHistoryOpen(false)}>
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
      </SidePanel>

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
            <div className="tabs" role="tablist" aria-label={`Nội dung ${w.name}`}>
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
                {isRound ? 'Trẻ có cảnh báo BMI' : 'Trẻ cần theo dõi'} <span className="tab__count">{watchList.length}</span>
              </button>
            </div>
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
                <table className="table table--grid tr-class-table">
                  <colgroup>
                    <col />
                    <col className="tr-class-table__col--progress" />
                    {(isRound ? [1, 2] : [1, 2, 3]).map((n) => (
                      <col key={n} className="tr-class-table__col--count" />
                    ))}
                  </colgroup>
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
                                <span className="tr-class-name">
                                  {c.className}
                                  <span className="tr-class-name__meta">Sĩ số {c.total}</span>
                                </span>
                              </button>
                            </td>
                            <td className="tr-progress-cell">
                              <SegmentedProgress
                                compact
                                label={`Tiến độ ${c.className}`}
                                total={c.total}
                                text={c.total ? `${c.recorded}/${c.total}` : '0/0'}
                                segments={[
                                  { key: 'recorded', label: isRound ? 'Đã cân đo' : 'Đã có kết luận', value: c.recorded, tone: 'green' },
                                  { key: 'inProgress', label: 'Đang khám', value: c.inProgress || 0, tone: 'blue' },
                                  { key: 'absent', label: w.absent, value: c.absent || 0, tone: 'gray' },
                                ]}
                              />
                            </td>
                            <td className="num">
                              <CountCell value={c.absent} />
                            </td>
                            {!isRound && (
                              <td className="num">
                                <CountCell value={c.watch} tone="orange" />
                              </td>
                            )}
                            {!isRound && (
                              <td className="num">
                                <CountCell value={c.closeWatch} tone="red" />
                              </td>
                            )}
                            {isRound && (
                              <td className="num">
                                <CountCell value={c.bmiWarning} tone="orange" />
                              </td>
                            )}
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
                    <th className="center">Ngày đo</th>
                    <th className="num">BMI</th>
                    <th>Cảnh báo BMI</th>
                  </tr>
                </thead>
                <tbody>
                  {watchList.map((r) => (
                    // Bấm dòng mở sổ sức khỏe của trẻ (DESIGN §6.3), không cột icon Xem
                    <tr key={r.childId} className="row-click" {...clickableRowProps(() => navigate(`/children/${r.childId}/health`))}>
                      <td>
                        <div className="fw-600">{r.fullName}</div>
                        <div className="muted text-xs">{r.code}</div>
                      </td>
                      <td className="nowrap">{r.className}</td>
                      <td className="nowrap center">{r.date ? formatDate(r.date) : '—'}</td>
                      <td className="num">{formatNumber(r.bmi)}</td>
                      <td>
                        <BmiStatusBadge status={r.bmiStatus} />
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
                  </tr>
                </thead>
                <tbody>
                  {watchList.map((r) => (
                    // Bấm dòng mở sổ sức khỏe của trẻ (DESIGN §6.3), không cột icon Xem
                    <tr key={r.childId} className="row-click" {...clickableRowProps(() => navigate(`/children/${r.childId}/health`))}>
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
