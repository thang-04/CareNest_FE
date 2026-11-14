import { useId, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { LABELS } from '@/components/ui/labels';
import { LoadingState } from '@/components/ui/States';
import { Modal, Notice } from './eduUi';
import { FilterSelect } from './planUi';
import { useEducationPlan, useGoalDetails } from '@/hooks/education-plan/useEducationPlan';
import { currentPlanOf } from '@/models/education-plan/planVersions.mjs';
import { numberGoals, toRows } from '@/models/education-plan/goalTable';
import { AGE_GROUPS } from '@/models/education-plan/educationPlanConstants';
import { norm } from '@/models/education-plan/learningResources.mjs';
import { Checkbox, TextField } from '@/components';

const yearText = (t) => (t.schoolYearName ? ` · ${t.schoolYearName}` : '');
const themeKey = (t) => `${norm(t.name)}|${t.schoolYearId ?? ''}`;

/**
 * "Sửa nhãn" ở trang Kho (BE:EDU-87, spec 901 FR-004/005/006): nhóm tuổi, chủ đề đã dạy (chọn từ chủ đề đã dạy hoặc gõ tên), MT
 * theo kế hoạch năm đã ban hành của nhóm tuổi. Nhãn tự thêm (`auto`) chỉ hiện, không bỏ được; gửi nhãn thêm mới + id nhãn tay cần bỏ.
 * taught: chủ đề đã dạy của mọi học liệu đang thấy [{ name, schoolYearId, schoolYearName }].
 */
export function ResourceTagsModal({ item, taught, busy, error, onSave, onClose }) {
  const id = useId();
  const { goals: plans, schoolYear } = useEducationPlan();
  const tags = item.tags || [];
  const [age, setAge] = useState(item.ageGroupId ? String(item.ageGroupId) : '');
  const [dropped, setDropped] = useState(() => new Set());
  const [addThemes, setAddThemes] = useState([]);
  const [pick, setPick] = useState('');
  const [typed, setTyped] = useState('');
  const [addGoals, setAddGoals] = useState([]);
  const plan = age ? currentPlanOf(plans, age, schoolYear) : null;
  const planLoad = useGoalDetails([plan?.id]);
  const detail = plan && !plan.summary ? plan : null;
  const planGoals = detail
    ? (() => {
        const domains = detail.domains.map((d) => ({ ...d, rows: toRows(d, () => '') }));
        const no = numberGoals(domains);
        return domains.flatMap((d) => d.rows.filter((r) => no[r.id]).map((r) => ({ id: String(r.id), no: no[r.id], text: r.text })));
      })()
    : [];

  // Nhãn tự thêm gộp trùng (một chủ đề – năm có thể đến từ nhiều dòng gắn)
  const autoThemes = [...new Map(tags.filter((t) => t.auto && t.kind === 'THEME' && t.name).map((t) => [themeKey(t), t])).values()];
  const manualThemes = tags.filter((t) => !t.auto && t.kind === 'THEME' && t.name);
  const goalTags = tags.filter((t) => t.kind === 'GOAL');
  const goalTagOf = (gid) => goalTags.filter((t) => String(t.refId) === gid);
  const otherGoals = goalTags.filter((t) => !t.auto && !planGoals.some((g) => g.id === String(t.refId)));
  const toggleDrop = (tid) =>
    setDropped((prev) => {
      const next = new Set(prev);
      if (next.has(tid)) next.delete(tid);
      else next.add(tid);
      return next;
    });
  const has = (t) => [...autoThemes, ...manualThemes, ...addThemes].some((x) => themeKey(x) === themeKey(t));
  const addTheme = () => {
    const known = taught.find((t) => themeKey(t) === pick);
    const next = typed.trim() ? { name: typed.trim(), schoolYearId: null, schoolYearName: null } : known;
    if (next && !has(next)) setAddThemes((list) => [...list, next]);
    setPick('');
    setTyped('');
  };
  const toggleGoal = (gid) => {
    const own = goalTagOf(gid).filter((t) => !t.auto);
    if (own.length) own.forEach((t) => toggleDrop(t.id));
    else setAddGoals((list) => (list.includes(gid) ? list.filter((x) => x !== gid) : [...list, gid]));
  };
  const save = () =>
    onSave({
      ...(age ? { ageGroupId: age } : { clearAgeGroup: true }),
      themes: addThemes.map((t) => ({ name: t.name, schoolYearId: t.schoolYearId ?? null })),
      goals: addGoals.map((goalId) => ({ goalId })),
      removeTagIds: [...dropped],
    });

  return (
    <Modal
      width={700}
      title={`Sửa nhãn: ${item.title}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {LABELS.cancel}
          </Button>
          <Button variant="primary" loading={busy} onClick={save}>
            {LABELS.save}
          </Button>
        </>
      }
    >
      <p className="muted text-sm">Nhãn giúp tìm và gợi ý học liệu khi soạn giáo án; nhãn không hiện trong giáo án.</p>
      <FilterSelect
        label="Nhóm tuổi"
        value={age}
        onChange={setAge}
        options={[{ value: '', label: 'Mọi nhóm tuổi' }, ...AGE_GROUPS.map((g) => ({ value: String(g.id), label: g.name }))]}
      />
      <fieldset className="ga-edit-fieldset stack">
        <legend className="field__label">Chủ đề đã dạy</legend>
        {autoThemes.length + manualThemes.length + addThemes.length === 0 && <p className="muted text-sm">Chưa ghi chủ đề.</p>}
        <ul className="ga-resource-list">
          {autoThemes.map((t) => (
            <li key={`a-${t.id}`}>
              <span>
                {t.name}
                {yearText(t)} <span className="muted text-sm">· tự thêm khi gắn vào giáo án, gỡ khỏi giáo án thì tự bỏ</span>
              </span>
            </li>
          ))}
          {manualThemes.map((t) => (
            <li key={`m-${t.id}`}>
              <span>
                {t.name}
                {yearText(t)}
                {dropped.has(t.id) && <span className="muted text-sm"> · sẽ bỏ khi lưu</span>}
              </span>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`${dropped.has(t.id) ? 'Giữ' : 'Bỏ'} chủ đề ${t.name}`}
                onClick={() => toggleDrop(t.id)}
              >
                {dropped.has(t.id) ? 'Giữ' : 'Bỏ'}
              </Button>
            </li>
          ))}
          {addThemes.map((t) => (
            <li key={`n-${themeKey(t)}`}>
              <span>
                {t.name}
                {yearText(t)} <span className="muted text-sm">· mới</span>
              </span>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Bỏ chủ đề ${t.name}`}
                onClick={() => setAddThemes((list) => list.filter((x) => themeKey(x) !== themeKey(t)))}
              >
                Bỏ
              </Button>
            </li>
          ))}
        </ul>
        <div className="filter-bar">
          <FilterSelect
            label="Chọn chủ đề đã dạy"
            value={pick}
            onChange={setPick}
            options={[
              { value: '', label: 'Chọn chủ đề' },
              ...taught.map((t) => ({ value: themeKey(t), label: `${t.name}${yearText(t)}` })),
            ]}
          />
          <div className="field">
            <label className="field__label" htmlFor={`${id}-theme`}>
              Hoặc gõ tên chủ đề
            </label>
            <TextField id={`${id}-theme`} value={typed} maxLength={255} onChange={(e) => setTyped(e.target.value)} />
          </div>
          <Button size="sm" variant="outline-primary" disabled={!pick && !typed.trim()} onClick={addTheme}>
            Thêm chủ đề
          </Button>
        </div>
      </fieldset>
      {age && planLoad.loading && <LoadingState />}
      {age && !plan && <Notice>Nhóm tuổi chưa có kế hoạch năm học đã ban hành: chưa chọn được MT.</Notice>}
      {detail && planGoals.length > 0 && (
        <fieldset className="ga-edit-fieldset stack">
          <legend className="field__label">Mục tiêu (MT) học liệu phục vụ</legend>
          {planGoals.map((g) => {
            const own = goalTagOf(g.id);
            const auto = own.some((t) => t.auto);
            const manual = own.filter((t) => !t.auto);
            const checked = auto || (manual.length ? !manual.every((t) => dropped.has(t.id)) : addGoals.includes(g.id));
            return (
              <label key={g.id} className="checkbox">
                <Checkbox checked={checked} disabled={auto} onChange={() => toggleGoal(g.id)} />
                <span>
                  <span className="ga-goal-code">MT{g.no}</span> {g.text}
                  {auto && <span className="muted text-sm"> · tự thêm</span>}
                </span>
              </label>
            );
          })}
        </fieldset>
      )}
      {otherGoals.length > 0 && (
        <ul className="ga-resource-list" aria-label="MT từ kế hoạch khác">
          {otherGoals.map((t) => (
            <li key={t.id}>
              <span className="muted">
                {t.name || 'MT từ kế hoạch khác (năm trước hoặc nhóm tuổi khác)'}
                {dropped.has(t.id) ? ' · sẽ bỏ khi lưu' : ''}
              </span>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`${dropped.has(t.id) ? 'Giữ' : 'Bỏ'} nhãn MT này`}
                onClick={() => toggleDrop(t.id)}
              >
                {dropped.has(t.id) ? 'Giữ' : 'Bỏ'}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {error && <Notice>{error}</Notice>}
    </Modal>
  );
}
