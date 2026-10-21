import { useState } from 'react';
import { PackageCheck } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { ConfirmationModal, Spinner } from '@/components';
import { fmtQty } from '@/components/kitchen/KitchenFilters';
import { allocateIssueLots } from '@/services/kitchen/kitchenService';
import { formatDate } from '@/utils/format';

const r3 = (n) => Math.round(n * 1000) / 1000;
const keyOf = (foodId, lotId) => `${foodId}|${lotId}`;

/**
 * Bếp chọn lô cho phiếu xuất đang chờ chọn lô (BA): nhập lượng lấy từ từng lô, lô hết hạn không chọn được.
 * Đủ lượng mọi dòng thì gửi; hệ thống kiểm tra lại và ghi xuất một lần.
 */
export function IssueLotAllocation({ issue, onPosted }) {
  const { user } = useAuth();
  const toast = useToast();
  const [qty, setQty] = useState({});
  const [errors, setErrors] = useState({});
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);

  const picked = (it) => r3(it.lots.reduce((n, l) => n + (Number(qty[keyOf(it.foodId, l.id)]) || 0), 0));
  const ready = issue.items.every((it) => picked(it) === r3(it.requiredQty));

  // Gợi ý: lô hạn gần lấy trước; bếp vẫn sửa được từng ô
  const fillByExpiry = () => {
    const next = {};
    issue.items.forEach((it) => {
      let left = it.requiredQty;
      it.lots
        .filter((l) => l.usable)
        .forEach((l) => {
          const take = r3(Math.min(left, l.qty));
          left = r3(left - take);
          if (take > 0) next[keyOf(it.foodId, l.id)] = String(take);
        });
    });
    setQty(next);
    setErrors({});
  };

  const save = async () => {
    setSaving(true);
    try {
      const allocations = Object.fromEntries(
        issue.items.map((it) => [
          it.foodId,
          it.lots.map((l) => ({ lotId: l.id, qty: Number(qty[keyOf(it.foodId, l.id)]) || 0 })).filter((p) => p.qty > 0),
        ]),
      );
      await allocateIssueLots({ id: issue.id, allocations }, user);
      toast.success(`Đã ghi xuất phiếu ${issue.code} và trừ tồn theo lô đã chọn.`);
      onPosted?.();
    } catch (err) {
      if (err.details) setErrors(err.details);
      toast.error(err.message || 'Không ghi xuất được. Vui lòng thử lại.', 'Chưa ghi xuất');
    } finally {
      setSaving(false);
      setConfirming(false);
    }
  };

  return (
    <div className="kb-stack">
      <div className="row row--between">
        <span className="text-sm muted">Nhập lượng lấy từ từng lô cho đủ lượng cần xuất.</span>
        <button type="button" className="btn btn--sm" onClick={fillByExpiry} disabled={saving}>
          Điền theo hạn gần trước
        </button>
      </div>
      {issue.items.map((it) => {
        const sum = picked(it);
        const err = errors[`items.${it.foodId}`];
        return (
          <div key={it.foodId} className="kb-alloc">
            <div className="row row--between">
              <b>{it.name}</b>
              <span className={`text-sm ${sum === r3(it.requiredQty) ? 'muted' : 'kb-short'}`}>
                Đã chọn {fmtQty(sum)} / cần {fmtQty(it.requiredQty)} {it.unit}
              </span>
            </div>
            <div className="table-wrap">
              <table className="table table--grid table--compact">
                <thead>
                  <tr>
                    <th>Số lô</th>
                    <th>Hạn dùng</th>
                    <th className="num">Tồn lô</th>
                    <th className="num">Lấy</th>
                  </tr>
                </thead>
                <tbody>
                  {it.lots.map((l) => (
                    <tr key={l.id} className={l.usable ? undefined : 'kb-row--short'}>
                      <td>{l.lotNo || <span className="muted">Tồn đầu kỳ</span>}</td>
                      <td className="nowrap">{l.expiryDate ? formatDate(l.expiryDate) : '—'}</td>
                      <td className="num">{fmtQty(l.qty)}</td>
                      <td className="num">
                        {l.usable ? (
                          <input
                            type="number"
                            min="0"
                            step="any"
                            max={l.qty}
                            className="input kb-num"
                            value={qty[keyOf(it.foodId, l.id)] || ''}
                            onChange={(e) => {
                              setQty((q) => ({ ...q, [keyOf(it.foodId, l.id)]: e.target.value }));
                              setErrors((x) => ({ ...x, [`items.${it.foodId}`]: undefined }));
                            }}
                            aria-label={`Lượng lấy từ lô ${l.lotNo || 'tồn đầu kỳ'} của ${it.name}`}
                          />
                        ) : (
                          <span className="kb-short text-sm">Hết hạn</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {err && <div className="field__error">{err}</div>}
          </div>
        );
      })}
      <div className="row">
        <button type="button" className="btn btn--primary" onClick={() => setConfirming(true)} disabled={!ready || saving}>
          {saving ? <Spinner small /> : <PackageCheck size={16} />} Ghi xuất kho
        </button>
      </div>
      <ConfirmationModal
        open={confirming}
        title="Ghi xuất kho theo lô đã chọn?"
        message="Hệ thống trừ tồn từng lô đúng một lần. Phiếu đã ghi xuất không sửa được."
        confirmLabel="Ghi xuất kho"
        onConfirm={save}
        onClose={() => setConfirming(false)}
      />
    </div>
  );
}
