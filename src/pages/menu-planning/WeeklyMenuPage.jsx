import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Copy, Lock, Pencil, Plus, Send, Sparkles } from '@/components/ui/icons';
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
import { WeekPicker } from '@/components/form/WeekPicker';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { AiWorkingOverlay } from '@/components/ui/AiWorkingOverlay';
import { Modal } from '@/components/ui/Modal';
import { useAiRun } from '@/hooks/useAiRun';
import { WeeklyStatusBadge } from '@/components/menu-planning/MenuBadges';
import { WeekGrid } from '@/components/menu-planning/WeekGrid';
import { WeekBalanceTable } from '@/components/menu-planning/WeekBalanceTable';
import { AiWeekComposer } from '@/components/menu-planning/AiWeekComposer';
import { DayNormDetail } from '@/components/menu-planning/DayNormDetail';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { dayLabel, groupIssues, weekIssues } from '@/utils/menu-planning/menuChecks';
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

// Ngày trong tuần trước dời sang tuần này (giữ thực đơn mẫu và món đã sửa)
const shiftDays = (days, weekStart) =>
  weekDates(weekStart).map((date, i) => {
    const d = days[i] || {};
    return { date, holiday: false, note: '', menuId: d.holiday ? null : d.menuId, meals: d.holiday ? [] : d.meals };
  });
