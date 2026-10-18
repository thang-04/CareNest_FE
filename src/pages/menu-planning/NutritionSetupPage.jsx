import { useEffect, useState } from 'react';
import { ArrowRight, ChevronDown, History, Lock, Plus, Question, Save, Trash2, X } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useMenuAccess, useNutritionSetups } from '@/hooks/menu-planning/useMenuPlanning';
import { saveNutritionSetups } from '@/services/menu-planning/menuPlanningService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { SidePanel } from '@/components/ui/SidePanel';
import { Switch } from '@/components/ui/Switch';
import { FormField } from '@/components/form/FormField';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { ageGroupById } from '@/models/School';
import { MEAL_SESSION_LABELS, formatMoney, sessionsOf } from '@/models/menu-planning/menuPlanningConstants';
import { hasErrors, validateNutritionSetup } from '@/utils/menu-planning/menuPlanningValidation';
import { NORM_COLUMNS, isBaseMeal, priceStatus, toSetupForm, toSetupPayload } from '@/utils/menu-planning/nutritionSetup';
import { setupCrumbs } from '@/utils/menu-planning/breadcrumbs';
import { formatDate, todayInput } from '@/utils/format';
import '@/styles/modules/menu-planning.css';

const TABS = [
  { key: 'overview', label: 'Tổng quan' },
  { key: 'groups', label: 'Nhóm độ tuổi' },
  { key: 'meals', label: 'Bữa ăn & định mức' },
];
const NORM_TONE = { protein: 'td-col-p', lipid: 'td-col-l', glucid: 'td-col-g' };
const NORM_SHORT_LABELS = { kcal: 'Kcal', protein: 'Đạm', lipid: 'Béo', glucid: 'Bột' };
const DESC = 'Bữa ăn, giá suất ăn một ngày và khoảng định mức một ngày cho mỗi nhóm tuổi. Nhập đúng theo văn bản quy định, không dùng AI.';
// Tên ngắn và độ tuổi tách từ tên nhóm "Nhà trẻ (24–36 tháng)"
const groupInfo = (ageGroupId) => {
  const g = ageGroupById(ageGroupId);
  return { short: g?.shortName || ageGroupId, range: g?.name.match(/\((.+)\)/)?.[1] || '' };
};
const money = (v) => (v === '' || Number.isNaN(Number(v)) ? v : Number(v).toLocaleString('vi-VN'));
const digits = (v) => v.replace(/\D/g, '');
const rangeLabel = (values, suffix = '') =>
  values?.[0] !== '' && values?.[0] != null && values?.[1] !== '' && values?.[1] != null ? `${values[0]}–${values[1]}${suffix}` : '—';

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

