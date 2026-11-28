import { useState } from 'react';
import { FormField } from '@/components/form/FormField';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { useActiveSuppliers } from '@/hooks/menu-planning/useMenuPlanning';
import { DateInput } from '@/components/form/DateInput';
import { fixedPurchaseUnit } from '@/utils/menu-planning/foodUnits';
import { todayInput } from '@/utils/format';
import {
  ALLERGENS,
  FOOD_GROUP_LABELS,
  FOOD_ORIGIN_LABELS,
  FOOD_STORAGE_LABELS,
  FOOD_UNIT_LABELS,
  MICRONUTRIENT_GROUPS,
  MICRONUTRIENT_LABELS,
  MICRONUTRIENT_UNITS,
  RECORD_STATUS_LABELS,
  defaultStorageOf,
} from '@/models/menu-planning/menuPlanningConstants';
import { Checkbox, TextAreaField, TextField } from '@/components';

const toOptions = (labels) => Object.entries(labels).map(([value, label]) => ({ value, label }));
const num = (v) => Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 3 });
const OTHER_UNIT = '__other_unit__';

// Mỗi chất chính một màu chip để nhận ra nhanh giữa các ô số
const MACROS = [
  ['kcal', 'Năng lượng', 'kcal', 'orange'],
  ['protein', 'Chất đạm', 'g', 'red'],
  ['lipid', 'Chất béo', 'g', 'purple'],
  ['glucid', 'Tinh bột', 'g', 'blue'],
];

function MicronutrientFields({ group, hasError, children }) {
  if (group.key === 'supplementary') {
    return (
      <details className="td-micro-fieldset" open={hasError || undefined}>
        <summary className="fw-600">{group.label}</summary>
        {children}
      </details>
    );
  }
  return (
    <fieldset className="td-micro-fieldset">
      <legend className="fw-600">{group.label}</legend>
      {children}
    </fieldset>
  );
}

// BE khóa ba ô đơn vị khi thực phẩm đã nhập kho (NUT-32)
const LOCK_HINT = 'Đã nhập kho nên không đổi được; quy cách khác thì thêm thực phẩm mới';

/** Ô số có đơn vị dính bên phải (g, %, đ), tùy chọn chữ dẫn bên trái ("1 kg ="). */
function Affix({ unit, prefix, className = '', disabled, ...props }) {
  // FormField gắn id, aria và class lỗi vào phần tử con: chuyển xuống ô nhập, viền lỗi lên khung
  const cls = ['td-affix', className.includes('is-invalid') && 'is-invalid', disabled && 'is-disabled'].filter(Boolean).join(' ');
  return (
    <span className={cls}>
      {prefix && <span className="td-affix__prefix">{prefix}</span>}
      <input type="number" min="0" className="input" disabled={disabled} {...props} />
      <span>{unit}</span>
    </span>
  );
}

/**
 * Thân form thực phẩm (các khối giống form cũ: thông tin chung, đơn vị & quy đổi, dinh dưỡng / 100 g, dị ứng).
 * `f` = kết quả `useFoodForm`. Dùng trong trang sửa và trong modal trên danh sách.
 */
