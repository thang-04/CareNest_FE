import { Fragment, useMemo, useRef, useState } from 'react';
import { Card } from '@/components/education-plan/eduUi';
import { Cell, focusCell } from '@/components/education-plan/planUi';
import { domainLabel } from '@/models/education-plan/educationPlanConstants';
import { domainRoman, mtList, numberGoals } from '@/models/education-plan/goalTable';
import { themeGoalBlocks, weekRows } from '@/models/education-plan/classPlan';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Adjustments, RotateCcw } from '@/components/ui/icons';
import ThemeGoalPickerModal from '@/components/education-plan/ThemeGoalPickerModal';

/**
 * Dòng của một mục tiêu. Nội dung giáo dục do Phó HT / Tổ trưởng lập ở kế hoạch năm (các nội dung đã tích cho chủ đề),
 * giáo viên không sửa; giáo viên chỉ viết hoạt động giáo dục.
 */
export const themeRowOf = (draft, g) => ({
  activities: draft?.rows?.[g.id]?.activities || '',
  contents: draft?.rows?.[g.id]?.contents !== undefined ? draft.rows[g.id].contents : g.contents.map((c) => `- ${c}`).join('\n'),
});

// Nút loại giờ của hoạt động giáo dục = các dòng của kế hoạch tuần theo cấu hình của trường, để chữ trước ":" khớp đúng
// dòng tuần nhận gợi ý (Tiền 16/10)
const activityHeads = () => weekRows().map((r) => r.label);

