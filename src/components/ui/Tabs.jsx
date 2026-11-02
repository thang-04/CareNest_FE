/**
 * Thanh tab dùng chung (DESIGN §6.3, §14.1): class `.tabs` / `.tab`, có số đếm tùy chọn.
 * items: [{ key, label, count? }]; value: key đang chọn; onChange(key).
 */
export function Tabs({ items, value, onChange, ariaLabel }) {
  return (
    <div className="tabs" role="tablist" aria-label={ariaLabel}>
      {items.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={value === t.key}
          className={`tab ${value === t.key ? 'tab--active' : ''}`}
          onClick={() => onChange(t.key)}
        >
          {t.label}
          {t.count != null && <span className="tab__count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
