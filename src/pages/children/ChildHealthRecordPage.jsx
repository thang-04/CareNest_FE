import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Plus, LineChart, History, ArrowLeft, Info, HeartPulse, RotateCcw, Stethoscope, ClipboardCheck } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useHealthRecord } from '@/hooks/children/useChildRecords';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { RowActions } from '@/components/ui/RowActions';
import {
  AllergyStateBadge,
  ConclusionCategoryBadge,
  FollowUpDueBadge,
  FollowUpLevelShortBadge,
  FollowUpStatusBadge,
  MotorResultBadge,
  PublishStatusBadge,
} from '@/components/children/ChildBadges';
import { MeasurementSummary } from '@/components/children/MeasurementSummary';
import { MeasurementDetailModal } from '@/components/children/MeasurementDetailModal';
import { ChildAccessState } from '@/components/children/ChildAccessState';
import { ImageUploader } from '@/components/upload/ImageUploader';
import { DECLARATION_STATE, MEASUREMENT_SOURCE, MEASUREMENT_SOURCE_LABELS } from '@/models/children/childrenConstants';
import { EXAM_STATUS } from '@/models/children/healthExamForm';
import { CAMPAIGN_KIND, FOLLOW_UP_STATUS } from '@/models/children/healthCheckConstants';
import { formatDate, formatDateTime } from '@/utils/format';
import { formatMeasurementChange, formatNumber } from '@/utils/children/childrenHelpers';
import { canEditMeasurement, canRecordMeasurement } from '@/utils/children/childrenPermissions';
import { childCrumb, childrenCrumbs } from '@/utils/children/breadcrumbs';
import '@/styles/modules/children.css';

const ageText = (months) =>
  months == null ? '—' : months < 36 ? `${months} tháng` : `${Math.floor(months / 12)} tuổi ${months % 12} tháng`;

