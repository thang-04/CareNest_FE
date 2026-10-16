/** Danh mục lọc bên trái của trang danh sách (loại món, nhóm thực phẩm); dưới 900px chuyển thành hàng cuộn ngang. */
export function CategoryNav({ title, items, value, onChange }) {
  return (
    <nav className="td-cat-nav" aria-label={title}>
      <h3>{title}</h3>
      {items.map((it) => (
        <button key={it.key} type="button" aria-current={value === it.key} onClick={() => onChange(it.key)}>
          {it.label}
          <em>{it.count}</em>
        </button>
      ))}
    </nav>
  );
}
