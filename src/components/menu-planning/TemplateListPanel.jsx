import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from '@/components/ui/icons';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { RecordStatusBadge } from '@/components/menu-planning/MenuBadges';
import { useMenuTemplates } from '@/hooks/menu-planning/useMenuTemplates';
import { MEAL_BLOCK_LABELS, MEAL_SESSION_LABELS, SESSION_ORDER } from '@/models/menu-planning/menuPlanningConstants';
import { itemsBySession } from '@/utils/menu-planning/menuTemplateGrid';
import { normalizeText } from '@/utils/format';

const BLOCK_OPTIONS = [
  { value: '', label: 'Tất cả khối' },
  ...Object.entries(MEAL_BLOCK_LABELS).map(([value, label]) => ({ value, label })),
];

/** Cột trái màn mẫu ngày: tìm, lọc khối, mỗi mẫu một dòng (tên, trạng thái, khối · mùa · số bữa và món). */
export function TemplateListPanel({ currentId }) {
  const { data, loading, error, reload } = useMenuTemplates();
  const [keyword, setKeyword] = useState('');
  const [block, setBlock] = useState('');
  const rows = useMemo(() => {
    const q = normalizeText(keyword);
    return (data || []).filter((t) => (!block || t.block === block) && (!q || normalizeText(t.name).includes(q)));
  }, [data, keyword, block]);

  return (
    <section className="card td-tpl-list" aria-label="Danh sách mẫu ngày">
      <div className="card__header">
        <h2 className="card__title">{loading ? 'Mẫu ngày' : `${(data || []).length} mẫu`}</h2>
      </div>
      <div className="td-tpl-list__filters">
        <label className="td-search">
          <Search size={16} className="muted" />
          <input
            className="input"
            placeholder="Tìm mẫu"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            aria-label="Tìm mẫu"
          />
        </label>
        <SearchSelect size="sm" options={BLOCK_OPTIONS} value={block} onChange={setBlock} ariaLabel="Lọc theo khối" />
      </div>
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState
          title={data?.length ? 'Không có mẫu phù hợp' : 'Chưa có mẫu ngày'}
          description={data?.length ? 'Thử đổi từ khóa hoặc khối.' : 'Tạo mẫu đầu tiên cho nhà trẻ hoặc mẫu giáo.'}
        />
      ) : (
        <ul className="td-tpl-rows">
          {rows.map((t) => {
            const bySession = itemsBySession(t.items);
            const meals = SESSION_ORDER.filter((x) => bySession[x]);
            return (
              <li key={t.id}>
                <Link
                  to={`/menu/templates/${t.id}`}
                  className="td-tpl-row"
                  aria-current={String(t.id) === String(currentId) ? 'true' : undefined}
                >
                  <span className="td-tpl-row__top">
                    <span className="td-tpl-row__name">{t.name}</span>
                    {t.status !== 'ACTIVE' && <RecordStatusBadge status={t.status} />}
                  </span>
                  <span className="td-tpl-row__meta">
                    {[
                      MEAL_BLOCK_LABELS[t.block] || t.block,
                      t.seasonLabel,
                      meals.length ? meals.map((s) => MEAL_SESSION_LABELS[s]).join(', ') : 'Chưa có món',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
