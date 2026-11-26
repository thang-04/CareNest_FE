import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Sparkles } from '@/components/ui/icons';
import { DayBalanceView } from '@/components/menu-planning/DayBalanceView';
import { MenuAiSwapModal } from '@/components/menu-planning/MenuAiSwapModal';
import { fixOptions, swapDish } from '@/utils/menu-planning/menuAiDraft';

/**
 * Modal to "Sửa ngày" của Kế hoạch tuần (user chốt 09/11/2026: sửa nhiều thì mở modal to). Sửa trên bản sao món của khối trong
 * ngày; "Áp dụng vào tuần" chỉ đổi bản nháp của tuần, việc lưu vẫn ở nút Lưu nháp của trang. `editable` false ⇒ chỉ xem.
 */
export function DayEditorModal({
  title,
  initialItems,
  editable,
  balanceTo,
  applyLabel = 'Áp dụng vào tuần',
  aiSwap,
  onApply,
  onClose,
  ...view
}) {
  const [items, setItems] = useState(initialItems);
  const [swapOpen, setSwapOpen] = useState(false);
  const changed = JSON.stringify(items) !== JSON.stringify(initialItems);
  // BE chỉ thay món đang có trong thực đơn đã lưu: món vừa thêm hoặc vừa đổi trong bảng chưa thay bằng AI được
  const swapOptions = aiSwap
    ? fixOptions({ days: [{ date: view.date, items: initialItems.filter((i) => items.includes(i)) }] }, aiSwap.block)
    : [];

  return (
    <Modal
      open
      size="full"
      title={title}
      onClose={onClose}
      footer={
        <>
          {balanceTo && (
            <Link className="btn btn--ghost" to={balanceTo}>
              Mở ở Cân đối khẩu phần
            </Link>
          )}
          {editable && aiSwap && swapOptions.length > 0 && (
            <Button onClick={() => setSwapOpen(true)}>
              <Sparkles size={16} /> AI gợi ý món thay
            </Button>
          )}
          <span className="td-grow" />
          <Button onClick={onClose}>{editable ? 'Hủy' : 'Đóng'}</Button>
          {editable && (
            <Button variant="primary" disabled={!changed} onClick={() => onApply(items)}>
              {applyLabel}
            </Button>
          )}
        </>
      }
    >
      <DayBalanceView {...view} dayTitle={title} items={items} onChange={editable ? setItems : undefined} />
      {aiSwap && (
        <MenuAiSwapModal
          open={swapOpen}
          onClose={() => setSwapOpen(false)}
          block={aiSwap.block}
          weekStart={aiSwap.weekStart}
          date={view.date}
          options={swapOptions}
          onUse={(target, draft) => setItems((current) => swapDish(current, target, draft))}
        />
      )}
    </Modal>
  );
}
