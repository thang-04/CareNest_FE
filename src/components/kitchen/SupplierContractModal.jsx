import { useEffect, useState } from 'react';
import { Save } from '@/components/ui/icons';
import { Button, Checkbox, EmptyState, FormField, LoadingState, Modal, TextField } from '@/components';
import { DataTable } from '@/components/ui/DataTable';
import { DateInput } from '@/components/form/DateInput';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { Tabs } from '@/components/ui/Tabs';
import { useToast } from '@/contexts/ToastContext';
import { useSuppliers } from '@/hooks/kitchen/useKitchen';
import { applySupplierContract, getSupplierFoods } from '@/services/kitchen/kitchenService';
import { formatMoney, todayInput } from '@/utils/format';

const MODES = [
  { key: 'renew', label: 'Gia hạn nhà cung cấp này' },
  { key: 'takeover', label: 'Nhận thực phẩm từ nhà cung cấp khác' },
];

/**
 * Áp dụng hợp đồng mới cho `supplier` (NUT-27): chọn thực phẩm và giá mới, BE tạo mức giá hiệu lực từ ngày bắt đầu với NCC này
 * và cập nhật hợp đồng trong một lần lưu. Ngày trước ngày bắt đầu giữ NCC và giá cũ.
 */
export function SupplierContractModal({ supplier, onClose, onSaved }) {
  const toast = useToast();
  const { data } = useSuppliers({ status: 'ACTIVE' });
  const suppliers = data || [];
  const [mode, setMode] = useState('renew');
  const [sourceId, setSourceId] = useState('');
  const [head, setHead] = useState({ contractNo: '', contractStart: todayInput(), contractEnd: '' });
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});

  const from = mode === 'renew' ? supplier.id : sourceId;
  useEffect(() => {
    if (!from) {
      setLines([]);
      return undefined;
    }
    let alive = true;
    setLoading(true);
    getSupplierFoods(from, todayInput())
      .then((foods) => alive && setLines(foods.map((f) => ({ ...f, selected: true, newPrice: f.price ?? '' }))))
      .catch((err) => alive && toast.error(err, 'Không tải được thực phẩm của nhà cung cấp'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [from, toast]);

  const setLine = (foodId, patch) => setLines((list) => list.map((l) => (l.foodId === foodId ? { ...l, ...patch } : l)));
  const chosen = lines.filter((l) => l.selected);

  const save = async () => {
    setBusy(true);
    try {
      const saved = await applySupplierContract(supplier.id, {
        ...head,
        lines: chosen.map((l) => ({ foodId: l.foodId, price: l.newPrice })),
      });
      toast.success(`Đã áp dụng hợp đồng cho ${chosen.length} thực phẩm.`);
      onSaved?.(saved);
      onClose();
    } catch (err) {
      if (err.details) setErrors(err.details);
      toast.error(err, 'Không áp dụng được hợp đồng');
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    {
      key: 'selected',
      header: 'Chọn',
      className: 'center',
      render: (l) => (
        <Checkbox checked={l.selected} aria-label={`Chọn ${l.name}`} onChange={(e) => setLine(l.foodId, { selected: e.target.checked })} />
      ),
    },
    {
      key: 'name',
      header: 'Thực phẩm',
      render: (l) => (
        <>
          <span className="fw-600">{l.name}</span> <span className="text-sm muted">{l.code}</span>
        </>
      ),
    },
    { key: 'price', header: 'Giá hiện tại', className: 'money nowrap', render: (l) => `${formatMoney(l.price)} / ${l.purchaseUnit}` },
    {
      key: 'newPrice',
      header: 'Giá mới',
      className: 'money',
      render: (l) => (
        <TextField
          type="number"
          min="0"
          step="500"
          aria-label={`Giá mới ${l.name}`}
          disabled={!l.selected}
          value={l.newPrice}
          onChange={(e) => setLine(l.foodId, { newPrice: e.target.value })}
        />
      ),
    },
  ];
  const others = suppliers.filter((s) => s.id !== supplier.id).map((s) => ({ value: s.id, label: s.name }));
  const ready = head.contractStart && head.contractEnd && chosen.length > 0 && chosen.every((l) => l.newPrice !== '');
  return (
    <Modal
      open
      size="lg"
      title={`Áp dụng hợp đồng mới · ${supplier.name}`}
      onClose={busy ? undefined : onClose}
      closeOnBackdrop={false}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Hủy
          </Button>
          <Button variant="primary" icon={Save} loading={busy} disabled={!ready} onClick={save}>
            Áp dụng cho {chosen.length} thực phẩm
          </Button>
        </>
      }
    >
      <div className="kb-sup-form">
        <Tabs items={MODES} value={mode} onChange={setMode} ariaLabel="Cách áp dụng" variant="pill" />
        <div className="kb-sup-sec__fields">
          <TextField
            label="Số hợp đồng"
            maxLength={50}
            value={head.contractNo}
            error={errors.contractNo}
            onChange={(e) => setHead((h) => ({ ...h, contractNo: e.target.value }))}
          />
          {mode === 'takeover' && (
            <FormField label="Nhà cung cấp cũ" required>
              <SearchSelect options={others} value={sourceId} onChange={setSourceId} placeholder="Chọn nhà cung cấp" searchable />
            </FormField>
          )}
          <FormField label="Ngày bắt đầu (giá mới có hiệu lực)" required error={errors.contractStart}>
            <DateInput value={head.contractStart} min={todayInput()} onChange={(v) => setHead((h) => ({ ...h, contractStart: v }))} />
          </FormField>
          <FormField label="Ngày kết thúc" required error={errors.contractEnd}>
            <DateInput
              value={head.contractEnd}
              min={head.contractStart || undefined}
              onChange={(v) => setHead((h) => ({ ...h, contractEnd: v }))}
            />
          </FormField>
        </div>
        {loading ? (
          <LoadingState />
        ) : lines.length === 0 ? (
          <EmptyState
            title={from ? 'Nhà cung cấp chưa có thực phẩm nào' : 'Chọn nhà cung cấp cũ'}
            description="Thực phẩm lấy theo nhà cung cấp của mức giá đang áp dụng hôm nay."
          />
        ) : (
          <DataTable columns={columns} rows={lines} rowKey="foodId" />
        )}
      </div>
    </Modal>
  );
}
