import { History } from '@/components/ui/icons';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Switch } from '@/components/ui/Switch';
import { NutritionAppliedStructure } from '@/components/menu-planning/NutritionAppliedStructure';
import { NutritionConvertedTable } from '@/components/menu-planning/NutritionConvertedTable';
import { formatMoney } from '@/models/menu-planning/menuPlanningConstants';
import { KCAL_NORM, STRUCTURE_NORM_COLUMNS } from '@/utils/menu-planning/nutritionSetup';
import { formatDate } from '@/utils/format';
import { Button, TextField } from '@/components';

const NORM_TONE = { protein: 'td-col-p', lipid: 'td-col-l', glucid: 'td-col-g' };
// Định mức theo hàng: năng lượng và khoảng tỷ lệ P:L:G; gam theo chất do hệ thống quy đổi, vi chất xem ở màn Thực phẩm
const NORM_SECTIONS = [
  {
    key: 'core',
    label: 'Năng lượng và cơ cấu P:L:G (bắt buộc)',
    rows: [
      KCAL_NORM,
      ...STRUCTURE_NORM_COLUMNS.map((c) => ({ ...c, label: `Tỷ lệ năng lượng từ ${c.label.toLowerCase()}`, tone: NORM_TONE[c.key] })),
    ],
  },
];

const money = (v) => (v === '' || Number.isNaN(Number(v)) ? v : Number(v).toLocaleString('vi-VN'));
const digits = (v) => v.replace(/\D/g, '');
const ErrorDot = () => <span className="td-tab-error" role="img" aria-label="có ô cần sửa" />;

function SetupSectionHeading({ number, title, description }) {
  return (
    <div className="td-setup-step-heading">
      <span aria-hidden="true">{number}</span>
      <div>
        <h3>{title}</h3>
        {description && <p>{description}</p>}
      </div>
    </div>
  );
}

export const rangeLabel = (values, suffix = '') =>
  values?.[0] !== '' && values?.[0] != null && values?.[1] !== '' && values?.[1] != null ? `${values[0]}–${values[1]}${suffix}` : '—';

export const versionState = (v, today) =>
  v.editable
    ? { tone: 'blue', label: 'Chưa áp dụng — sửa được' }
    : { tone: 'gray', label: v.effectiveFrom <= today ? 'Đã áp dụng — chỉ xem' : 'Chỉ xem' };

/** Ô số tối thiểu / tối đa của một chỉ số; chỉ xem thì hiện số. */
function MinMaxCells({ value = ['', ''], readOnly, label, invalid, onChange }) {
  const cell = (i) =>
    readOnly ? (
      <span>{value[i] === '' || value[i] == null ? '—' : value[i]}</span>
    ) : (
      <TextField
        type="number"
        min="0"
        className={`input td-norm__input ${invalid ? 'is-invalid' : ''}`}
        value={value[i] ?? ''}
        aria-label={`${label} ${i ? 'tối đa' : 'tối thiểu'}`}
        onChange={(e) => onChange(i ? [value[0], e.target.value] : [e.target.value, value[1]])}
      />
    );
  return (
    <>
      <td className={`num ${readOnly ? '' : 'td-norm__input-cell'}`}>{cell(0)}</td>
      <td className={`num ${readOnly ? '' : 'td-norm__input-cell'}`}>{cell(1)}</td>
    </>
  );
}

