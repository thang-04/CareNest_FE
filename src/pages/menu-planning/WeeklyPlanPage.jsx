import { useEffect, useMemo, useState } from 'react';
import { useTabParam } from '@/hooks/useTabParam';
import { Tabs } from '@/components/ui/Tabs';
import { useSearchParams } from 'react-router-dom';
import { Lock, Save, Send } from '@/components/ui/icons';
import { useToast } from '@/contexts/ToastContext';
import { Breadcrumb, EmptyState, ErrorState, LoadingState } from '@/components';
import { WeekPicker } from '@/components/form/WeekPicker';
import { LeaveConfirmModal } from '@/components/ui/LeaveConfirmModal';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { Modal } from '@/components/ui/Modal';
import { WeekDaySummary } from '@/components/menu-planning/WeekDaySummary';
import { MealPlanEvaluations } from '@/components/menu-planning/MealPlanEvaluations';
import { MealPlanGrid } from '@/components/menu-planning/MealPlanGrid';
import { MealPlanIssueList } from '@/components/menu-planning/MealPlanIssueList';
import { MealPlanStatusBadge } from '@/components/menu-planning/MenuBadges';
import { PublishWeekDialog } from '@/components/menu-planning/PublishWeekDialog';
import { useActiveDishes, useMealPlan } from '@/hooks/menu-planning/useMealPlan';
import { useMenuTemplates } from '@/hooks/menu-planning/useMenuTemplates';
import { useLeaveGuard } from '@/hooks/useLeaveGuard';
import { mealPlanApi } from '@/services/mealPlanApi';
import { MEAL_BLOCK_LABELS, MEAL_PLAN_STATUS, mondayOf } from '@/models/menu-planning/menuPlanningConstants';
import { blockSessions, draftFromPlan, isDirty, planBlocks, resolveWeekStart } from '@/utils/menu-planning/mealPlanGrid';
import { applyTemplateDay, dayBlockItemCount } from '@/utils/menu-planning/menuTemplateGrid';
import { statisticsHref } from '@/utils/menu-planning/menuStatistics';
import { weeklyCrumbs } from '@/utils/menu-planning/breadcrumbs';
import { formatDateTime, todayInput } from '@/utils/format';
import '@/styles/modules/menu-planning.css';

/**
 * Kế hoạch tuần theo khối (`/menu/weekly`): lưới ngày × bữa cho từng khối (nhà trẻ, mẫu giáo), lưu nháp, xem bảng kiểm do BE tính,
 * công bố cả tuần. Nút theo cờ `canEdit`/`canPublish` BE trả; đã công bố thì chỉ xem. Tuần chọn trên URL (?week=, thứ Hai).
 */