export function FoodEditor({ f }) {
  const {
    form,
    payload,
    set,
    setPurchaseUnit,
    setBaseUnit,
    setUnitConversion,
    unitOptions,
    setNut,
    blur,
    show,
    toggleAllergen,
    isNew,
    priceChanged,
    locked,
  } = f;
  const [customUnit, setCustomUnit] = useState(false);
  const { items: suppliers } = useActiveSuppliers();
  const purchaseUnit = form.purchaseUnit || 'đơn vị tính';
  const fixedUnit = isNew && fixedPurchaseUnit(form.purchaseUnit);
  const chooseUnit = (value) => {
    setCustomUnit(value === OTHER_UNIT);
    setPurchaseUnit(value === OTHER_UNIT ? '' : value);
  };

  return (
    <div className="td-food-editor">
      <section className="td-food-box">
        <h3>Thông tin chung</h3>
        <div className="td-food-grid td-food-grid--general">
          <FormField label="Tên thực phẩm" required error={show('name')}>
            <TextField
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
          <Checkbox checked={!!form.favorite} onChange={(e) => set('favorite', e.target.checked)} />
          Hay dùng (lọc nhanh khi lập món)
        </label>
      </section>

      <section className="td-food-box">
        <div className="td-food-box__head">
          <h3>Đơn vị, giá và thải bỏ</h3>
          <span className="text-sm muted">
            {payload.purchaseUnitSize ? `1 ${purchaseUnit} = ${num(payload.purchaseUnitSize)} ${form.unit}` : 'Chưa nhập quy đổi'}
          </span>
        </div>
        <div className="td-food-grid td-food-grid--wide">
          <FormField
            label="Đơn vị tính"
            required
            error={customUnit ? undefined : show('purchaseUnit')}
            hint={locked ? LOCK_HINT : 'Chọn đơn vị có sẵn hoặc nhập đơn vị mới'}
          >
            <SearchSelect
              disabled={locked}
              options={[...unitOptions, { value: OTHER_UNIT, label: 'Nhập đơn vị khác…' }]}
              value={customUnit ? OTHER_UNIT : form.purchaseUnit}
              onChange={chooseUnit}
              ariaLabel="Đơn vị tính"
              searchable
            />
          </FormField>
          {customUnit && (
            <TextField
              label="Tên đơn vị mới"
              required
              error={show('purchaseUnit')}
              hint="Ví dụ: bao 25 kg, hộp 200 g"
              value={form.purchaseUnit}
              maxLength={30}
              onChange={(event) => setPurchaseUnit(event.target.value)}
              onBlur={blur('purchaseUnit')}
              placeholder="Nhập tên đơn vị"
              autoFocus
            />
          )}
          {(locked || !fixedUnit) && (
            <FormField
              label="Quy đổi gam hoặc ml"
              required
              error={show('purchaseUnitSize')}
              hint="Chỉ nhập cho đơn vị đóng gói, ví dụ 1 hộp = 100 g"
            >
              <Affix
                disabled={locked}
                unit={form.unit}
                prefix={`1 ${purchaseUnit} =`}
                step="any"
                value={form.purchaseUnitSize}
                onChange={(e) => setUnitConversion(e.target.value)}
                onBlur={blur('purchaseUnitSize')}
              />
            </FormField>
          )}
          {(locked || !fixedUnit) && (
            <FormField label="Đơn vị gốc" required error={show('unit')} hint={locked ? LOCK_HINT : 'Dùng khi nhập định lượng món'}>
              <SearchSelect
                disabled={locked}
                options={toOptions(FOOD_UNIT_LABELS)}
                value={form.unit}
                onChange={setBaseUnit}
                ariaLabel="Đơn vị gốc"
              />
            </FormField>
          )}
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
          <FormField
            label="Đơn giá"
            error={show('unitPrice')}
            hint={isNew ? 'Mức giá đầu tiên, áp dụng từ hôm nay' : 'Đổi giá sẽ thêm một mức giá mới, mức cũ vẫn lưu trong lịch sử'}
          >
            <Affix
              unit={`đ / ${form.purchaseUnit || 'đơn vị mua'}`}
              step="500"
              value={form.unitPrice}
              onChange={(e) => set('unitPrice', e.target.value)}
              onBlur={blur('unitPrice')}
            />
          </FormField>
          <FormField label="Nhà cung cấp" error={show('supplierId')}>
            <SearchSelect
              options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
              value={form.supplierId}
              onChange={(v) => set('supplierId', v)}
              placeholder="Chưa gán nhà cung cấp"
              ariaLabel="Nhà cung cấp"
              searchable
            />
          </FormField>
          {priceChanged && (
            <>
              <FormField
                label="Ngày hiệu lực của giá mới"
                required
                error={show('effectiveFrom')}
                hint="Từ hôm nay trở đi; các ngày trước đó giữ giá cũ"
              >
                <DateInput value={form.effectiveFrom} min={todayInput()} onChange={(v) => set('effectiveFrom', v)} />
              </FormField>
              <FormField
                label="Lý do đổi giá / nhà cung cấp"
                error={show('priceReason')}
                hint="Bắt buộc khi ngày hiệu lực nằm trong hạn hợp đồng hiện hành"
              >
                <TextField
                  className="input"
                  value={form.priceReason}
                  maxLength={300}
                  onChange={(e) => set('priceReason', e.target.value)}
                  onBlur={blur('priceReason')}
                />
              </FormField>
            </>
          )}
        </div>
      </section>

      <section className="td-food-box">
        <div className="td-food-box__head">
          <h3>Dinh dưỡng trên 100 {form.unit} ăn được</h3>
        </div>
        <div className="td-food-grid td-food-grid--wide">
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
          {MACROS.map(([k, label, unit, tone]) => (
            <FormField key={k} label={<span className={`chip chip--${tone}`}>{label}</span>} error={show(k)}>
              <Affix unit={unit} step="0.1" value={form.nutrition[k]} onChange={(e) => setNut(k, e.target.value)} onBlur={blur(k)} />
            </FormField>
          ))}
        </div>
        <p className="text-xs muted">Để trống nếu chưa có số liệu – thực đơn dùng thực phẩm này sẽ được báo là chưa đủ dữ liệu.</p>
        <div className="td-food-more">
          {/* Vi chất theo bảng PMS (BE NUT-26): không bắt buộc, trên 100 g ăn được */}
          {MICRONUTRIENT_GROUPS.map((g) => (
            <MicronutrientFields key={g.key} group={g} hasError={g.items.some((k) => show(k))}>
              <div className="td-food-grid td-food-grid--wide">
                {g.items.map((k) => (
                  <FormField
                    key={k}
                    label={MICRONUTRIENT_LABELS[k]}
                    error={show(k)}
                    hint={k === 'vitaminA' ? 'Nhập theo µg RAE; dữ liệu cũ ghi µg hoặc RE cần xác minh trước khi cộng chung.' : undefined}
                  >
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
            </MicronutrientFields>
          ))}
          <div className="td-food-grid td-food-grid--wide">
            <FormField
              label="Nguồn số liệu dinh dưỡng"
              required
              error={show('nutrientSource')}
              hint="Ví dụ: Bảng thành phần thực phẩm Việt Nam"
            >
              <TextField
                className="input"
                value={form.nutrientSource}
                maxLength={200}
                onChange={(e) => set('nutrientSource', e.target.value)}
                onBlur={blur('nutrientSource')}
              />
            </FormField>
          </div>
        </div>
      </section>

      <section className="td-food-box">
        <div className="td-food-box__head">
          <h3>Chất gây dị ứng</h3>
          {form.allergens.length > 0 ? (
            <span className="chip chip--red">{form.allergens.length} chất</span>
          ) : (
            <span className="chip chip--gray">Không có</span>
          )}
        </div>
        <fieldset className="td-allergen-pick">
          <legend className="sr-only">Chọn chất gây dị ứng có trong thực phẩm</legend>
          {ALLERGENS.map((a) => (
            <label key={a}>
              <Checkbox checked={form.allergens.includes(a)} onChange={() => toggleAllergen(a)} /> {a}
            </label>
          ))}
        </fieldset>
        <FormField label="Ghi chú">
          <TextAreaField className="textarea" rows={2} value={form.note} onChange={(e) => set('note', e.target.value)} />
        </FormField>
      </section>
    </div>
  );
}