/** Bước 1 của luồng dinh dưỡng: bữa ăn, đơn giá từng bữa và khoảng định mức một ngày cho mỗi nhóm tuổi. */
export default function NutritionSetupPage() {
  const { user } = useAuth();
  const toast = useToast();
  const access = useMenuAccess();
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

  const errors = { ...(submitted ? validateNutritionSetup(form, today) : {}), ...serverErrors };
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
    const tableErrors = Object.keys(validateNutritionSetup({ ...form, effectiveFrom: today }, today));
    if (tableErrors.length) {
      toast.error('Hãy kiểm tra các ô được đánh dấu.', 'Chưa lưu được');
      return;
    }
    setConfirm(true);
  };
  const save = async () => {
    if (hasErrors(validateNutritionSetup(form, today))) return;
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
      toast.error(e.message, 'Không lưu được thay đổi');
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
          {TABS.map((t) => (
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
            <table className="table td-overview__table">
              <thead>
                <tr>
                  <th>Nhóm tuổi</th>
                  <th>Bữa ăn</th>
                  <th>Giá suất / trẻ / ngày</th>
                  <th>Định mức / ngày</th>
                  <th>Trạng thái</th>
                  <th className="text-right">Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {form.groups.map((g) => {
                  const info = groupInfo(g.ageGroupId);
                  const childCount = childCountOf(g.ageGroupId);
                  const { upcoming } = priceStatus(items.find((s) => s.ageGroupId === g.ageGroupId)?.prices, g.ageGroupId, today);
                  return (
                    <tr key={g.ageGroupId}>
                      <td>
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
                      <td>
                        <div className="td-overview__price">
                          <strong>{g.price ? formatMoney(Number(g.price)) : 'Chưa thiết lập'}</strong>
                          {upcoming && (
                            <span className="text-xs text-2">
                              Giá mới {formatMoney(upcoming.price)} từ {formatDate(upcoming.effectiveFrom)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="td-overview__norms">
                          {NORM_COLUMNS.map(({ key }) => (
                            <span key={key}>
                              <b>{NORM_SHORT_LABELS[key]}</b> {rangeLabel(g.norms[key], key === 'kcal' ? '' : '%')}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <StatusBadge tone={g.enabled ? 'green' : 'gray'} label={g.enabled ? 'Đang áp dụng' : 'Không áp dụng'} />
                      </td>
                      <td className="text-right">
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
            <table className="table">
              <thead>
                <tr>
                  <th className="td-num-col" aria-label="Số thứ tự" />
                  <th>Nhóm trẻ tại trường</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                <tr className="td-grp-row">
                  <td colSpan={3}>Nhà trẻ (24–36 tháng)</td>
                </tr>
                {groupRows(form.groups.filter((g) => g.ageGroupId === 'ag-2'))}
                <tr className="td-grp-row">
                  <td colSpan={3}>Mẫu giáo (3–6 tuổi)</td>
                </tr>
                {groupRows(form.groups.filter((g) => g.ageGroupId !== 'ag-2'))}
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
                      {info.range} · {childCountOf(g.ageGroupId) ?? 0} trẻ
                    </span>
                  </span>
                  <span className="td-acc__summary">
                    {g.enabled
                      ? `${g.meals.length} bữa · ${formatMoney(Number(g.price))} / ngày · ${g.norms.kcal[0]}–${g.norms.kcal[1]} kcal`
                      : 'Không áp dụng'}
                  </span>
                </button>
                <div className="row td-card-tools">
                  {upcoming && (
                    <span className="text-sm muted">{`Giá mới ${formatMoney(upcoming.price)} từ ${formatDate(upcoming.effectiveFrom)}`}</span>
                  )}
                  <button type="button" className="link-btn text-sm" onClick={() => setHistoryOf(g.ageGroupId)}>
                    <History size={15} /> Lịch sử giá
                  </button>
                  <span className="row td-switch-row fw-600 text-sm">
                    Áp dụng
                    <Switch
                      checked={g.enabled}
                      disabled={!canEdit}
                      label={`Áp dụng ${info.short}`}
                      onChange={(v) => setGroup(g.ageGroupId, (x) => (x.enabled = v))}
                    />
                  </span>
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
                      <div className="table-wrap">
                        <table className="table td-norm">
                          <thead>
                            <tr>
                              <th rowSpan={2}>Bữa ăn</th>
                              <th rowSpan={2} className="center">
                                {NORM_COLUMNS[0].label}
                              </th>
                              <th colSpan={3} className="center">
                                Tỷ lệ năng lượng từ các chất (%)
                              </th>
                            </tr>
                            <tr>
                              {NORM_COLUMNS.slice(1).map((c) => (
                                <th key={c.key} className={`center ${NORM_TONE[c.key]}`}>
                                  {c.label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {g.meals.map((m, i) => {
                              const base = isBaseMeal(g.ageGroupId, m);
                              const k = `${g.ageGroupId}.meals.${i}`;
                              return (
                                <tr key={m.code || `new-${i}`}>
                                  <td>
                                    {canEdit ? (
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
                                  {i === 0 &&
                                    NORM_COLUMNS.map((c) => (
                                      <td key={c.key} rowSpan={g.meals.length} className="center td-norm__range">
                                        <RangeInput
                                          value={g.norms[c.key]}
                                          readOnly={!canEdit}
                                          label={c.label}
                                          invalid={!!err(`${g.ageGroupId}.norms.${c.key}`)}
                                          onChange={(v) => setGroup(g.ageGroupId, (x) => (x.norms[c.key] = v))}
                                        />
                                        {err(`${g.ageGroupId}.norms.${c.key}`) && (
                                          <span className="field__error">{err(`${g.ageGroupId}.norms.${c.key}`)}</span>
                                        )}
                                      </td>
                                    ))}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      {canEdit && (
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
        message="Định mức và bữa ăn áp dụng ngay cho các kiểm tra thực đơn. Giá đã đổi áp dụng từ ngày bạn chọn."
        confirmLabel="Lưu"
        onConfirm={save}
        onClose={() => setConfirm(false)}
      >
        <div className="td-confirm-fields">
          <FormField label="Giá mới áp dụng từ ngày" required error={err('effectiveFrom')}>
            <input
              type="date"
              className="input"
              min={today}
              value={form.effectiveFrom}
              onChange={(e) => update((f) => ({ ...f, effectiveFrom: e.target.value }))}
            />
          </FormField>
          <FormField label="Lý do thay đổi" error={err('reason')} hint="Bắt buộc khi sửa giá đã áp dụng">
            <input
              className="input"
              maxLength={200}
              value={form.reason}
              onChange={(e) => update((f) => ({ ...f, reason: e.target.value }))}
            />
          </FormField>
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
        title={`Lịch sử giá · ${historyGroup ? groupInfo(historyOf).short : ''}`}
        onClose={() => setHistoryOf(null)}
      >
        {historyGroup?.prices.length ? (
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
