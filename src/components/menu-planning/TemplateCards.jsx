import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { NotebookPen, Plus, Search } from '@/components/ui/icons';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { RecordStatusBadge } from '@/components/menu-planning/MenuBadges';
import { useMenuTemplates } from '@/hooks/menu-planning/useMenuTemplates';
import { MEAL_BLOCK_LABELS, MEAL_SESSION_LABELS, SESSION_ORDER } from '@/models/menu-planning/menuPlanningConstants';
import { dayItems, hasTemplateDays, itemsBySession } from '@/utils/menu-planning/menuTemplateGrid';
import { normalizeText } from '@/utils/format';

const BLOCK_OPTIONS = [
  { value: '', label: 'Tất cả khối' },
  ...Object.entries(MEAL_BLOCK_LABELS).map(([value, label]) => ({ value, label })),
];
const SHOWN_DISHES = 3;

const mealLine = (items) => {
  const names = items.map((i) => i.dishName).filter(Boolean);
  const rest = names.length - SHOWN_DISHES;
  return rest > 0 ? `${names.slice(0, SHOWN_DISHES).join(', ')} +${rest} món` : names.join(', ');
};

/**
 * Mẫu thực đơn ngày dạng lưới thẻ giữa trang: tìm, lọc khối, mỗi mẫu một thẻ (tên, khối · mùa, món từng bữa).
 * Bấm thẻ gọi `onOpen(id)` để mở modal xem chi tiết.
 */
export function TemplateCards({ canCreate, onOpen }) {
  const { data, loading, error, reload } = useMenuTemplates();
  const [keyword, setKeyword] = useState('');
  const [block, setBlock] = useState('');
  const rows = useMemo(() => {
    const q = normalizeText(keyword);
    return (data || []).filter((t) => (!block || t.block === block) && (!q || normalizeText(t.name).includes(q)));
  }, [data, keyword, block]);

  return (
    <>
      <section className="card">
        <div className="filter-bar">
          <label className="td-search td-grow">
            <Search size={16} className="muted" />
            <input
              className="input"
              placeholder="Tìm mẫu theo tên"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              aria-label="Tìm mẫu"
            />
          </label>
          <SearchSelect options={BLOCK_OPTIONS} value={block} onChange={setBlock} ariaLabel="Lọc theo khối" />
          <span className="text-sm muted">{loading ? '' : `${rows.length}/${(data || []).length} mẫu`}</span>
        </div>
      </section>
      {error ? (
        <section className="card">
          <ErrorState error={error} onRetry={reload} />
        </section>
      ) : loading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <section className="card">
          <EmptyState
            icon={NotebookPen}
            title={data?.length ? 'Không có mẫu phù hợp' : 'Chưa có mẫu ngày'}
            description={
              data?.length
                ? 'Thử đổi từ khóa hoặc khối.'
                : 'Mỗi mẫu là món của một ngày cho một khối. Ở thực đơn tuần, chọn mẫu cho từng ngày để điền món nhanh.'
            }
            action={
              !data?.length &&
              canCreate && (
                <Link className="btn btn--primary" to="/menu/templates/new">
                  <Plus size={16} /> Tạo mẫu ngày
                </Link>
              )
            }
          />
        </section>
      ) : (
        <div className="td-tpl-cards td-tpl-cards--page">
          {rows.map((t) => {
            // Bộ 4 tuần: thẻ chỉ tóm tắt ngày đầu của bộ (Tuần 1 · Thứ Hai), không gộp cả 4 tuần
            const days = hasTemplateDays(t.items);
            const first = [...t.items].sort((a, b) => a.weekNo - b.weekNo || a.weekday - b.weekday)[0];
            const bySession = itemsBySession(days && first ? dayItems(t.items, first) : t.items);
            const meals = SESSION_ORDER.filter((s) => bySession[s]);
            return (
              <button key={t.id} type="button" className="card td-tpl-card td-tpl-card--btn" onClick={() => onOpen(t.id)}>
                <span className="td-tpl-card__head">
                  <b className="td-tpl-card__name">{t.name}</b>
                  {t.status !== 'ACTIVE' && <RecordStatusBadge status={t.status} />}
                </span>
                <span className="td-tpl-card__chips">
                  <span className="chip chip--blue">{MEAL_BLOCK_LABELS[t.block] || t.block}</span>
                  {t.seasonLabel && <span className="chip chip--teal">{t.seasonLabel}</span>}
                  {days && <span className="chip chip--gray">Bộ 4 tuần · {t.dishCount ?? t.items.length} món</span>}
                </span>
                {meals.length === 0 ? (
                  <span className="text-sm muted">Chưa có món</span>
                ) : (
                  <ul className="td-tpl-card__meals">
                    {meals.map((s) => (
                      <li key={s}>
                        <b>{MEAL_SESSION_LABELS[s] || s}</b>
                        <span>{mealLine(bySession[s])}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
