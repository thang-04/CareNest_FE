import { Sparkles } from '@/components/ui/icons';
import { Button, ErrorState } from '@/components';
import { Spinner } from '@/components/ui/States';
import { NORM_STATUS, NORM_STATUS_LABELS } from '@/models/menu-planning/menuPlanningConstants';
import { SWAP_SHOWN } from '@/utils/menu-planning/menuAiDraftGrid';

const KCAL_TONE = { [NORM_STATUS.OK]: 'chip--green', [NORM_STATUS.LOW]: 'chip--orange', [NORM_STATUS.HIGH]: 'chip--orange' };

const deltaText = (delta) => (delta == null || delta === 0 ? '' : `${delta > 0 ? '+' : ''}${delta} điểm`);

/**
 * "Gợi ý món thay" cho ô đang chọn ở bảng gợi ý tuần: BE chấm thử từng món ứng viên trên lưới đang sửa, FE xếp món giữ được
 * định mức ngày lên đầu để giáo viên không đổi sang món làm ngày đó thiếu hoặc thừa chất. Xếp hạng theo số BE đã tính, không
 * phải do model viết (NUT-05). `swap` = kết quả còn khớp lưới và ô đang chọn, hoặc null khi chưa gợi ý / lưới đã đổi.
 */
export function MenuAiSwapSuggestions({ swap, disabled, onSuggest, onPick }) {
  const loading = swap?.status === 'loading';
  const shown = (swap?.items || []).slice(0, SWAP_SHOWN);
  return (
    <section className="td-aip__swap" aria-label="Gợi ý món thay">
      <Button size="sm" className="td-aip__swap-go" onClick={onSuggest} disabled={disabled || loading}>
        <Sparkles size={14} /> {swap?.status === 'ready' ? 'Gợi ý lại' : 'Gợi ý món thay'}
      </Button>
      {loading && (
        <p className="text-xs muted td-flat" role="status">
          <Spinner small /> Đang chấm thử các món thay…
        </p>
      )}
      {swap?.status === 'error' && <ErrorState error={swap.error} onRetry={onSuggest} />}
      {swap?.status === 'ready' &&
        (shown.length === 0 ? (
          <p className="text-sm muted td-flat">Không có món nào khác dùng được cho ô này.</p>
        ) : (
          <>
            <p className="text-xs muted td-flat">Xếp theo mức đạt định mức của ngày này, rồi điểm cả tuần. Bấm món để thay.</p>
            <ul className="td-aip__list td-aip__swaps">
              {shown.map((item) => (
                <li key={item.dish.dishId}>
                  <Button variant="ghost" className="td-aip__swap-item" onClick={() => onPick(item.dish)}>
                    <span className="td-aip__swap-name">{item.dish.dishName}</span>
                    <span className="td-chips">
                      <span className={`chip ${item.blocking === 0 ? 'chip--green' : 'chip--orange'}`}>
                        {item.blocking === 0 ? 'Đạt định mức ngày' : `Còn ${item.blocking} lỗi`}
                      </span>
                      {item.kcal != null && (
                        <span className={`chip ${KCAL_TONE[item.kcalStatus] || 'chip--gray'}`}>
                          {Math.round(item.kcal)} kcal
                          {item.kcalStatus && item.kcalStatus !== NORM_STATUS.OK && ` · ${NORM_STATUS_LABELS[item.kcalStatus] || ''}`}
                        </span>
                      )}
                      {deltaText(item.delta) && <span className="chip chip--gray">{deltaText(item.delta)}</span>}
                      {item.dish.outOfStock && <span className="chip chip--orange">kho khô hết</span>}
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
          </>
        ))}
    </section>
  );
}
