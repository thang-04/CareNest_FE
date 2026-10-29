import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Search } from '@/components/ui/icons';
import { Tabs } from '@/components/ui/Tabs';
import { useCurriculum } from '@/hooks/education-plan/useCurriculum';
import { AGE_GROUPS } from '@/models/education-plan/educationPlanConstants';
import { curriculumSourceLink, curriculumTree, goalTargets } from '@/models/education-plan/curriculum.mjs';
import { EmptyState, Modal, Notice } from '@/components/education-plan/eduUi';
import { ErrorState, LoadingState } from '@/components/ui/States';

/*
 * Lấy mục tiêu từ Chương trình GDMN của Bộ (BE:EDU-28): thẻ Mục tiêu (mục D) chọn từng/nhóm/lĩnh vực/tất cả;
 * thẻ Gợi ý nội dung (mục C) chọn mục tiêu đích trong bản đang soạn rồi tích gợi ý. Chỉ đổi bản đang soạn.
 */

// Tìm không phân biệt hoa thường, dấu
const fold = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/gi, 'd')
    .toLowerCase();

/** Ô chọn có trạng thái chọn một phần (một số mục trong nhóm đã chọn). */
function GroupCheck({ ids, picked, onToggle, label }) {
  const count = ids.filter((id) => picked.has(id)).length;
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={ids.length > 0 && count === ids.length}
      ref={(el) => el && (el.indeterminate = count > 0 && count < ids.length)}
      onChange={() => onToggle(ids)}
    />
  );
}