/** Ô hoạt động giáo dục: khi đang soạn hiện các đầu mục loại giờ, bấm để thêm dòng "Loại giờ: " rồi điền tiếp. */
function ActivityCell({ value, onChange, editable, label }) {
  const wrap = useRef(null);
  const [open, setOpen] = useState(false);
  const add = (head) => {
    const lines = (value || '').split('\n').filter((l) => l.trim());
    const next = [...lines, `${head}: `].join('\n');
    onChange(next);
    requestAnimationFrame(() => {
      const input = wrap.current?.querySelector('.ga-cell-input');
      input?.focus();
      input?.setSelectionRange(next.length, next.length);
    });
  };
  const used = (head) => (value || '').split('\n').some((l) => l.trim().startsWith(`${head}:`));
  return (
    <div ref={wrap} onFocus={() => setOpen(true)} onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setOpen(false)}>
      <Cell editable={editable} value={value} label={label} placeholder="Bấm để chọn loại giờ" onChange={onChange} />
      {editable && open && (
        <div className="row row--wrap gap-2 ga-goal-table__pad">
          {activityHeads()
            .filter((h) => !used(h))
            .map((h) => (
              <button
                key={h}
                type="button"
                className="btn btn--outline-primary btn--sm"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => add(h)}
              >
                + {h}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

/**
 * Nội dung kế hoạch chủ đề (I. mục tiêu, nội dung, hoạt động; II. môi trường). Dùng ở trang soạn và chỉ đọc ở trang
 * duyệt giáo án tuần đầu của chủ đề (kế hoạch chủ đề duyệt chung với tuần đó).
 */
export function ThemePlanBody({
  yearPlan,
  themeId,
  draft,
  editable = false,
  setRow,
  setField,
  flagOf = () => null,
  added = null,
  heading = null,
}) {
  const blocks = themeGoalBlocks(yearPlan.domains, numberGoals(yearPlan.domains), themeId, draft?.customTicks);
  const goals = blocks.flatMap((b) => b.goals);
  const rowOf = (g) => themeRowOf(draft, g);
  // Một thẻ "CĐ n" chứa cả mục I và II; thu gọn / mở cả thẻ (Tiền 04/11)
  const [folded, setFolded] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);

  const currentTheme = yearPlan?.themes?.find((t) => t.id === themeId) || { id: themeId, name: '' };

  const hasCustomTicks = useMemo(() => {
    if (!draft?.customTicks) return false;
    return Object.keys(draft.customTicks).length > 0;
  }, [draft?.customTicks]);

  const resetToDefault = () => {
    if (setField) setField('customTicks', {});
  };
  return (
    <>
      <Card title={heading} bodyClass={null} collapsed={folded} onToggle={heading ? () => setFolded((v) => !v) : undefined}>
        <div className="card__body">
          <div className="ga-theme-goal-head mb-8">
            <h3 className="subsection-title mb-8">I. Mục tiêu, nội dung và hoạt động giáo dục</h3>
            {editable && (
              <div className="row row--between row--wrap row--middle gap-2">
                <div className="row row--wrap row--middle gap-2">
                  <button
                    type="button"
                    className="btn btn--outline-primary btn--sm"
                    onClick={() => setShowGoalModal(true)}
                  >
                    <Adjustments size={16} aria-hidden /> Tùy chọn mục tiêu cho chủ đề này
                  </button>
                  <button
                    type="button"
                    className="btn btn--outline-secondary btn--sm"
                    onClick={resetToDefault}
                    disabled={!hasCustomTicks}
                    title="Khôi phục danh sách mục tiêu về nguyên bản theo kế hoạch năm"
                  >
                    <RotateCcw size={16} aria-hidden /> Khôi phục về mặc định mục tiêu sẵn có của năm
                  </button>
                </div>
                {hasCustomTicks && (
                  <div className="row row--wrap row--middle gap-2">
                    <span className="chip chip--orange text-sm" title="Mục tiêu đã được tùy chỉnh khác với Kế hoạch năm">
                      Đã tùy chỉnh mục tiêu
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Nhắc dạng chữ đỏ nhỏ, căn phải như bước tạo chủ đề ở mục tiêu năm học, nằm ngay bên trên bảng */}
          {goals.length === 0 && <p className="text-danger text-sm text-right mb-8">Kế hoạch năm chưa tích nội dung nào vào chủ đề này.</p>}
          {/* MT chưa viết hoạt động thì kế hoạch tuần không có gợi ý, cuối chủ đề không phủ được MT đó */}
          {editable && goals.some((g) => !rowOf(g).activities.trim()) && (
            <p className="text-danger text-sm text-right mb-8">
              {mtList(goals.filter((g) => !rowOf(g).activities.trim()).map((g) => g.no))} chưa có hoạt động giáo dục nên kế hoạch tuần sẽ
              không có gợi ý cho các MT này.
            </p>
          )}

          {showGoalModal && (
            <ThemeGoalPickerModal
              open={showGoalModal}
              onClose={() => setShowGoalModal(false)}
              theme={currentTheme}
              yearPlan={yearPlan}
              customTicks={draft?.customTicks || {}}
              onApply={(nextTicks) => {
                if (setField) setField('customTicks', nextTicks);
              }}
              onResetDefault={resetToDefault}
            />
          )}
          <div className="table-wrap">
            <table className="table ga-plan-table ga-goal-table" onMouseDown={focusCell}>
              <colgroup>
                <col className="ga-goal-table__del" />
                <col className="ga-goal-table__goaltext" />
                <col />
                <col />
              </colgroup>
              <thead>
                <tr>
                  <th className={editable ? 'cell--fixed ga-stt' : 'ga-stt'}>TT</th>
                  <th className={editable ? 'cell--fixed' : ''}>Mục tiêu giáo dục</th>
                  <th className={editable ? 'ga-th-editable' : ''}>Nội dung giáo dục</th>
                  <th className={editable ? 'ga-th-editable' : ''}>Hoạt động giáo dục</th>
                </tr>
              </thead>
              <tbody>
                {blocks.map((b, i) => (
                  <Fragment key={`${b.domain}-${b.sub}-${i}`}>
                    {(i === 0 || blocks[i - 1].domain !== b.domain) && (
                      <tr>
                        <td colSpan={4} className="ga-goal-table__domain">
                          <div className="ga-goal-table__pad">
                            <h3>
                              {domainRoman(b.domain)}. {domainLabel(b.domain).toUpperCase()}
                            </h3>
                          </div>
                        </td>
                      </tr>
                    )}
                    {b.sub && (
                      <tr>
                        <td colSpan={4} className="ga-goal-table__subband">
                          <div className="ga-goal-table__subname">{b.sub}</div>
                        </td>
                      </tr>
                    )}
                    {b.goals.map((g) => (
                      <tr key={g.id}>
                        <td className={editable ? 'cell--fixed ga-stt' : 'ga-stt'}>
                          <div className="ga-goal-table__pad">
                            <span className="ga-goal-code">MT{g.no}</span>
                            {/* Phiên bản kế hoạch năm mới (BE:EDU-26): MT đổi hiện đỏ, MT mới có nhãn "mới" */}
                            {flagOf(g.id) && <StatusBadge tone="red" label="Đổi" size="sm" />}
                            {added?.has(g.id) && <StatusBadge tone="blue" label="Mới" size="sm" />}
                          </div>
                        </td>
                        <td className={editable ? 'cell--fixed' : ''}>
                          <div className="ga-goal-table__pad">
                            {g.text}
                            {flagOf(g.id) && <div className="field__error">{flagOf(g.id).message}</div>}
                          </div>
                        </td>
                        <td className={editable ? 'ga-cell-editable' : ''}>
                          <Cell
                            editable={editable}
                            value={rowOf(g).contents}
                            label={`Nội dung của MT${g.no}`}
                            onChange={(v) => setRow(g, 'contents', v)}
                          />
                        </td>
                        <td className={editable ? 'ga-cell-editable' : ''}>
                          <ActivityCell
                            editable={editable}
                            value={rowOf(g).activities}
                            label={`Hoạt động giáo dục của MT${g.no}`}
                            onChange={(v) => setRow(g, 'activities', v)}
                          />
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card__section">
          <h3 className="subsection-title">II. Môi trường giáo dục</h3>
          <div className="table-wrap">
            <table className="table ga-plan-table ga-goal-table" onMouseDown={focusCell}>
              <thead>
                <tr>
                  <th>1. Trong lớp</th>
                  <th>2. Ngoài lớp</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <Cell
                      editable={editable}
                      value={draft.envIn}
                      label="Môi trường trong lớp"
                      placeholder="Trang trí, góc chơi, đồ dùng…"
                      onChange={(v) => setField('envIn', v)}
                    />
                  </td>
                  <td>
                    <Cell
                      editable={editable}
                      value={draft.envOut}
                      label="Môi trường ngoài lớp"
                      placeholder="Sân chơi, khu vực ngoài lớp…"
                      onChange={(v) => setField('envOut', v)}
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </>
  );
}
