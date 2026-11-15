import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download } from '@/components/ui/icons';
import { GoalPicker } from '@/components/education-plan/GoalPicker';
import { Tabs } from '@/components/ui/Tabs';
import { useCurriculum } from '@/hooks/education-plan/useCurriculum';
import { AGE_GROUPS } from '@/models/education-plan/educationPlanConstants';
import {
  curriculumPickTree,
  curriculumSourceLink,
  curriculumTree,
  goalTargets,
  filterGoalTargets,
  filterCurriculumContents,
  validContentSelection,
} from '@/models/education-plan/curriculum.mjs';
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
  const [filter, setFilter] = useState({});
  const [suggested, setSuggested] = useState(() => new Set());
  const tree = useMemo(() => curriculumTree(data.goals), [data.goals]);
  const allTargets = useMemo(() => goalTargets(form), [form]);
  const targets = useMemo(() => filterGoalTargets(form, filter), [form, filter]);
  const chosenTarget = targets.find((t) => t.id === target);
  const targetTitle = chosenTarget ? `${chosenTarget.domainName} · ${chosenTarget.text}` : undefined;
  const domain = form.domains.find((d) => String(d.id) === String(filter.domainId));
  const subs = domain?.rows.filter((r) => r.kind === 'sub') || [];
  const groups = [...new Map(filterGoalTargets(form, { ...filter, groupRowId: '' }).map((t) => [t.groupRowId, t.group])).values()].filter(
    Boolean,
  );
  const selectedSub = subs.find((s) => String(s.id) === String(filter.subRowId));
  const sourceSubs = [
    ...new Map(data.contents.filter((c) => !domain || c.domainName === domain.name).map((c) => [c.subDomainId ?? '@none', c])).values(),
  ];
  const suggestions = useMemo(() => filterCurriculumContents(form, filter, data.contents), [form, filter, data.contents]);
  const selection = validContentSelection(form, filter, target, suggestions, suggested);
  useEffect(() => {
    if (target && !chosenTarget) setTarget('');
    setSuggested((old) => {
      const next = new Set([...old].filter((id) => suggestions.some((c) => c.id === id)));
      return next.size === old.size ? old : next;
    });
  }, [target, chosenTarget, suggestions]);
  useEffect(() => {
    setTarget('');
    setSuggested(new Set());
    setFilter({});
    setPicked(new Set());
  }, [ageGroupId]);
  const source = data.sources[0];
  const ageName = AGE_GROUPS.find((a) => a.id === ageGroupId)?.name || '';

  const pickTree = useMemo(() => curriculumPickTree(tree), [tree]);

  // Nội dung đi kèm chọn theo khóa `${goalId}:${index}`: chọn mục tiêu ⇒ chọn hết nội dung, bỏ mục tiêu ⇒ bỏ hết;
  // tích một nội dung khi mục tiêu chưa chọn ⇒ chọn luôn mục tiêu (Tiền 04/11).
  const [pickedContents, setPickedContents] = useState(() => new Set());
  const contentKeys = (id) => (data.goals.find((g) => g.id === id)?.contents || []).map((_, i) => `${id}:${i}`);
  const toggle = (ids) => {
    const on = !ids.every((id) => picked.has(id));
    const next = new Set(picked);
    const nextContents = new Set(pickedContents);
    ids.forEach((id) => {
      if (on === next.has(id)) return;
      if (on) next.add(id);
      else next.delete(id);
      contentKeys(id).forEach((k) => (on ? nextContents.add(k) : nextContents.delete(k)));
    });
    setPicked(next);
    setPickedContents(nextContents);
  };
  const toggleContent = (goalId, index) => {
    const key = `${goalId}:${index}`;
    const next = new Set(pickedContents);
    if (next.has(key)) next.delete(key);
    else {
      next.add(key);
      if (!picked.has(goalId)) setPicked(new Set(picked).add(goalId));
    }
    setPickedContents(next);
  };
  // Lĩnh vực con bỏ tích: chỉ lấy mục tiêu, không lấy lĩnh vực con (Tiền 05/11). Chưa chọn mục tiêu nào ⇒ tích chọn cả lĩnh vực con
  const [droppedSubs, setDroppedSubs] = useState(() => new Set());
  const toggleSub = (key, ids) => {
    const next = new Set(droppedSubs);
    if (!ids.some((id) => picked.has(id))) {
      toggle(ids);
      next.delete(key);
    } else if (next.has(key)) next.delete(key);
    else next.add(key);
    setDroppedSubs(next);
  };
  const subKeyOf = (g) => `${g.domainName}|${g.subDomain ? (g.subDomainId ?? g.subDomain) : null}`;
  const toggleSuggestion = (id) => {
    const next = new Set(suggested);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSuggested(next);
  };
  const confirmGoals = () => {
    const goals = data.goals
      .filter((g) => picked.has(g.id))
      .map((g) => ({
        ...g,
        ...(droppedSubs.has(subKeyOf(g)) ? { subDomain: null, subDomainId: null } : {}),
        contents: (g.contents || []).filter((_, i) => pickedContents.has(`${g.id}:${i}`)),
      }));
    if (onImportGoals(goals)) onClose();
  };
  const confirmContents = () => {
    const valid = validContentSelection(form, filter, target, suggestions, suggested);
    if (!valid.targetId || !valid.items.length || data.loading || data.error) return;
    if (onAddContents(valid.targetId, valid.items, { filter, ageGroupId, formId: form.id, catalog: data.contents }))
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
            <button
              className="btn btn--primary"
              disabled={!selection.targetId || !selection.items.length || data.loading || !!data.error}
              onClick={confirmContents}
            >
              <Download size={16} aria-hidden /> Thêm {selection.items.length || ''} nội dung
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
        <GoalPicker
          tree={pickTree}
          picked={picked}
          onToggle={toggle}
          contentPicked={pickedContents}
          onToggleContent={toggleContent}
          droppedSubs={droppedSubs}
          onToggleSub={toggleSub}
          kindLabels={{ sub: 'Lĩnh vực con', group: 'Kết quả cần đạt' }}
        />
      ) : (
        <>
          {!allTargets.length && <Notice>Bản đang soạn chưa có mục tiêu.</Notice>}
          <div className="ga-cur-toolbar ga-cur-filters ga-cur-content-filters">
            <div className="field">
              <label className="field__label" htmlFor="cur-domain">
                Lĩnh vực
              </label>
              <select
                id="cur-domain"
                className="select"
                value={filter.domainId || ''}
                onChange={(e) => setFilter({ domainId: e.target.value })}
              >
                <option value="">Tất cả lĩnh vực</option>
                {form.domains.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="cur-sub">
                Lĩnh vực con
              </label>
              <select
                id="cur-sub"
                className="select"
                value={filter.subRowId || ''}
                disabled={!domain}
                onChange={(e) => setFilter({ domainId: filter.domainId, subRowId: e.target.value })}
              >
                <option value="">Tất cả lĩnh vực con</option>
                <option value="@none">Không thuộc lĩnh vực con</option>
                {subs.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.text || 'Chưa đặt tên'}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="cur-group">
                Kết quả mong đợi
              </label>
              <select
                id="cur-group"
                className="select"
                value={filter.groupRowId || ''}
                onChange={(e) => setFilter({ ...filter, groupRowId: e.target.value })}
              >
                <option value="">Tất cả kết quả mong đợi</option>
                <option value="@none">Không thuộc nhóm</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.text || 'Chưa đặt tên'}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="cur-target">
                Thêm vào mục tiêu <span className="req">*</span>
              </label>
              <select
                id="cur-target"
                className="select ga-cur-select--ellipsis"
                value={selection.targetId}
                title={targetTitle}
                onChange={(e) => setTarget(e.target.value)}
              >
                <option value="">Chọn mục tiêu</option>
                {targets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.domainName} · {t.text}
                  </option>
                ))}
              </select>
            </div>
            {selectedSub && selectedSub.curriculumSubDomainId == null && (
              <div className="field">
                <label className="field__label" htmlFor="cur-source-sub">
                  Lĩnh vực con nguồn gợi ý
                </label>
                <select
                  id="cur-source-sub"
                  className="select"
                  value={filter.sourceSubId || ''}
                  onChange={(e) => setFilter({ ...filter, sourceSubId: e.target.value })}
                >
                  <option value="">Chọn ngữ cảnh nguồn của Bộ</option>
                  {sourceSubs.map((c) => (
                    <option key={c.subDomainId ?? '@none'} value={c.subDomainId ?? '@none'}>
                      {c.subDomain || 'Không có lĩnh vực con'}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <p className="muted text-sm">
            Lọc lĩnh vực, lĩnh vực con, kết quả mong đợi rồi chọn mục tiêu đích. Gợi ý mục C chỉ lọc theo lĩnh vực/lĩnh vực con.
          </p>
          <div className="ga-cur-list ga-cur-content-list">
            {!suggestions.length && (
              <p className="muted" role="status">
                Không có nội dung phù hợp với bộ lọc.
              </p>
            )}
            {suggestions.map((c, i) => {
              const head = `${c.subDomain ? `${c.subDomain} › ` : ''}${c.categoryNo ? `${c.categoryNo}. ` : ''}${c.category}`;
              const prev = suggestions[i - 1];
              const showHead = !prev || `${prev.subDomain}|${prev.category}` !== `${c.subDomain}|${c.category}`;
              return (
                <div key={c.id} className="ga-cur-suggestion">
                  {showHead && <div className="ga-cur-sub__name">{head}</div>}
                  <label className="ga-cur-row">
                    <input
                      type="checkbox"
                      disabled={!selection.targetId}
                      checked={selection.items.some((item) => item.id === c.id)}
                      onChange={() => toggleSuggestion(c.id)}
                    />
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
