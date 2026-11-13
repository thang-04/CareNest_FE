import { FormField } from '@/components/form/FormField';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { coverageTone } from '@/utils/menu-planning/microGroups';
import {
  ALLERGENS,
  FOOD_GROUP_LABELS,
  FOOD_ORIGIN_LABELS,
  FOOD_STORAGE_LABELS,
  FOOD_UNIT_LABELS,
  MICRONUTRIENT_GROUPS,
  MICRONUTRIENTS,
  MICRONUTRIENT_LABELS,
  MICRONUTRIENT_UNITS,
  RECORD_STATUS_LABELS,
  defaultStorageOf,
} from '@/models/menu-planning/menuPlanningConstants';

const toOptions = (labels) => Object.entries(labels).map(([value, label]) => ({ value, label }));
const num = (v) => Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 3 });

/** Ô số có đơn vị dính bên phải (g, %, đ). */
function Affix({ unit, className = '', ...props }) {
  // FormField gắn id, aria và class lỗi vào phần tử con: chuyển xuống ô nhập, viền lỗi lên khung
  return (
    <span className={`td-affix ${className.includes('is-invalid') ? 'is-invalid' : ''}`}>
      <input type="number" min="0" className="input" {...props} />
      <span>{unit}</span>
    </span>
  );
}

/**
 * Thân form thực phẩm (các khối giống form cũ: thông tin chung, đơn vị & quy đổi, dinh dưỡng / 100 g, dị ứng).
 * `f` = kết quả `useFoodForm`. Dùng trong trang sửa và trong modal trên danh sách.
 */
