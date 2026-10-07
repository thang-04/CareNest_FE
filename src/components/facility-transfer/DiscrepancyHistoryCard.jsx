import { Scale, CheckCircle2 } from 'lucide-react';
import { formatDateTime } from '@/utils/format';
import { DISCREPANCY_PARTS, DISCREPANCY_PART_LABELS, RESOLUTION_CHOICE_LABELS } from '@/models/facility-transfer/transferConstants';
import { discrepancyParts } from '@/models/facility-transfer/FacilityTransferItem';
import { ConditionBadge } from '@/components/asset/AssetVisuals';
import { ImageUploader } from '@/components/upload/ImageUploader';

const PART_CHIP = { shortage: 'chip--red', surplus: 'chip--orange', damaged: 'chip--red' };

/** Problem parts of a line as chips: "Thiếu 1", "Thừa 1", "Hỏng 1". */
export function DiscrepancyParts({ line }) {
  const parts = discrepancyParts(line);
  return (
    <span className="row row--wrap" style={{ gap: 4, justifyContent: 'center' }}>
      {DISCREPANCY_PARTS.filter((p) => parts[p] > 0).map((p) => (
        <span key={p} className={`chip ${PART_CHIP[p]}`}>
          {DISCREPANCY_PART_LABELS[p]} {parts[p]}
        </span>
      ))}
    </span>
  );
}

/** VP decision of one line, e.g. "Thiếu: Yêu cầu giao thêm · Thừa: Chấp nhận". */
export const decisionText = (decision) =>
  DISCREPANCY_PARTS.filter((p) => decision?.[p])
    .map((p) => `${DISCREPANCY_PART_LABELS[p]}: ${RESOLUTION_CHOICE_LABELS[decision[p]] || decision[p]}`)
    .join(' · ');

/** Discrepancies reported by the receiver and the VP's decisions. */
export function DiscrepancyHistoryCard({ transfer, md }) {
  const list = [...(transfer.discrepancies || [])].reverse();
  if (!list.length) return null;
  const itemOf = (id) => transfer.items.find((i) => i.id === id);

  return (
    <div className="card card--soft-header">
      <div className="card__header">
        <div className="card__title">
          <Scale size={20} /> Chênh lệch khi nhận ({list.length})
        </div>
      </div>
      <div className="card__body stack" style={{ gap: 16 }}>
        {list.map((d) => {
          const open = d.status === 'OPEN';
          return (
            <div key={d.id} className={`disc-block ${open ? 'disc-block--open' : ''}`}>
              <div className="row row--between row--wrap" style={{ gap: 8 }}>
                <div>
                  <b>{md.userById(d.reportedBy)?.fullName}</b> (người nhận) báo lúc {formatDateTime(d.reportedAt)}
                </div>
                <span className={`chip ${open ? 'chip--purple' : 'chip--green'}`}>{open ? 'Chờ PHT xử lý' : 'Đã xử lý'}</span>
              </div>
              <div className="disc-block__desc">“{d.description}”</div>

              <div className="table-wrap mt-12">
                <table className="table table--compact">
                  <thead>
                    <tr>
                      <th>Tài sản</th>
                      <th className="center">Cần nhận</th>
                      <th className="center">Thực nhận</th>
                      <th className="center">Trong đó hỏng</th>
                      <th className="center">Vấn đề</th>
                      <th className="center">Tình trạng</th>
                      <th>Ghi chú người nhận</th>
                      <th className="center">Ảnh</th>
                      {d.resolution && <th>PHT quyết định</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {d.lines.map((l) => {
                      const item = itemOf(l.itemId);
                      const decision = d.resolution?.decisions?.find((x) => x.itemId === l.itemId);
                      return (
                        <tr key={l.itemId}>
                          <td>
                            <div className="fw-600">{item?.assetName}</div>
                            <div className="muted text-xs">{item?.assetCode}</div>
                          </td>
                          <td className="center">{l.expectedQuantity ?? l.handoverQuantity}</td>
                          <td className="center fw-600">{l.receivedQuantity}</td>
                          <td className="center">{discrepancyParts(l).damaged}</td>
                          <td className="center">
                            <DiscrepancyParts line={l} />
                          </td>
                          <td className="center">
                            <ConditionBadge value={l.condition} />
                          </td>
                          <td className="text-2">{l.note || '—'}</td>
                          <td className="center">
                            <ImageUploader images={l.images} disabled />
                          </td>
                          {d.resolution && <td>{decision ? decisionText(decision) || '—' : '—'}</td>}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {d.resolution && (
                <div className="alert alert--success mt-12">
                  <CheckCircle2 size={18} />
                  <div>
                    <b>{md.userById(d.resolution.resolvedBy)?.fullName}</b> xử lý lúc {formatDateTime(d.resolution.resolvedAt)}:{' '}
                    {d.resolution.note}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