export default function ChildHealthRecordPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { record, loading, error, reload } = useHealthRecord(id);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [historyOf, setHistoryOf] = useState(null);
  const [viewing, setViewing] = useState(null);

  const measurements = useMemo(
    () => (record?.measurements || []).filter((m) => (!from || m.date >= from) && (!to || m.date <= to)),
    [record, from, to],
  );
  const child = record?.child;
  const crumbs = childrenCrumbs(childCrumb(child), 'Sổ sức khỏe');

  if (loading)
    return (
      <div className="page">
        <Breadcrumb items={crumbs} />
        <LoadingState />
      </div>
    );
  if (error || !child)
    return (
      <div className="page">
        <Breadcrumb items={crumbs} />
        <ChildAccessState error={error} onRetry={reload} />
      </div>
    );

  const { cls, declaration } = record;
  const latest = record.measurements[0];
  const canRecord = canRecordMeasurement(child, user, cls);
  const canEdit = canEditMeasurement(child, user, cls);
  const filtered = !!(from || to);
  const open = record.openCampaign;
  // Số đo chỉ nhập trong kỳ cân đo đang diễn ra; mỗi trẻ một lần đo trong kỳ (user chốt 2026-10-31).
  const round = open?.kind === CAMPAIGN_KIND.MEASUREMENT ? open : null;
  const canMeasure = canRecord && !!round && !round.resultMeasurementId;
  const measureLink = round ? `/children/${child.id}/health/new?campaignId=${round.id}` : '';

  return (
    <div className="page">
      <Breadcrumb items={crumbs} />
      <div className="page__head">
        <h1 className="page__title">Sổ sức khỏe: {child.fullName}</h1>
        <div className="row gap-2">
          <Link className="btn" to={`/children/health-trends?childId=${child.id}`}>
            <LineChart size={16} /> Xem xu hướng
          </Link>
          {canMeasure && (
            <Link className="btn" to={measureLink}>
              <Plus size={16} /> Nhập số đo
            </Link>
          )}
        </div>
      </div>

      {canMeasure && (
        <div className="alert alert--info mb-16">
          <Info size={18} />
          <div>
            Kỳ cân đo <b>{round.name}</b> đang diễn ra ({formatDate(round.startDate)} – {formatDate(round.endDate)}).{' '}
            <Link className="text-primary fw-600" to={measureLink}>
              Nhập số đo của kỳ
            </Link>
          </div>
        </div>
      )}

      {canRecord && open?.kind === CAMPAIGN_KIND.EXAM && open.resultStatus !== EXAM_STATUS.CONCLUDED && open.resultStatus !== 'LEGACY' && (
        <div className="alert alert--info mb-16">
          <Stethoscope size={18} />
          <div>
            Đợt <b>{record.openCampaign.name}</b> đang diễn ra ({formatDate(record.openCampaign.startDate)} –{' '}
            {formatDate(record.openCampaign.endDate)}).{' '}
            <Link
              className="text-primary fw-600"
              to={`/children/health-checks/${record.openCampaign.id}/exam/${child.id}?classId=${child.classId}`}
            >
              {record.openCampaign.resultStatus === EXAM_STATUS.DRAFT ? 'Tiếp tục phiếu khám' : 'Khám trong đợt (phiếu Phụ lục II)'}
            </Link>
          </div>
        </div>
      )}

      {record.openFollowUp && (
        <div className={`alert ${record.openFollowUp.overdueDays > 0 ? 'alert--danger' : 'alert--warning'} mb-16`}>
          <ClipboardCheck size={18} />
          <div className="row row--wrap gap-2">
            <span>Trẻ đang có phiếu theo dõi sức khỏe từ ngày {formatDate(record.openFollowUp.openedAt.slice(0, 10))}:</span>
            <FollowUpStatusBadge status={record.openFollowUp.status} />
            {record.openFollowUp.status === FOLLOW_UP_STATUS.WAITING_PARENT_CONTACT && (
              <FollowUpDueBadge dueOn={record.openFollowUp.dueOn} overdueDays={record.openFollowUp.overdueDays} />
            )}
            <Link className="text-primary fw-600" to={`/children/health-follow-ups/${record.openFollowUp.id}`}>
              Mở phiếu theo dõi
            </Link>
          </div>
        </div>
      )}

      <div className="grid-2">
        <section className="card">
          <div className="card__header">
            <h2 className="card__title">Lần đo gần nhất</h2>
          </div>
          <div className="card__body">
            {latest ? (
              <>
                <p className="muted text-sm mb-12">
                  Ngày đo {formatDate(latest.date)} · {ageText(latest.ageMonths)}
                </p>
                <MeasurementSummary measurement={latest} />
              </>
            ) : (
              <p className="muted">Chưa có lần đo nào.</p>
            )}
          </div>
        </section>
        <section className="card">
          <div className="card__header row row--between">
            <h2 className="card__title">Thông tin sức khỏe khi tiếp nhận</h2>
            <Link className="text-primary text-sm" to={`/children/${child.id}/health-declaration`}>
              Xem khai báo
            </Link>
          </div>
          <div className="card__body">
            <dl className="info-list">
              <dt>Lớp</dt>
              <dd>{cls?.name || 'Chưa xếp lớp'}</dd>
              <dt>Dị ứng đã xác nhận</dt>
              <dd>
                {child.allergies?.length ? (
                  <span className="row row--wrap gap-1-5">
                    {child.allergies.map((a) => (
                      <span key={a} className="chip chip--red">
                        {a}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="muted">Không có</span>
                )}
              </dd>
              <dt>Khai báo dị ứng</dt>
              <dd>
                {declaration ? (
                  declaration.allergies.state === DECLARATION_STATE.REPORTED ? (
                    declaration.allergies.items.join(', ')
                  ) : (
                    <AllergyStateBadge status={declaration.allergies.state} />
                  )
                ) : (
                  'Chưa có khai báo'
                )}
              </dd>
            </dl>
          </div>
        </section>
      </div>

      {(record.externalResults || []).length > 0 && (
        <section className="card mt-16">
          <div className="card__header">
            <h2 className="card__title">Kết quả khám chuyên khoa (phụ huynh báo lại)</h2>
          </div>
          <div className="card__body">
            <ul className="history-list">
              {record.externalResults.map((x) => (
                <li key={x.at}>
                  <span className="history-list__dot" />
                  <div>
                    <div className="fw-600">
                      Ngày khám {formatDate(x.on)}
                      {x.facility ? ` · ${x.facility}` : ''}
                    </div>
                    <div className="tr-pre-line text-sm">{x.note}</div>
                    {x.images?.length > 0 && (
                      <div className="mt-8">
                        <ImageUploader images={x.images} disabled />
                      </div>
                    )}
                    <div className="muted text-xs">
                      {x.nextVisitOn && `Hẹn khám lại ngày ${formatDate(x.nextVisitOn)} · `}
                      Ghi bởi {x.byName || '—'} ·{' '}
                      <Link className="text-primary" to={`/children/health-follow-ups/${x.followUpId}`}>
                        Mở phiếu theo dõi
                      </Link>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="muted text-xs">Giáo viên ghi đúng lời bác sĩ chuyên khoa mà phụ huynh báo lại; hệ thống không kết luận.</div>
          </div>
        </section>
      )}

      <section className="card mt-16">
        <div className="card__header">
          <h2 className="card__title">Các lần đo</h2>
        </div>
        <div className="filter-bar">
          <label className="date-filter">
            Từ ngày
            <input type="date" className="input" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="date-filter">
            Đến ngày
            <input type="date" className="input" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </label>
          <button
            className="btn"
            disabled={!filtered}
            onClick={() => {
              setFrom('');
              setTo('');
            }}
          >
            <RotateCcw size={15} /> Đặt lại bộ lọc
          </button>
        </div>
        <div className="alert alert--info tr-alert-flat">
          <Info size={18} />
          <div>
            Phiếu khám trong đợt: mức theo dõi theo kết luận của bác sĩ. Kết quả mẫu cũ: mức theo dõi do hệ thống xếp theo ngưỡng tham chiếu
            tạm, là kết quả sàng lọc, không phải chẩn đoán. BMI chỉ là số hệ thống tính từ chiều cao, cân nặng.
          </div>
        </div>
        {measurements.length === 0 ? (
          <EmptyState
            icon={HeartPulse}
            title={filtered ? 'Không có lần đo trong khoảng thời gian này' : 'Chưa có kết quả khám'}
            description={filtered ? 'Chọn khoảng thời gian khác.' : 'Giáo viên phụ trách lớp nhập kết quả ở mỗi đợt khám hoặc kỳ cân đo.'}
            action={
              filtered ? (
                <button
                  className="btn"
                  onClick={() => {
                    setFrom('');
                    setTo('');
                  }}
                >
                  <RotateCcw size={15} /> Đặt lại bộ lọc
                </button>
              ) : (
                canMeasure && (
                  <Link className="btn btn--primary" to={measureLink}>
                    <Plus size={16} /> Nhập số đo
                  </Link>
                )
              )
            }
          />
        ) : (
          <div className="table-wrap tr-table-flat">
            <table className="table table--grid">
              <thead>
                <tr>
                  <th>Ngày đo</th>
                  <th className="num">Chiều cao (cm)</th>
                  <th className="num">Cân nặng (kg)</th>
                  <th className="num">Vòng đầu (cm)</th>
                  <th className="num">BMI</th>
                  <th>Kết luận</th>
                  <th>Mức theo dõi</th>
                  <th>Người nhập</th>
                  <th>Phụ huynh</th>
                  <th className="cell--actions">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {measurements.map((m) => (
                  <tr key={m.id}>
                    <td className="nowrap">
                      <div className="fw-600">{formatDate(m.date)}</div>
                      <div className="muted text-xs">{ageText(m.ageMonths)}</div>
                      <div className="muted text-xs tr-note">{m.campaignName || 'Ngoài đợt khám'}</div>
                      {m.note && <div className="muted text-xs tr-note">{m.note}</div>}
                    </td>
                    <td className="num">{formatNumber(m.heightCm)}</td>
                    <td className="num">{formatNumber(m.weightKg)}</td>
                    <td className="num">{formatNumber(m.headCircumferenceCm)}</td>
                    <td className="num">{formatNumber(m.bmi)}</td>
                    <td>
                      {m.source === MEASUREMENT_SOURCE.EXAM ? (
                        <div className="tr-cell-stack">
                          <ConclusionCategoryBadge status={m.conclusionCategory} />
                          <span className="muted text-xs tr-note">
                            {m.exam.conclusion.specialty
                              ? `Chuyển khám: ${m.exam.conclusion.specialty}`
                              : m.exam.conclusion.issueText || m.exam.conclusion.adviceText}
                          </span>
                        </div>
                      ) : m.source === MEASUREMENT_SOURCE.LEGACY ? (
                        <div className="tr-cell-stack text-sm">
                          <span className="muted text-xs">{MEASUREMENT_SOURCE_LABELS.LEGACY}</span>
                          <span>Thô: {m.grossMotor ? <MotorResultBadge status={m.grossMotor} /> : '—'}</span>
                          <span>Tinh: {m.fineMotor ? <MotorResultBadge status={m.fineMotor} /> : '—'}</span>
                        </div>
                      ) : (
                        <span className="muted text-xs tr-note">{MEASUREMENT_SOURCE_LABELS.MEASUREMENT_ONLY}</span>
                      )}
                    </td>
                    <td>
                      <div className="tr-cell-stack">
                        <FollowUpLevelShortBadge status={m.followUpLevel} />
                        {m.followUpId && (
                          <Link className="text-primary text-xs" to={`/children/health-follow-ups/${m.followUpId}`}>
                            Phiếu theo dõi
                          </Link>
                        )}
                      </div>
                    </td>
                    <td className="text-sm">{m.measuredByName || '—'}</td>
                    <td className="center">
                      <PublishStatusBadge status={m.published ? 'PUBLISHED' : 'UNPUBLISHED'} />
                    </td>
                    <td className="cell--actions">
                      <RowActions
                        view={
                          m.source === MEASUREMENT_SOURCE.EXAM
                            ? { to: `/children/health-checks/${m.campaignId}/exam/${child.id}`, label: 'Xem phiếu khám' }
                            : { onClick: () => setViewing(m), label: 'Xem chi tiết' }
                        }
                        edit={
                          canEdit && !m.locked && m.source !== MEASUREMENT_SOURCE.EXAM
                            ? { to: `/children/${child.id}/health/${m.id}/edit`, label: 'Sửa số đo' }
                            : null
                        }
                        name={`lần đo ${formatDate(m.date)}`}
                        menu={m.edits.length > 0 ? [{ label: 'Lịch sử chỉnh sửa', icon: History, onClick: () => setHistoryOf(m) }] : []}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="page-actions">
        <Link className="btn" to={`/children/${child.id}`}>
          <ArrowLeft size={16} /> Về hồ sơ trẻ
        </Link>
      </div>

      <MeasurementDetailModal measurement={viewing} ageText={ageText} onClose={() => setViewing(null)} />

      <Modal
        open={!!historyOf}
        title={historyOf ? `Lịch sử chỉnh sửa – lần đo ${formatDate(historyOf.date)}` : ''}
        onClose={() => setHistoryOf(null)}
        size="lg"
      >
        {historyOf && (
          <ul className="history-list">
            {[...historyOf.edits].reverse().map((e, i) => (
              <li key={`${e.at}${i}`}>
                <span className="history-list__dot" />
                <div>
                  <div className="fw-600">
                    {e.userName || '—'} · {formatDateTime(e.at)}
                  </div>
                  <ul className="tr-change-list">
                    {e.changes.map((c) => (
                      <li key={c.field}>
                        {c.label || c.field}: <s className="muted">{formatMeasurementChange(c.field, c.from)}</s> →{' '}
                        <b>{formatMeasurementChange(c.field, c.to)}</b>
                      </li>
                    ))}
                  </ul>
                  {e.reason && <div className="muted text-sm">Lý do: {e.reason}</div>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}
