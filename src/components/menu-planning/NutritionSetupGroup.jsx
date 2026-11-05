import { useEffect, useState } from 'react';
import { History, Plus, Trash2 } from '@/components/ui/icons';
import { Tabs } from '@/components/ui/Tabs';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Switch } from '@/components/ui/Switch';
import { FormField } from '@/components/form/FormField';
import { MEAL_SESSION_LABELS, formatMoney, sessionsOf } from '@/models/menu-planning/menuPlanningConstants';
import {
  GRAM_NORM_COLUMNS,
  KCAL_NORM,
  MICRO_NORM_GROUPS,
  SESSION_NORM_KEYS,
  STRUCTURE_NORM_COLUMNS,
  isBaseMeal,
} from '@/utils/menu-planning/nutritionSetup';
import { formatDate } from '@/utils/format';

const NORM_TONE = { protein: 'td-col-p', lipid: 'td-col-l', glucid: 'td-col-g' };
// Cột bảng định mức theo bảng dinh dưỡng PMS: đạm, béo tách ĐV/TV (gam), bột đường (gam), năng lượng (kcal)
const GRAM_TONE = {
  animalProteinG: 'td-col-p',
  plantProteinG: 'td-col-p',
  animalLipidG: 'td-col-l',
  plantLipidG: 'td-col-l',
  glucidG: 'td-col-g',
};
// Định mức theo hàng: mỗi chỉ số một dòng, cột Tối thiểu / Tối đa / Đơn vị (không tràn ngang khi thêm chỉ số)
const NORM_SECTIONS = [
  {
    key: 'core',
    label: 'Năng lượng và cơ cấu P:L:G (bắt buộc)',
    rows: [
      KCAL_NORM,
      ...STRUCTURE_NORM_COLUMNS.map((c) => ({ ...c, label: `Tỷ lệ năng lượng từ ${c.label.toLowerCase()}`, tone: NORM_TONE[c.key] })),
    ],
  },
  { key: 'gram', label: 'Định lượng theo chất (không bắt buộc)', rows: GRAM_NORM_COLUMNS.map((c) => ({ ...c, tone: GRAM_TONE[c.key] })) },
  ...MICRO_NORM_GROUPS.map((mg) => ({ key: mg.key, label: `${mg.label} (không bắt buộc)`, rows: mg.columns })),
];

const money = (v) => (v === '' || Number.isNaN(Number(v)) ? v : Number(v).toLocaleString('vi-VN'));
const digits = (v) => v.replace(/\D/g, '');
const ErrorDot = () => <span className="td-tab-error" role="img" aria-label="có ô cần sửa" />;

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
      <input
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
      <td className="center">{cell(0)}</td>
      <td className="center">{cell(1)}</td>
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
            <th className="center">Tối thiểu</th>
            <th className="center">Tối đa</th>
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
              <span className="td-tpl-row__meta">{[it.range, it.price].filter(Boolean).join(' · ')}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Chi tiết một nhóm tuổi trong một thẻ: đầu thẻ (tên, lịch sử, áp dụng) → hai ô chính (giá suất, nhu cầu năng lượng)
 * → tab "Bữa ăn và tỷ lệ năng lượng" | "Định mức / trẻ / ngày". Chỉ hiển thị và gửi ô sửa; kiểm hợp lệ ở trang.
 */
