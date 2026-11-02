import { useMemo, useState } from 'react';
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

export function GoalPicker({ tree, picked, onToggle, disabled = false }) {
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
        <div className="row row--between gap-2">
          <span className="fw-600" aria-live="polite">
            Đã chọn {tree.reduce((n, d) => n + idsOf(d).filter((id) => picked.has(id)).length, 0)}/{total} mục tiêu
          </span>
          <button type="button" className="btn btn--sm" disabled={!shownIds.length || disabled} onClick={() => onToggle(shownIds)}>
            {allShownPicked ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
          </button>
        </div>
      </div>
      {!shown.length ? (
        <p className="muted">Không có mục tiêu khớp.</p>
      ) : (
        <div className="ga-cur-list">
          {shown.map((domain) => (
            <section key={domain.name} className="ga-cur-domain">
              <label className="ga-cur-domain__head">
                <GroupCheck
                  ids={idsOf(domain)}
                  picked={picked}
                  onToggle={onToggle}
                  disabled={disabled}
                  label={`Chọn cả lĩnh vực ${domain.name}`}
                />
                <span>{domain.name}</span>
              </label>
              {domain.subs.map((sub) => (
                <div key={sub.key || '-'} className="ga-cur-sub">
                  {sub.name && <div className="ga-cur-sub__name">{sub.name}</div>}
                  {sub.groups.map((group) => (
                    <div key={group.key} className="ga-cur-group">
                      {group.title && (
                        <label className="ga-cur-group__head">
                          <GroupCheck
                            ids={group.goals.map((g) => g.id)}
                            picked={picked}
                            onToggle={onToggle}
                            disabled={disabled}
                            label={`Chọn cả nhóm ${group.title}`}
                          />
                          <span>{group.title}</span>
                        </label>
                      )}
                      {group.goals.map((goal) => (
                        <div key={goal.id} id={goal.anchor} className="ga-cur-item">
                          <label className="ga-cur-row">
                            <input type="checkbox" disabled={disabled} checked={picked.has(goal.id)} onChange={() => onToggle([goal.id])} />
                            <span className="ga-cur-row__text">
                              {goal.code && <span className="ga-goal-code">{goal.code}</span>} {goal.text}
                            </span>
                          </label>
                          {goal.contents.length > 0 && (
                            <details className="ga-cur-contents">
                              <summary className="muted text-sm">{goal.contents.length} nội dung</summary>
                              <ul className="text-sm">
                                {goal.contents.map((c, i) => (
                                  <li key={`${i}-${c}`}>{c}</li>
                                ))}
                              </ul>
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
