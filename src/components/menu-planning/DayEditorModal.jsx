import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { DayBalanceView } from '@/components/menu-planning/DayBalanceView';

/**
 * Modal to "Sửa ngày" của Kế hoạch tuần (user chốt 09/11/2026: sửa nhiều thì mở modal to). Sửa trên bản sao món của khối trong
 * ngày; "Áp dụng vào tuần" chỉ đổi bản nháp của tuần, việc lưu vẫn ở nút Lưu nháp của trang. `editable` false ⇒ chỉ xem.
 */
export function DayEditorModal({ title, initialItems, editable, balanceTo, applyLabel = 'Áp dụng vào tuần', onApply, onClose, ...view }) {
  const [items, setItems] = useState(initialItems);
  const changed = JSON.stringify(items) !== JSON.stringify(initialItems);

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
    </Modal>
  );
}
