/** Danh sách lựa chọn trong hộp AUTH-28: mỗi nút ở chân hộp có một ô nói rõ chọn thì điều gì xảy ra. */
export function SessionChoices({ items }) {
  return (
    <ul className="confirm__choices" aria-label="Các lựa chọn">
      {items.map(({ icon: Icon, title, description, primary }) => (
        <li key={title} className={`confirm__choice ${primary ? 'confirm__choice--primary' : ''}`}>
          <Icon size={20} className="confirm__choice-icon" aria-hidden="true" />
          <div>
            <div className="confirm__choice-title">{title}</div>
            <div className="confirm__choice-desc">{description}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}