export function NutritionSetupGroup({ group: g, info, childCount, setup, usesApi, canEdit, today, err, setGroup, onHistory }) {
  const baseCodes = sessionsOf(g.ageGroupId);
  const upcoming = !usesApi && setup?.upcoming;
  const errorOf = (k) => err(`${g.ageGroupId}.${k}`);
  const [part, setPart] = useState('meals');
  // Cột Thao tác chỉ khi có bữa thêm bỏ được (bữa gốc không bỏ)
  const removable = canEdit && !usesApi && g.meals.some((m) => !isBaseMeal(g.ageGroupId, m));
  const normError = NORM_SECTIONS.some((sec) => sec.rows.some((c) => errorOf(`norms.${c.key}`)));
  const mealError = g.meals.some(
    (m, i) =>
      errorOf(`meals.${i}.name`) ||
      errorOf(`meals.${i}.countAs`) ||
      (SESSION_NORM_KEYS[m.code] && errorOf(`norms.${SESSION_NORM_KEYS[m.code]}`)),
  );
  // Bấm Lưu mà lỗi chỉ nằm ở tab kia ⇒ chuyển sang tab đó để thấy ô cần sửa
  useEffect(() => {
    if (part === 'meals' && !mealError && normError) setPart('norms');
    else if (part === 'norms' && !normError && mealError) setPart('meals');
  }, [normError, mealError]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="card td-setup-detail">
      <div className="card__header">
        <div>
          <h2 className="card__title">{info.short}</h2>
          <span className="text-sm muted">{[info.range, `${childCount ?? '—'} trẻ`].filter(Boolean).join(' · ')}</span>
        </div>
        <div className="row td-card-tools">
          <button type="button" className="link-btn text-sm" onClick={onHistory}>
            <History size={15} /> {usesApi ? 'Lịch sử phiên bản' : 'Lịch sử giá'}
          </button>
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
          <div className="card__body td-setup-fields">
            <FormField
              label="Giá suất ăn / trẻ / ngày"
              error={errorOf('price')}
              hint={upcoming ? `Giá mới ${formatMoney(upcoming.price)} từ ${formatDate(upcoming.effectiveFrom)}` : undefined}
            >
              {canEdit ? (
                <span className={`input-unit ${errorOf('price') ? 'is-invalid' : ''}`}>
                  <input
                    inputMode="numeric"
                    value={money(g.price)}
                    aria-label={`Giá suất ăn một ngày ${info.short}`}
                    onChange={(e) => setGroup(g.ageGroupId, (x) => (x.price = digits(e.target.value)))}
                  />
                  <span>đ</span>
                </span>
              ) : (
                <b className="nowrap">{g.price ? formatMoney(Number(g.price)) : '—'}</b>
              )}
            </FormField>
            <FormField label="Nhu cầu năng lượng cả ngày" error={errorOf('dailyKcalNeed')}>
              <span className={`input-unit ${errorOf('dailyKcalNeed') ? 'is-invalid' : ''}`}>
                <input
                  type="number"
                  min={1}
                  max={5000}
                  value={g.dailyKcalNeed ?? ''}
                  readOnly={!canEdit}
                  aria-label={`Nhu cầu năng lượng cả ngày ${info.short}`}
                  onChange={(e) => setGroup(g.ageGroupId, (x) => (x.dailyKcalNeed = e.target.value))}
                />
                <span>kcal / trẻ</span>
              </span>
            </FormField>
          </div>

          <div className="card__section td-setup-parts">
            <Tabs
              ariaLabel={`Phần thiết lập ${info.short}`}
              value={part}
              onChange={setPart}
              items={[
                { key: 'meals', label: <>Bữa ăn và tỷ lệ năng lượng{mealError && <ErrorDot />}</> },
                { key: 'norms', label: <>Định mức / trẻ / ngày{normError && <ErrorDot />}</> },
              ]}
            />
            {errorOf('meals') && (
              <p className="field__error" role="alert">
                {errorOf('meals')}
              </p>
            )}
            {part === 'meals' ? (
              <>
                <div className="table-wrap">
                  <table className="table table--grid table--compact td-norm td-norm--rows">
                    <thead>
                      <tr>
                        <th>Bữa ăn</th>
                        <th className="center">Tối thiểu</th>
                        <th className="center">Tối đa</th>
                        <th>Đơn vị</th>
                        {removable && <th className="cell--actions">Thao tác</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {g.meals.map((m, i) => {
                        const base = isBaseMeal(g.ageGroupId, m);
                        const k = `meals.${i}`;
                        const pctKey = SESSION_NORM_KEYS[m.code];
                        const pctError = pctKey && errorOf(`norms.${pctKey}`);
                        return (
                          <tr key={m.code || `new-${i}`}>
                            <th scope="row">
                              {canEdit && !usesApi ? (
                                <div className="td-meal-cell">
                                  <input
                                    className={`input ${errorOf(`${k}.name`) ? 'is-invalid' : ''}`}
                                    value={m.name}
                                    maxLength={50}
                                    aria-label="Tên bữa"
                                    onChange={(e) => setGroup(g.ageGroupId, (x) => (x.meals[i].name = e.target.value))}
                                  />
                                  {!base && (
                                    <label className="td-count-as">
                                      Tính suất theo
                                      <select
                                        className="select"
                                        value={m.countAs}
                                        onChange={(e) => setGroup(g.ageGroupId, (x) => (x.meals[i].countAs = e.target.value))}
                                      >
                                        {baseCodes.map((c) => (
                                          <option key={c} value={c}>
                                            {MEAL_SESSION_LABELS[c]}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                  )}
                                  {(errorOf(`${k}.name`) || errorOf(`${k}.countAs`)) && (
                                    <span className="field__error">{errorOf(`${k}.name`) || errorOf(`${k}.countAs`)}</span>
                                  )}
                                </div>
                              ) : (
                                m.name
                              )}
                              {pctError && <span className="field__error">{pctError}</span>}
                            </th>
                            {pctKey ? (
                              <MinMaxCells
                                value={g.norms[pctKey]}
                                readOnly={!canEdit}
                                label={`% năng lượng ${m.name}`}
                                invalid={!!pctError}
                                onChange={(v) => setGroup(g.ageGroupId, (x) => (x.norms[pctKey] = v))}
                              />
                            ) : (
                              <td colSpan={2} className="center text-sm muted">
                                Tính theo {MEAL_SESSION_LABELS[m.countAs] || 'bữa gốc'}
                              </td>
                            )}
                            <td className="muted">% cả ngày</td>
                            {removable && (
                              <td className="cell--actions">
                                {!base && (
                                  <button
                                    type="button"
                                    className="icon-btn icon-btn--danger"
                                    aria-label={`Bỏ ${m.name || 'bữa'}`}
                                    title="Bỏ bữa"
                                    onClick={() => setGroup(g.ageGroupId, (x) => x.meals.splice(i, 1))}
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {usesApi && <p className="text-sm muted td-setup-parts__hint">Tên và số bữa chỉnh ở Cấu hình trường.</p>}
                {canEdit && !usesApi && (
                  <button
                    type="button"
                    className="link-btn td-setup-parts__hint"
                    onClick={() => setGroup(g.ageGroupId, (x) => x.meals.push({ code: '', name: '', countAs: baseCodes.at(-1) }))}
                  >
                    <Plus size={16} /> Thêm bữa ăn
                  </button>
                )}
              </>
            ) : (
              <>
                <NormTable
                  norms={g.norms}
                  readOnly={!canEdit}
                  errorOf={(k) => errorOf(`norms.${k}`)}
                  onChange={(k, v) => setGroup(g.ageGroupId, (x) => (x.norms[k] = v))}
                />
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}
