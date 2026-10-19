import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Copy, ListChecks, Lock, Pencil, Plus, Send, Sparkles } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import {
  useAllergyContext,
  useAllergyMenus,
  useMenuAccess,
  useMenuCatalog,
  useWeeklyMenu,
  useWeeklyMenus,
} from '@/hooks/menu-planning/useMenuPlanning';
import {
  applyDayFix,
  createWeeklyReplacement,
  dismissAiDraft,
  generateAiSuggestion,
  getAiDraft,
  publishWeeklyMenu,
  saveDayAdjustment,
  saveWeeklyMenu,
} from '@/services/menu-planning/menuPlanningService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { FormField } from '@/components/form/FormField';
import { EmptyState, ErrorState, LoadingState, Spinner } from '@/components/ui/States';
import { WeekGrid } from '@/components/menu-planning/WeekGrid';
import { WeekBalanceTable } from '@/components/menu-planning/WeekBalanceTable';
import { AiWeekComposer } from '@/components/menu-planning/AiWeekComposer';
import { dayLabel, weekIssues } from '@/utils/menu-planning/menuChecks';
import { activeAgeGroups } from '@/utils/menu-planning/nutritionSetup';
import { weeklyCrumbs } from '@/utils/menu-planning/breadcrumbs';
import { formatDateTime, todayInput } from '@/utils/format';
import {
  AI_DRAFT_KIND,
  AI_LABEL,
  DISH_TYPE,
  REPEAT_WINDOW_DAYS,
  RECORD_STATUS,
  WEEKLY_STATUS,
  WEEKLY_STATUS_LABELS,
  addDays,
  mondayOf,
  weekDates,
  weekLabel,
} from '@/models/menu-planning/menuPlanningConstants';
import '@/styles/modules/menu-planning.css';

const STATUS_TONE = { DRAFT: 'orange', PUBLISHED: 'green', REPLACED: 'gray' };
// Ngày trong tuần trước dời sang tuần này (giữ thực đơn mẫu và món đã sửa)
const shiftDays = (days, weekStart) =>
  weekDates(weekStart).map((date, i) => {
    const d = days[i] || {};
    return { date, holiday: false, note: '', menuId: d.holiday ? null : d.menuId, meals: d.holiday ? [] : d.meals };
  });

/**
 * Bước 4 luồng dinh dưỡng – thực đơn tuần trên một trang: chọn nhóm tuổi + tuần; bảng cột là các thứ,
 * bữa trưa tách theo loại món; "Cần xem lại" và bảng cân đối chung ở cuối. PHT xuất bản; HT chỉ xem bản đã xuất bản.
 */
