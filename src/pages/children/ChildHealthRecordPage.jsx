import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Plus, LineChart, History, ArrowLeft, HeartPulse, RotateCcw, Stethoscope } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useHealthRecord } from '@/hooks/children/useChildRecords';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { RowActions } from '@/components/ui/RowActions';
import { HealthWarningCell } from '@/components/children/HealthWarningCell';
import { MeasurementDetailModal } from '@/components/children/MeasurementDetailModal';
import { ExamDetailModal } from '@/components/children/ExamDetailModal';
import { ChildAccessState } from '@/components/children/ChildAccessState';
import { MEASUREMENT_SOURCE, MEASUREMENT_SOURCE_LABELS } from '@/models/children/childrenConstants';
import { EXAM_STATUS } from '@/models/children/healthExamForm';
import { CAMPAIGN_KIND, CAMPAIGN_KIND_LABELS } from '@/models/children/healthCheckConstants';
import { formatDate, formatDateTime } from '@/utils/format';
import { formatAgeMonths, formatMeasurementChange, hasHealthWarning } from '@/utils/children/childrenHelpers';
import { canEditMeasurement, canRecordMeasurement } from '@/utils/children/childrenPermissions';
import { childCrumb, childrenCrumbs } from '@/utils/children/breadcrumbs';
import '@/styles/modules/children.css';

// Dòng phụ dưới tên đợt: loại đợt (đợt khám có bác sĩ / kỳ cân đo), kết quả mẫu cũ, hoặc lần đo không thuộc đợt nào.
const kindLabelOf = (m) =>
  [CAMPAIGN_KIND_LABELS[m.campaignKind], m.source === MEASUREMENT_SOURCE.LEGACY && MEASUREMENT_SOURCE_LABELS.LEGACY]
    .filter(Boolean)
    .join(' · ');

/**
 * Sổ sức khỏe tối giản (user yêu cầu 2026-11-04): một bảng các lần khám, cân đo với kết luận sức khỏe (bác sĩ hoặc mức BMI — HLT-19);
 * xem chi tiết theo loại: phiếu khám Phụ lục II đầy đủ, hoặc số đo của kỳ cân đo.
 */
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

  const { cls } = record;
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
  const examOpen =
    canRecord && open?.kind === CAMPAIGN_KIND.EXAM && open.resultStatus !== EXAM_STATUS.CONCLUDED && open.resultStatus !== 'LEGACY';
  const isExam = viewing?.source === MEASUREMENT_SOURCE.EXAM;
  // Bút chì theo loại: phiếu khám mở trang phiếu ở chế độ sửa, số đo mở form số đo. Chỉ GV lớp, đợt/kỳ đang diễn ra (BE trả
  // locked; lần đo ngoài đợt luôn khóa).
  const editOf = (m) => {
    if (!canEdit || m.locked) return null;
    return m.source === MEASUREMENT_SOURCE.EXAM
      ? { to: `/children/health-checks/${m.campaignId}/exam/${child.id}?classId=${child.classId}&edit=1`, label: 'Sửa phiếu khám' }
      : { to: `/children/${child.id}/health/${m.id}/edit`, label: 'Sửa số đo' };
  };

  return (
    <div className="page">
      <Breadcrumb items={crumbs} />
      <div className="page__head">
        <h1 className="page__title">Sổ sức khỏe: {child.fullName}</h1>
        <div className="row gap-2">
          <Link className="btn" to={`/children/health-trends?childId=${child.id}`}>
            <LineChart size={16} /> Xem xu hướng
          </Link>
          {examOpen && (
            <Link className="btn" to={`/children/health-checks/${open.id}/exam/${child.id}?classId=${child.classId}`}>
              <Stethoscope size={16} /> {open.resultStatus === EXAM_STATUS.DRAFT ? 'Tiếp tục phiếu khám' : 'Khám trong đợt'}
            </Link>
          )}
          {canMeasure && (
            <Link className="btn btn--primary" to={measureLink}>
              <Plus size={16} /> Nhập số đo
            </Link>
          )}
        </div>
      </div>

      <section className="card">
        <div className="card__header">
          <h2 className="card__title">Lịch sử khám, cân đo</h2>
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
        {measurements.length === 0 ? (
          <EmptyState
            icon={HeartPulse}
            title={filtered ? 'Không có lần khám phù hợp' : 'Chưa có kết quả khám'}
            description={
              filtered
                ? 'Không có lần khám, cân đo nào theo khoảng thời gian hoặc bộ lọc cảnh báo đã chọn.'
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
              <caption className="sr-only">Các lần khám, cân đo của {child.fullName}</caption>
              <thead>
                <tr>
                  <th>Tên đợt khám</th>
                  <th>Ngày khám</th>
                  <th>Người nhập</th>
                  <th>Kết luận sức khỏe</th>
                  <th className="cell--actions">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {measurements.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div className="fw-600">{m.campaignName || 'Ngoài đợt khám'}</div>
                      {kindLabelOf(m) && <div className="muted text-xs">{kindLabelOf(m)}</div>}
                    </td>
                    <td className="nowrap">
                      <div>{formatDate(m.date)}</div>
                      <div className="muted text-xs">{formatAgeMonths(m.ageMonths)}</div>
                    </td>
                    <td className="text-sm">{m.measuredByName || '—'}</td>
                    <td>
                      <HealthWarningCell measurement={m} variant="conclusion" />
                    </td>
                    <td className="cell--actions">
                      <RowActions
                        view={{
                          onClick: () => setViewing(m),
                          label: m.source === MEASUREMENT_SOURCE.EXAM ? 'Xem phiếu khám' : 'Xem số đo',
                        }}
                        edit={editOf(m)}
                        name={`${m.campaignName || 'lần đo'} ngày ${formatDate(m.date)}`}
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

      <MeasurementDetailModal measurement={isExam ? null : viewing} ageText={formatAgeMonths} onClose={() => setViewing(null)} />
      <ExamDetailModal measurement={isExam ? viewing : null} childId={child.id} onClose={() => setViewing(null)} />

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
