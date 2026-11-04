import { useEffect, useState } from 'react';
import { ArrowRight, ChevronDown, History, Lock, Plus, Question, Save, Trash2, X } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useCatalogAccess, useNutritionSetups } from '@/hooks/menu-planning/useMenuPlanning';
import { catalogUsesApi, saveNutritionSetups } from '@/services/menu-planning/menuPlanningService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { SidePanel } from '@/components/ui/SidePanel';
import { Switch } from '@/components/ui/Switch';
import { FormField } from '@/components/form/FormField';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { ageGroupById, isNurseryAgeGroup } from '@/models/School';
import { MEAL_SESSION_LABELS, MICRONUTRIENTS, addDays, formatMoney, sessionsOf } from '@/models/menu-planning/menuPlanningConstants';
import { hasErrors, validateNutritionSetup } from '@/utils/menu-planning/menuPlanningValidation';
import {
  GRAM_NORM_COLUMNS,
  KCAL_NORM,
  MICRO_NORM_GROUPS,
  SESSION_NORM_KEYS,
  STRUCTURE_NORM_COLUMNS,
  isBaseMeal,
  priceStatus,
  toSetupForm,
  toSetupPayload,
} from '@/utils/menu-planning/nutritionSetup';
import { setupCrumbs } from '@/utils/menu-planning/breadcrumbs';
import { formatDate, todayInput } from '@/utils/format';
import '@/styles/modules/menu-planning.css';

const TABS = [
  { key: 'overview', label: 'Tổng quan' },
  { key: 'groups', label: 'Nhóm độ tuổi' },
  { key: 'meals', label: 'Bữa ăn & chuẩn tạm' },
];
const NORM_TONE = { protein: 'td-col-p', lipid: 'td-col-l', glucid: 'td-col-g' };
// Cột bảng định mức theo bảng dinh dưỡng PMS: đạm, béo tách ĐV/TV (gam), bột đường (gam), năng lượng (kcal)
const GRAM_TONE = {
  animalProteinG: 'td-col-p',
  plantProteinG: 'td-col-p',
  animalLipidG: 'td-col-l',
  plantLipidG: 'td-col-l',
  glucidG: 'td-col-g',
};
const DESC =
  'Bữa ăn, giá suất ăn một ngày và chuẩn tạm (nhập tay) cho mỗi nhóm tuổi: năng lượng và cơ cấu P:L:G (bắt buộc để đánh giá), định mức gam / trẻ / ngày theo chất và tỷ lệ năng lượng từng bữa (không bắt buộc). Để trống thì thực đơn hiện "Chưa đặt định mức". Định mức áp cho các bữa trường phục vụ của nhóm tuổi. Không dùng AI.';
const isSet = (range) => rangeLabel(range) !== '—';
// Tên ngắn và độ tuổi tách từ tên nhóm "Nhà trẻ (24–36 tháng)"
const groupInfo = (ageGroupId) => {
  const g = ageGroupById(ageGroupId);
  return { short: g?.shortName || ageGroupId, range: g?.name.match(/\((.+)\)/)?.[1] || '' };
};
const money = (v) => (v === '' || Number.isNaN(Number(v)) ? v : Number(v).toLocaleString('vi-VN'));
const digits = (v) => v.replace(/\D/g, '');
const rangeLabel = (values, suffix = '') =>
  values?.[0] !== '' && values?.[0] != null && values?.[1] !== '' && values?.[1] != null ? `${values[0]}–${values[1]}${suffix}` : '—';
