import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Baby, NotebookPen, Plus, School, Search, Soup, Sun, Sunset } from '@/components/ui/icons';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Tabs } from '@/components/ui/Tabs';
import { RecordStatusBadge } from '@/components/menu-planning/MenuBadges';
import { useMenuTemplates } from '@/hooks/menu-planning/useMenuTemplates';
import { MEAL_BLOCK_LABELS, MEAL_SESSION, MEAL_SESSION_LABELS, SESSION_ORDER } from '@/models/menu-planning/menuPlanningConstants';
import { dayItems, hasTemplateDays, itemsBySession } from '@/utils/menu-planning/menuTemplateGrid';
import { normalizeText } from '@/utils/format';

const SHOWN_DISHES = 3;
const MEAL_ICONS = { [MEAL_SESSION.MORNING]: Sun, [MEAL_SESSION.LUNCH]: Soup, [MEAL_SESSION.AFTERNOON]: Sunset };
const BLOCK_ICONS = { NURSERY: Baby, KINDERGARTEN: School };

/** Một bữa của thẻ: icon + tên bữa, món là các viên nhỏ, quá 4 món gộp thành "+n". */
function MealRow({ session, items }) {
  const Icon = MEAL_ICONS[session] || Soup;
  const names = items.map((i) => i.dishName).filter(Boolean);
  const rest = names.length - SHOWN_DISHES;
  return (
    <li className="td-tpl-meal">
      <span className="td-tpl-meal__icon" aria-hidden="true">
        <Icon size={16} />
      </span>
      <div className="td-tpl-meal__body">
        <b className="td-tpl-meal__label">{MEAL_SESSION_LABELS[session] || session}</b>
        <span className="td-tpl-meal__dishes">
          {names.slice(0, SHOWN_DISHES).map((name, i) => (
            <span key={`${name}-${i}`} className="td-tpl-dish">
              {name}
            </span>
          ))}
          {rest > 0 && <span className="td-tpl-dish td-tpl-dish--more">+{rest}</span>}
        </span>
      </div>
    </li>
  );
}

function TemplateCard({ template: t, onOpen }) {
  // Bộ 4 tuần: thẻ chỉ tóm tắt ngày đầu của bộ (Tuần 1 · Thứ Hai), không gộp cả 4 tuần
  const days = hasTemplateDays(t.items);
  const first = [...t.items].sort((a, b) => a.weekNo - b.weekNo || a.weekday - b.weekday)[0];
  const bySession = itemsBySession(days && first ? dayItems(t.items, first) : t.items);
  const meals = SESSION_ORDER.filter((s) => bySession[s]);
  const BlockIcon = BLOCK_ICONS[t.block] || School;
  const dishTotal = t.dishCount ?? t.items.length;

  return (
    <button
      type="button"
      className={`card td-tpl-card td-tpl-card--btn td-tpl-card--${String(t.block || '').toLowerCase()}`}
      onClick={() => onOpen(t.id)}
    >
      <span className="td-tpl-card__head">
        <span className="td-tpl-card__avatar" aria-hidden="true">
          <BlockIcon size={22} />
        </span>
        <span className="td-tpl-card__title">
          <b className="td-tpl-card__name">{t.name}</b>
          <span className="td-tpl-card__chips">
            <span className="chip chip--blue">{MEAL_BLOCK_LABELS[t.block] || t.block}</span>
            {t.seasonLabel && <span className="chip chip--teal">{t.seasonLabel}</span>}
            {t.status !== 'ACTIVE' && <RecordStatusBadge status={t.status} />}
          </span>
        </span>
      </span>

      {meals.length === 0 ? (
        <span className="text-sm muted">Chưa có món</span>
      ) : (
        <ul className="td-tpl-card__meals">
          {meals.map((s) => (
            <MealRow key={s} session={s} items={bySession[s]} />
          ))}
        </ul>
      )}

      <span className="td-tpl-card__foot">
        <span>
          {days ? 'Bộ 4 tuần · ngày đầu' : 'Một ngày'} · {dishTotal} món
        </span>
        <span className="td-tpl-card__cta">
          Chi tiết <ArrowRight size={14} />
        </span>
      </span>
    </button>
  );
}

/**
 * Mẫu thực đơn ngày dạng lưới thẻ giữa trang: tìm, lọc khối (tab có số đếm), mỗi mẫu một thẻ (khối · mùa, số liệu, món từng bữa).
 * Bấm thẻ gọi `onOpen(id)` để mở modal xem chi tiết.
 */
export function TemplateCards({ canCreate, onOpen }) {
  const { data, loading, error, reload } = useMenuTemplates();
  const [keyword, setKeyword] = useState('');
  const [block, setBlock] = useState('');
  const all = data || [];
  const rows = useMemo(() => {
    const q = normalizeText(keyword);
    return all.filter((t) => (!block || t.block === block) && (!q || normalizeText(t.name).includes(q)));
  }, [all, keyword, block]);
  const tabs = useMemo(
    () => [
      { key: '', label: 'Tất cả', count: all.length },
      ...Object.entries(MEAL_BLOCK_LABELS).map(([key, label]) => ({
        key,
        label,
        count: all.filter((t) => t.block === key).length,
      })),
    ],
    [all],
  );

  return (
    <>
      <section className="card td-tpl-toolbar">
        <Tabs items={tabs} value={block} onChange={setBlock} ariaLabel="Lọc theo khối" variant="pill" />
        <label className="td-search td-tpl-toolbar__search">
          <Search size={16} className="muted" />
          <input
            className="input"
            placeholder="Tìm mẫu theo tên"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            aria-label="Tìm mẫu"
          />
        </label>
        {canCreate && (
          <Link className="btn btn--primary" to="/menu/templates/new">
            <Plus size={16} /> Tạo mẫu ngày
          </Link>
        )}
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
            title={all.length ? 'Không có mẫu phù hợp' : 'Chưa có mẫu ngày'}
            description={
              all.length
                ? 'Thử đổi từ khóa hoặc khối.'
                : 'Mỗi mẫu là món của một ngày cho một khối. Ở thực đơn tuần, chọn mẫu cho từng ngày để điền món nhanh.'
            }
            action={
              !all.length &&
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
          {rows.map((t) => (
            <TemplateCard key={t.id} template={t} onOpen={onOpen} />
          ))}
        </div>
      )}
    </>
  );
}
