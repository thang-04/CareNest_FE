import { useId, useMemo, useState } from 'react';
import { Search } from '@/components/ui/icons';

/*
 * Danh sách chọn mục tiêu dùng chung cho hộp "Lấy từ Chương trình của Bộ" và "Lấy từ kế hoạch có sẵn": ô tìm, chip lĩnh
 * vực, cây lĩnh vực → lĩnh vực con → nhóm kết quả mong đợi → mục tiêu (chọn từng / cả nhóm / cả lĩnh vực / tất cả).
 * tree: [{ name, subs: [{ key, name, groups: [{ key, title, goals: [{ id, code, text, contents: [string], anchor }] }] }] }]
 */

// Tìm không phân biệt hoa thường, dấu
const fold = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/gi, 'd')
    .toLowerCase();

const idsOf = (domain) => domain.subs.flatMap((s) => s.groups.flatMap((g) => g.goals.map((x) => x.id)));

/** Ô chọn có trạng thái chọn một phần (một số mục trong nhóm đã chọn). */
function GroupCheck({ ids, picked, onToggle, label, disabled }) {
  const count = ids.filter((id) => picked.has(id)).length;
  return (
    <input
      type="checkbox"
      aria-label={label}
      disabled={disabled}
      checked={ids.length > 0 && count === ids.length}
      ref={(el) => el && (el.indeterminate = count > 0 && count < ids.length)}
      onChange={() => onToggle(ids)}
    />
  );
}

// Nhãn loại cấp lĩnh vực con, nhóm kết quả; mục tiêu nhận ra qua mã MT như bảng mục tiêu (Tiền 03/11)
const KIND_LABELS = { sub: 'Lĩnh vực con', group: 'Kết quả mong đợi' };
const Kind = ({ label, tone }) => <span className={`ga-cur-kind ga-cur-kind--${tone}`}>{label}</span>;

/** readOnly: chỉ xem (trang Nguồn chương trình của Bộ) — cùng giao diện, không ô tích / chọn tất cả. */
/** contentPicked + onToggleContent: tích từng nội dung đi kèm (khóa `${goalId}:${index}`); không truyền thì chỉ xem nội dung. */
/**
 * droppedSubs + onToggleSub (Tiền 05/11): ô tích ở lĩnh vực con. Chọn mục tiêu thì lĩnh vực con tự tích; bỏ tích lĩnh vực con
 * để chỉ lấy mục tiêu (không lấy lĩnh vực con). Khóa lĩnh vực con: `${tên lĩnh vực}|${sub.key}`.
 */