// Số định mức đã đặt trong nhóm (gam theo chất, vi chất); vi chất chỉ cần số tối thiểu
const filled = (v) => v !== '' && v != null;
const setCount = (norms, keys, minOnly = false) => {
  const n = keys.filter((k) => (minOnly ? filled(norms[k]?.[0]) : isSet(norms[k]))).length;
  return n ? `Đã đặt ${n}/${keys.length}` : 'Chưa đặt';
};
// Trạng thái nhóm: chưa đủ năng lượng + P:L:G thì thực đơn chưa đánh giá được ⇒ báo vàng thay vì "Đang áp dụng"
const groupStatus = (g) => {
  if (!g.enabled) return { tone: 'gray', label: 'Không áp dụng' };
  const coreSet = [KCAL_NORM, ...STRUCTURE_NORM_COLUMNS].every((c) => isSet(g.norms[c.key]));
  return coreSet ? { tone: 'green', label: 'Đang áp dụng' } : { tone: 'orange', label: 'Chưa nhập chuẩn' };
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

function NormTable({ sections, norms, readOnly, errorOf, onChange }) {
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
        {sections.map((s) => (
          <tbody key={s.key}>
            <tr className="td-nutrient-table__group">
              <th scope="colgroup" colSpan={4}>
                {s.label}
              </th>
            </tr>
            {s.rows.map((c) => {
              const value = norms[c.key] || ['', ''];
              const error = errorOf(c.key);
              const cell = (i) =>
                readOnly ? (
                  <span>{value[i] === '' ? '—' : value[i]}</span>
                ) : (
                  <input
                    type="number"
                    min="0"
                    className={`input td-norm__input ${error ? 'is-invalid' : ''}`}
                    value={value[i]}
                    aria-label={`${c.label} ${i ? 'tối đa' : 'tối thiểu'}`}
                    onChange={(e) => onChange(c.key, i ? [value[0], e.target.value] : [e.target.value, value[1]])}
                  />
                );
              return (
                <tr key={c.key}>
                  <th scope="row" className={c.tone}>
                    {c.label}
                    {error && <span className="field__error">{error}</span>}
                  </th>
                  <td className="center">{cell(0)}</td>
                  <td className="center">{cell(1)}</td>
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

function RangeInput({ value, onChange, readOnly, label, invalid }) {
  if (readOnly)
    return (
      <span className="nowrap">
        {value[0]} <ArrowRight size={12} /> {value[1]}
      </span>
    );
  const input = (i) => (
    <input
      type="number"
      min="0"
      className={`input ${invalid ? 'is-invalid' : ''}`}
      value={value[i]}
      aria-label={`${label} ${i ? 'tối đa' : 'tối thiểu'}`}
      onChange={(e) => onChange(i ? [value[0], e.target.value] : [e.target.value, value[1]])}
    />
  );
  return (
    <span className="td-range">
      {input(0)}
      <ArrowRight size={14} className="muted" aria-hidden="true" />
      {input(1)}
    </span>
  );
}

const versionState = (v, today) =>
  v.editable
    ? { tone: 'blue', label: 'Chưa áp dụng — sửa được' }
    : { tone: 'gray', label: v.effectiveFrom <= today ? 'Đã áp dụng — chỉ xem' : 'Chỉ xem' };

/** Bản mới nhất của nhóm tuổi trên BE: đã hiệu lực thì khóa, thay đổi lưu thành bản mới từ ngày sau hôm nay. */
function VersionNote({ versions, today }) {
  const latest = versions?.[0];
  if (!latest) return <p className="text-sm muted td-card-note">Chưa có cấu hình: bản đầu tiên áp dụng từ ngày bạn chọn khi lưu.</p>;
  const state = versionState(latest, today);
  return (
    <p className="text-sm td-card-note">
      <StatusBadge tone={state.tone} label={state.label} /> Bản áp dụng từ {formatDate(latest.effectiveFrom)}.{' '}
      {latest.editable ? 'Lưu cùng ngày này để sửa bản đó.' : 'Thay đổi sẽ lưu thành bản mới từ một ngày sau hôm nay.'}
    </p>
  );
}

function VersionHistory({ versions, today }) {
  if (!versions?.length) return <EmptyState title="Chưa có phiên bản cấu hình" />;
  return (
    <ul className="td-price-history">
      {versions.map((v) => {
        const state = versionState(v, today);
        return (
          <li key={v.id}>
            <b className="nowrap">{v.price == null ? '—' : formatMoney(v.price)}</b>
            <span>Từ {formatDate(v.effectiveFrom)}</span>
            <span className="text-sm muted">{v.norms.kcal ? `${rangeLabel(v.norms.kcal)} kcal` : 'Chưa đặt định mức'}</span>
            <StatusBadge tone={state.tone} label={state.label} />
          </li>
        );
      })}
    </ul>
  );
}

/** Bước 1 của luồng dinh dưỡng: bữa ăn, đơn giá từng bữa và khoảng định mức một ngày cho mỗi nhóm tuổi. */
export default function NutritionSetupPage() {
  const { user } = useAuth();
  const toast = useToast();
  // Danh mục nối BE ⇒ quyền sửa theo NUTRITION_MANAGE (HT có sẵn, PHT khi được cấp), như Thực phẩm, Món
  const access = useCatalogAccess();
  const { items, loading, error, reload } = useNutritionSetups();
  const today = todayInput();
  const [tab, setTab] = useState('overview');
  const [form, setForm] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState({});
  const [confirm, setConfirm] = useState(false);
  const [historyOf, setHistoryOf] = useState(null);
  const [basisOpen, setBasisOpen] = useState(false);
  const [expanded, setExpanded] = useState([]);
  const toggle = (id) => setExpanded((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  const canEdit = access.canManage;
  // Nối BE: mỗi nhóm tuổi có các bản cấu hình theo ngày hiệu lực; bữa ăn chỉnh ở Cấu hình trường; không có bật/tắt nhóm
  const usesApi = catalogUsesApi();
  const tomorrow = addDays(today, 1);
  const hasVersions = items.some((s) => s.versions?.length);
  const firstDate = usesApi && hasVersions ? tomorrow : today;
  const validateOpts = usesApi ? { mealsReadOnly: true, minDate: hasVersions ? tomorrow : undefined } : {};
  const tabs = usesApi ? TABS.filter((t) => t.key !== 'groups') : TABS;

  // Dữ liệu tải lại nền không ghi đè khi đang sửa dở
  useEffect(() => {
    if (items.length && !dirty) setForm(toSetupForm(items, today));
  }, [items, dirty, today]);

  if (loading || access.loading) return <LoadingState />;

  const header = (
    <>
      <Breadcrumb items={setupCrumbs()} />
      <div className="page__head">
        <div>
          <h1 className="page__title">Thiết lập dinh dưỡng</h1>
          <p className="page__desc">
            {tab === 'overview' ? 'Xem nhanh bữa ăn, giá suất và định mức của tất cả nhóm tuổi; mở chi tiết khi cần.' : DESC}
          </p>
        </div>
        {form &&
          (canEdit ? (
            <div className="page__actions">
              <button type="button" className="btn" disabled={!dirty} onClick={() => cancel()}>
                <X size={16} /> Hủy
              </button>
              <button type="button" className="btn btn--primary" disabled={!dirty} onClick={() => submit()}>
                <Save size={16} /> Lưu
              </button>
            </div>
          ) : (
            <span className="chip chip--gray">
              <Lock size={14} /> Chỉ xem
            </span>
          ))}
      </div>
    </>
  );

  if (error)
    return (
      <div className="page">
        {header}
        <ErrorState error={error} onRetry={reload} />
      </div>
    );
  if (!form)
    return (
      <div className="page">
        {header}
        <div className="card">
          <EmptyState title="Chưa có nhóm tuổi" description="Nhóm tuổi lấy từ Cấu hình trường. Thêm nhóm tuổi ở đó rồi quay lại." />
        </div>
      </div>
    );

  const errors = { ...(submitted ? validateNutritionSetup(form, today, validateOpts) : {}), ...serverErrors };
  const err = (k) => errors[k];
  const update = (fn) => {
    setForm((f) => fn(structuredClone(f)));
    setDirty(true);
    setServerErrors({});
  };
  const setGroup = (ageGroupId, fn) =>
    update((f) => {
      fn(f.groups.find((g) => g.ageGroupId === ageGroupId));
      return f;
    });
  const cancel = () => {
    setForm(toSetupForm(items, today));
    setDirty(false);
    setSubmitted(false);
    setServerErrors({});
  };
  // Kiểm các ô trên bảng trước; ngày áp dụng và lý do nhập trong hộp xác nhận
  const submit = () => {
    setSubmitted(true);
    const tableErrors = Object.keys(validateNutritionSetup({ ...form, effectiveFrom: firstDate }, today, validateOpts));
    if (tableErrors.length) {
      toast.error('Hãy kiểm tra các ô được đánh dấu.', 'Chưa lưu được');
      return;
    }
    if (usesApi) {
      // Mặc định: ngày của bản chưa hiệu lực sớm nhất (sửa thẳng bản đó), không có thì bản mới từ ngày mai
      const upcoming = items
        .flatMap((s) => s.versions || [])
        .filter((v) => v.editable)
        .map((v) => v.effectiveFrom)
        .sort()[0];
      setForm((f) => ({ ...f, effectiveFrom: upcoming || firstDate }));
    }
    setConfirm(true);
  };
  const save = async () => {
    if (hasErrors(validateNutritionSetup(form, today, validateOpts))) return;
    try {
      await saveNutritionSetups(toSetupPayload(form), user);
      toast.success('Đã lưu thiết lập dinh dưỡng.');
      setDirty(false);
      setSubmitted(false);
      setConfirm(false);
      reload();
    } catch (e) {
      if (e.details) setServerErrors(e.details);
      // Lỗi ngày áp dụng / lý do sửa ngay trong hộp; lỗi khác đóng hộp để sửa trên bảng
      if (!e.details?.effectiveFrom && !e.details?.reason) setConfirm(false);
      toast.error(e, 'Không lưu được thay đổi');
    }
  };

  const historyGroup = historyOf && items.find((s) => s.ageGroupId === historyOf);
  const childCountOf = (ageGroupId) => items.find((s) => s.ageGroupId === ageGroupId)?.childCount;
  const groupRows = (list) =>
    list.map((g, i) => {
      const info = groupInfo(g.ageGroupId);
      return (
        <tr key={g.ageGroupId}>
          <td className="muted td-num-col">{i + 1}</td>
          <td>
            <b>{info.short}</b> <span className="muted">{info.range}</span>
            <div className="text-xs muted">{childCountOf(g.ageGroupId) ?? 0} trẻ</div>
          </td>
          <td>
            <span className="row td-switch-row">
              <Switch
                checked={g.enabled}
                disabled={!canEdit}
                label={`Áp dụng ${info.short}`}
                onChange={(v) => setGroup(g.ageGroupId, (x) => (x.enabled = v))}
              />
              {g.enabled ? 'Đang áp dụng' : 'Không áp dụng'}
            </span>
          </td>
        </tr>
      );
    });

  return (
    <div className="page">
      {header}
      <div className="td-setup-bar">
        <div className="tabs tabs--pill" role="tablist" aria-label="Phần thiết lập">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              className={`tab ${tab === t.key ? 'tab--active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button type="button" className="link-btn" onClick={() => setBasisOpen(true)}>
          <Question size={16} /> Căn cứ và hướng dẫn tổ chức bữa ăn
        </button>
      </div>

      {tab === 'overview' ? (
        <section className="card td-overview">
          <div className="td-overview__head">
            <div>
              <h2>Tổng quan theo nhóm tuổi</h2>
              <p className="text-sm text-2">Bữa ăn, giá suất và định mức đang lưu cho từng nhóm.</p>
            </div>
          </div>
          <div className="table-wrap">
            <table className="table table--grid td-overview__table">
              <thead>
                <tr>
                  <th className="td-sticky-first">Nhóm tuổi</th>
                  <th>Bữa ăn</th>
                  <th className="money">Giá suất / trẻ / ngày</th>
                  <th className="num">Năng lượng (kcal)</th>
                  <th className="num">Đạm P (%)</th>
                  <th className="num">Béo L (%)</th>
                  <th className="num">Tinh bột G (%)</th>
                  <th className="center">Định mức gam</th>
                  <th className="center">Vi chất</th>
                  <th className="center">Trạng thái</th>
                  <th className="cell--actions">Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {form.groups.map((g) => {
                  const info = groupInfo(g.ageGroupId);
                  const childCount = childCountOf(g.ageGroupId);
                  const { upcoming } = priceStatus(items.find((s) => s.ageGroupId === g.ageGroupId)?.prices, g.ageGroupId, today);
                  return (
                    <tr key={g.ageGroupId}>
                      <td className="td-sticky-first">
                        <div className="td-overview__age">
                          <strong>{info.short}</strong>
                          <span className="text-sm text-2">
                            {info.range ? `${info.range} · ` : ''}
                            {childCount == null ? '—' : `${childCount} trẻ`}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="td-overview__meals">
                          {g.meals.length ? (
                            g.meals.map((meal, index) => (
                              <span className="td-overview__meal" key={`${g.ageGroupId}-${meal.code || index}`}>
                                {meal.name || MEAL_SESSION_LABELS[meal.code] || 'Chưa đặt tên'}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-2">Chưa thiết lập</span>
                          )}
                        </div>
                      </td>
                      <td className="money">
                        <div className="td-overview__price">
                          <strong>{g.price ? formatMoney(Number(g.price)) : 'Chưa thiết lập'}</strong>
                          {upcoming && (
                            <span className="text-xs text-2">
                              Giá mới {formatMoney(upcoming.price)} từ {formatDate(upcoming.effectiveFrom)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="num nowrap">{rangeLabel(g.norms.kcal)}</td>
                      {STRUCTURE_NORM_COLUMNS.map((c) => (
                        <td key={c.key} className="num nowrap">
                          {rangeLabel(g.norms[c.key])}
                        </td>
                      ))}
                      <td className="center nowrap">
                        {setCount(
                          g.norms,
                          GRAM_NORM_COLUMNS.map((c) => c.key),
                        )}
                      </td>
                      <td className="center nowrap">{setCount(g.norms, MICRONUTRIENTS, true)}</td>
                      <td className="center">
                        <StatusBadge {...groupStatus(g)} />
                      </td>
                      <td className="cell--actions">
                        <button
                          className="btn btn--sm"
                          type="button"
                          onClick={() => {
                            setExpanded([g.ageGroupId]);
                            setTab('meals');
                          }}
                        >
                          {canEdit ? 'Chỉnh sửa' : 'Xem chi tiết'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : tab === 'groups' ? (
        <section className="card">
          <div className="table-wrap">
            <table className="table table--grid">
              <thead>
                <tr>
                  <th className="td-num-col" aria-label="Số thứ tự" />
                  <th>Nhóm trẻ tại trường</th>
                  <th className="center">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                <tr className="td-grp-row">
                  <td colSpan={3}>Nhà trẻ (24–36 tháng)</td>
                </tr>
                {groupRows(form.groups.filter((g) => isNurseryAgeGroup(g.ageGroupId)))}
                <tr className="td-grp-row">
                  <td colSpan={3}>Mẫu giáo (3–6 tuổi)</td>
                </tr>
                {groupRows(form.groups.filter((g) => !isNurseryAgeGroup(g.ageGroupId)))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        form.groups.map((g) => {
          const info = groupInfo(g.ageGroupId);
          const { upcoming } = priceStatus(items.find((s) => s.ageGroupId === g.ageGroupId)?.prices, g.ageGroupId, today);
          const baseCodes = sessionsOf(g.ageGroupId);
          // Mặc định thu gọn; nhóm có lỗi tự mở để thấy ô cần sửa
          const open = expanded.includes(g.ageGroupId) || Object.keys(errors).some((k) => k.startsWith(`${g.ageGroupId}.`));
          return (
            <section key={g.ageGroupId} className={`card td-acc ${open ? 'td-acc--open' : ''}`}>
              <div className="td-acc__head">
                <button
                  type="button"
                  className="td-acc__toggle"
                  aria-expanded={open}
                  aria-controls={`setup-${g.ageGroupId}`}
                  onClick={() => toggle(g.ageGroupId)}
                >
                  <ChevronDown size={18} className="td-acc__chev" aria-hidden="true" />
                  <span className="td-acc__title">
                    <b>{info.short}</b>
                    <span className="td-title-sub">
                      {info.range} · {childCountOf(g.ageGroupId) ?? '—'} trẻ
                    </span>
                  </span>
                  <span className="td-acc__summary">
                    {g.enabled
                      ? `${g.meals.length} bữa · ${formatMoney(Number(g.price))} / ngày · ${rangeLabel(g.norms.kcal) === '—' ? 'chưa nhập chuẩn tạm' : `${rangeLabel(g.norms.kcal)} kcal`}`
                      : 'Không áp dụng'}
                  </span>
                </button>
                <div className="row td-card-tools">
                  {upcoming && !usesApi && (
                    <span className="text-sm muted">{`Giá mới ${formatMoney(upcoming.price)} từ ${formatDate(upcoming.effectiveFrom)}`}</span>
                  )}
                  <button type="button" className="link-btn text-sm" onClick={() => setHistoryOf(g.ageGroupId)}>
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
              {open && (
                <div id={`setup-${g.ageGroupId}`} className="td-acc__body">
                  {err(`${g.ageGroupId}.meals`) && (
                    <p className="field__error td-card-error" role="alert">
                      {err(`${g.ageGroupId}.meals`)}
                    </p>
                  )}
                  {!g.enabled ? (
                    <p className="td-muted-line td-card-note">Nhóm này đang tắt: không dùng khi soạn thực đơn.</p>
                  ) : (
                    <>
                      {usesApi && <VersionNote versions={items.find((s) => s.ageGroupId === g.ageGroupId)?.versions} today={today} />}
                      <div className="td-day-price">
                        <span className="field__label">Giá suất ăn / trẻ / ngày</span>
                        {canEdit ? (
                          <>
                            <span className={`input-unit td-money ${err(`${g.ageGroupId}.price`) ? 'is-invalid' : ''}`}>
                              <input
                                inputMode="numeric"
                                value={money(g.price)}
                                aria-label={`Giá suất ăn một ngày ${info.short}`}
                                onChange={(e) => setGroup(g.ageGroupId, (x) => (x.price = digits(e.target.value)))}
                              />
                              <span>đ</span>
                            </span>
                            {err(`${g.ageGroupId}.price`) && <span className="field__error">{err(`${g.ageGroupId}.price`)}</span>}
                          </>
                        ) : (
                          <b className="nowrap">{formatMoney(Number(g.price))}</b>
                        )}
                      </div>
                      <h3 className="td-norm__title">Định mức / trẻ / ngày</h3>
                      <p className="text-xs muted td-card-note td-flat">
                        Năng lượng và cơ cấu P:L:G bắt buộc để đánh giá thực đơn; các nhóm còn lại không bắt buộc. Khoáng chất, vitamin để
                        trống số tối đa nếu chỉ cần đạt tối thiểu; lệch định mức chỉ cảnh báo.
                      </p>
                      <NormTable
                        sections={NORM_SECTIONS}
                        norms={g.norms}
                        readOnly={!canEdit}
                        errorOf={(k) => err(`${g.ageGroupId}.norms.${k}`)}
                        onChange={(k, v) => setGroup(g.ageGroupId, (x) => (x.norms[k] = v))}
                      />
                      <h3 className="td-norm__title">Bữa ăn và tỷ lệ năng lượng từng bữa</h3>
                      <div className="td-daily-kcal">
                        <FormField
                          label="Nhu cầu năng lượng cả ngày (kcal/trẻ)"
                          hint="% của mỗi bữa tính trên số này; để trống thì không đánh giá bữa."
                          error={err(`${g.ageGroupId}.dailyKcalNeed`)}
                        >
                          <input
                            className="input"
                            type="number"
                            min={1}
                            max={5000}
                            value={g.dailyKcalNeed ?? ''}
                            readOnly={!canEdit}
                            onChange={(e) => setGroup(g.ageGroupId, (x) => (x.dailyKcalNeed = e.target.value))}
                          />
                        </FormField>
                      </div>
                      <div className="table-wrap">
                        <table className="table table--grid td-norm td-norm--meals">
                          <thead>
                            <tr>
                              <th>Bữa ăn</th>
                              <th className="center">% nhu cầu năng lượng cả ngày</th>
                            </tr>
                          </thead>
                          <tbody>
                            {g.meals.map((m, i) => {
                              const base = isBaseMeal(g.ageGroupId, m);
                              const k = `${g.ageGroupId}.meals.${i}`;
                              const pctKey = SESSION_NORM_KEYS[m.code];
                              return (
                                <tr key={m.code || `new-${i}`}>
                                  <td>
                                    {canEdit && !usesApi ? (
                                      <div className="td-meal-cell">
                                        <div className="row">
                                          <input
                                            className={`input ${err(`${k}.name`) ? 'is-invalid' : ''}`}
                                            value={m.name}
                                            maxLength={50}
                                            aria-label="Tên bữa"
                                            onChange={(e) => setGroup(g.ageGroupId, (x) => (x.meals[i].name = e.target.value))}
                                          />
                                          {!base && (
                                            <button
                                              type="button"
                                              className="icon-btn"
                                              aria-label={`Bỏ ${m.name || 'bữa'}`}
                                              onClick={() => setGroup(g.ageGroupId, (x) => x.meals.splice(i, 1))}
                                            >
                                              <Trash2 size={16} />
                                            </button>
                                          )}
                                        </div>
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
                                        {(err(`${k}.name`) || err(`${k}.countAs`)) && (
                                          <span className="field__error">{err(`${k}.name`) || err(`${k}.countAs`)}</span>
                                        )}
                                      </div>
                                    ) : (
                                      <b>{m.name}</b>
                                    )}
                                  </td>
                                  <td className="center td-norm__range">
                                    {pctKey ? (
                                      <>
                                        <RangeInput
                                          value={g.norms[pctKey]}
                                          readOnly={!canEdit}
                                          label={`% năng lượng ${m.name}`}
                                          invalid={!!err(`${g.ageGroupId}.norms.${pctKey}`)}
                                          onChange={(v) => setGroup(g.ageGroupId, (x) => (x.norms[pctKey] = v))}
                                        />
                                        {err(`${g.ageGroupId}.norms.${pctKey}`) && (
                                          <span className="field__error">{err(`${g.ageGroupId}.norms.${pctKey}`)}</span>
                                        )}
                                      </>
                                    ) : (
                                      <span className="text-sm muted">Tính theo {MEAL_SESSION_LABELS[m.countAs] || 'bữa gốc'}</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      {usesApi && <p className="text-sm muted td-card-note">Bữa ăn chỉnh ở Cấu hình trường.</p>}
                      {canEdit && !usesApi && (
                        <div className="td-add-meal">
                          <button
                            type="button"
                            className="link-btn"
                            onClick={() => setGroup(g.ageGroupId, (x) => x.meals.push({ code: '', name: '', countAs: baseCodes.at(-1) }))}
                          >
                            <Plus size={16} /> Thêm bữa ăn
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </section>
          );
        })
      )}

      <ConfirmationModal
        open={confirm}
        title="Lưu thiết lập dinh dưỡng"
        message={
          usesApi
            ? 'Giá suất ăn và định mức đã đổi được lưu thành bản cấu hình áp dụng từ ngày bạn chọn. Bản đã áp dụng giữ nguyên.'
            : 'Định mức và bữa ăn áp dụng ngay cho các kiểm tra thực đơn. Giá đã đổi áp dụng từ ngày bạn chọn.'
        }
        confirmLabel="Lưu"
        onConfirm={save}
        onClose={() => setConfirm(false)}
      >
        <div className="td-confirm-fields">
          <FormField label={usesApi ? 'Áp dụng từ ngày' : 'Giá mới áp dụng từ ngày'} required error={err('effectiveFrom')}>
            <input
              type="date"
              className="input"
              min={firstDate}
              value={form.effectiveFrom}
              onChange={(e) => update((f) => ({ ...f, effectiveFrom: e.target.value }))}
            />
          </FormField>
          {!usesApi && (
            <FormField label="Lý do thay đổi" error={err('reason')} hint="Bắt buộc khi sửa giá đã áp dụng">
              <input
                className="input"
                maxLength={200}
                value={form.reason}
                onChange={(e) => update((f) => ({ ...f, reason: e.target.value }))}
              />
            </FormField>
          )}
        </div>
      </ConfirmationModal>

      <SidePanel open={basisOpen} title="Căn cứ và hướng dẫn tổ chức bữa ăn" onClose={() => setBasisOpen(false)}>
        <div className="td-basis">
          {canEdit ? (
            <FormField label="Căn cứ (văn bản quy định)" hint="Lưu cùng thiết lập khi bấm Lưu">
              <textarea
                className="textarea"
                rows={4}
                maxLength={300}
                placeholder="Số hiệu, tên văn bản quy định chế độ ăn"
                value={form.basis}
                onChange={(e) => update((f) => ({ ...f, basis: e.target.value }))}
              />
            </FormField>
          ) : (
            <p>
              <b>Căn cứ:</b> {form.basis || 'Chưa nhập.'}
            </p>
          )}
          <ul className="td-guide text-sm">
            <li>Mỗi nhóm tuổi có một giá suất ăn một trẻ cho cả ngày và danh sách bữa ăn trong ngày.</li>
            <li>
              Khoảng năng lượng và tỷ lệ đạm, béo, bột nhập theo văn bản quy định; thực đơn mẫu và tuần được kiểm tra theo khoảng này.
            </li>
            <li>Bữa thêm chọn "Tính suất theo" một bữa gốc để lấy số suất khi đi chợ.</li>
          </ul>
        </div>
      </SidePanel>

      <SidePanel
        open={!!historyGroup}
        title={`${usesApi ? 'Lịch sử phiên bản' : 'Lịch sử giá'} · ${historyGroup ? groupInfo(historyOf).short : ''}`}
        onClose={() => setHistoryOf(null)}
      >
        {usesApi ? (
          <VersionHistory versions={historyGroup?.versions} today={today} />
        ) : historyGroup?.prices.length ? (
          <ul className="td-price-history">
            {historyGroup.prices.map((p) => (
              <li key={p.id}>
                <b className="nowrap">{formatMoney(p.price)}</b>
                <span>
                  {formatDate(p.effectiveFrom)} – {p.effectiveTo ? formatDate(p.effectiveTo) : 'nay'}
                </span>
                {p.note && <span className="text-sm muted">{p.note}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Chưa có lịch sử giá" />
        )}
      </SidePanel>
    </div>
  );
}
