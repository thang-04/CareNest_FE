import { useMemo, useRef, useState } from 'react';
import { Search, SidebarCollapse, SidebarExpand } from '@/components/ui/icons';
import { FOLLOW_UP_LEVEL } from '@/models/children/childrenConstants';
import { normalizeText } from '@/utils/format';
import { FollowUpLevelShortBadge } from './ChildBadges';

// Thứ tự "cần chú ý" theo mức theo dõi BE trả (user chọn 2026-10-23); chỉ sắp xếp để hiển thị, không tính lại mức.
const ATTENTION_RANK = { [FOLLOW_UP_LEVEL.CLOSE_WATCH]: 0, [FOLLOW_UP_LEVEL.WATCH]: 1, [FOLLOW_UP_LEVEL.KNOWN_STABLE]: 2 };
const rankOf = (child) => ATTENTION_RANK[child.latestHealth?.followUpLevel] ?? 3;

/** Trẻ xếp theo mức cần chú ý rồi theo tên; trang dùng để chọn trẻ mặc định và nút Trước/Sau. */
export const sortByAttention = (children) =>
  [...children].sort((a, b) => rankOf(a) - rankOf(b) || a.fullName.localeCompare(b.fullName, 'vi'));

/**
 * Danh sách trẻ cột trái trang Xu hướng sức khỏe: lọc theo tên/mã khi gõ, ↑/↓ để đổi trẻ.
 * filters: ô chọn điểm trường/lớp của trang, đặt ngay trên ô tìm để biết rõ đang lọc danh sách nào.
 * collapsed: thu gọn còn 1 dòng để biểu đồ rộng hết trang (user chọn 2026-10-23); onToggle đổi trạng thái.
 */
export function TrendChildList({
  items,
  selectedId,
  onSelect,
  showClass = false,
  loading = false,
  filters = null,
  collapsed = false,
  onToggle,
}) {
  const [keyword, setKeyword] = useState('');
  const listRef = useRef(null);
  const shown = useMemo(() => {
    const kw = normalizeText(keyword).trim();
    return kw ? items.filter((c) => normalizeText(`${c.fullName} ${c.code}`).includes(kw)) : items;
  }, [items, keyword]);

  const move = (step) => {
    const index = shown.findIndex((c) => c.id === selectedId);
    const next = shown[Math.min(shown.length - 1, Math.max(0, index + step))];
    if (!next || next.id === selectedId) return;
    onSelect(next.id);
    listRef.current?.querySelector(`[data-child-id="${next.id}"]`)?.focus();
  };
  const onKeyDown = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    move(e.key === 'ArrowDown' ? 1 : -1);
  };

  if (collapsed) {
    const selected = items.find((c) => c.id === selectedId);
    return (
      <section className="card tr-trend-list tr-trend-list--collapsed" aria-label="Danh sách trẻ">
        <button type="button" className="btn btn--sm" aria-expanded="false" onClick={onToggle}>
          <SidebarExpand size={16} /> Mở danh sách trẻ ({items.length})
        </button>
        {selected && (
          <span className="text-sm">
            <span className="muted">Đang xem:</span> <b>{selected.fullName}</b>
          </span>
        )}
      </section>
    );
  }

  return (
    <section className="card tr-trend-list" aria-label="Danh sách trẻ">
      <div className="tr-trend-list__head">
        <div className="tr-trend-list__title">
          <span className="fw-600">Trẻ ({items.length})</span>
          {onToggle && (
            <button
              type="button"
              className="icon-btn"
              aria-expanded="true"
              aria-label="Thu gọn danh sách trẻ"
              title="Thu gọn danh sách trẻ"
              onClick={onToggle}
            >
              <SidebarCollapse size={18} />
            </button>
          )}
        </div>
        {filters}
        <label className="search-box">
          <Search size={16} className="muted" aria-hidden="true" />
          <span className="sr-only">Tìm trẻ theo họ tên hoặc mã</span>
          <input value={keyword} placeholder="Tìm tên, mã trẻ…" maxLength={60} onChange={(e) => setKeyword(e.target.value)} />
        </label>
      </div>
      <ul ref={listRef} className="tr-trend-list__items" onKeyDown={onKeyDown}>
        {loading ? (
          <li className="muted text-sm tr-trend-list__note">Đang tải danh sách trẻ…</li>
        ) : shown.length === 0 ? (
          <li className="muted text-sm tr-trend-list__note">{items.length ? 'Không có trẻ phù hợp.' : 'Không có trẻ đang học.'}</li>
        ) : (
          shown.map((c) => {
            const active = c.id === selectedId;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  data-child-id={c.id}
                  className={`tr-trend-item ${active ? 'tr-trend-item--active' : ''}`}
                  aria-current={active ? 'true' : undefined}
                  onClick={() => onSelect(c.id)}
                >
                  <span className="tr-trend-item__name">
                    <span className="fw-600">{c.fullName}</span>
                    <span className="muted text-xs">
                      {c.code}
                      {showClass && c.className ? ` · ${c.className}` : ''}
                    </span>
                  </span>
                  {c.latestHealth ? (
                    <FollowUpLevelShortBadge status={c.latestHealth.followUpLevel} />
                  ) : (
                    <span className="muted text-xs nowrap">Chưa có kết quả khám</span>
                  )}
                </button>
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}