function NormTable({ norms, readOnly, errorOf, onChange }) {
  return (
    <div className="table-wrap">
      <table className="table table--grid table--compact td-norm td-norm--rows">
        <thead>
          <tr>
            <th>Chỉ số</th>
            <th className="num">Tối thiểu</th>
            <th className="num">Tối đa</th>
            <th>Đơn vị</th>
          </tr>
        </thead>
        {NORM_SECTIONS.map((s) => (
          <tbody key={s.key}>
            <tr className="td-nutrient-table__group">
              <th scope="colgroup" colSpan={4}>
                {s.label}
              </th>
            </tr>
            {s.rows.map((c) => {
              const error = errorOf(c.key);
              return (
                <tr key={c.key}>
                  <th scope="row" className={c.tone}>
                    {c.label}
                    {error && <span className="field__error">{error}</span>}
                  </th>
                  <MinMaxCells
                    value={norms[c.key]}
                    readOnly={readOnly}
                    label={c.label}
                    invalid={!!error}
                    onChange={(v) => onChange(c.key, v)}
                  />
                  <td className="muted">{c.unit}</td>
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
    </div>
  );
}

/** Bản mới nhất của nhóm tuổi trên BE: đã hiệu lực thì khóa, thay đổi lưu thành bản mới từ ngày sau hôm nay. */
function VersionNote({ versions, today }) {
  const latest = versions?.[0];
  if (!latest)
    return <p className="text-sm muted td-setup-detail__note">Chưa có cấu hình: bản đầu tiên áp dụng từ ngày bạn chọn khi lưu.</p>;
  const state = versionState(latest, today);
  return (
    <p className="text-sm td-setup-detail__note">
      <StatusBadge tone={state.tone} label={state.label} /> Bản áp dụng từ {formatDate(latest.effectiveFrom)}.{' '}
      {latest.editable ? 'Lưu cùng ngày này để sửa bản đó.' : 'Thay đổi sẽ lưu thành bản mới từ một ngày sau hôm nay.'}
    </p>
  );
}

/**
 * Danh sách nhóm tuổi bên trái (như danh sách Mẫu thực đơn ngày): tên, độ tuổi, giá suất, trạng thái; nhóm có ô lỗi hiện chấm đỏ.
 */
export function NutritionGroupList({ items, value, onChange }) {
  return (
    <section className="card td-tpl-list" aria-label="Nhóm tuổi">
      <div className="card__header">
        <h2 className="card__title">Nhóm tuổi</h2>
      </div>
      <ul className="td-tpl-rows">
        {items.map((it) => (
          <li key={it.key}>
            <button
              type="button"
              className="td-tpl-row td-setup-row"
              aria-current={it.key === value ? 'true' : undefined}
              onClick={() => onChange(it.key)}
            >
              <span className="td-tpl-row__top">
                <span className="td-tpl-row__name">
                  {it.name} {it.hasError && <ErrorDot />}
                </span>
                <StatusBadge {...it.status} />
              </span>
              <span className="td-tpl-row__meta td-setup-row__meta">
                {it.range && <span className="td-setup-age-badge">{it.range}</span>}
                {it.price && <span>{it.price}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Chi tiết một nhóm tuổi trong một thẻ: đầu thẻ (tên, lịch sử, áp dụng) → giá suất và nhu cầu năng lượng → bảng định mức
 * (năng lượng, khoảng P:L:G) → cơ cấu áp dụng → hàm lượng quy đổi tại trường. Chỉ hiển thị và gửi ô sửa; kiểm hợp lệ ở trang.
 */
export function NutritionSetupGroup({ group: g, info, childCount, setup, usesApi, canEdit, today, err, setGroup, onHistory }) {
  const upcoming = !usesApi && setup?.upcoming;
  const errorOf = (k) => err(`${g.ageGroupId}.${k}`);
  const priceError = errorOf('price');
  const dailyKcalError = errorOf('dailyKcalNeed');
  const priceErrorId = `nutrition-price-${g.ageGroupId}-error`;
  const dailyKcalErrorId = `nutrition-kcal-${g.ageGroupId}-error`;

  return (
    <section className="card td-setup-detail">
      <div className="card__header">
        <div>
          <h2 className="card__title">{info.short}</h2>
          <span className="td-setup-detail__meta">
            {info.range && <span className="td-setup-age-badge">{info.range}</span>}
            <span className="text-sm muted">{childCount ?? '—'} trẻ</span>
          </span>
        </div>
        <div className="row td-card-tools">
          <Button variant="link" className="text-sm" onClick={onHistory}>
            <History size={15} /> {usesApi ? 'Lịch sử phiên bản' : 'Lịch sử giá'}
          </Button>
          {!usesApi && (
            <span className="row td-switch-row fw-600 text-sm">
              Áp dụng
              <Switch
                checked={g.enabled}
                disabled={!canEdit}
                label={`Áp dụng ${info.short}`}
                onChange={(v) => setGroup(g.ageGroupId, (x) => (x.enabled = v))}
              />
            </span>
          )}
        </div>
      </div>
      {usesApi && <VersionNote versions={setup?.versions} today={today} />}

      {!g.enabled ? (
        <p className="card__body td-muted-line">Nhóm này đang tắt: không dùng khi soạn thực đơn.</p>
      ) : (
        <>
          <div className="card__section td-setup-grid">
            <section className="td-setup-step">
              <SetupSectionHeading
                number="01"
                title="Suất ăn và nhu cầu năng lượng"
                description="Thông tin áp dụng cho một trẻ trong một ngày."
              />
              <div className="table-wrap">
                <table className="table table--grid table--compact td-setup-input-table">
                  <thead>
                    <tr>
                      <th>Chỉ tiêu</th>
                      <th className="center">Mức thiết lập</th>
                      <th className="center">Đơn vị</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row">Giá suất ăn / trẻ / ngày</th>
                      <td className="center">
                        {canEdit ? (
                          <TextField
                            className="input td-setup-table-input"
                            inputMode="numeric"
                            value={money(g.price)}
                            aria-label={`Giá suất ăn một ngày ${info.short}`}
                            aria-invalid={!!priceError}
                            aria-describedby={priceError ? priceErrorId : undefined}
                            onChange={(e) => setGroup(g.ageGroupId, (x) => (x.price = digits(e.target.value)))}
                          />
                        ) : (
                          <b className="nowrap">{g.price ? Number(g.price).toLocaleString('vi-VN') : '—'}</b>
                        )}
                        {priceError && (
                          <span id={priceErrorId} className="field__error td-setup-table__error" role="alert">
                            {priceError}
                          </span>
                        )}
                        {upcoming && (
                          <span className="td-setup-table__note">
                            Giá mới {formatMoney(upcoming.price)} từ {formatDate(upcoming.effectiveFrom)}
                          </span>
                        )}
                      </td>
                      <td className="center">đ</td>
                    </tr>
                    <tr>
                      <th scope="row">Phí dịch vụ / trẻ / ngày</th>
                      <td className="center">
                        {canEdit ? (
                          <TextField
                            className="input td-setup-table-input"
                            inputMode="numeric"
                            value={money(g.serviceFee ?? '')}
                            aria-label={`Phí dịch vụ một ngày ${info.short}`}
                            aria-invalid={!!errorOf('serviceFee')}
                            onChange={(e) => setGroup(g.ageGroupId, (x) => (x.serviceFee = digits(e.target.value)))}
                          />
                        ) : (
                          <b className="nowrap">{formatMoney(Number(g.serviceFee) || 0)}</b>
                        )}
                        {errorOf('serviceFee') && (
                          <span className="field__error td-setup-table__error" role="alert">
                            {errorOf('serviceFee')}
                          </span>
                        )}
                        <span className="td-setup-table__note">
                          {g.price
                            ? `Ngân sách thực phẩm ${formatMoney(Math.max(0, Number(g.price) - (Number(g.serviceFee) || 0)))} / trẻ / ngày`
                            : 'Phần giá suất không dùng mua thực phẩm; để trống = 0'}
                        </span>
                      </td>
                      <td className="center">đ</td>
                    </tr>
                    <tr>
                      <th scope="row">Nhu cầu năng lượng cả ngày</th>
                      <td className="center">
                        <TextField
                          className="input td-setup-table-input"
                          type="number"
                          min={1}
                          max={5000}
                          value={g.dailyKcalNeed ?? ''}
                          readOnly={!canEdit}
                          aria-label={`Nhu cầu năng lượng cả ngày ${info.short}`}
                          aria-invalid={!!dailyKcalError}
                          aria-describedby={dailyKcalError ? dailyKcalErrorId : undefined}
                          onChange={(e) => setGroup(g.ageGroupId, (x) => (x.dailyKcalNeed = e.target.value))}
                        />
                        {dailyKcalError && (
                          <span id={dailyKcalErrorId} className="field__error td-setup-table__error" role="alert">
                            {dailyKcalError}
                          </span>
                        )}
                      </td>
                      <td className="center">kcal / trẻ</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
            <section className="td-setup-step">
              <SetupSectionHeading
                number="02"
                title="Khoảng định mức dinh dưỡng"
                description="Thực đơn được đánh giá theo khoảng tối thiểu và tối đa này."
              />
              <NormTable
                norms={g.norms}
                readOnly={!canEdit}
                errorOf={(k) => errorOf(`norms.${k}`)}
                onChange={(k, v) => setGroup(g.ageGroupId, (x) => (x.norms[k] = v))}
              />
            </section>
            <section className="td-setup-step">
              <SetupSectionHeading
                number="03"
                title="Cơ cấu áp dụng P:L:G"
                description="Nhập tỷ lệ năng lượng từ đạm, béo và đường; tổng ba tỷ lệ phải bằng 100%."
              />
              <NutritionAppliedStructure
                applied={g.applied}
                canEdit={canEdit}
                error={errorOf('applied')}
                onChange={(k, v) => setGroup(g.ageGroupId, (x) => (x.applied[k] = v))}
              />
            </section>
            <section className="td-setup-step">
              <SetupSectionHeading
                number="04"
                title="Hàm lượng quy đổi tại trường"
                description="Xem giá trị ước tính tại hai mốc năng lượng đã thiết lập."
              />
              <NutritionConvertedTable kcal={g.norms.kcal} applied={g.applied} factors={setup?.factors} />
            </section>
          </div>
        </>
      )}
    </section>
  );
}
