import { Link } from 'react-router-dom';
import { CalendarDays, NotebookPen, Sun } from '@/components/ui/icons';
import { Modal } from '@/components/ui/Modal';
import { TEMPLATE_KIND, TEMPLATE_KIND_LABELS } from '@/utils/menu-planning/menuTemplateGrid';

const KINDS = [
  { kind: TEMPLATE_KIND.DAY, icon: Sun, hint: 'Món của một ngày, điền được vào bất kỳ ngày nào trong tuần.' },
  { kind: TEMPLATE_KIND.WEEK, icon: CalendarDays, hint: 'Món từ Thứ Hai đến Thứ Sáu của một tuần.' },
  { kind: TEMPLATE_KIND.MONTH, icon: NotebookPen, hint: 'Bộ 4 tuần, mỗi tuần từ Thứ Hai đến Thứ Sáu.' },
];

/** Chọn loại mẫu trước khi vào trang tạo: mỗi loại một thẻ, bấm mở trang tạo đúng loại đó. */
export function TemplateKindModal({ onClose }) {
  return (
    <Modal open size="md" title="Tạo mẫu thực đơn" onClose={onClose}>
      <div className="td-kind-list">
        {KINDS.map(({ kind, icon: Icon, hint }) => (
          <Link key={kind} className="td-kind" to={`/menu/templates/new?kind=${kind}`}>
            <span className="td-kind__icon" aria-hidden="true">
              <Icon size={22} />
            </span>
            <span className="td-kind__text">
              <b>{TEMPLATE_KIND_LABELS[kind]}</b>
              <span className="text-sm muted">{hint}</span>
            </span>
          </Link>
        ))}
      </div>
    </Modal>
  );
}