export function GoalPicker({
  tree,
  picked = new Set(),
  onToggle,
  disabled = false,
  kindLabels = KIND_LABELS,
  readOnly = false,
  contentPicked,
  onToggleContent,
  droppedSubs,
  onToggleSub,
}) {
  const pickSubs = !readOnly && droppedSubs instanceof Set && typeof onToggleSub === 'function';
  const scopeId = useId();
  const pickContents = !readOnly && contentPicked instanceof Set && typeof onToggleContent === 'function';
  const [query, setQuery] = useState('');
  const [domainPick, setDomainPick] = useState('');
  const q = fold(query.trim());
  const shown = useMemo(
    () =>
      tree
        .filter((d) => !domainPick || d.name === domainPick)
        .map((d) => ({
          ...d,
          subs: d.subs
            .map((s) => ({
              ...s,
              groups: s.groups
                .map((g) => ({
                  ...g,
                  goals: g.goals.filter((x) => !q || fold([x.text, g.title, s.name, ...x.contents].join(' ')).includes(q)),
                }))
                .filter((g) => g.goals.length),
            }))
            .filter((s) => s.groups.length),
        }))
        .filter((d) => d.subs.length),
    [tree, domainPick, q],
  );
  const total = tree.reduce((n, d) => n + idsOf(d).length, 0);
  const shownIds = shown.flatMap(idsOf);
  const allShownPicked = shownIds.length > 0 && shownIds.every((id) => picked.has(id));
  const chips = [{ name: '', label: 'Tất cả', n: total }, ...tree.map((d) => ({ name: d.name, label: d.name, n: idsOf(d).length }))];

  return (
    <>
      <div className="ga-cur-toolbar">
        <label className="ga-cur-search">
          <Search size={16} aria-hidden />
          <input
            type="search"
            className="input"
            placeholder="Tìm mục tiêu"
            aria-label="Tìm mục tiêu"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        {tree.length > 1 && (
          <div className="ga-cur-chips" role="group" aria-label="Lọc theo lĩnh vực">
            {chips.map((d) => (
              <button
                key={d.name || 'all'}
                type="button"
                className={`ga-cur-chip ${domainPick === d.name ? 'is-on' : ''}`}
                aria-pressed={domainPick === d.name}
                onClick={() => setDomainPick(d.name)}
              >
                {d.label} <span className="ga-cur-chip__n">{d.n}</span>
              </button>
            ))}
          </div>
        )}
        {!readOnly && (
          <div className="ga-cur-selection">
            <div>
              <p className="fw-600" aria-live="polite">
                Đã chọn {tree.reduce((n, d) => n + idsOf(d).filter((id) => picked.has(id)).length, 0)}/{total} mục tiêu
              </p>
              <p className="muted text-sm" id={scopeId}>
                Chọn tất cả áp dụng cho {shownIds.length} mục tiêu đang hiển thị.
              </p>
            </div>
            <button
              type="button"
              className="btn btn--outline-primary btn--sm"
              aria-describedby={scopeId}
              disabled={!shownIds.length || disabled}
              onClick={() => onToggle(shownIds)}
            >
              {allShownPicked ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
            </button>
          </div>
        )}
      </div>
      {!shown.length ? (
        <p className="muted" role="status">
          Không có mục tiêu khớp.
        </p>
      ) : (
        <div className="ga-cur-list">
          {shown.map((domain) => (
            <section key={domain.name} className="ga-cur-domain">
              <label className="ga-cur-domain__head">
                {!readOnly && (
                  <GroupCheck
                    ids={idsOf(domain)}
                    picked={picked}
                    onToggle={onToggle}
                    disabled={disabled}
                    label={`Chọn cả lĩnh vực ${domain.name}`}
                  />
                )}
                <span>{domain.name}</span>
              </label>
              {domain.subs.map((sub) => (
                <div key={sub.key || '-'} className="ga-cur-sub">
                  {sub.name &&
                    (pickSubs ? (
                      <label className="ga-cur-sub__name">
                        <input
                          type="checkbox"
                          disabled={disabled}
                          aria-label={`Lấy cả lĩnh vực con ${sub.name}`}
                          checked={
                            sub.groups.some((g) => g.goals.some((x) => picked.has(x.id))) && !droppedSubs.has(`${domain.name}|${sub.key}`)
                          }
                          onChange={() =>
                            onToggleSub(
                              `${domain.name}|${sub.key}`,
                              sub.groups.flatMap((g) => g.goals.map((x) => x.id)),
                            )
                          }
                        />
                        <Kind label={kindLabels.sub} tone="sub" />
                        {sub.name}
                      </label>
                    ) : (
                      <div className="ga-cur-sub__name">
                        <Kind label={kindLabels.sub} tone="sub" />
                        {sub.name}
                      </div>
                    ))}
                  {sub.groups.map((group) => (
                    <div key={group.key} className="ga-cur-group">
                      {group.title && (
                        <label className="ga-cur-group__head">
                          {!readOnly && (
                            <GroupCheck
                              ids={group.goals.map((g) => g.id)}
                              picked={picked}
                              onToggle={onToggle}
                              disabled={disabled}
                              label={`Chọn cả nhóm ${group.title}`}
                            />
                          )}
                          <span>
                            <Kind label={kindLabels.group} tone="group" />
                            {group.title}
                          </span>
                        </label>
                      )}
                      {group.goals.map((goal) => (
                        <div key={goal.id} id={goal.anchor} className="ga-cur-item">
                          <label className="ga-cur-row">
                            {!readOnly && (
                              <input
                                type="checkbox"
                                disabled={disabled}
                                checked={picked.has(goal.id)}
                                onChange={() => onToggle([goal.id])}
                              />
                            )}
                            <span className="ga-cur-row__text">
                              {goal.code && <span className="ga-goal-code">{goal.code}</span>} {goal.text}
                            </span>
                          </label>
                          {goal.contents.length > 0 && (
                            <details className="ga-cur-contents">
                              <summary className="text-sm">
                                {goal.contents.length} nội dung đi kèm
                                {pickContents &&
                                  ` · đã chọn ${goal.contents.filter((_, i) => contentPicked.has(`${goal.id}:${i}`)).length}`}
                              </summary>
                              {pickContents ? (
                                <div className="text-sm">
                                  {goal.contents.map((c, i) => (
                                    <label key={`${i}-${c}`} className="ga-cur-row">
                                      <input
                                        type="checkbox"
                                        disabled={disabled}
                                        checked={contentPicked.has(`${goal.id}:${i}`)}
                                        onChange={() => onToggleContent(goal.id, i)}
                                      />
                                      <span>{c}</span>
                                    </label>
                                  ))}
                                </div>
                              ) : (
                                <ul className="text-sm">
                                  {goal.contents.map((c, i) => (
                                    <li key={`${i}-${c}`}>{c}</li>
                                  ))}
                                </ul>
                              )}
                            </details>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </>
  );
}
