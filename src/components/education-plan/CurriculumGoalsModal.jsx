import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download } from '@/components/ui/icons';
import { GoalPicker } from '@/components/education-plan/GoalPicker';
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

export default function CurriculumGoalsModal({ ageGroupId, form, onClose, onImportGoals, onAddContents }) {
  const data = useCurriculum(ageGroupId);
  const [tab, setTab] = useState('goals');
  const [picked, setPicked] = useState(() => new Set());
  const [target, setTarget] = useState('');
  const [domainFilter, setDomainFilter] = useState('');
  const [subFilter, setSubFilter] = useState('');
  const [suggested, setSuggested] = useState(() => new Set());
  const tree = useMemo(() => curriculumTree(data.goals), [data.goals]);
  const targets = useMemo(() => goalTargets(form), [form]);
  const chosenTarget = targets.find((t) => t.id === target);
  const targetTitle = chosenTarget ? `${chosenTarget.domainName} · ${chosenTarget.text}` : undefined;
  const targetDomain = targets.find((t) => t.id === target)?.domainName || '';
  const filterDomain = domainFilter || targetDomain;
  const inDomain = data.contents.filter((c) => !filterDomain || c.domainName === filterDomain);
  const subDomains = [...new Set(inDomain.map((c) => c.subDomain).filter(Boolean))];
  const suggestions = inDomain.filter((c) => !subFilter || c.subDomain === subFilter);
  const source = data.sources[0];
  const ageName = AGE_GROUPS.find((a) => a.id === ageGroupId)?.name || '';

  // Dạng cây của danh sách chọn dùng chung (GoalPicker)
  const pickTree = useMemo(
    () =>
      tree.map((d) => ({
        name: d.name,
        subs: d.subs.map((s) => ({
          key: s.key,
          name: s.name,
          groups: s.groups.map((g) => ({
            key: g.key,
            title: `${g.no ? `${g.no}. ` : ''}${g.text}`,
            goals: g.goals.map((x) => ({ id: x.id, code: x.goalNo, text: x.goalText, contents: x.contents, anchor: `pick-cg-${x.id}` })),
          })),
        })),
      })),
    [tree],
  );

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
        <GoalPicker tree={pickTree} picked={picked} onToggle={toggle} />
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
                  className="select ga-cur-target"
                  value={target}
                  title={targetTitle}
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
