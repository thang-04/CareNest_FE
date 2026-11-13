import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '@/components/ui/Modal';
import { DayBalanceView } from '@/components/menu-planning/DayBalanceView';

/**
 * Modal to "Sửa ngày" của Kế hoạch tuần (user chốt 09/11/2026: sửa nhiều thì mở modal to). Sửa trên bản sao món của khối trong
 * ngày; "Áp dụng vào tuần" chỉ đổi bản nháp của tuần, việc lưu vẫn ở nút Lưu nháp của trang. `editable` false ⇒ chỉ xem.
 */
export function DayEditorModal({ title, initialItems, editable, balanceTo, onApply, onClose, ...view }) {
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
          <button type="button" className="btn" onClick={onClose}>
            {editable ? 'Hủy' : 'Đóng'}
          </button>
          {editable && (
            <button type="button" className="btn btn--primary" disabled={!changed} onClick={() => onApply(items)}>
              Áp dụng vào tuần
            </button>
          )}
        </>
      }
    >
      <DayBalanceView {...view} dayTitle={title} items={items} onChange={editable ? setItems : undefined} />
    </Modal>
  );
}
