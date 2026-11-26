/**
 * Thông tin nhãn – giá trị dạng kẻ ô như bảng: hai cặp mỗi hàng, `wide` chiếm cả hàng.
 * Số mục không `wide` đứng liền nhau nên chẵn để không hở ô.
 */
export function InfoGrid({ items }) {
  return (
    <dl className="td-info-grid">
      {items.map((it) => (
        <div key={it.label} className={`td-info-grid__item ${it.wide ? 'td-info-grid__item--wide' : ''}`}>
          <dt>{it.label}</dt>
          <dd>{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
