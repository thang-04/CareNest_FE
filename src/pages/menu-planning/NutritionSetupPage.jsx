import { useEffect, useState } from 'react';
import { Lock, Question, Save, X } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useCatalogAccess, useNutritionSetups } from '@/hooks/menu-planning/useMenuPlanning';
import { catalogUsesApi, saveNutritionSetups } from '@/services/menu-planning/menuPlanningService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { SidePanel } from '@/components/ui/SidePanel';
import { Switch } from '@/components/ui/Switch';
import { Tabs } from '@/components/ui/Tabs';
import { RowActions } from '@/components/ui/RowActions';
import { FormField } from '@/components/form/FormField';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { NutritionGroupList, NutritionSetupGroup, rangeLabel, versionState } from '@/components/menu-planning/NutritionSetupGroup';
import { ageGroupById, isNurseryAgeGroup } from '@/models/School';
import { MEAL_SESSION_LABELS, addDays, formatMoney } from '@/models/menu-planning/menuPlanningConstants';
import { hasErrors, validateNutritionSetup } from '@/utils/menu-planning/menuPlanningValidation';
import { KCAL_NORM, STRUCTURE_NORM_COLUMNS, priceStatus, toSetupForm, toSetupPayload } from '@/utils/menu-planning/nutritionSetup';
import { setupCrumbs } from '@/utils/menu-planning/breadcrumbs';
import { clickableRowProps } from '@/utils/clickableRow';
import { formatDate, todayInput } from '@/utils/format';
import '@/styles/modules/menu-planning.css';

