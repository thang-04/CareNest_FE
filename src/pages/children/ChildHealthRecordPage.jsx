import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Plus, LineChart, History, ArrowLeft, Info, HeartPulse, RotateCcw, Stethoscope } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useHealthRecord } from '@/hooks/children/useChildRecords';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { RowActions } from '@/components/ui/RowActions';
import { AllergyStateBadge, PublishStatusBadge } from '@/components/children/ChildBadges';
import { HealthWarningCell } from '@/components/children/HealthWarningCell';
import { HealthWarningsCard } from '@/components/children/HealthWarningsCard';
import { MeasurementSummary } from '@/components/children/MeasurementSummary';
import { MeasurementDetailModal } from '@/components/children/MeasurementDetailModal';
import { ChildAccessState } from '@/components/children/ChildAccessState';
import { DECLARATION_STATE, MEASUREMENT_SOURCE } from '@/models/children/childrenConstants';
import { EXAM_STATUS } from '@/models/children/healthExamForm';
import { CAMPAIGN_KIND } from '@/models/children/healthCheckConstants';
import { formatDate, formatDateTime } from '@/utils/format';
import { formatAgeMonths, formatMeasurementChange, formatNumber, hasHealthWarning } from '@/utils/children/childrenHelpers';
import { canEditMeasurement, canRecordMeasurement } from '@/utils/children/childrenPermissions';
import { childCrumb, childrenCrumbs } from '@/utils/children/breadcrumbs';
import '@/styles/modules/children.css';

export default function ChildHealthRecordPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { record, loading, error, reload } = useHealthRecord(id);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [warningsOnly, setWarningsOnly] = useState(false);
  const [historyOf, setHistoryOf] = useState(null);
  const [viewing, setViewing] = useState(null);

  // Lọc theo trường BE trả (ngày, mức BMI, mức theo dõi); không tính lại cảnh báo.
  const measurements = useMemo(
    () =>
      (record?.measurements || []).filter(
        (m) => (!from || m.date >= from) && (!to || m.date <= to) && (!warningsOnly || hasHealthWarning(m)),
      ),
    [record, from, to, warningsOnly],
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
  const filtered = !!(from || to || warningsOnly);
  const resetFilters = () => {
    setFrom('');
    setTo('');
    setWarningsOnly(false);
  };
  const open = record.openCampaign;
  // Số đo chỉ nhập trong kỳ cân đo đang diễn ra; mỗi trẻ một lần đo trong kỳ (user chốt 2026-10-31).
  const round = open?.kind === CAMPAIGN_KIND.MEASUREMENT ? open : null;
  const canMeasure = canRecord && !!round && !round.resultMeasurementId;
  const measureLink = round ? `/children/${child.id}/health/new?campaignId=${round.id}` : '';
  const viewMeasurement = (measurementId) => setViewing(record.measurements.find((m) => m.id === measurementId) || null);

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
            Đợt <b>{open.name}</b> đang diễn ra ({formatDate(open.startDate)} – {formatDate(open.endDate)}).{' '}
            <Link className="text-primary fw-600" to={`/children/health-checks/${open.id}/exam/${child.id}?classId=${child.classId}`}>
              {open.resultStatus === EXAM_STATUS.DRAFT ? 'Tiếp tục phiếu khám' : 'Khám trong đợt (phiếu Phụ lục II)'}
            </Link>
          </div>
        </div>
      )}

      {/* Cảnh báo hiện tại thay thẻ "Theo dõi sức khỏe" và phiếu theo dõi (HLT-19, user chốt 2026-11-04) */}
      <HealthWarningsCard childId={child.id} latestExam={record.latestExam} latestBmi={record.latestBmi} onViewBmi={viewMeasurement} />

      <div className="grid-2">
        <section className="card">
          <div className="card__header">
            <h2 className="card__title">Lần đo gần nhất</h2>
          </div>
          <div className="card__body">
            {latest ? (
              <>
                <p className="muted text-sm mb-12">
                  Ngày đo {formatDate(latest.date)} · {formatAgeMonths(latest.ageMonths)}
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
          <div className="date-filter__static">
            <label className="checkbox text-sm">
              <input type="checkbox" checked={warningsOnly} onChange={(e) => setWarningsOnly(e.target.checked)} />
              Chỉ lần có cảnh báo
            </label>
          </div>
          <button className="btn" disabled={!filtered} onClick={resetFilters}>
            <RotateCcw size={15} /> Đặt lại bộ lọc
          </button>
        </div>
        <div className="alert alert--info tr-alert-flat">
          <Info size={18} />
          <div>
            Đợt khám: cảnh báo theo kết luận của bác sĩ. Kỳ cân đo: cảnh báo BMI theo tuổi do hệ thống tính theo chuẩn WHO, là kết quả sàng
            lọc, không phải chẩn đoán.
          </div>
        </div>
        {measurements.length === 0 ? (
          <EmptyState
            icon={HeartPulse}
            title={filtered ? 'Không có lần đo phù hợp' : 'Chưa có kết quả khám'}
            description={
              filtered
                ? 'Không có lần đo nào theo khoảng thời gian hoặc bộ lọc cảnh báo đã chọn.'
                : 'Giáo viên phụ trách lớp nhập kết quả ở mỗi đợt khám hoặc kỳ cân đo.'
            }
            action={
              filtered ? (
                <button className="btn" onClick={resetFilters}>
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
                  <th>Cảnh báo</th>
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
                      <div className="muted text-xs">{formatAgeMonths(m.ageMonths)}</div>
                      <div className="muted text-xs tr-note">{m.campaignName || 'Ngoài đợt khám'}</div>
                      {m.note && <div className="muted text-xs tr-note">{m.note}</div>}
                    </td>
                    <td className="num">{formatNumber(m.heightCm)}</td>
                    <td className="num">{formatNumber(m.weightKg)}</td>
                    <td className="num">{formatNumber(m.headCircumferenceCm)}</td>
                    <td className="num">{formatNumber(m.bmi)}</td>
                    <td>
                      <HealthWarningCell measurement={m} />
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

      <MeasurementDetailModal measurement={viewing} ageText={formatAgeMonths} onClose={() => setViewing(null)} />

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
