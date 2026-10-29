import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download } from '@/components/ui/icons';
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
  const targetDomain = targets.find((t) => t.id === target)?.domainName || '';
  const filterDomain = domainFilter || targetDomain;
  const inDomain = data.contents.filter((c) => !filterDomain || c.domainName === filterDomain);
  const subDomains = [...new Set(inDomain.map((c) => c.subDomain).filter(Boolean))];
  const suggestions = inDomain.filter((c) => !subFilter || c.subDomain === subFilter);
  const source = data.sources[0];
  const ageName = AGE_GROUPS.find((a) => a.id === ageGroupId)?.name || '';
  const allIds = data.goals.map((g) => g.id);

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

  const sourceNote = source && (
    <p className="muted text-xs">
      Nguồn: {source.title} số {source.documentNo} ngày {source.issuedDate?.split('-').reverse().join('/')} của {source.issuer} ·{' '}
      <Link to={curriculumSourceLink(ageGroupId)} target="_blank" rel="noopener">
        Xem trang nguồn để đối chiếu
      </Link>
    </p>
  );

  return (
    <Modal
      title="Lấy từ Chương trình của Bộ"
      width={820}
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
      <p className="muted text-sm">
        {ageName} · Mục tiêu và nội dung lấy nguyên văn; thêm vào cuối, bỏ qua mục đã có. Chưa ghi lên hệ thống cho tới khi bấm Lưu.
      </p>
      {sourceNote}
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
          <div className="row row--between">
            <span className="fw-600" aria-live="polite">
              Đã chọn {picked.size}/{allIds.length} mục tiêu
            </span>
            <button type="button" className="btn btn--sm" onClick={() => toggle(allIds)}>
              {allIds.length > 0 && picked.size === allIds.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
            </button>
          </div>
          <div className="ga-pick-list">
            {tree.map((domain) => {
              const domainIds = domain.subs.flatMap((s) => s.groups.flatMap((g) => g.goals.map((x) => x.id)));
              return (
                <div key={domain.name} className="mb-8">
                  <label className="ga-goal-check ga-goal-check--head">
                    <input type="checkbox" checked={domainIds.every((id) => picked.has(id))} onChange={() => toggle(domainIds)} />
                    <span className="fw-600">{domain.name}</span>
                  </label>
                  {domain.subs.map((sub) =>
                    sub.groups.map((group) => {
                      const groupIds = group.goals.map((g) => g.id);
                      return (
                        <div key={`${sub.name}-${group.key}`}>
                          <label className="ga-goal-check ga-goal-check--child">
                            <input
                              type="checkbox"
                              aria-label={`Chọn cả nhóm ${group.text}`}
                              checked={groupIds.every((id) => picked.has(id))}
                              onChange={() => toggle(groupIds)}
                            />
                            <span className="muted text-xs">
                              {[sub.name, `${group.no ? `${group.no}. ` : ''}${group.text}`].filter(Boolean).join(' › ')}
                            </span>
                          </label>
                          {group.goals.map((goal) => (
                            <div key={goal.id} id={`pick-cg-${goal.id}`}>
                              <label className="ga-goal-check ga-goal-check--child">
                                <input type="checkbox" checked={picked.has(goal.id)} onChange={() => toggle([goal.id])} />
                                {goal.goalNo && <span className="ga-goal-code">{goal.goalNo}</span>}
                                <span className="text-sm">{goal.goalText}</span>
                              </label>
                              {goal.contents.length > 0 && (
                                <ul className="muted text-sm">
                                  {goal.contents.map((c) => (
                                    <li key={c}>{c}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    }),
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <>
          {!targets.length ? (
            <Notice tone="warn">Bản đang soạn chưa có mục tiêu. Thêm mục tiêu trước rồi mới gắn gợi ý nội dung.</Notice>
          ) : (
            <div className="grid-2 gap-3">
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
                  Lĩnh vực của gợi ý
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
                    <option value="">Tất cả lĩnh vực con</option>
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
          <p className="fw-600" aria-live="polite">
            Đã chọn {suggested.size} gợi ý
          </p>
          <div className="ga-pick-list">
            {suggestions.map((c, i) => {
              const head = `${c.subDomain ? `${c.subDomain} › ` : ''}${c.categoryNo ? `${c.categoryNo}. ` : ''}${c.category}`;
              const prev = suggestions[i - 1];
              const showHead = !prev || `${prev.subDomain}|${prev.category}` !== `${c.subDomain}|${c.category}`;
              return (
                <div key={c.id}>
                  {showHead && <p className="muted text-xs">{head}</p>}
                  <label className="ga-goal-check ga-goal-check--child">
                    <input type="checkbox" disabled={!target} checked={suggested.has(c.id)} onChange={() => toggleSuggestion(c.id)} />
                    <span className="text-sm">
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
