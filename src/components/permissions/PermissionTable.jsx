import { Fragment } from 'react';
import { Check } from '@/components/ui/icons';
import { PERMISSION_TASKS } from '@/models/account/permissionConstants';
import { permissionFeatureLabel } from '@/utils/account/permissionMatrix';

/**
 * Bảng việc × cột: mỗi dòng một việc bằng lời thường, nhóm theo nghiệp vụ; việc cần quyền xem thụt vào với "↳".
 * `columns`: [{ key, header, note?, fixed?, render(code) }] — ô do màn gọi tự vẽ (ô tick, ✓/—, badge).
 */
export function PermissionTable({ groups, catalog, columns, caption }) {
  return (
    <div className="table-wrap perm-table-wrap">
      <table className="table table--grid table--compact perm-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className="perm-table__task">
              Việc được làm
            </th>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={`perm-table__col${column.fixed ? ' perm-table__col--fixed' : ''}`}>
                {column.header}
                {column.note && <small className="perm-table__note">{column.note}</small>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map(({ feature, rows }) => (
            <Fragment key={feature.key}>
              <tr className="perm-table__group">
                <th scope="colgroup" colSpan={columns.length + 1}>
                  {permissionFeatureLabel(feature, catalog)}
                </th>
              </tr>
              {rows.map(({ code, dependent }) => {
                const task = PERMISSION_TASKS[code];
                return (
                  <tr key={code}>
                    <th scope="row" className={`perm-table__task${dependent ? ' is-dependent' : ''}`} title={task?.hint}>
                      {dependent && (
                        <span className="perm-table__arrow" aria-hidden="true">
                          ↳
                        </span>
                      )}
                      {task?.label || catalog.find((permission) => permission.code === code)?.description || code}
                      {dependent && <span className="sr-only"> (cần quyền xem của nhóm này)</span>}
                    </th>
                    {columns.map((column) => (
                      <td key={column.key} className={`perm-table__col${column.fixed ? ' perm-table__col--fixed' : ''}`}>
                        {column.render(code)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Ô tick phủ cả ô bảng để dễ bấm; `changed` tô nền ô vừa đổi chưa lưu. */
export function PermissionCheckCell({ checked, onChange, label, disabled = false, changed = false }) {
  return (
    <label className={`perm-check-cell${changed ? ' is-changed' : ''}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <span className="sr-only">{label}</span>
    </label>
  );
}

/** Ô không chọn được: ✓ = luôn có, — = không có; lý do ở tooltip và trình đọc màn hình. */
export function PermissionFixedCell({ has, reason }) {
  return (
    <span className={`perm-fixed${has ? ' perm-fixed--on' : ''}`} title={reason}>
      {has ? <Check size={16} aria-hidden="true" /> : <span aria-hidden="true">—</span>}
      <span className="sr-only">
        {has ? 'Có' : 'Không'}
        {reason ? `. ${reason}` : ''}
      </span>
    </span>
  );
}