const TABS = [
  { key: 'overview', label: 'Tổng quan' },
  { key: 'groups', label: 'Nhóm độ tuổi' },
  { key: 'meals', label: 'Bữa ăn & chuẩn tạm' },
];
const isSet = (range) => rangeLabel(range) !== '—';
// Tên ngắn và độ tuổi tách từ tên nhóm "Nhà trẻ (24–36 tháng)"
const groupInfo = (ageGroupId) => {
  const g = ageGroupById(ageGroupId);
  return { short: g?.shortName || ageGroupId, range: g?.name.match(/\((.+)\)/)?.[1] || '' };
};
// Trạng thái nhóm: chưa đủ năng lượng + P:L:G thì thực đơn chưa đánh giá được ⇒ báo vàng thay vì "Đang áp dụng"
const groupStatus = (g) => {
  if (!g.enabled) return { tone: 'gray', label: 'Không áp dụng' };
  const coreSet = [KCAL_NORM, ...STRUCTURE_NORM_COLUMNS].every((c) => isSet(g.norms[c.key]));
  return coreSet ? { tone: 'green', label: 'Đang áp dụng' } : { tone: 'orange', label: 'Chưa nhập chuẩn' };
};

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
  const [groupKey, setGroupKey] = useState(null);
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
        </div>
        {form &&
          (canEdit ? (
            <div className="page__actions">
              {dirty && <span className="text-sm muted">Có thay đổi chưa lưu</span>}
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
  const groupHasError = (id) => Object.keys(errors).some((k) => k.startsWith(`${id}.`));
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
  const openGroup = (ageGroupId) => {
    setGroupKey(ageGroupId);
    setTab('meals');
  };
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
      // Chuyển tới nhóm tuổi đầu tiên có ô lỗi để thấy ngay ô cần sửa
      const firstBad = form.groups.find((g) => tableErrors.some((k) => k.startsWith(`${g.ageGroupId}.`)));
      if (firstBad) openGroup(firstBad.ageGroupId);
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

  const setupOf = (ageGroupId) => items.find((s) => s.ageGroupId === ageGroupId);
  const historyGroup = historyOf && setupOf(historyOf);
  const childCountOf = (ageGroupId) => setupOf(ageGroupId)?.childCount;
  const activeGroup = form.groups.find((g) => g.ageGroupId === groupKey) || form.groups[0];
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
        <Tabs items={tabs} value={tab} onChange={setTab} variant="pill" ariaLabel="Phần thiết lập" />
        <button type="button" className="link-btn" onClick={() => setBasisOpen(true)}>
          <Question size={16} /> Căn cứ và hướng dẫn tổ chức bữa ăn
        </button>
      </div>

      {tab === 'overview' ? (
        <section className="card td-overview">
          <div className="td-overview__head">
            <div>
              <h2>Tổng quan theo nhóm tuổi</h2>
            </div>
          </div>
          <div className="table-wrap">
            <table className="table table--grid td-overview__table">
              <thead>
                <tr>
                  {/* Tổng quan chỉ giữ thông tin để chọn nhóm; P : L : G, định mức gam, vi chất xem ở tab chi tiết */}
                  <th className="td-sticky-first">Nhóm tuổi</th>
                  <th>Độ tuổi</th>
                  <th className="num">Số trẻ</th>
                  <th>Bữa phục vụ</th>
                  <th className="money">Giá suất / ngày</th>
                  <th className="num">Năng lượng (kcal)</th>
                  <th>Trạng thái</th>
                  {canEdit && <th className="cell--actions">Thao tác</th>}
                </tr>
              </thead>
              <tbody>
                {form.groups.map((g) => {
                  const info = groupInfo(g.ageGroupId);
                  const childCount = childCountOf(g.ageGroupId);
                  const { upcoming } = priceStatus(setupOf(g.ageGroupId)?.prices, g.ageGroupId, today);
                  return (
                    <tr key={g.ageGroupId} className="row-click" {...clickableRowProps(() => openGroup(g.ageGroupId))}>
                      <td className="td-sticky-first">
                        <strong>{info.short}</strong>
                      </td>
                      <td className="nowrap text-2">{info.range || '—'}</td>
                      <td className="num">{childCount == null ? '—' : childCount}</td>
                      <td>
                        {g.meals.length ? (
                          g.meals.map((meal) => meal.name || MEAL_SESSION_LABELS[meal.code] || 'Chưa đặt tên').join(', ')
                        ) : (
                          <span className="text-sm text-2">Chưa thiết lập</span>
                        )}
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
                      <td>
                        <StatusBadge {...groupStatus(g)} />
                      </td>
                      {canEdit && (
                        <td className="cell--actions">
                          <RowActions edit={{ onClick: () => openGroup(g.ageGroupId) }} name={info.short} />
                        </td>
                      )}
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
                  <th className="td-num-col">STT</th>
                  <th>Nhóm trẻ tại trường</th>
                  <th>Trạng thái</th>
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
        // Danh sách nhóm tuổi bên trái, chi tiết nhóm đang chọn bên phải trong một thẻ
        <div className="td-tpl-split td-setup-split">
          <NutritionGroupList
            value={activeGroup.ageGroupId}
            onChange={setGroupKey}
            items={form.groups.map((g) => {
              const info = groupInfo(g.ageGroupId);
              return {
                key: g.ageGroupId,
                name: info.short,
                range: info.range,
                price: g.enabled && g.price ? `${formatMoney(Number(g.price))} / ngày` : '',
                status: groupStatus(g),
                hasError: groupHasError(g.ageGroupId),
              };
            })}
          />
          <NutritionSetupGroup
            key={activeGroup.ageGroupId}
            group={activeGroup}
            info={groupInfo(activeGroup.ageGroupId)}
            childCount={childCountOf(activeGroup.ageGroupId)}
            setup={{
              versions: setupOf(activeGroup.ageGroupId)?.versions,
              upcoming: priceStatus(setupOf(activeGroup.ageGroupId)?.prices, activeGroup.ageGroupId, today).upcoming,
            }}
            usesApi={usesApi}
            canEdit={canEdit}
            today={today}
            err={err}
            setGroup={setGroup}
            onHistory={() => setHistoryOf(activeGroup.ageGroupId)}
          />
        </div>
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
