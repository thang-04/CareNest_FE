import { useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { X } from '@/components/ui/icons';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { useFoods } from '@/hooks/menu-planning/useMenuPlanning';
import { RECORD_STATUS } from '@/models/menu-planning/menuPlanningConstants';

/**
 * Ô "Thực phẩm đang thiếu" của modal AI gợi ý thực đơn (NUT-11): chọn thực phẩm đang dùng; BE loại mọi món chứa chúng khỏi
 * ứng viên của cả phương án AI lẫn phương án theo quy tắc. `value` là mảng id thực phẩm.
 */
export function MenuAiMissingFoods({ value, onChange, max = 50 }) {
  const { items: foods } = useFoods({ status: RECORD_STATUS.ACTIVE });
  const byId = useMemo(() => new Map(foods.map((f) => [String(f.id), f])), [foods]);
  const picked = value.map((id) => byId.get(String(id))).filter(Boolean);
  const choices = foods.filter((f) => !value.some((id) => String(id) === String(f.id)));

  return (
    <div className="field">
      <span className="field__label">Thực phẩm đang thiếu (không bắt buộc)</span>
      <span className="field__hint">
        Chọn thực phẩm đang hết hoặc nhà cung cấp báo không có, ví dụ cá, tôm. Món nào dùng thực phẩm này sẽ không được gợi ý.
      </span>
      <div className="td-chips">
        {picked.map((food) => (
          <span key={food.id} className="chip chip--orange">
            {food.name}
            <Button
              variant="icon"
              icon={X}
              aria-label={`Bỏ ${food.name}`}
              onClick={() => onChange(value.filter((id) => String(id) !== String(food.id)))}
            />
          </span>
        ))}
        <SearchSelect
          variant="add"
          placeholder={picked.length ? 'Thêm' : 'Thêm thực phẩm'}
          disabled={choices.length === 0 || value.length >= max}
          heading="Thực phẩm đang thiếu"
          searchable
          searchPlaceholder="Tìm thực phẩm"
          ariaLabel="Thêm thực phẩm đang thiếu"
          options={choices.map((food) => ({ value: String(food.id), label: food.name }))}
          onChange={(id) => onChange([...value, Number(id)])}
        />
      </div>
    </div>
  );
}
