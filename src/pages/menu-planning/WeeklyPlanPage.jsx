import { useEffect, useMemo, useState } from 'react';
import { MENU_AI_ENABLED } from '@/config/env';
import { Tabs } from '@/components/ui/Tabs';
import { useSearchParams } from 'react-router-dom';
import { Copy, FileDown, History, Info, Pencil, Save, Scale, Send, Sparkles } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { DayEditorModal } from '@/components/menu-planning/DayEditorModal';
import { CopyDayModal } from '@/components/menu-planning/CopyDayModal';
import { AmendDayDialog } from '@/components/menu-planning/AmendDayDialog';
import { MealPlanRevisionsModal } from '@/components/menu-planning/MealPlanRevisionsModal';
import { PERMISSIONS } from '@/models/bePermissions';
import { hasBePermission } from '@/utils/bePermissions';
import { useToast } from '@/contexts/ToastContext';
import { Button, Checkbox, EmptyState, ErrorState, LoadingState, LockNote, PageHeader } from '@/components';
import { usePageReadOnly } from '@/contexts/PageReadOnlyContext';
import { WeekPicker } from '@/components/form/WeekPicker';
import { LeaveConfirmModal } from '@/components/ui/LeaveConfirmModal';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { MealPlanGrid } from '@/components/menu-planning/MealPlanGrid';
import { MealPlanStatusBadge } from '@/components/menu-planning/MenuBadges';
import { PublishWeekDialog } from '@/components/menu-planning/PublishWeekDialog';
import { MenuAiWeekModal } from '@/components/menu-planning/MenuAiWeekModal';
import { WeeklyMenuExportModal } from '@/components/menu-planning/WeeklyMenuExportModal';
import { useActiveDishes, useBeAgeGroups, useMealPlan, useWeekHolidays } from '@/hooks/menu-planning/useMealPlan';
import { useMenuTemplates } from '@/hooks/menu-planning/useMenuTemplates';
import { useLeaveGuard } from '@/hooks/useLeaveGuard';
import { mealPlanApi } from '@/services/mealPlanApi';
import {
  MEAL_BLOCK_LABELS,
  MEAL_PLAN_STATUS,
  MEAL_SESSION_LABELS,
  WEEKDAY_LABELS,
  schoolWeekStart,
} from '@/models/menu-planning/menuPlanningConstants';
import {
  applyHolidays,
  balanceHref,
  blockSessions,
  copyDay,
  dayBlockItems,
  draftFromPlan,
  holidayNames,
  isDirty,
  planBlocks,
  resolveWeekStart,
  setDayBlockItems,
  sharedSessions,
  syncSharedMeals,
} from '@/utils/menu-planning/mealPlanGrid';
import { applyTemplateDay, dayBlockItemCount, templateItemsForDate } from '@/utils/menu-planning/menuTemplateGrid';
import { weeklyCrumbs } from '@/utils/menu-planning/breadcrumbs';
import { formatDateTime, todayInput } from '@/utils/format';
import '@/styles/modules/menu-planning.css';

/**
 * Kế hoạch tuần theo khối (`/menu/weekly`): lưới ngày × bữa cho từng khối (nhà trẻ, mẫu giáo) chỉ liệt kê món, lưu nháp,
 * công bố cả tuần (dinh dưỡng xem ở Cân đối khẩu phần). "Đồng bộ bữa chung" chép món bữa cả hai khối cùng ăn sang khối kia. Nút theo cờ `canEdit`/`canPublish` BE trả; đã công bố thì chỉ xem. Tuần chọn trên URL (?week=, thứ Hai).
 */