export default function WeeklyPlanPage() {
  const [tab, setTab] = useTabParam(['menu', 'check'], 'view');
  const toast = useToast();
  const [params] = useSearchParams();
  const today = todayInput();
  const week = resolveWeekStart(params.get('week'), today);
  const planQ = useMealPlan(week);
  const plan = planQ.data;
  const { dishes } = useActiveDishes();
  const saved = useMemo(() => (plan ? draftFromPlan(plan) : null), [plan]);
  const [draft, setDraft] = useState(null);
  const [blockKey, setBlockKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishError, setPublishError] = useState('');
  // Mẫu ngày chờ xác nhận thay món: { day, template, count }
  const [pending, setPending] = useState(null);
  const [issuesOpen, setIssuesOpen] = useState(false);

  // Kế hoạch mới về (đổi tuần, sau khi lưu, nạp lại) ⇒ bản nháp trên màn lấy lại từ BE
  useEffect(() => setDraft(saved), [saved]);

  const blocks = planBlocks(plan);
  const block = blocks.includes(blockKey) ? blockKey : blocks[0];
  const editable = !!plan?.canEdit && plan.status !== MEAL_PLAN_STATUS.PUBLISHED;
  const dirty = !!draft && !!saved && isDirty(draft, saved);
  const templatesQ = useMenuTemplates({ block, status: 'ACTIVE' });
  const templates = editable ? templatesQ.data || [] : [];

  const fillDay = (day, template) => {
    setDraft((d) => applyTemplateDay(d, day.date, template));
    toast.success(`Đã điền món theo mẫu "${template.name}". Sửa từng món nếu cần rồi bấm Lưu nháp.`);
  };
  // Ngày đã có món của khối ⇒ hỏi trước khi thay bằng mẫu (agent chọn 2026-11-04, xem plan)
  const pickTemplate = (day, template) => {
    if (!template) return;
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

  const head = (
    <>
      <Breadcrumb items={weeklyCrumbs()} />
      <div className="page__head">
        <div>
          <h1 className="page__title">Kế hoạch tuần</h1>
        </div>
      </div>
      <div className="td-week-toolbar">
        {blocks.length > 0 && (
          <div className="tabs tabs--pill" role="tablist" aria-label="Khối">
            {blocks.map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={key === block}
                className={`tab ${key === block ? 'tab--active' : ''}`}
                onClick={() => setBlockKey(key)}
              >
                {MEAL_BLOCK_LABELS[key] || key}
              </button>
            ))}
          </div>
        )}
        <WeekPicker
          value={week}
          thisWeek={mondayOf(today)}
          onChange={(next) => guard.leave(`/menu/weekly?week=${next}`, { replace: true })}
        />
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
          {!editable && plan.status !== MEAL_PLAN_STATUS.PUBLISHED && (
            <span className="chip chip--gray">
              <Lock size={14} /> Chỉ xem
            </span>
          )}
          {plan.status === MEAL_PLAN_STATUS.PUBLISHED && (
            <span className="chip chip--gray">
              <Lock size={14} /> Đã khóa, không sửa
            </span>
          )}
        </div>
        <div className="row td-week-toolbar__actions">
          {editable && (
            <button type="button" className="btn" disabled={busy || !dirty} onClick={save}>
              <Save size={16} /> Lưu nháp
            </button>
          )}
          {plan.canPublish && (
            <button
              type="button"
              className="btn btn--primary"
              disabled={busy || dirty}
              title={dirty ? 'Lưu nháp trước khi công bố' : undefined}
              onClick={openPublish}
            >
              <Send size={16} /> Công bố tuần
            </button>
          )}
        </div>
      </div>
      {dirty && (
        <div className="alert alert--warning">
          <div>Có thay đổi chưa lưu. Bảng kiểm và lưu ý bên dưới tính theo bản đã lưu; lưu nháp để cập nhật và công bố.</div>
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
          <WeekDaySummary plan={plan} draft={draft} onShowAll={plan.issues.length ? () => setIssuesOpen(true) : undefined} />
          {/* Chia tab (DESIGN §6.3): soạn món cả tuần | bảng kiểm dinh dưỡng; lưu ý của tuần ở dải tóm tắt phía trên */}
          <Tabs
            ariaLabel="Phần kế hoạch tuần"
            value={tab}
            onChange={setTab}
            items={[
              { key: 'menu', label: 'Thực đơn tuần' },
              { key: 'check', label: 'Bảng kiểm dinh dưỡng' },
            ]}
          />
          {tab === 'menu' ? (
            <section className="card">
              <MealPlanGrid
                draft={draft}
                plan={plan}
                block={block}
                sessions={blockSessions(plan, block)}
                dishes={dishes}
                editable={editable}
                busy={busy}
                onEdit={(fn) => setDraft((d) => fn(d))}
                dayLink={plan.status === MEAL_PLAN_STATUS.NONE ? undefined : (day) => statisticsHref({ week, date: day.date })}
                templates={templates}
                onPickTemplate={pickTemplate}
              />
            </section>
          ) : (
            <section className="card">
              <div className="card__header">
                <div>
                  <h2 className="card__title">Bảng kiểm dinh dưỡng — {MEAL_BLOCK_LABELS[block] || block}</h2>
                  <span className="text-sm muted">Hệ thống tính theo định mức và mức giá đang hiệu lực của từng nhóm tuổi.</span>
                </div>
              </div>
              <MealPlanEvaluations plan={plan} block={block} />
            </section>
          )}
        </>
      )}

      <PublishWeekDialog
        open={publishOpen}
        plan={plan}
        busy={busy}
        error={publishError}
        onConfirm={publish}
        onClose={() => setPublishOpen(false)}
      />
      <Modal open={issuesOpen} size="lg" title={`Lưu ý của tuần · ${plan.issues.length} lưu ý`} onClose={() => setIssuesOpen(false)}>
        <MealPlanIssueList issues={plan.issues} />
      </Modal>
      <ConfirmationModal
        open={!!pending}
        title="Thay món của ngày này?"
        message={
          pending
            ? `Ngày đang có ${pending.count} món của khối ${MEAL_BLOCK_LABELS[block] || block}. Dùng mẫu "${pending.template.name}" sẽ thay toàn bộ các món đó, kể cả món đã sửa tay.`
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
      <LeaveConfirmModal {...guard.modal} />
    </div>
  );
}