export default function WeeklyMenuPage() {
  const { user } = useAuth();
  const toast = useToast();
  const access = useMenuAccess();
  const { catalog, loading: catLoading } = useMenuCatalog();
  const [params, setParams] = useSearchParams();
  const today = todayInput();
  const groups = activeAgeGroups(catalog.nutritionSetups);
  const ag = params.get('ag') || groups[0]?.id || 'ag-4';
  const week = params.get('week') || mondayOf(today);
  const { items: list, loading, error, reload } = useWeeklyMenus({ ageGroupId: ag });
  const { rows: allergyRows } = useAllergyContext(ag);
  const { items: allergyMenus } = useAllergyMenus({ ageGroupId: ag });
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [reason, setReason] = useState('');
  const [aiDraft, setAiDraft] = useState(null);
  const [fixes, setFixes] = useState({});
  const [fixing, setFixing] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const canManage = access.canManage;

  // Mở từ màn gợi ý AI cũ (?aiDraftId=): nạp bản nháp tuần để dùng khi tuần chưa có thực đơn
  const aiDraftId = params.get('aiDraftId');
  useEffect(() => {
    if (!aiDraftId) return;
    getAiDraft(aiDraftId, user)
      .then((d) => {
        setAiDraft(d);
        setParams({ ag: d.ageGroupId, week: d.weekStart }, { replace: true });
      })
      .catch((err) => toast.error(err.message, 'Không mở được bản nháp AI'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiDraftId]);

  const lonelyId = params.get('id') && !params.get('ag') ? params.get('id') : null;
  const { item: linked } = useWeeklyMenu(lonelyId);
  useEffect(() => {
    if (linked) setParams({ ag: linked.ageGroupId, week: linked.weekStart, id: linked.id }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linked]);

  const versions = list.filter((w) => w.weekStart === week).sort((a, b) => b.version - a.version);
  const pinned = params.get('id') && versions.find((w) => w.id === params.get('id'));
  // PHT xem bản nháp mới nhất nếu có; người khác chỉ có bản đã xuất bản
  const wm =
    pinned ||
    versions.find((w) => w.status === WEEKLY_STATUS.DRAFT) ||
    versions.find((w) => w.status === WEEKLY_STATUS.PUBLISHED) ||
    versions[0] ||
    null;
  const previous = list.find((w) => w.weekStart === addDays(week, -7) && w.status === WEEKLY_STATUS.PUBLISHED);
  const editable = canManage && wm?.status === WEEKLY_STATUS.DRAFT;
  const menus = catalog.menus.filter((m) => m.ageGroupId === ag && m.status !== RECORD_STATUS.INACTIVE);
  const weekOptions = [...new Set([...Array.from({ length: 10 }, (_, i) => addDays(mondayOf(today), (i - 3) * 7)), week])].sort();
  const go = (next) => setParams({ ag, week, ...next }, { replace: true });

  const run = async (fn, ok) => {
    setBusy(true);
    try {
      const out = await fn();
      if (ok) toast.success(ok);
      reload();
      return out ?? true;
    } catch (err) {
      toast.error(err.message, 'Chưa thực hiện được');
      return null;
    } finally {
      setBusy(false);
    }
  };
  const daysPayload = (patch) =>
    wm.days.map((d) => {
      const p = patch(d);
      return p || { date: d.date, holiday: d.holiday, note: d.note, menuId: d.menuId, meals: d.meals };
    });
  const create = (days, aiDraftIdToUse) =>
    run(async () => {
      const saved = await saveWeeklyMenu(null, { ageGroupId: ag, weekStart: week, days, aiDraftId: aiDraftIdToUse }, user);
      go({ id: saved.id });
      return saved;
    }, 'Đã tạo bản nháp thực đơn tuần.');
  const pickMenu = (date, menuId) =>
    run(() =>
      saveWeeklyMenu(
        wm.id,
        { ageGroupId: ag, weekStart: week, days: daysPayload((d) => (d.date === date ? { date, menuId } : null)) },
        user,
      ),
    );
  const setHoliday = (date, on) => {
    if (on) {
      setReason('');
      setConfirm({ kind: 'holiday', date });
    } else
      run(() =>
        saveWeeklyMenu(wm.id, { ageGroupId: ag, weekStart: week, days: daysPayload((d) => (d.date === date ? { date } : null)) }, user),
      );
  };
  const changeMeals = (date, meals) => run(() => saveDayAdjustment(wm.id, date, meals, user));
  const dishName = (id) => catalog.dishById[id]?.name || 'Món đã xóa';
  // AI chỉ nhận món của từng ngày (không có dữ liệu trẻ); ngày AI không tìm được món thay thì người soạn sửa tay
  const askFixes = async (dates) => {
    setFixing(true);
    const next = {};
    // Món mặn vừa gợi ý cho ngày trước cũng tính là đã dùng, để đổi hết các ngày không sinh ra món lặp mới
    const planned = [];
    for (const date of dates) {
      const day = wm.days.find((d) => d.date === date);
      // Món mặn đã dùng trong 7 ngày quanh ngày này (cả tuần trước) để AI không gợi ý món lặp
      const near = [...(previous?.days || []), ...wm.days].filter(
        (d) => d.date !== date && !d.holiday && Math.abs(new Date(d.date) - new Date(date)) < REPEAT_WINDOW_DAYS * 86400000,
      );
      const recentMainIds = [
        ...new Set(
          near
            .flatMap((d) => (d.meals || []).flatMap((m) => m.items))
            .map((i) => i.dishId)
            .concat(planned)
            .filter((id) => catalog.dishById[id]?.type === DISH_TYPE.MAIN),
        ),
      ];
      try {
        next[date] = await generateAiSuggestion(
          { kind: AI_DRAFT_KIND.DAY_FIX, ageGroupId: ag, date, meals: day.meals, menuId: day.menuId, recentMainIds, weeklyMenuId: wm.id },
          user,
        );
        planned.push(next[date].proposal.toDishId);
      } catch (err) {
        next[date] = { error: err.message };
      }
    }
    setFixes(next);
    setFixing(false);
  };
  const applyFix = async (date) => {
    const out = await run(() => applyDayFix(fixes[date].id, wm.id, user), 'Đã đổi món theo gợi ý.');
    if (out) setFixes((f) => ({ ...f, [date]: undefined }));
  };
  const skipFix = async (date) => {
    if (fixes[date]?.id) await dismissAiDraft(fixes[date].id, user).catch(() => null);
    setFixes((f) => ({ ...f, [date]: undefined }));
  };

  const head = (
    <>
      <Breadcrumb items={weeklyCrumbs()} />
      <div className="page__head">
        <div>
          <h1 className="page__title">Thực đơn tuần</h1>
          <p className="page__desc">
            {groups.find((g) => g.id === ag)?.shortName || ''} · {weekLabel(week)}. Mỗi ngày lấy từ một thực đơn mẫu, sửa thêm được.
          </p>
        </div>
        <div className="page__actions">
          <select className="select td-auto" value={ag} onChange={(e) => setParams({ ag: e.target.value, week })} aria-label="Nhóm tuổi">
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.shortName}
              </option>
            ))}
          </select>
          <select className="select td-auto" value={week} onChange={(e) => setParams({ ag, week: e.target.value })} aria-label="Tuần">
            {weekOptions.map((w) => (
              <option key={w} value={w}>
                {weekLabel(w)}
              </option>
            ))}
          </select>
          {!canManage && (
            <span className="chip chip--gray">
              <Lock size={14} /> Chỉ xem
            </span>
          )}
          {canManage && (!wm || editable) && (
            <button type="button" className="btn btn--outline-primary" disabled={busy} onClick={() => setAiOpen(true)}>
              <Sparkles size={16} /> AI soạn tuần
            </button>
          )}
          {editable && previous && (
            <button type="button" className="btn" disabled={busy} onClick={() => setConfirm({ kind: 'copy' })}>
              <Copy size={16} /> Sao chép tuần trước
            </button>
          )}
          {editable && (
            <button type="button" className="btn btn--primary" disabled={busy} onClick={() => setConfirm({ kind: 'publish' })}>
              <Send size={16} /> Xuất bản
            </button>
          )}
          {canManage && wm?.status === WEEKLY_STATUS.PUBLISHED && !versions.some((w) => w.status === WEEKLY_STATUS.DRAFT) && (
            <button
              type="button"
              className="btn btn--outline-primary"
              disabled={busy}
              onClick={() => {
                setReason('');
                setConfirm({ kind: 'replace' });
              }}
            >
              <Pencil size={16} /> Tạo phiên bản thay thế
            </button>
          )}
        </div>
      </div>
    </>
  );

  if (loading || catLoading || access.loading)
    return (
      <div className="page">
        {head}
        <LoadingState />
      </div>
    );
  if (error)
    return (
      <div className="page">
        {head}
        <ErrorState error={error} onRetry={reload} />
      </div>
    );

  const issues = wm ? weekIssues({ wm, catalog, previousDays: previous?.days || [], allergyRows, allergyMenus }) : [];
  const issueDates = [...new Set(issues.map((x) => x.date))];

  return (
    <div className="page td-sections">
      {head}
      {!wm ? (
        <>
          <section className="card">
            <EmptyState
              title={canManage ? 'Tuần này chưa có thực đơn' : 'Tuần này chưa có thực đơn đã xuất bản'}
              description={
                canManage
                  ? 'Soạn tay, sao chép tuần trước hoặc nhờ AI soạn từ thực đơn mẫu của trường.'
                  : 'Phó hiệu trưởng xuất bản xong thì thực đơn hiện ở đây.'
              }
              action={
                canManage && (
                  <div className="row td-chips">
                    <button type="button" className="btn btn--primary" disabled={busy} onClick={() => setAiOpen(true)}>
                      <Sparkles size={16} /> AI soạn tuần
                    </button>
                    <button type="button" className="btn" disabled={busy} onClick={() => create([])}>
                      <Plus size={16} /> Soạn tay
                    </button>
                    {previous && (
                      <button type="button" className="btn" disabled={busy} onClick={() => create(shiftDays(previous.days, week))}>
                        <Copy size={16} /> Sao chép tuần trước
                      </button>
                    )}
                    {aiDraft && aiDraft.weekStart === week && aiDraft.ageGroupId === ag && (
                      <button
                        type="button"
                        className="btn btn--outline-primary"
                        disabled={busy}
                        onClick={() => create(aiDraft.days, aiDraft.id)}
                      >
                        <Sparkles size={16} /> Dùng bản nháp AI
                      </button>
                    )}
                  </div>
                )
              }
            />
          </section>
        </>
      ) : (
        <>
          <div className="row td-week-status">
            <span className={`chip chip--${STATUS_TONE[wm.status]}`}>{WEEKLY_STATUS_LABELS[wm.status]}</span>
            <span className="text-sm muted">
              {wm.code} · phiên bản {wm.version}
              {wm.publishedAt && ` · xuất bản ${formatDateTime(wm.publishedAt)}`}
            </span>
            {wm.aiDraftId && (
              <span className="chip chip--purple">
                <Sparkles size={13} /> Soạn từ bản nháp AI
              </span>
            )}
            {versions.length > 1 && (
              <span className="row td-chips text-sm">
                Phiên bản:
                {versions.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    className={`link-btn ${v.id === wm.id ? 'fw-600' : ''}`}
                    onClick={() => go({ id: v.id })}
                  >
                    v{v.version} ({WEEKLY_STATUS_LABELS[v.status]})
                  </button>
                ))}
              </span>
            )}
          </div>
          {wm.status === WEEKLY_STATUS.DRAFT && wm.aiDraftId && (
            <div className="alert alert--info">
              <Sparkles size={18} />
              <div>
                <b>{AI_LABEL}.</b> Bản này do AI soạn; bạn xem từng ngày, sửa nếu cần rồi mới xuất bản.
              </div>
            </div>
          )}
          <section className="card">
            <WeekGrid
              wm={wm}
              catalog={catalog}
              menus={menus}
              allergyRows={allergyRows}
              allergyMenus={allergyMenus}
              editable={editable}
              busy={busy}
              onPickMenu={pickMenu}
              onHoliday={setHoliday}
              onChangeMeals={changeMeals}
            />
          </section>
          <section className="card">
            <div className="card__header">
              <h2 className="card__title">
                <ListChecks size={18} /> {issueDates.length ? `Cần xem lại (${issueDates.length} ngày)` : 'Cần xem lại'}
              </h2>
              {editable && issueDates.length > 0 && (
                <button
                  type="button"
                  className="btn btn--sm btn--outline-primary"
                  disabled={busy || fixing}
                  onClick={() => askFixes(issueDates)}
                >
                  {fixing ? <Spinner small /> : <Sparkles size={14} />} AI gợi ý cách sửa
                </button>
              )}
            </div>
            {issueDates.length ? (
              <>
                <p className="td-card-note td-flat text-sm muted">Hệ thống tự kiểm tra theo định mức và tiền ăn ở Thiết lập.</p>
                <ul className="td-review">
                  {issueDates.map((date) => {
                    const fix = fixes[date];
                    return (
                      <li key={date}>
                        <div className="td-review__day">
                          <b>{dayLabel(date)}</b>
                          {issues
                            .filter((x) => x.date === date)
                            .map((x, i) => (
                              <span key={i} className={x.tone === 'bad' ? 'td-bad' : 'td-warn'}>
                                {x.text}
                              </span>
                            ))}
                        </div>
                        {editable && fix?.error && <p className="td-flat text-sm muted">{fix.error}</p>}
                        {editable && fix?.proposal && (
                          <div className="td-fix">
                            <span className="td-fix__ai">
                              <Sparkles size={14} /> Gợi ý:{' '}
                              {fix.proposal.fromDishId ? (
                                <>
                                  đổi <del>{dishName(fix.proposal.fromDishId)}</del> → <ins>{dishName(fix.proposal.toDishId)}</ins>
                                </>
                              ) : (
                                <>
                                  thêm <ins>{dishName(fix.proposal.toDishId)}</ins>
                                </>
                              )}
                            </span>
                            <button type="button" className="btn btn--sm btn--primary" disabled={busy} onClick={() => applyFix(date)}>
                              {fix.proposal.fromDishId ? 'Đổi món' : 'Thêm món'}
                            </button>
                            <button type="button" className="btn btn--sm btn--ghost" disabled={busy} onClick={() => skipFix(date)}>
                              Để sau
                            </button>
                            <span className="text-xs muted td-fix__reason">{fix.reason}</span>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <p className="td-card-note td-flat muted">Các ngày đều đạt, không có gì cần xem lại.</p>
            )}
          </section>
          <WeekBalanceTable wm={wm} catalog={catalog} />
        </>
      )}

      {canManage && (
        <AiWeekComposer
          open={aiOpen}
          onClose={() => setAiOpen(false)}
          ageGroupId={ag}
          groupName={groups.find((g) => g.id === ag)?.shortName}
          weekStart={week}
          catalog={catalog}
          menus={menus}
          allergyRows={allergyRows}
          allergyMenus={allergyMenus}
          current={editable ? wm : null}
          busy={busy}
          onUse={(d) =>
            wm
              ? run(
                  () => saveWeeklyMenu(wm.id, { ageGroupId: ag, weekStart: week, days: d.days, aiDraftId: d.id }, user),
                  'Đã dùng bản AI soạn.',
                )
              : create(d.days, d.id)
          }
        />
      )}
      <ConfirmationModal
        open={confirm?.kind === 'publish'}
        title="Xuất bản thực đơn tuần"
        message={`Xuất bản thực đơn ${weekLabel(week)}? Hiệu trưởng, bếp và giáo viên sẽ nhận thông báo. Sau khi xuất bản, muốn sửa phải tạo phiên bản thay thế.`}
        confirmLabel="Xuất bản"
        onConfirm={async () => {
          await run(() => publishWeeklyMenu(wm.id, user), 'Đã xuất bản thực đơn tuần.');
          setConfirm(null);
        }}
        onClose={() => setConfirm(null)}
      >
        {issueDates.length > 0 && <p className="td-warn td-flat">Còn {issueDates.length} ngày ở mục "Cần xem lại".</p>}
      </ConfirmationModal>
      <ConfirmationModal
        open={confirm?.kind === 'copy'}
        title="Sao chép tuần trước"
        message="Thay các ngày của bản nháp bằng thực đơn tuần trước đã xuất bản?"
        confirmLabel="Sao chép"
        onConfirm={async () => {
          await run(
            () => saveWeeklyMenu(wm.id, { ageGroupId: ag, weekStart: week, days: shiftDays(previous.days, week) }, user),
            'Đã sao chép tuần trước.',
          );
          setConfirm(null);
        }}
        onClose={() => setConfirm(null)}
      />
      <ConfirmationModal
        open={confirm?.kind === 'replace'}
        title="Tạo phiên bản thay thế"
        message="Bản đã xuất bản vẫn dùng cho tới khi bạn xuất bản phiên bản mới."
        confirmLabel="Tạo phiên bản"
        onConfirm={async () => {
          if (!reason.trim()) return;
          const draft = await run(() => createWeeklyReplacement(wm.id, reason.trim(), user), 'Đã tạo phiên bản thay thế.');
          if (draft) go({ id: draft.id });
          setConfirm(null);
        }}
        onClose={() => setConfirm(null)}
      >
        <div className="td-confirm-fields">
          <FormField label="Lý do thay đổi" required>
            <input className="input" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} />
          </FormField>
        </div>
      </ConfirmationModal>
      <ConfirmationModal
        open={confirm?.kind === 'holiday'}
        title="Đánh dấu ngày nghỉ"
        message="Ngày nghỉ không có thực đơn và không tính khi xuất bản."
        confirmLabel="Lưu"
        onConfirm={async () => {
          if (!reason.trim()) return;
          await run(() =>
            saveWeeklyMenu(
              wm.id,
              {
                ageGroupId: ag,
                weekStart: week,
                days: daysPayload((d) => (d.date === confirm.date ? { date: d.date, holiday: true, note: reason.trim() } : null)),
              },
              user,
            ),
          );
          setConfirm(null);
        }}
        onClose={() => setConfirm(null)}
      >
        <div className="td-confirm-fields">
          <FormField label="Lý do nghỉ" required>
            <input
              className="input"
              maxLength={100}
              placeholder="Ví dụ: nghỉ lễ"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </FormField>
        </div>
      </ConfirmationModal>
    </div>
  );
}
