import { Fragment } from 'react';

/**
 * Nhãn – giá trị chia đôi theo cột trên màn rộng (`.info-columns--2`, màn ≤1280px về 1 cột). rows: [{ key, label, value,
 * className }]; phần tử null/false bị bỏ qua, nửa đầu ở cột trái.
 */
export function SplitInfoList({ rows }) {
  const list = rows.filter(Boolean);
  const half = Math.ceil(list.length / 2);
  return (
    <div className="info-columns info-columns--2">
      {[list.slice(0, half), list.slice(half)]
        .filter((part) => part.length > 0)
        .map((part, i) => (
          <dl key={i} className="info-list">
            {part.map((r) => (
              <Fragment key={r.key}>
                <dt>{r.label}</dt>
                <dd className={r.className}>{r.value}</dd>
              </Fragment>
            ))}
          </dl>
        ))}
    </div>
  );
}