const SHORT_DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const shortDay = (iso) => `${SHORT_DAYS[new Date(`${iso}T00:00:00`).getDay()]} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/**
 * Bước 4 luồng dinh dưỡng – thực đơn tuần trên một trang: thanh chọn nhóm tuổi + tuần; bảng cột là các thứ, gom theo bữa
 * (đầu cột có nhãn "Đạt"/"N lưu ý", bấm mở chi tiết so định mức); dưới bảng là lưu ý gom theo vấn đề và số liệu thu gọn.
 * PHT xuất bản; HT chỉ xem bản đã xuất bản.
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
  const { running: fixing, run: runAi } = useAiRun();
  const [showFixes, setShowFixes] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [openDay, setOpenDay] = useState(null);
  const canManage = access.canManage;

  // Mở từ màn gợi ý AI cũ (?aiDraftId=): nạp bản nháp tuần để dùng khi tuần chưa có thực đơn
  const aiDraftId = params.get('aiDraftId');
  useEffect(() => {
    if (!aiDraftId) return undefined;
    let ignore = false; // đổi bản nháp/rời trang ⇒ bỏ kết quả cũ
    getAiDraft(aiDraftId, user)
      .then((d) => {
        if (ignore) return;
        setAiDraft(d);
        setParams({ ag: d.ageGroupId, week: d.weekStart }, { replace: true });
      })
      .catch((err) => !ignore && toast.error(err, 'Không mở được bản nháp AI'));
    return () => {
      ignore = true;
    };
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
  const go = (next) => setParams({ ag, week, ...next }, { replace: true });

  const run = async (fn, ok) => {
    setBusy(true);
    try {
      const out = await fn();
      if (ok) toast.success(ok);
      reload();
      return out ?? true;
    } catch (err) {
      toast.error(err, 'Chưa thực hiện được');
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
  // Cả lượt (tuần tự từng ngày) chạy trong một runAi ⇒ một lớp phủ liền mạch, không chớp giữa các ngày
  const askFixes = async (dates) => {
    await runAi(() => suggestFixes(dates));
    setShowFixes(true);
  };
  const suggestFixes = async (dates) => {
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
          <p className="page__desc">Mỗi ngày lấy từ một thực đơn mẫu, sửa thêm được.</p>
        </div>
      </div>
      {/* Chọn nhóm tuổi, tuần và nút thao tác ở hàng riêng để không chen vào hàng tiêu đề */}
      <div className="td-week-toolbar">
        <div className="tabs tabs--pill" role="tablist" aria-label="Nhóm tuổi">
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              role="tab"
              aria-selected={g.id === ag}
              className={`tab ${g.id === ag ? 'tab--active' : ''}`}
              onClick={() => setParams({ ag: g.id, week })}
            >
              {g.shortName}
            </button>
          ))}
        </div>
        <WeekPicker value={week} thisWeek={mondayOf(today)} onChange={(w) => setParams({ ag, week: w })} />
      </div>
      <div className="td-week-bar">
        {wm && (
          <div className="row td-week-status">
            <WeeklyStatusBadge status={wm.status} />
            <span className="text-sm muted">
              {wm.code} · phiên bản {wm.version}
              {wm.publishedAt && ` · xuất bản ${formatDateTime(wm.publishedAt)}`}
            </span>
            {/* Nhãn nguồn gốc, hiện cả khi đã xuất bản nên không dùng AiDraftLabel ("cần người duyệt") */}
            {wm.aiDraftId && <StatusBadge tone="purple" icon={Sparkles} label="Soạn từ bản nháp AI" />}
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
        )}
        <div className="row td-week-toolbar__actions">
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
  const grouped = groupIssues(issues);
  const issuesByDate = Object.fromEntries((wm?.days || []).map((d) => [d.date, issues.filter((x) => x.date === d.date)]));

  const fixList = (
    <ul className="td-review">
      {issueDates
        .filter((date) => fixes[date])
        .map((date) => {
          const fix = fixes[date];
          return (
            <li key={date}>
              <div className="td-review__day">
                <b>{dayLabel(date)}</b>
              </div>
              {fix?.error && <p className="td-flat text-sm muted">{fix.error}</p>}
              {fix?.proposal && (
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
  );

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
              issuesByDate={issuesByDate}
              onOpenDay={setOpenDay}
            />
          </section>
          <section className="card">
            {/* Lưu ý gom theo nội dung (mỗi vấn đề một dòng + các ngày), không lặp lại theo từng ngày */}
            <div className="card__header">
              <div>
                <h2 className="card__title">{editable ? 'Cần sửa trước khi xuất bản' : 'Lưu ý trong tuần'}</h2>
                <span className="text-sm muted">
                  Hệ thống tự kiểm tra theo định mức, tiền ăn và dị ứng ở Thiết lập. Bấm vào ngày để xem số liệu.
                </span>
              </div>
              {editable && issueDates.length > 0 && (
                <button
                  type="button"
                  className="btn btn--sm btn--outline-primary"
                  disabled={busy || fixing}
                  onClick={() => askFixes(issueDates)}
                >
                  <Sparkles size={14} /> AI gợi ý cách sửa
                </button>
              )}
            </div>
            {grouped.length ? (
              <ul className="td-issues">
                {grouped.map((g) => (
                  <li key={g.text} className="td-issues__item">
                    <StatusBadge tone={g.tone === 'bad' ? 'red' : 'orange'} label={g.tone === 'bad' ? 'Cần sửa' : 'Nên xem'} />
                    <span className="td-issues__text">{g.text}</span>
                    <span className="td-issues__days">
                      {g.dates.map((date) => (
                        <button key={date} type="button" className="td-day-chip" onClick={() => setOpenDay(date)} title={dayLabel(date)}>
                          {shortDay(date)}
                        </button>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="td-card-note td-flat muted">Các ngày đều đạt, không có gì cần sửa.</p>
            )}
            {editable && Object.values(fixes).some(Boolean) && (
              <>
                <h3 className="td-fix-title text-sm">Gợi ý của AI</h3>
                {fixList}
              </>
            )}
            <details className="td-balance-toggle">
              <summary>Xem số liệu dinh dưỡng và tiền ăn từng ngày</summary>
              <WeekBalanceTable wm={wm} catalog={catalog} />
            </details>
          </section>
          <DayNormDetail
            open={!!openDay}
            day={wm.days.find((d) => d.date === openDay)}
            wm={wm}
            catalog={catalog}
            menuName={menus.find((m) => m.id === wm.days.find((d) => d.date === openDay)?.menuId)?.name}
            issues={issues.filter((x) => x.date === openDay)}
            onClose={() => setOpenDay(null)}
          />
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
        {grouped.length > 0 && <p className="td-warn td-flat">Còn {grouped.length} lưu ý ở mục "Cần sửa trước khi xuất bản".</p>}
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
      {/* AI xong ⇒ gợi ý mở trong modal; đóng modal thì khối "Gợi ý của AI" trên trang vẫn còn (user chốt) */}
      <Modal
        open={showFixes && editable && Object.values(fixes).some(Boolean)}
        onClose={() => setShowFixes(false)}
        size="lg"
        title="Gợi ý của AI"
        footer={
          <button type="button" className="btn" onClick={() => setShowFixes(false)}>
            Đóng, xử lý sau
          </button>
        }
      >
        {fixList}
      </Modal>
      {fixing && <AiWorkingOverlay kind="cooking" text="Đang tìm món thay cho ngày chưa đạt…" />}
    </div>
  );
}
