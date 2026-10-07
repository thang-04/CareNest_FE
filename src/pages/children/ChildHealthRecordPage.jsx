import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Plus, LineChart, Pencil, Send, History, ArrowLeft, Info, HeartPulse, RotateCcw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useHealthRecord } from '@/hooks/children/useChildRecords';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Modal } from '@/components/ui/Modal';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { NutritionBadge } from '@/components/children/ChildBadges';
import { ChildAccessState } from '@/components/children/ChildAccessState';
import { publishMeasurement } from '@/services/children/childrenService';
import { DECLARATION_STATE, ALLERGY_STATE_LABELS } from '@/models/children/childrenConstants';
import { formatDate, formatDateTime } from '@/utils/format';
import { formatNumber } from '@/utils/children/childrenHelpers';
import { canEditMeasurement, canPublishMeasurement, canRecordMeasurement } from '@/utils/children/childrenPermissions';
import { childCrumb, childrenCrumbs } from '@/utils/children/breadcrumbs';
import '@/styles/modules/children.css';

const ageText = (months) =>
  months == null ? '—' : months < 36 ? `${months} tháng` : `${Math.floor(months / 12)} tuổi ${months % 12} tháng`;

export default function ChildHealthRecordPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const { record, loading, error, reload } = useHealthRecord(id);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [historyOf, setHistoryOf] = useState(null);
  const [publishing, setPublishing] = useState(null);

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
  const canPublish = canPublishMeasurement(child, user, cls);
  const filtered = !!(from || to);

  const doPublish = async () => {
    try {
      await publishMeasurement(child.id, publishing.id, user);
      toast.success(`Đã công bố kết quả ngày ${formatDate(publishing.date)} cho phụ huynh.`);
    } catch (err) {
      toast.error(err.message, 'Không công bố được');
    } finally {
      setPublishing(null);
    }
  };

  return (
    <div className="page">
      <Breadcrumb items={crumbs} />
      <div className="page__head">
        <h1 className="page__title">Sổ sức khỏe: {child.fullName}</h1>
        <div className="row" style={{ gap: 8 }}>
          <Link className="btn" to={`/children/health-trends?childId=${child.id}`}>
            <LineChart size={16} /> Xem xu hướng
          </Link>
          {canRecord && (
            <Link className="btn btn--primary" to={`/children/${child.id}/health/new`}>
              <Plus size={16} /> Nhập số đo
            </Link>
          )}
        </div>
      </div>

      <div className="grid-2">
        <section className="card">
          <div className="card__header">
            <h2 className="card__title">Lần đo gần nhất</h2>
          </div>
          <div className="card__body">
            {latest ? (
              <>
                <div className="tr-metrics">
                  <div>
                    <div className="tr-metric__value">{formatNumber(latest.heightCm)}</div>
                    <div className="muted text-sm">Chiều cao (cm)</div>
                  </div>
                  <div>
                    <div className="tr-metric__value">{formatNumber(latest.weightKg)}</div>
                    <div className="muted text-sm">Cân nặng (kg)</div>
                  </div>
                  <div>
                    <div className="tr-metric__value">{formatNumber(latest.bmi)}</div>
                    <div className="muted text-sm">BMI</div>
                  </div>
                </div>
                <div className="row row--wrap mt-12" style={{ gap: 8 }}>
                  <NutritionBadge status={latest.nutritionStatus} />
                  <span className="muted text-sm">
                    Ngày đo {formatDate(latest.date)} · {ageText(latest.ageMonths)}
                  </span>
                </div>
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
                  <span className="row row--wrap" style={{ gap: 6 }}>
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
                {declaration
                  ? declaration.allergies.state === DECLARATION_STATE.REPORTED
                    ? declaration.allergies.items.join(', ')
                    : ALLERGY_STATE_LABELS[declaration.allergies.state]
                  : 'Chưa có khai báo'}
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
          <label className="row" style={{ gap: 8 }}>
            <span className="text-sm text-2">Từ ngày</span>
            <input type="date" className="input" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="row" style={{ gap: 8 }}>
            <span className="text-sm text-2">Đến ngày</span>
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
            <RotateCcw size={15} /> Đặt lại
          </button>
        </div>
        <div className="alert alert--info tr-alert-flat">
          <Info size={18} />
          <div>
            Tình trạng dinh dưỡng do hệ thống tính theo quy tắc cố định từ chiều cao, cân nặng và tuổi – không phải chẩn đoán y khoa.
          </div>
        </div>
        {measurements.length === 0 ? (
          <EmptyState
            icon={HeartPulse}
            title={filtered ? 'Không có lần đo trong khoảng thời gian này' : 'Chưa có số đo sức khỏe'}
            description={filtered ? 'Chọn khoảng thời gian khác.' : 'Giáo viên chủ nhiệm nhập chiều cao, cân nặng ở mỗi lần khám định kỳ.'}
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
                canRecord && (
                  <Link className="btn btn--primary" to={`/children/${child.id}/health/new`}>
                    <Plus size={16} /> Nhập số đo
                  </Link>
                )
              )
            }
          />
        ) : (
          <div className="table-wrap tr-table-flat">
            <table className="table">
              <thead>
                <tr>
                  <th>Ngày đo</th>
                  <th>Tuổi</th>
                  <th className="right">Chiều cao (cm)</th>
                  <th className="right">Cân nặng (kg)</th>
                  <th className="right">BMI</th>
                  <th>Tình trạng dinh dưỡng</th>
                  <th>Người đo</th>
                  <th>Phụ huynh</th>
                  <th className="center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {measurements.map((m) => (
                  <tr key={m.id}>
                    <td className="nowrap fw-600">
                      {formatDate(m.date)}
                      {m.note && <div className="muted text-xs tr-note">{m.note}</div>}
                    </td>
                    <td className="nowrap">{ageText(m.ageMonths)}</td>
                    <td className="right">{formatNumber(m.heightCm)}</td>
                    <td className="right">{formatNumber(m.weightKg)}</td>
                    <td className="right">{formatNumber(m.bmi)}</td>
                    <td>
                      <NutritionBadge status={m.nutritionStatus} />
                    </td>
                    <td className="text-sm">{m.measuredByName || '—'}</td>
                    <td>
                      {m.published ? (
                        <span className="chip chip--green">Đã công bố</span>
                      ) : (
                        <span className="chip chip--gray">Chưa công bố</span>
                      )}
                    </td>
                    <td className="center nowrap">
                      {m.edits.length > 0 && (
                        <button
                          className="icon-btn"
                          title="Lịch sử chỉnh sửa"
                          aria-label={`Lịch sử chỉnh sửa lần đo ${formatDate(m.date)}`}
                          onClick={() => setHistoryOf(m)}
                        >
                          <History size={17} />
                        </button>
                      )}
                      {canEdit && (
                        <Link
                          className="icon-btn"
                          to={`/children/${child.id}/health/${m.id}/edit`}
                          title="Sửa số đo"
                          aria-label={`Sửa lần đo ${formatDate(m.date)}`}
                        >
                          <Pencil size={17} />
                        </Link>
                      )}
                      {canPublish && !m.published && (
                        <button className="btn btn--sm" onClick={() => setPublishing(m)}>
                          <Send size={14} /> Công bố
                        </button>
                      )}
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
                        {c.label || c.field}:{' '}
                        <s className="muted">{c.field === 'date' ? formatDate(c.from) : String(c.from ?? '') || '(trống)'}</s> →{' '}
                        <b>{c.field === 'date' ? formatDate(c.to) : String(c.to ?? '') || '(trống)'}</b>
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

      <ConfirmationModal
        open={!!publishing}
        title="Công bố kết quả cho phụ huynh?"
        message={
          publishing
            ? `Phụ huynh của ${child.fullName} sẽ xem được kết quả đo ngày ${formatDate(publishing.date)} và nhận thông báo trên ứng dụng.`
            : ''
        }
        confirmLabel="Công bố kết quả"
        onConfirm={doPublish}
        onClose={() => setPublishing(null)}
      />
    </div>
  );
}
