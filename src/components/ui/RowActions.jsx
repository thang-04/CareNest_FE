import { Link } from 'react-router-dom';
import { Eye, Pencil } from '@/components/ui/icons';
import { RowMenu } from './RowMenu';

const stop = (e) => e.stopPropagation();

function IconAction({ action, icon: Icon, fallback, name }) {
  const text = `${action.label || fallback}${name ? ` ${name}` : ''}`;
  const props = { className: 'icon-btn', 'aria-label': text, title: action.label || fallback, onClick: stop };
  return action.to ? (
    <Link to={action.to} {...props}>
      <Icon size={18} />
    </Link>
  ) : (
    <button
      type="button"
      {...props}
      onClick={(e) => {
        stop(e);
        action.onClick?.();
      }}
    >
      <Icon size={18} />
    </button>
  );
}

/**
 * Chuẩn hành động hàng bảng (DESIGN §6.3): tối đa 2 icon có tooltip + aria-label, mọi thao tác khác và Xóa vào menu "…".
 * view / edit: { to } hoặc { onClick }, tùy chọn { label }. extra: icon thao tác phụ khi dòng chỉ có 1 thao tác phụ,
 * { to | onClick, label, icon } (thay menu chỉ 1 mục). menu: items của RowMenu. name: tên đối tượng cho trình đọc màn hình.
 */
export function RowActions({ view, edit, extra, menu = [], name }) {
  return (
    <div className="row-actions">
      {view && <IconAction action={view} icon={Eye} fallback="Xem" name={name} />}
      {edit && <IconAction action={edit} icon={Pencil} fallback="Sửa" name={name} />}
      {extra && <IconAction action={extra} icon={extra.icon} fallback={extra.label} name={name} />}
      {menu.length > 0 && <RowMenu label={`Thao tác khác${name ? ` ${name}` : ''}`} items={menu} />}
    </div>
  );
}