export default function CurriculumGoalsModal({ ageGroupId, form, onClose, onImportGoals, onAddContents }) {
  const data = useCurriculum(ageGroupId);
  const [tab, setTab] = useState('goals');
  const [picked, setPicked] = useState(() => new Set());
  const [query, setQuery] = useState('');
  const [domainPick, setDomainPick] = useState('');
  const [target, setTarget] = useState('');
  const [domainFilter, setDomainFilter] = useState('');
  const [subFilter, setSubFilter] = useState('');
  const [suggested, setSuggested] = useState(() => new Set());
  const tree = useMemo(() => curriculumTree(data.goals), [data.goals]);
  const targets = useMemo(() => goalTargets(form), [form]);
  const targetDomain = targets.find((t) => t.id === target)?.domainName || '';
  const filterDomain = domainFilter || targetDomain;
  const inDomain = data.contents.filter((c) => !filterDomain || c.domainName === filterDomain);
  const subDomains = [...new Set(inDomain.map((c) => c.subDomain).filter(Boolean))];
  const suggestions = inDomain.filter((c) => !subFilter || c.subDomain === subFilter);
  const source = data.sources[0];
  const ageName = AGE_GROUPS.find((a) => a.id === ageGroupId)?.name || '';
  const allIds = data.goals.map((g) => g.id);

  // Cây đang hiện theo lĩnh vực đã chọn và ô tìm (tìm cả câu mục tiêu, tên nhóm, nội dung con)
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
                  goals: g.goals.filter((x) => !q || fold([x.goalText, g.text, s.name, ...x.contents].join(' ')).includes(q)),
                }))
                .filter((g) => g.goals.length),
            }))
            .filter((s) => s.groups.length),
        }))
        .filter((d) => d.subs.length),
    [tree, domainPick, q],
  );
  const idsOf = (domain) => domain.subs.flatMap((s) => s.groups.flatMap((g) => g.goals.map((x) => x.id)));
  const shownIds = shown.flatMap(idsOf);
  const countOf = (d) => d.subs.reduce((n, s) => n + s.groups.reduce((m, g) => m + g.goals.length, 0), 0);

  const toggle = (ids) => {
    const on = !ids.every((id) => picked.has(id));
    const next = new Set(picked);
    ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
    setPicked(next);
  };
  const toggleSuggestion = (id) => {
    const next = new Set(suggested);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSuggested(next);
  };
  const confirmGoals = () => {
    if (onImportGoals(data.goals.filter((g) => picked.has(g.id)))) onClose();
  };
  const confirmContents = () => {
    if (
      onAddContents(
        target,
        data.contents.filter((c) => suggested.has(c.id)),
      )
    )
      setSuggested(new Set());
  };

  const allShownPicked = shownIds.length > 0 && shownIds.every((id) => picked.has(id));

  return (
    <Modal
      title="Lấy từ Chương trình của Bộ"
      width={1100}
      className="ga-cur-modal"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Đóng
          </button>
          {tab === 'goals' ? (
            <button className="btn btn--primary" disabled={!picked.size} onClick={confirmGoals}>
              <Download size={16} aria-hidden /> Thêm {picked.size || ''} mục tiêu
            </button>
          ) : (
            <button className="btn btn--primary" disabled={!target || !suggested.size} onClick={confirmContents}>
              <Download size={16} aria-hidden /> Thêm {suggested.size || ''} nội dung
            </button>
          )}
        </>
      }
    >
      <div className="ga-cur-meta">
        {ageName && <span className="chip chip--blue">{ageName}</span>}
        {source && (
          <span className="muted text-sm ga-cur-meta__source" title={`${source.title} — ${source.issuer}`}>
            {source.documentNo} · {source.issuedDate?.split('-').reverse().join('/')}
          </span>
        )}
        <Link className="text-sm" to={curriculumSourceLink(ageGroupId)} target="_blank" rel="noopener">
          Đối chiếu
        </Link>
      </div>
      <Tabs
        ariaLabel="Lấy từ Chương trình của Bộ"
        value={tab}
        onChange={setTab}
        items={[
          { key: 'goals', label: 'Mục tiêu', count: data.goals.length || null },
          { key: 'contents', label: 'Gợi ý nội dung', count: data.contents.length || null },
        ]}
      />
      {data.loading ? (
        <LoadingState />
      ) : data.error ? (
        <ErrorState error={data.error} onRetry={data.reload} />
      ) : !data.goals.length && !data.contents.length ? (
        <EmptyState title="Chưa có dữ liệu của Bộ cho nhóm tuổi này" />
      ) : tab === 'goals' ? (
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
            <div className="ga-cur-chips" role="group" aria-label="Lọc theo lĩnh vực">
              {[{ name: '', label: 'Tất cả', n: allIds.length }, ...tree.map((d) => ({ name: d.name, label: d.name, n: countOf(d) }))].map(
                (d) => (
                  <button
                    key={d.name || 'all'}
                    type="button"
                    className={`ga-cur-chip ${domainPick === d.name ? 'is-on' : ''}`}
                    aria-pressed={domainPick === d.name}
                    onClick={() => setDomainPick(d.name)}
                  >
                    {d.label} <span className="ga-cur-chip__n">{d.n}</span>
                  </button>
                ),
              )}
            </div>
            <div className="row row--between gap-2">
              <span className="fw-600" aria-live="polite">
                Đã chọn {picked.size}/{allIds.length} mục tiêu
              </span>
              <button type="button" className="btn btn--sm" disabled={!shownIds.length} onClick={() => toggle(shownIds)}>
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
                    <GroupCheck ids={idsOf(domain)} picked={picked} onToggle={toggle} label={`Chọn cả lĩnh vực ${domain.name}`} />
                    <span>{domain.name}</span>
                  </label>
                  {domain.subs.map((sub) => (
                    <div key={sub.name || '-'} className="ga-cur-sub">
                      {sub.name && <div className="ga-cur-sub__name">{sub.name}</div>}
                      {sub.groups.map((group) => (
                        <div key={group.key} className="ga-cur-group">
                          <label className="ga-cur-group__head">
                            <GroupCheck
                              ids={group.goals.map((g) => g.id)}
                              picked={picked}
                              onToggle={toggle}
                              label={`Chọn cả nhóm ${group.text}`}
                            />
                            <span>
                              {group.no ? `${group.no}. ` : ''}
                              {group.text}
                            </span>
                          </label>
                          {group.goals.map((goal) => (
                            <div key={goal.id} id={`pick-cg-${goal.id}`} className="ga-cur-item">
                              <label className="ga-cur-row">
                                <input type="checkbox" checked={picked.has(goal.id)} onChange={() => toggle([goal.id])} />
                                <span className="ga-cur-row__text">
                                  {goal.goalNo && <span className="ga-goal-code">{goal.goalNo}</span>} {goal.goalText}
                                </span>
                              </label>
                              {goal.contents.length > 0 && (
                                <details className="ga-cur-contents">
                                  <summary className="muted text-sm">{goal.contents.length} nội dung</summary>
                                  <ul className="text-sm">
                                    {goal.contents.map((c) => (
                                      <li key={c}>{c}</li>
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
      ) : (
        <>
          {!targets.length ? (
            <Notice tone="warn">Bản đang soạn chưa có mục tiêu.</Notice>
          ) : (
            <div className="ga-cur-toolbar ga-cur-filters">
              <div className="field">
                <label className="field__label" htmlFor="cur-target">
                  Thêm vào mục tiêu
                </label>
                <select
                  id="cur-target"
                  className="select"
                  value={target}
                  onChange={(e) => {
                    setTarget(e.target.value);
                    setSubFilter('');
                  }}
                >
                  <option value="">Chọn mục tiêu</option>
                  {targets.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.domainName} · {t.text.slice(0, 90)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="field__label" htmlFor="cur-domain">
                  Lĩnh vực
                </label>
                <select
                  id="cur-domain"
                  className="select"
                  value={domainFilter}
                  onChange={(e) => {
                    setDomainFilter(e.target.value);
                    setSubFilter('');
                  }}
                >
                  <option value="">{targetDomain ? `Theo mục tiêu (${targetDomain})` : 'Tất cả lĩnh vực'}</option>
                  {[...new Set(data.contents.map((c) => c.domainName))].map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              {subDomains.length > 0 && (
                <div className="field">
                  <label className="field__label" htmlFor="cur-sub">
                    Lĩnh vực con
                  </label>
                  <select id="cur-sub" className="select" value={subFilter} onChange={(e) => setSubFilter(e.target.value)}>
                    <option value="">Tất cả</option>
                    {subDomains.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
          <div className="ga-cur-list">
            {suggestions.map((c, i) => {
              const head = `${c.subDomain ? `${c.subDomain} › ` : ''}${c.categoryNo ? `${c.categoryNo}. ` : ''}${c.category}`;
              const prev = suggestions[i - 1];
              const showHead = !prev || `${prev.subDomain}|${prev.category}` !== `${c.subDomain}|${c.category}`;
              return (
                <div key={c.id}>
                  {showHead && <div className="ga-cur-sub__name">{head}</div>}
                  <label className="ga-cur-row">
                    <input type="checkbox" disabled={!target} checked={suggested.has(c.id)} onChange={() => toggleSuggestion(c.id)} />
                    <span className="ga-cur-row__text">
                      {c.label && <span className="muted">{c.label}: </span>}
                      {c.text}
                    </span>
                  </label>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Modal>
  );
}
