import { useState } from 'react';
import { Save } from '@/components/ui/icons';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/form/FormField';
import { TextAreaField, TextField } from '@/components/form/Field';
import { DateInput } from '@/components/form/DateInput';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { useToast } from '@/contexts/ToastContext';
import { adjustFoodPrice, updateFoodPrice } from '@/services/menu-planning/menuPlanningService';
import { todayInput } from '@/utils/format';

/**
 * Điều chỉnh giá có ngày hiệu lực (NUT-27): thêm mức mới hoặc sửa mức chưa tới ngày. BE kiểm ngày, trùng ngày và lý do
 * khi ngày nằm trong hạn hợp đồng; lỗi hiện tại ô.
 */
export function FoodPriceModal({ food, row, suppliers, onSaved, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState({
    supplierId: row?.supplierId ?? food.supplierId ?? '',
    price: row?.price ?? food.unitPrice ?? '',
    effectiveFrom: row?.effectiveFrom ?? todayInput(),
    reason: row?.reason ?? '',
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors(({ [k]: _drop, ...rest }) => rest);
  };

  const save = async () => {
    setBusy(true);
    try {
      const saved = row ? await updateFoodPrice(food.id, row.id, form) : await adjustFoodPrice(food.id, form);
      toast.success('Đã lưu mức giá.');
      onSaved?.(saved);
    } catch (err) {
      if (err.details) setErrors(err.details);
      toast.error(err, 'Không lưu được mức giá');
    } finally {
      setBusy(false);
    }
  };

  const options = suppliers.map((s) => ({ value: s.id, label: s.name }));
  return (
    <Modal
      open
      size="md"
      title={`${row ? 'Sửa mức giá' : 'Điều chỉnh giá'} · ${food.name}`}
      onClose={busy ? undefined : onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Hủy
          </Button>
          <Button variant="primary" icon={Save} loading={busy} disabled={form.price === '' || !form.effectiveFrom} onClick={save}>
            Lưu mức giá
          </Button>
        </>
      }
    >
      <p className="text-sm muted mb-16">
        Ngày trước ngày hiệu lực vẫn tính giá cũ. Đổi giá trong thời hạn hợp đồng của nhà cung cấp cần ghi lý do (phụ lục hợp đồng).
      </p>
      {errors._form && (
        <div className="alert alert--danger mb-16" role="alert">
          {errors._form}
        </div>
      )}
      <div className="td-food-grid">
        <FormField label="Nhà cung cấp" error={errors.supplierId}>
          <SearchSelect
            options={options}
            value={form.supplierId}
            onChange={(v) => set('supplierId', v)}
            placeholder="Chưa gán nhà cung cấp"
            searchable
          />
        </FormField>
        <FormField label={`Giá (đ / ${food.purchaseUnit || 'đơn vị mua'})`} required error={errors.price}>
          <TextField type="number" min="0" step="500" className="input" value={form.price} onChange={(e) => set('price', e.target.value)} />
        </FormField>
        <FormField label="Ngày hiệu lực" required error={errors.effectiveFrom}>
          <DateInput value={form.effectiveFrom} min={todayInput()} onChange={(v) => set('effectiveFrom', v)} />
        </FormField>
        <FormField label="Lý do" error={errors.reason} className="td-span-all">
          <TextAreaField
            className="input"
            rows={2}
            maxLength={300}
            value={form.reason}
            placeholder="Vd. Phụ lục 02 – điều chỉnh giá theo thị trường"
            onChange={(e) => set('reason', e.target.value)}
          />
        </FormField>
      </div>
    </Modal>
  );
}
