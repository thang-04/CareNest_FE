import { useDeferredValue, useState } from 'react';
import { GoalTable } from '@/components/education-plan/GoalTables';
import { TextField } from '@/components/form/Field';
import { Checkbox } from '@/components/form/Checkbox';
import { filterDomains, hasGoalRows, mergeFiltered } from '@/models/education-plan/aiThemeContent.mjs';

/**
 * BE:EDU-103: bảng tick kế hoạch tổ có ô tìm theo chữ (bỏ dấu) và lọc "Chưa thuộc chủ đề nào". Sửa trên bản lọc được ghi
 * về đủ các lĩnh vực (nội dung bị ẩn giữ nguyên). Bảng không tick chủ đề (kế hoạch năm) hiện như GoalTable thường.
 */
export function FilterableGoalTable(props) {
  const { domains, onChange, canAssignContents, themes = [] } = props;
  const filterable = !!canAssignContents && themes.length > 0;
  const [query, setQuery] = useState('');
  const [unassigned, setUnassigned] = useState(false);
  // Lọc theo bản hoãn của ô tìm để gõ không bị giật với bảng vài trăm dòng
  const deferredQuery = useDeferredValue(query);
  const view = filterable ? filterDomains(domains, deferredQuery, unassigned) : null;
  if (!filterable) return <GoalTable {...props} />;
  return (
    <>
      <div className="filter-bar filter-bar--aligned ga-goal-filter" data-testid="goal-tick-filter">
        <TextField
          type="search"
          aria-label="Tìm nội dung"
          placeholder="Tìm nội dung (gõ có dấu hoặc không dấu)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          data-testid="goal-tick-search"
        />
        <label className="row row--middle gap-2 text-sm nowrap ga-goal-filter__only">
          <Checkbox checked={unassigned} onChange={(e) => setUnassigned(e.target.checked)} data-testid="goal-tick-unassigned" />
          <span>Chưa thuộc chủ đề nào</span>
        </label>
      </div>
      {view && !hasGoalRows(view) && <p className="muted text-sm">Không có nội dung khớp bộ lọc.</p>}
      <GoalTable {...props} domains={view || domains} onChange={view ? (next) => onChange(mergeFiltered(domains, view, next)) : onChange} />
    </>
  );
}
