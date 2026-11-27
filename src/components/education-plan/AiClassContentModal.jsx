import { useState } from 'react';
import { Sparkles } from '@/components/ui/icons';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextAreaField } from '@/components/form/Field';
import { Notice } from '@/components/education-plan/eduUi';
import { cardText } from '@/models/education-plan/classPlan';

const SITUATION_MAX = 500;

/**
 * BE:EDU-115: ghi tình hình lớp (không bắt buộc) trước khi AI viết lại nội dung. Nêu trước các thẻ hoạt động sẽ bị xóa nếu
 * giữ bản AI. `scopeLabel` mô tả phạm vi (tất cả / một mục tiêu / một dòng).
 */
export function AiClassContentModal({ scopeLabel, lostCards, usedCellsOf, busy, onSubmit, onClose }) {
  const [situation, setSituation] = useState('');
  return (
    <Modal
      open
      title="AI viết lại nội dung"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" icon={Sparkles} loading={busy} onClick={() => onSubmit(situation.trim())}>
            Tạo nội dung
          </Button>
        </>
      }
    >
      <div className="stack">
        <p className="muted text-sm">Phạm vi: {scopeLabel}. Nội dung AI sẽ thay nội dung cũ trong phạm vi này; bấm ✗ để trả lại dòng cũ.</p>
        <TextAreaField
          label="Tình hình lớp (không bắt buộc)"
          hint="Không ghi tên trẻ. Để trống thì AI chọn lại nội dung theo chương trình và kho tham khảo."
          rows={4}
          maxLength={SITUATION_MAX}
          value={situation}
          onChange={(e) => setSituation(e.target.value)}
        />
        {lostCards.length > 0 && (
          <Notice>
            <span>Giữ bản AI thì các thẻ hoạt động sau bị xóa:</span>
            <ul>
              {lostCards.map((c) => (
                <li key={c.id}>
                  {cardText(c)}
                  {usedCellsOf(c.id) > 0 && ` (đang xếp ở ${usedCellsOf(c.id)} ô kế hoạch tuần)`}
                </li>
              ))}
            </ul>
          </Notice>
        )}
      </div>
    </Modal>
  );
}
