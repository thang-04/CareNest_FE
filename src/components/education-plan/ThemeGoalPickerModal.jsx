import { useMemo, useState } from 'react';
import { Check, RotateCcw } from '@/components/ui/icons';
import { Modal } from '@/components/education-plan/eduUi';
import { GoalPicker } from '@/components/education-plan/GoalPicker';
import { numberGoals } from '@/models/education-plan/goalTable';

/**
 * Modal tùy chọn mục tiêu giáo dục cho chủ đề:
 * - Dùng chung mẫu thiết kế và component GoalPicker với modal "Lấy từ Chương trình của Bộ"
 *   và "Lấy từ kế hoạch có sẵn" ở màn Tạo kế hoạch năm học.
 * - Hỗ trợ cây: Lĩnh vực → Lĩnh vực con → Nhóm kết quả mong đợi → Mục tiêu.
 * - Có nút "Khôi phục về mặc định mục tiêu sẵn có của năm" để đưa toàn bộ lựa chọn
 *   về đúng các mục tiêu đã phân bổ cho chủ đề theo Kế hoạch năm.
 */
export default function ThemeGoalPickerModal({ open, onClose, theme, yearPlan, customTicks = {}, onApply }) {
  const tree = useMemo(() => {
    if (!yearPlan?.domains) return [];
    const numbers = numberGoals(yearPlan.domains);
    const domainList = [];

    yearPlan.domains.forEach((d) => {
      let currentSub = { key: 'sub-default', name: '', groups: [] };
      let currentGroup = { key: 'grp-default', title: '', goals: [] };
      const domainObj = { name: d.name, subs: [] };

      (d.rows || []).forEach((r, idx) => {
        if (r.kind === 'sub') {
          currentSub = { key: r.id || `sub-${idx}`, name: r.text || '', groups: [] };
          currentGroup = { key: `grp-${idx}-0`, title: '', goals: [] };
          domainObj.subs.push(currentSub);
        } else if (r.kind === 'group') {
          currentGroup = { key: r.id || `grp-${idx}`, title: r.text || '', goals: [] };
          if (!domainObj.subs.includes(currentSub)) {
            domainObj.subs.push(currentSub);
          }
          currentSub.groups.push(currentGroup);
        } else if (r.kind === 'goal' && numbers[r.id]) {
          if (!domainObj.subs.includes(currentSub)) {
            domainObj.subs.push(currentSub);
          }
          if (!currentSub.groups.includes(currentGroup)) {
            currentSub.groups.push(currentGroup);
          }
          const defaultTicked = (r.contents || []).some((c) => (c.themes || []).includes(theme?.id));
          currentGroup.goals.push({
            id: r.id,
            code: `MT${numbers[r.id]}`,
            text: r.text || '',
            contents: (r.contents || []).map((c) => c.text).filter(Boolean),
            defaultTicked,
          });
        }
      });

      // Lọc các nhánh không có mục tiêu
      domainObj.subs = domainObj.subs
        .map((s) => ({
          ...s,
          groups: s.groups.filter((g) => g.goals.length > 0),
        }))
        .filter((s) => s.groups.length > 0);

      if (domainObj.subs.length > 0) {
        domainList.push(domainObj);
      }
    });

    return domainList;
  }, [yearPlan, theme?.id]);

  const allGoals = useMemo(() => {
    return tree.flatMap((d) => d.subs.flatMap((s) => s.groups.flatMap((g) => g.goals)));
  }, [tree]);

  const [picked, setPicked] = useState(() => {
    const set = new Set();
    allGoals.forEach((g) => {
      const isTicked = customTicks[g.id] !== undefined ? Boolean(customTicks[g.id]) : Boolean(g.defaultTicked);
      if (isTicked) set.add(g.id);
    });
    return set;
  });

  const toggle = (ids) => {
    const on = !ids.every((id) => picked.has(id));
    const next = new Set(picked);
    ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
    setPicked(next);
  };

  const handleResetToDefault = () => {
    const set = new Set();
    allGoals.forEach((g) => {
      if (g.defaultTicked) set.add(g.id);
    });
    setPicked(set);
  };

  const handleApply = () => {
    const nextTicks = {};
    allGoals.forEach((g) => {
      const isNowTicked = picked.has(g.id);
      if (isNowTicked !== g.defaultTicked) {
        nextTicks[g.id] = isNowTicked;
      }
    });
    onApply?.(nextTicks);
    onClose?.();
  };

  const hasCustom = useMemo(() => {
    return allGoals.some((g) => picked.has(g.id) !== Boolean(g.defaultTicked));
  }, [allGoals, picked]);

  if (!open) return null;

  return (
    <Modal
      title={`Tùy chọn mục tiêu cho chủ đề: ${theme?.name || ''}`}
      width={1100}
      className="ga-cur-modal"
      onClose={onClose}
      footer={
        <div className="row row--between row--middle w-100 gap-2">
          <button
            type="button"
            className="btn btn--outline-secondary btn--sm"
            onClick={handleResetToDefault}
            title="Khôi phục toàn bộ lựa chọn về đúng các mục tiêu mặc định đã phân bổ theo kế hoạch năm"
          >
            <RotateCcw size={16} aria-hidden /> Khôi phục về mặc định mục tiêu sẵn có của năm
          </button>
          <div className="row row--middle gap-2">
            <button type="button" className="btn btn--outline-secondary btn--sm" onClick={onClose}>
              Hủy
            </button>
            <button type="button" className="btn btn--primary btn--sm" onClick={handleApply}>
              <Check size={16} aria-hidden /> Áp dụng ({picked.size} mục tiêu)
            </button>
          </div>
        </div>
      }
    >
      <div className="ga-cur-meta mb-2">
        <span className="chip chip--blue">{theme?.name || 'Chủ đề'}</span>
        <span className="muted text-sm">Kế hoạch năm học: {yearPlan?.schoolYear}</span>
        {hasCustom && (
          <span className="chip chip--orange text-xs" title="Đang có mục tiêu chọn khác với phân bổ của Kế hoạch năm">
            Đã tùy chỉnh khác Kế hoạch năm
          </span>
        )}
      </div>

      <GoalPicker tree={tree} picked={picked} onToggle={toggle} />
    </Modal>
  );
}