export function FoodEditor({ f }) {
  const { form, payload, set, setNut, blur, show, toggleAllergen, locked } = f;
  const unitPreview =
    Number(form.purchaseToStock) > 0 && Number(form.stockUnitSize) > 0 && form.stockUnit && form.purchaseUnit
      ? `1 ${form.purchaseUnit} = ${num(form.purchaseToStock)} ${form.stockUnit} = ${num(payload.purchaseUnitSize)} ${form.unit}`
      : null;
  const lockHint = 'Đã có lô tồn kho hoặc phiếu nhập: không đổi được';
  const isFilled = (k) => String(form.nutrition[k] ?? '').trim() !== '';
  const filledMicro = MICRONUTRIENTS.filter(isFilled).length;

  return (
    <div className="td-food-editor">
      <section className="td-food-box td-food-box--full">
        <h3>Thông tin chung</h3>
        <div className="td-food-grid td-food-grid--general">
          <FormField label="Tên thực phẩm" required error={show('name')}>
            <input
              className="input"
              value={form.name}
              maxLength={100}
              onChange={(e) => set('name', e.target.value)}
              onBlur={blur('name')}
            />
          </FormField>
          <FormField label="Nhóm thực phẩm" required error={show('group')}>
            <SearchSelect
              options={toOptions(FOOD_GROUP_LABELS)}
              value={form.group}
              onChange={(v) => set('group', v)}
              placeholder="Chọn nhóm"
              error={show('group')}
              ariaLabel="Nhóm thực phẩm"
            />
          </FormField>
          <FormField label="Bảo quản" error={show('storage')} hint="Tươi: giao trong ngày; khô: lấy từ kho">
            <SearchSelect
              options={toOptions(FOOD_STORAGE_LABELS)}
              value={form.storage || defaultStorageOf(form.group)}
              onChange={(v) => set('storage', v)}
              ariaLabel="Bảo quản"
            />
          </FormField>
          <FormField label="Trạng thái" required>
            <SearchSelect
              options={toOptions(RECORD_STATUS_LABELS)}
              value={form.status}
              onChange={(v) => set('status', v)}
              ariaLabel="Trạng thái"
            />
          </FormField>
        </div>
        <label className="checkbox">
          <input type="checkbox" checked={!!form.favorite} onChange={(e) => set('favorite', e.target.checked)} />
          Hay dùng (lọc nhanh khi lập món)
        </label>
      </section>

      <section className="td-food-box">
        <div className="td-food-box__head">
          <h3>Đơn vị, giá và thải bỏ</h3>
          {unitPreview && <span className="text-sm muted">{unitPreview}</span>}
        </div>
        <div className="td-food-grid">
          <FormField label="Đơn vị công thức" required error={show('unit')} hint="g hoặc ml khi nhập định lượng món">
            <SearchSelect
              options={toOptions(FOOD_UNIT_LABELS)}
              value={form.unit}
              onChange={(v) => set('unit', v)}
              ariaLabel="Đơn vị công thức"
            />
          </FormField>
          <FormField label="Đơn vị mua" required error={show('purchaseUnit')} hint="Ví dụ: kg, lít, thùng">
            <input
              className="input"
              value={form.purchaseUnit}
              maxLength={30}
              onChange={(e) => set('purchaseUnit', e.target.value)}
              onBlur={blur('purchaseUnit')}
            />
          </FormField>
          <FormField label="Đơn vị kho" required error={show('stockUnit')} hint={locked ? lockHint : undefined}>
            <input
              className="input"
              value={form.stockUnit}
              maxLength={30}
              disabled={locked}
              onChange={(e) => set('stockUnit', e.target.value)}
              onBlur={blur('stockUnit')}
            />
          </FormField>
          <FormField
            label={`Số ${form.stockUnit || 'đơn vị kho'} trong 1 ${form.purchaseUnit || 'đơn vị mua'}`}
            required
            error={show('purchaseToStock')}
          >
            <input
              type="number"
              min="0"
              step="any"
              className="input"
              value={form.purchaseToStock}
              onChange={(e) => set('purchaseToStock', e.target.value)}
              onBlur={blur('purchaseToStock')}
            />
          </FormField>
          <FormField
            label={`Số ${form.unit} trong 1 ${form.stockUnit || 'đơn vị kho'}`}
            required
            error={show('stockUnitSize')}
            hint={locked ? lockHint : undefined}
          >
            <input
              type="number"
              min="0"
              step="any"
              className="input"
              value={form.stockUnitSize}
              disabled={locked}
              onChange={(e) => set('stockUnitSize', e.target.value)}
              onBlur={blur('stockUnitSize')}
            />
          </FormField>
          <FormField label="Tỷ lệ thải bỏ" error={show('wastePct')}>
            <Affix
              unit="%"
              max="90"
              step="1"
              value={form.wastePct}
              onChange={(e) => set('wastePct', e.target.value)}
              onBlur={blur('wastePct')}
            />
          </FormField>
          <FormField label="Đơn giá" error={show('unitPrice')} className="td-span-all">
            <Affix
              unit={`đ / ${form.purchaseUnit || 'đơn vị mua'}`}
              step="500"
              value={form.unitPrice}
              onChange={(e) => set('unitPrice', e.target.value)}
              onBlur={blur('unitPrice')}
            />
          </FormField>
        </div>
      </section>

      <section className="td-food-box">
        <h3>Dinh dưỡng trên 100 {form.unit} ăn được</h3>
        <div className="td-food-grid">
          <FormField label="Nguồn gốc" required error={show('origin')} className="td-span-all">
            <SearchSelect
              options={toOptions(FOOD_ORIGIN_LABELS)}
              value={form.origin}
              onChange={(v) => set('origin', v)}
              placeholder="Chọn nguồn gốc"
              error={show('origin')}
              ariaLabel="Nguồn gốc"
            />
          </FormField>
          {[
            ['kcal', 'Năng lượng', 'kcal'],
            ['protein', 'Chất đạm', 'g'],
            ['lipid', 'Chất béo', 'g'],
            ['glucid', 'Tinh bột', 'g'],
          ].map(([k, label, unit]) => (
            <FormField key={k} label={label} error={show(k)}>
              <Affix unit={unit} step="0.1" value={form.nutrition[k]} onChange={(e) => setNut(k, e.target.value)} onBlur={blur(k)} />
            </FormField>
          ))}
        </div>
        <p className="text-xs muted">Để trống nếu chưa có số liệu – thực đơn dùng thực phẩm này sẽ được báo là chưa đủ dữ liệu.</p>
        <details className="td-food-more">
          <summary>
            8 vi chất và nguồn số liệu{' '}
            <StatusBadge
              tone={coverageTone(filledMicro, MICRONUTRIENTS.length)}
              label={`${filledMicro}/${MICRONUTRIENTS.length} đã nhập`}
            />
          </summary>
          {/* Vi chất theo bảng PMS (BE NUT-26): không bắt buộc, trên 100 g ăn được */}
          {MICRONUTRIENT_GROUPS.map((g) => (
            <fieldset key={g.key} className="td-micro-fieldset">
              <legend className="fw-600">
                {g.label}{' '}
                <StatusBadge
                  tone={coverageTone(g.items.filter(isFilled).length, g.items.length)}
                  label={`${g.items.filter(isFilled).length}/${g.items.length} đã nhập`}
                />
              </legend>
              <div className="td-food-grid">
                {g.items.map((k) => (
                  <FormField key={k} label={MICRONUTRIENT_LABELS[k]} error={show(k)}>
                    <Affix
                      unit={MICRONUTRIENT_UNITS[k]}
                      step="0.01"
                      value={form.nutrition[k] ?? ''}
                      onChange={(e) => setNut(k, e.target.value)}
                      onBlur={blur(k)}
                    />
                  </FormField>
                ))}
              </div>
            </fieldset>
          ))}
          <div className="td-food-grid">
            <FormField
              label="Nguồn số liệu dinh dưỡng"
              required
              error={show('nutrientSource')}
              hint="Ví dụ: Bảng thành phần thực phẩm Việt Nam"
            >
              <input
                className="input"
                value={form.nutrientSource}
                maxLength={200}
                onChange={(e) => set('nutrientSource', e.target.value)}
                onBlur={blur('nutrientSource')}
              />
            </FormField>
            <FormField label="Phiên bản nguồn" error={show('nutrientSourceVersion')}>
              <input
                className="input"
                value={form.nutrientSourceVersion}
                maxLength={50}
                onChange={(e) => set('nutrientSourceVersion', e.target.value)}
                onBlur={blur('nutrientSourceVersion')}
              />
            </FormField>
          </div>
        </details>
      </section>

      <section className="td-food-box td-food-box--full">
        <h3>Chất gây dị ứng</h3>
        <fieldset className="td-allergen-pick">
          <legend className="sr-only">Chọn chất gây dị ứng có trong thực phẩm</legend>
          {ALLERGENS.map((a) => (
            <label key={a}>
              <input type="checkbox" checked={form.allergens.includes(a)} onChange={() => toggleAllergen(a)} /> {a}
            </label>
          ))}
        </fieldset>
        <FormField label="Ghi chú">
          <textarea className="textarea" rows={2} value={form.note} onChange={(e) => set('note', e.target.value)} />
        </FormField>
      </section>
    </div>
  );
}
