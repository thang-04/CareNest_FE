import { AssetThumb, ConditionBadge } from '@/components/asset/AssetVisuals';
import { ImageUploader } from '@/components/upload/ImageUploader';
import { expectedReceiveQuantity } from '@/models/facility-transfer/FacilityTransferItem';

/**
 * Read-only asset table. `columns` picks which quantity groups to show:
 * 'document' | 'handover' | 'received' | 'final' | 'image' | 'condition' | 'note'.
 */
export function TransferAssetTable({ items, columns = ['document', 'condition', 'image'] }) {
  const has = (c) => columns.includes(c);
  const visible = items.filter((i) => i.quantity > 0 || i.handoverQuantity);
  const total = (fn) => visible.reduce((s, i) => s + (Number(fn(i)) || 0), 0);
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th className="center" style={{ width: 56 }}>
              STT
            </th>
            <th>Mã tài sản</th>
            <th>Tên tài sản</th>
            <th className="center">Đơn vị</th>
            {has('document') && <th className="center">SL theo phiếu</th>}
            {has('handover') && <th className="center">SL bàn giao</th>}
            {has('received') && <th className="center">SL thực nhận</th>}
            {has('final') && <th className="center">SL hoàn thành</th>}
            {has('condition') && <th className="center">Tình trạng</th>}
            {has('note') && <th>Ghi chú</th>}
            {has('image') && <th className="center">Hình ảnh</th>}
          </tr>
        </thead>
        <tbody>
          {visible.map((item, idx) => (
            <tr key={item.id}>
              <td className="center">{idx + 1}</td>
              <td>{item.assetCode}</td>
              <td>
                {item.assetName}
                {item.cancelledQuantity > 0 && <div className="text-danger text-xs">Đã hủy {item.cancelledQuantity} (lỗi)</div>}
                {item.acceptedQuantity != null && item.acceptedQuantity !== item.quantity && (
                  <div className="text-primary text-xs">Nơi nhận giữ {item.acceptedQuantity} (theo xử lý chênh lệch)</div>
                )}
              </td>
              <td className="center">{item.unit}</td>
              {has('document') && <td className="center fw-600">{item.quantity}</td>}
              {has('handover') && <td className="center">{item.handoverQuantity ?? '—'}</td>}
              {has('received') && <td className="center">{item.receivedQuantity ?? '—'}</td>}
              {has('final') && <td className="center fw-600">{expectedReceiveQuantity(item)}</td>}
              {has('condition') && (
                <td className="center">
                  <ConditionBadge value={item.receivedCondition || item.handoverCondition || item.condition} />
                </td>
              )}
              {has('note') && <td className="text-2">{item.receivedNote || item.handoverNote || '—'}</td>}
              {has('image') && (
                <td className="center">
                  {[...(item.handoverImages || []), ...(item.receivedImages || [])].length ? (
                    <ImageUploader images={[...(item.handoverImages || []), ...(item.receivedImages || [])]} disabled />
                  ) : (
                    <AssetThumb asset={item} size="sm" />
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4} className="right">
              Tổng cộng
            </td>
            {has('document') && <td className="center">{total((i) => i.quantity)}</td>}
            {has('handover') && <td className="center">{total((i) => i.handoverQuantity)}</td>}
            {has('received') && <td className="center">{total((i) => i.receivedQuantity)}</td>}
            {has('final') && <td className="center">{total(expectedReceiveQuantity)}</td>}
            {has('condition') && <td />}
            {has('note') && <td />}
            {has('image') && <td />}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
