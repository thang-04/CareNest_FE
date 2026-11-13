import { Fragment, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Check, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown } from '@/components/ui/icons';
import { PERMISSION_LEVELS, PERMISSION_TASKS } from '@/models/account/permissionConstants';
import { groupByFlow, permissionFeatureLabel } from '@/utils/account/permissionMatrix';

/**
 * Bảng việc × cột, 2 cấp: luồng lớn (Bán trú, Hồ sơ trẻ…) rồi từng việc nhỏ bằng lời thường kèm ghi chú;
 * việc cần quyền xem thụt vào với "↳".
 * `columns`: [{ key, header, note?, fixed?, render(code), renderFlow?(flow) }] — ô do màn gọi tự vẽ (ô tick, ✓/—, badge);
 * `renderFlow` vẽ ô tổng của dòng luồng (flow = { key, label, codes }), không có thì để trống.
 * `collapsible`: luồng thu gọn mặc định, bấm tên luồng để bung việc nhỏ; ghi chú việc chỉ còn ở tooltip.
 */
export function PermissionTable({ groups, catalog, columns, caption, collapsible = false }) {
  const flows = groupByFlow(groups);
  const [openFlows, setOpenFlows] = useState(() => new Set());
  const isOpen = (key) => !collapsible || openFlows.has(key);
  const allOpen = flows.length > 0 && flows.every((flow) => openFlows.has(flow.key));
  const toggleOpen = (key) =>
    setOpenFlows((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <>
      {collapsible && (
        <div className="perm-table-toolbar">
          <Button
            variant="ghost"
            size="sm"
            icon={allOpen ? ChevronsDownUp : ChevronsUpDown}
            onClick={() => setOpenFlows(allOpen ? new Set() : new Set(flows.map((flow) => flow.key)))}
          >
            {allOpen ? 'Thu gọn tất cả' : 'Mở tất cả việc nhỏ'}
          </Button>
        </div>
      )}
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
            {flows.map((flow) => (
              <Fragment key={flow.key}>
                {/* Cấp 1: luồng lớn; ô tick tổng của cột chỉnh được, tick là tick cả luồng */}
                <tr className={`perm-table__flow${isOpen(flow.key) ? '' : ' is-collapsed'}`}>
                  <th scope="colgroup" className="perm-table__task">
                    {collapsible ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="perm-table__flow-toggle"
                        icon={isOpen(flow.key) ? ChevronDown : ChevronRight}
                        aria-expanded={isOpen(flow.key)}
                        onClick={() => toggleOpen(flow.key)}
                      >
                        {flow.label}
                      </Button>
                    ) : (
                      flow.label
                    )}
                    {flow.codes.length > 1 && <small className="perm-table__note">{flow.codes.length} việc nhỏ bên trong</small>}
                  </th>
                  {columns.map((column) => (
                    <td key={column.key} className={`perm-table__col${column.fixed ? ' perm-table__col--fixed' : ''}`}>
                      {column.renderFlow?.(flow)}
                    </td>
                  ))}
                </tr>
                {isOpen(flow.key) &&
                  flow.groups.map(({ feature, rows }) => (
                    <Fragment key={feature.key}>
                      {/* Cấp 2: nhóm việc; ẩn khi luồng chỉ có 1 nhóm để khỏi lặp tên */}
                      {flow.groups.length > 1 && (
                        <tr className="perm-table__group">
                          <th scope="colgroup" colSpan={columns.length + 1}>
                            {permissionFeatureLabel(feature, catalog)}
                          </th>
                        </tr>
                      )}
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
                              <PermissionLevelBadge level={task?.level} />
                              {task?.label || catalog.find((permission) => permission.code === code)?.description || code}
                              {dependent && <span className="sr-only"> (cần quyền xem của nhóm này)</span>}
                              {task?.hint &&
                                (collapsible ? (
                                  <span className="sr-only">. {task.hint}</span>
                                ) : (
                                  <small className="perm-table__note">{task.hint}</small>
                                ))}
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
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Badge màu cấp quyền (Xem / Thao tác / Duyệt / Quản trị); việc chưa gắn cấp thì không vẽ. */
export function PermissionLevelBadge({ level }) {
  const info = PERMISSION_LEVELS[level];
  if (!info) return null;
  return (
    <span className={`chip chip--${info.tone} perm-level`} title={info.hint}>
      {info.label}
    </span>
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

/**
 * Ô tick tổng của luồng: all = đủ, some = một phần (dấu gạch), none = không; bấm khi chưa đủ ⇒ tick cả luồng.
 * `summary` (vd. "3/5 việc") hiện dưới ô tick; `changed` tô nền khi luồng có việc đổi chưa lưu.
 */
export function PermissionFlowCheckCell({ state, onChange, label, disabled = false, summary, changed = false }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === 'some';
  }, [state]);
  return (
    <label className={`perm-check-cell perm-check-cell--flow${changed ? ' is-changed' : ''}`}>
      <input
        ref={ref}
        type="checkbox"
        checked={state === 'all'}
        disabled={disabled}
        aria-checked={state === 'some' ? 'mixed' : state === 'all'}
        onChange={() => onChange(state !== 'all')}
      />
      <span className="sr-only">{label}</span>
      {summary && <small className="perm-flow-summary">{summary}</small>}
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
