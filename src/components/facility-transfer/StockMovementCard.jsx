import { ArrowRight, Boxes } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { getTransferStockSnapshot } from '@/services/facility-transfer/transferService';
import { locationLabel } from '@/models/Location';
import { formatDateTime } from '@/utils/format';
import { TRANSFER_STATUS } from '@/models/facility-transfer/transferConstants';
import { expectedReceiveQuantity } from '@/models/facility-transfer/FacilityTransferItem';
import { Spinner } from '@/components/ui/States';

const Flow = ({ before, after, delta }) => (
  <span className="stock-flow">
    <span>{before}</span>
    <ArrowRight size={14} className="muted" />
    <b>{after}</b>
    <span className={delta < 0 ? 'stock-delta stock-delta--minus' : 'stock-delta stock-delta--plus'}>
      {delta < 0 ? delta : `+${delta}`}
    </span>
  </span>
);

/**
 * "Biến động tồn kho": stock is moved when the receiver confirms (COMPLETED):
 * minus at the sending location, plus at the receiving location.
 * Before that, the block shows the expected change from the current stock.
 */
export function StockMovementCard({ transfer: t, md }) {
  const { user } = useAuth();
  const completed = t.status === TRANSFER_STATUS.COMPLETED;
  const cancelled = t.status === TRANSFER_STATUS.CANCELLED;
  const { data: snapshot, loading } = useAsync(() => getTransferStockSnapshot(t.id, user), [t.id, t.updatedAt], {
    enabled: !completed && !cancelled,
  });

  const fromName = locationLabel(md.locationById(t.fromLocationId));
  const toName = locationLabel(md.locationById(t.toLocationId));

  let rows = [];
  if (completed) {
    rows = (t.stockMovements || []).map((m) => ({
      key: m.itemId,
      name: m.assetName,
      code: m.assetCode,
      unit: m.unit,
      qty: m.quantity,
      fromBefore: m.fromBefore,
      fromAfter: m.fromAfter,
      toBefore: m.toBefore,
      toAfter: m.toAfter,
    }));
  } else if (snapshot) {
    rows = t.items
      .filter((i) => i.quantity > 0)
      .map((i) => {
        const s = snapshot.find((x) => x.itemId === i.id) || { fromQuantity: 0, toQuantity: 0 };
        const qty = expectedReceiveQuantity(i);
        return {
          key: i.id,
          name: i.assetName,
          code: i.assetCode,
          unit: i.unit,
          qty,
          fromBefore: s.fromQuantity,
          fromAfter: s.fromQuantity - qty,
          toBefore: s.toQuantity,
          toAfter: s.toQuantity + qty,
        };
      });
  }
  const movedAt = completed ? t.stockMovements?.[0]?.at : null;

  return (
    <div className="card card--soft-header">
      <div className="card__header">
        <div className="card__title">
          <Boxes size={20} /> Biến động tồn kho
        </div>
        <span className={`chip ${completed ? 'chip--green' : cancelled ? 'chip--gray' : 'chip--orange'}`}>
          {completed
            ? `Đã cập nhật ${movedAt ? formatDateTime(movedAt) : ''}`
            : cancelled
              ? 'Không thay đổi'
              : 'Dự kiến – cập nhật khi người nhận xác nhận'}
        </span>
      </div>
      <div className="card__body">
        {cancelled ? (
          <div className="muted">Phiếu đã hủy nên tồn kho hai bên không thay đổi.</div>
        ) : loading && !completed ? (
          <div className="row">
            <Spinner small /> Đang tải tồn kho...
          </div>
        ) : rows.length === 0 ? (
          <div className="muted">Chưa có dữ liệu biến động tồn kho.</div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="table table--compact">
                <thead>
                  <tr>
                    <th>Tài sản</th>
                    <th className="center">Số lượng luân chuyển</th>
                    <th>Nơi giao: {fromName}</th>
                    <th>Nơi nhận: {toName}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key}>
                      <td>
                        <div className="fw-600">{r.name}</div>
                        <div className="muted text-xs">{r.code}</div>
                      </td>
                      <td className="center fw-600">
                        {r.qty} {r.unit}
                      </td>
                      <td>
                        <Flow before={r.fromBefore} after={r.fromAfter} delta={-r.qty} />
                      </td>
                      <td>
                        <Flow before={r.toBefore} after={r.toAfter} delta={r.qty} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="muted mt-8 text-xs">
              {completed
                ? 'Tồn kho đã được trừ ở nơi giao và cộng ở nơi nhận theo số lượng thực nhận.'
                : 'Số lượng đang được giữ chỗ cho phiếu này (không thể dùng cho phiếu khác). Tồn kho chỉ thay đổi khi người nhận bấm “Xác nhận nhận”.'}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