export default function WeeklyPlanPage() {
  const toast = useToast();
  const [params] = useSearchParams();
  const today = todayInput();
  const week = resolveWeekStart(params.get('week'), today);
  const planQ = useMealPlan(week);
  const plan = planQ.data;
  const { dishes } = useActiveDishes();
  const { ageGroups } = useBeAgeGroups();
  const saved = useMemo(() => (plan ? draftFromPlan(plan) : null), [plan]);
  const { holidays } = useWeekHolidays(week);
  // Ngày trùng đợt nghỉ năm học (HT cấu hình ở Thiết lập năm học): { [date]: tên đợt nghỉ }
  const holidayMap = useMemo(() => holidayNames(saved, holidays || []), [saved, holidays]);
  const [draft, setDraft] = useState(null);
  const [blockKey, setBlockKey] = useState('');
  const [syncMeals, setSyncMeals] = useState(true);
  const [busy, setBusy] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [publishError, setPublishError] = useState('');
  // Mẫu ngày chờ xác nhận thay món: { day, template, count }
  const [pending, setPending] = useState(null);
  const [aiOpen, setAiOpen] = useState(false);
  // Ngày đang mở ở modal Sửa ngày / ngày nguồn khi chép (yyyy-mm-dd)
  const [editingDay, setEditingDay] = useState(null);
  const [copyFrom, setCopyFrom] = useState(null);
  // Sửa ngoại lệ ngày đã công bố (P-39): ngày đang sửa món, bước nhập lý do { date, items }, lịch sử sửa của tuần
  const [amendingDay, setAmendingDay] = useState(null);
  const [amendDraft, setAmendDraft] = useState(null);
  const [amendError, setAmendError] = useState('');
  const [revisionsOpen, setRevisionsOpen] = useState(false);
  const { user } = useAuth();

  // Kế hoạch mới về (đổi tuần, sau khi lưu, nạp lại) ⇒ bản nháp trên màn lấy lại từ BE
  useEffect(() => setDraft(saved), [saved]);

  const blocks = planBlocks(plan);
  const block = blocks.includes(blockKey) ? blockKey : blocks[0];
  const editable = !!plan?.canEdit && plan.status !== MEAL_PLAN_STATUS.PUBLISHED;
  const { reason: viewOnlyReason } = usePageReadOnly();
  const dirty = !!draft && !!saved && isDirty(draft, saved);
  // Bản nháp sửa được ⇒ ngày lễ tự thành ngày nghỉ (chạy sau effect nạp lại bản nháp ở trên, kể cả khi ngày nghỉ về muộn)
  useEffect(() => {
    if (editable) setDraft((d) => applyHolidays(d, holidayMap));
  }, [holidayMap, editable]);
  const autoOff = editable ? Object.keys(holidayMap).filter((date) => !saved?.days.find((d) => d.date === date)?.off) : [];
  // Modal AI hiện kcal theo nhóm tuổi đầu tiên của khối
  const blockGroups = (plan?.blocks || []).find((b) => b.block === block)?.ageGroupIds || [];
  const kcalAgeGroup = ageGroups.find((g) => blockGroups.some((id) => String(id) === String(g.id)));
  const shared = [...new Set(blocks.filter((other) => other !== block).flatMap((other) => sharedSessions(plan, block, other)))];
  const withSync = (before, after) => (syncMeals ? syncSharedMeals(before, after, plan, block) : after);
  const editDraft = (fn) => setDraft((d) => withSync(d, fn(d)));
  const templatesQ = useMenuTemplates({ block, status: 'ACTIVE' });
  const templates = editable ? templatesQ.data || [] : [];

  const dayTitle = (date) => {
    const i = draft?.days.findIndex((d) => d.date === date) ?? -1;
    return `${WEEKDAY_LABELS[i] || ''} ${date.slice(8, 10)}/${date.slice(5, 7)} · ${MEAL_BLOCK_LABELS[block] || block}`;
  };
  // Menu "…" đầu cột ngày: sửa trong modal to, chép ngày (khi sửa được); xem cân đối khi chỉ xem
  const dayActions = (day) => {
    const balance = { label: 'Mở ở Cân đối khẩu phần', icon: Scale, to: balanceHref({ week, block, date: day.date }) };
    // Tuần đã công bố: chỉ ngày BE cho phép (`canAmend`) mới có lối sửa ngoại lệ
    const amendAction = plan?.days.find((d) => d.date === day.date)?.canAmend
      ? [{ label: 'Sửa ngoại lệ', icon: Pencil, onClick: () => setAmendingDay(day.date) }]
      : [];
    return editable
      ? [
          { label: 'Sửa ngày', icon: Pencil, onClick: () => setEditingDay(day.date) },
          { label: 'Chép sang ngày…', icon: Copy, onClick: () => setCopyFrom(day.date) },
          balance,
        ]
      : [...amendAction, { label: 'Xem món trong ngày', icon: Info, onClick: () => setEditingDay(day.date) }, balance];
  };

  const fillDay = (day, template) => {
    editDraft((d) => applyTemplateDay(d, day.date, template));
    toast.success('Đã điền món theo mẫu.');
  };
  // Ngày đã có món của khối ⇒ hỏi trước khi thay bằng mẫu (agent chọn 2026-11-04, xem plan)
  const pickTemplate = (day, template) => {
    if (!template) return;
    // Bộ 4 tuần lấy Tuần 1 cùng thứ; thứ này chưa có món thì không thay gì, báo rõ thay vì xóa món đang có
    if (templateItemsForDate(template, day.date).length === 0) {
      toast.error('Mẫu chưa có món cho thứ này.', 'Chưa điền được theo mẫu');
      return;
    }
    const count = dayBlockItemCount(draft, day.date, block);
    if (count > 0) setPending({ day, template, count });
    else fillDay(day, template);
  };

  const save = async () => {
    setBusy(true);
    try {
      planQ.setData(await mealPlanApi.savePlan(week, draft));
      toast.success('Đã lưu nháp kế hoạch tuần.');
      return true;
    } catch (err) {
      toast.error(err, 'Chưa lưu được kế hoạch tuần');
      // Tuần vừa được công bố ở nơi khác: nạp lại để lưới khóa đúng
      if (err.status === 409) planQ.reload({ silent: true });
      return false;
    } finally {
      setBusy(false);
    }
  };
  const guard = useLeaveGuard({ when: dirty, onSave: save });

  const openPublish = () => {
    setPublishError('');
    setPublishOpen(true);
    // Lỗi chặn có thể đổi từ lần lưu trước (món, định mức): lấy lại trước khi người dùng quyết định
    planQ.reload({ silent: true });
  };
  const publish = async () => {
    setBusy(true);
    setPublishError('');
    try {
      planQ.setData(await mealPlanApi.publishPlan(week));
      setPublishOpen(false);
      toast.success('Đã công bố kế hoạch tuần.');
    } catch (err) {
      setPublishError(err.message);
      // 409: còn lỗi chặn ⇒ nạp lại kế hoạch để hộp thoại hiện danh sách lỗi mới nhất
      if (err.status === 409) await planQ.reload({ silent: true });
    } finally {
      setBusy(false);
    }
  };

  const savedDay = (date) => saved?.days.find((d) => d.date === date);
  const amend = async ({ reason, note }) => {
    setBusy(true);
    setAmendError('');
    try {
      const day = { ...savedDay(amendDraft.date), items: amendDraft.items, note };
      const next = await mealPlanApi.amendDay(week, day, reason);
      planQ.setData(next);
      setAmendDraft(null);
      // Cân đối chỉ cảnh báo, không chặn (P-39): báo để người sửa xem lại ở Cân đối khẩu phần
      const notes = next.issues.filter((i) => i.date === day.date && (i.severity === 'BLOCKING' || i.severity === 'WARNING'));
      if (notes.length) toast.warning(`Ngày này còn ${notes.length} lưu ý cân đối, xem ở Cân đối khẩu phần.`, 'Đã lưu thay đổi');
      else toast.success('Đã lưu thay đổi và báo phụ huynh, bếp.');
    } catch (err) {
      setAmendError(err.message);
      // 409: ngày vừa qua giờ chốt hoặc tuần đổi ở nơi khác ⇒ nạp lại để cờ canAmend đúng
      if (err.status === 409) planQ.reload({ silent: true });
    } finally {
      setBusy(false);
    }
  };

  const head = (
    <>
      <PageHeader crumbs={weeklyCrumbs()} title="Kế hoạch tuần" readOnly={!!plan && !plan.canEdit} />
      <div className="td-week-toolbar">
        {blocks.length > 0 && (
          <Tabs
            variant="pill"
            items={blocks.map((key) => ({ key, label: MEAL_BLOCK_LABELS[key] || key }))}
            value={block}
            onChange={setBlockKey}
            ariaLabel="Khối"
          />
        )}
        <WeekPicker
          value={week}
          thisWeek={schoolWeekStart(today)}
          onChange={(next) => guard.leave(`/menu/weekly?week=${next}`, { replace: true })}
        />
        {shared.length > 0 && (editable || plan?.days.some((d) => d.canAmend)) && (
          <label
            className="checkbox td-week-toolbar__group"
            title={`Bữa ${shared.map((x) => MEAL_SESSION_LABELS[x]).join(', ')}: thêm, đổi, xóa món sẽ ghi đè khối còn lại`}
          >
            <Checkbox checked={syncMeals} disabled={busy} onChange={(e) => setSyncMeals(e.target.checked)} /> Đồng bộ bữa chung
          </label>
        )}
      </div>
    </>
  );

  if (planQ.error)
    return (
      <div className="page">
        {head}
        <ErrorState error={planQ.error} onRetry={planQ.reload} />
      </div>
    );
  if (planQ.loading || !plan || !draft)
    return (
      <div className="page">
        {head}
        <LoadingState />
      </div>
    );

  const noPlanForViewer = plan.status === MEAL_PLAN_STATUS.NONE && !plan.canEdit;
  return (
    <div className="page td-sections">
      {head}
      <div className="td-week-bar">
        <div className="row td-week-status">
          <MealPlanStatusBadge status={plan.status} size="lg" />
          {plan.publishedAt && <span className="text-sm muted">Công bố lúc {formatDateTime(plan.publishedAt)}</span>}
        </div>
        <div className="row td-week-toolbar__actions">
          {MENU_AI_ENABLED && editable && block && (
            <Button disabled={busy} onClick={() => setAiOpen(true)}>
              <Sparkles size={16} /> AI gợi ý
            </Button>
          )}
          {/* Chỉ bản đã công bố được xuất văn bản (MENU-14 SRS): văn bản gửi bếp, phụ huynh phải là bản chính thức */}
          {plan.revisionCount > 0 && (
            <Button icon={History} onClick={() => setRevisionsOpen(true)}>
              Lịch sử sửa ({plan.revisionCount})
            </Button>
          )}
          {plan.status === MEAL_PLAN_STATUS.PUBLISHED && (
            <Button icon={FileDown} onClick={() => setExportOpen(true)}>
              Xuất văn bản
            </Button>
          )}
          {editable && (
            <Button icon={Save} disabled={busy || !dirty} onClick={save}>
              Lưu nháp
            </Button>
          )}
          {/* Thiếu quyền vẫn hiện nút chính đang khóa kèm lý do; tuần đã công bố thì không còn việc công bố */}
          {plan.status !== MEAL_PLAN_STATUS.PUBLISHED && (plan.canPublish || !plan.canEdit) && (
            <Button
              variant="primary"
              icon={Send}
              disabled={busy}
              disabledReason={!plan.canPublish ? viewOnlyReason : dirty ? 'Lưu nháp trước khi công bố.' : undefined}
              onClick={openPublish}
            >
              Công bố tuần
            </Button>
          )}
        </div>
      </div>
      {plan.status === MEAL_PLAN_STATUS.PUBLISHED && (
        <LockNote kind="locked">
          {plan.days.some((d) => d.canAmend)
            ? 'Tuần đã công bố: chỉ sửa ngoại lệ ở ngày được phép.'
            : 'Tuần đã công bố nên không sửa được món.'}
        </LockNote>
      )}
      {dirty && autoOff.length > 0 && (
        <div className="alert alert--info">
          <div>
            Đã tự đánh dấu nghỉ {autoOff.length} ngày trùng ngày nghỉ của năm học (
            {[...new Set(autoOff.map((date) => holidayMap[date]))].join(', ')}). Bấm Lưu nháp để lưu.
          </div>
        </div>
      )}
      {dirty && (
        <div className="alert alert--warning">
          <div>Có thay đổi chưa lưu. Lưu nháp để cập nhật và công bố.</div>
        </div>
      )}

      {noPlanForViewer ? (
        <section className="card">
          <EmptyState title="Tuần này chưa có kế hoạch" description="Khi kế hoạch được lập và công bố, thực đơn hiện ở đây." />
        </section>
      ) : !block ? (
        <section className="card">
          <EmptyState title="Chưa có khối nào để lập kế hoạch" description="Kiểm tra cấu hình nhóm tuổi và bữa ăn của trường." />
        </section>
      ) : (
        <>
          <section className="card">
            <MealPlanGrid
              draft={draft}
              block={block}
              sessions={blockSessions(plan, block)}
              dishes={dishes}
              editable={editable}
              busy={busy}
              onEdit={editDraft}
              dayLink={plan.status === MEAL_PLAN_STATUS.NONE ? undefined : (day) => `/kitchen/market-day?date=${day.date}`}
              templates={templates}
              onPickTemplate={pickTemplate}
              dayActions={plan.status === MEAL_PLAN_STATUS.NONE && !editable ? undefined : dayActions}
              holidays={holidayMap}
            />
          </section>
        </>
      )}

      <PublishWeekDialog
        open={publishOpen}
        plan={plan}
        busy={busy}
        error={publishError}
        dayHref={(date, issueBlock) => balanceHref({ week, block: issueBlock || block, date })}
        onConfirm={publish}
        onClose={() => setPublishOpen(false)}
      />
      {exportOpen && (
        <WeeklyMenuExportModal
          plan={plan}
          week={week}
          defaultPreparer={user?.fullName || user?.name || ''}
          onClose={() => setExportOpen(false)}
        />
      )}
      <ConfirmationModal
        open={!!pending}
        title="Thay món của ngày này?"
        message={
          pending
            ? `Ngày đang có ${pending.count} món của khối ${MEAL_BLOCK_LABELS[block] || block}. Dùng mẫu "${pending.template.name}" sẽ thay toàn bộ các món đó, kể cả món đã sửa tay.${syncMeals && shared.length ? ' Bữa chung của khối còn lại cũng đổi theo.' : ''}`
            : ''
        }
        confirmLabel="Thay bằng mẫu"
        cancelLabel="Giữ món hiện tại"
        onConfirm={() => {
          fillDay(pending.day, pending.template);
          setPending(null);
        }}
        onClose={() => setPending(null)}
      />
      {MENU_AI_ENABLED && editable && block && (
        <MenuAiWeekModal
          open={aiOpen}
          onClose={() => setAiOpen(false)}
          block={block}
          week={week}
          plan={plan}
          dirty={dirty}
          dishes={dishes}
          kcalAgeGroup={kcalAgeGroup}
          onApplied={() => planQ.reload({ silent: true })}
        />
      )}
      {editingDay && draft && (
        <DayEditorModal
          key={editingDay}
          title={dayTitle(editingDay)}
          date={editingDay}
          initialItems={dayBlockItems(
            draft.days.find((d) => d.date === editingDay),
            block,
          )}
          editable={editable}
          sessions={blockSessions(plan, block)}
          dishes={dishes}
          canEditRecipe={hasBePermission(user, PERMISSIONS.NUTRITION_MANAGE)}
          balanceTo={balanceHref({ week, block, date: editingDay })}
          onApply={(items) => {
            editDraft((d) => setDayBlockItems(d, editingDay, block, items));
            setEditingDay(null);
            toast.success('Đã áp dụng vào tuần. Bấm Lưu nháp để lưu.');
          }}
          onClose={() => setEditingDay(null)}
        />
      )}
      {copyFrom && draft && (
        <CopyDayModal
          draft={draft}
          block={block}
          from={copyFrom}
          blockLabel={MEAL_BLOCK_LABELS[block] || block}
          onCopy={(dates) => {
            editDraft((d) => copyDay(d, copyFrom, dates, block));
            setCopyFrom(null);
            toast.success(`Đã chép món sang ${dates.length} ngày. Bấm Lưu nháp để lưu.`);
          }}
          onClose={() => setCopyFrom(null)}
        />
      )}
      {amendingDay && (
        <DayEditorModal
          key={`amend-${amendingDay}`}
          title={dayTitle(amendingDay)}
          date={amendingDay}
          initialItems={dayBlockItems(savedDay(amendingDay), block)}
          editable
          applyLabel="Tiếp tục"
          aiSwap={MENU_AI_ENABLED ? { block, weekStart: week } : null}
          sessions={blockSessions(plan, block)}
          dishes={dishes}
          canEditRecipe={hasBePermission(user, PERMISSIONS.NUTRITION_MANAGE)}
          onApply={(items) => {
            // Sửa cả ngày: món khối khác giữ theo bản đã công bố, trừ bữa chung khi đang bật đồng bộ
            const next = withSync(saved, setDayBlockItems(saved, amendingDay, block, items));
            const day = next.days.find((d) => d.date === amendingDay);
            setAmendError('');
            setAmendDraft({ date: amendingDay, items: day.items });
            setAmendingDay(null);
          }}
          onClose={() => setAmendingDay(null)}
        />
      )}
      {amendDraft && (
        <AmendDayDialog
          key={`confirm-${amendDraft.date}`}
          title={dayTitle(amendDraft.date)}
          beforeItems={savedDay(amendDraft.date)?.items}
          afterItems={amendDraft.items}
          initialNote={savedDay(amendDraft.date)?.note}
          busy={busy}
          error={amendError}
          onConfirm={amend}
          onClose={() => setAmendDraft(null)}
        />
      )}
      {revisionsOpen && <MealPlanRevisionsModal week={week} onClose={() => setRevisionsOpen(false)} />}
      <LeaveConfirmModal {...guard.modal} />
    </div>
  );
}
