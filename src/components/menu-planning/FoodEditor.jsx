import { Lock } from '@/components/ui/icons';
import { FormField } from '@/components/form/FormField';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { coverageTone } from '@/utils/menu-planning/microGroups';
import { useActiveSuppliers } from '@/hooks/menu-planning/useMenuPlanning';
import { ContractStatusBadge } from '@/components/menu-planning/ContractStatusBadge';
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
import { Checkbox, TextAreaField, TextField } from '@/components';

const toOptions = (labels) => Object.entries(labels).map(([value, label]) => ({ value, label }));
const num = (v) => Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 3 });

// Mỗi chất chính một màu chip để nhận ra nhanh giữa các ô số
const MACROS = [
  ['kcal', 'Năng lượng', 'kcal', 'orange'],
  ['protein', 'Chất đạm', 'g', 'red'],
  ['lipid', 'Chất béo', 'g', 'purple'],
  ['glucid', 'Tinh bột', 'g', 'blue'],
];

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
  const { form, payload, set, setNut, blur, show, toggleAllergen, locked, isNew, auto } = f;
  const autoToStock = auto.purchaseToStock !== undefined;
  const autoUnitSize = auto.stockUnitSize !== undefined;
  const { items: suppliers } = useActiveSuppliers();
  const unitPreview =
    Number(payload.purchaseToStock) > 0 && Number(payload.stockUnitSize) > 0 && form.stockUnit && form.purchaseUnit
      ? `1 ${form.purchaseUnit} = ${num(payload.purchaseToStock)} ${form.stockUnit} = ${num(payload.purchaseUnitSize)} ${form.unit}`
      : null;
  const purchaseUnit = form.purchaseUnit || 'đơn vị mua';
  const stockUnit = form.stockUnit || 'đơn vị kho';
  const isFilled = (k) => String(form.nutrition[k] ?? '').trim() !== '';
  const filledMicro = MICRONUTRIENTS.filter(isFilled).length;
  const filledMacro = MACROS.filter(([k]) => isFilled(k)).length;

  return (
    <div className="td-food-editor">
      <section className="td-food-box td-food-box--full">
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
            <TextField
              className="input"
              value={form.purchaseUnit}
              maxLength={30}
              onChange={(e) => set('purchaseUnit', e.target.value)}
              onBlur={blur('purchaseUnit')}
            />
          </FormField>
          <FormField label="Đơn vị kho" required error={show('stockUnit')}>
            <TextField
              className="input"
              value={form.stockUnit}
              maxLength={30}
              disabled={locked}
              onChange={(e) => set('stockUnit', e.target.value)}
              onBlur={blur('stockUnit')}
            />
          </FormField>
          {/* Hai hệ số quy đổi viết thành câu "1 mua = … kho", "1 kho = … g" thay cho nhãn "Số kg trong 1 kg" */}
          {autoToStock && autoUnitSize ? (
            <p className="text-sm muted td-span-all">Đơn vị mua trùng đơn vị kho nên hệ thống tự quy đổi, không cần nhập.</p>
          ) : (
            <fieldset className="td-food-conv td-span-all">
              <legend className="field__label">
                Quy đổi <span className="req">*</span>
              </legend>
              {!autoToStock && (
                <FormField label={`Số ${stockUnit} trong 1 ${purchaseUnit}`} error={show('purchaseToStock')} className="td-food-conv__row">
                  <Affix
                    unit={stockUnit}
                    prefix={`1 ${purchaseUnit} =`}
                    step="any"
                    value={form.purchaseToStock}
                    onChange={(e) => set('purchaseToStock', e.target.value)}
                    onBlur={blur('purchaseToStock')}
                  />
                </FormField>
              )}
              {!autoUnitSize && (
                <FormField label={`Số ${form.unit} trong 1 ${stockUnit}`} error={show('stockUnitSize')} className="td-food-conv__row">
                  <Affix
                    unit={form.unit}
                    prefix={`1 ${stockUnit} =`}
                    step="any"
                    value={form.stockUnitSize}
                    disabled={locked}
                    onChange={(e) => set('stockUnitSize', e.target.value)}
                    onBlur={blur('stockUnitSize')}
                  />
                </FormField>
              )}
              {locked && (
                <p className="td-food-conv__lock text-xs">
                  <Lock size={14} aria-hidden="true" /> Đơn vị kho và số {form.unit} trong 1 {stockUnit} đã khóa vì có lô tồn kho hoặc phiếu
                  nhập.
                </p>
              )}
            </fieldset>
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
            hint={isNew ? 'Mức giá đầu tiên, áp dụng từ hôm nay' : 'Đổi giá ở trang chi tiết › Giá & nhà cung cấp › Điều chỉnh giá'}
          >
            <Affix
              unit={`đ / ${form.purchaseUnit || 'đơn vị mua'}`}
              step="500"
              value={form.unitPrice}
              disabled={!isNew}
              onChange={(e) => set('unitPrice', e.target.value)}
              onBlur={blur('unitPrice')}
            />
          </FormField>
          <FormField label="Nhà cung cấp" error={show('supplierId')}>
            {isNew ? (
              <SearchSelect
                options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                value={form.supplierId}
                onChange={(v) => set('supplierId', v)}
                placeholder="Chưa gán nhà cung cấp"
                searchable
              />
            ) : (
              <span className="td-chips">
                {form.supplierName || <span className="muted">Chưa gán</span>}
                {form.supplierName && <ContractStatusBadge status={form.contractStatus} size="sm" />}
              </span>
            )}
          </FormField>
        </div>
      </section>

      <section className="td-food-box">
        <div className="td-food-box__head">
          <h3>Dinh dưỡng trên 100 {form.unit} ăn được</h3>
          <span className="td-chips">
            <StatusBadge tone={coverageTone(filledMacro, MACROS.length)} label={`Chất chính ${filledMacro}/${MACROS.length}`} />
            <StatusBadge
              tone={coverageTone(filledMicro, MICRONUTRIENTS.length)}
              label={`Vi chất ${filledMicro}/${MICRONUTRIENTS.length}`}
            />
          </span>
        </div>
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
          {MACROS.map(([k, label, unit, tone]) => (
            <FormField key={k} label={<span className={`chip chip--${tone}`}>{label}</span>} error={show(k)}>
              <Affix unit={unit} step="0.1" value={form.nutrition[k]} onChange={(e) => setNut(k, e.target.value)} onBlur={blur(k)} />
            </FormField>
          ))}
        </div>
        <p className="text-xs muted">Để trống nếu chưa có số liệu – thực đơn dùng thực phẩm này sẽ được báo là chưa đủ dữ liệu.</p>
        {/* Vi chất hiện sẵn thành badge (đã nhập kèm giá trị, chưa nhập viền đứt); mở khung dưới để nhập */}
        <div className="td-food-micro" aria-label="Vi chất đã nhập">
          {MICRONUTRIENT_GROUPS.map((g) => {
            const have = g.items.filter(isFilled).length;
            return (
              <div key={g.key} className="td-food-micro__grp">
                <span className="td-food-micro__lbl">
                  {g.label} <StatusBadge tone={coverageTone(have, g.items.length)} label={`${have}/${g.items.length}`} />
                </span>
                {g.items.map((k) =>
                  isFilled(k) ? (
                    <span key={k} className="chip chip--green">
                      {MICRONUTRIENT_LABELS[k]} {num(form.nutrition[k])} {MICRONUTRIENT_UNITS[k]}
                    </span>
                  ) : (
                    <span key={k} className="chip td-food-micro__miss">
                      {MICRONUTRIENT_LABELS[k]} · chưa nhập
                    </span>
                  ),
                )}
              </div>
            );
          })}
          {form.nutrientSource && <span className="text-xs muted">Nguồn: {form.nutrientSource}</span>}
        </div>
        <details className="td-food-more">
          <summary>Nhập vi chất và nguồn số liệu</summary>
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
              <TextField
                className="input"
                value={form.nutrientSource}
                maxLength={200}
                onChange={(e) => set('nutrientSource', e.target.value)}
                onBlur={blur('nutrientSource')}
              />
            </FormField>
            <FormField label="Phiên bản nguồn" error={show('nutrientSourceVersion')}>
              <TextField
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
