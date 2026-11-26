import { useEffect, useState } from 'react';
import { Button, EmptyState, ErrorState, LoadingState, StatusBadge } from '@/components';
import { Save } from '@/components/ui/icons';
import { Tabs } from '@/components/ui/Tabs';
import { LeaveConfirmModal } from '@/components/ui/LeaveConfirmModal';
import { BalanceCounts } from '@/components/menu-planning/balance/BalanceCounts';
import { BalanceFoodTable } from '@/components/menu-planning/balance/BalanceFoodTable';
import { BalanceMoney, BalanceNutrition } from '@/components/menu-planning/balance/BalanceNutrition';
import { BalanceSidebar } from '@/components/menu-planning/balance/BalanceSidebar';
import { BalanceSummaryTable } from '@/components/menu-planning/balance/BalanceSummaryTable';
import { useDayBalance } from '@/hooks/menu-planning/useDayBalance';
import { useLeaveGuard } from '@/hooks/useLeaveGuard';
import { useToast } from '@/contexts/ToastContext';
import { dayBalanceApi } from '@/services/dayBalanceApi';
import { mealGroupsOf, toBalanceRequest } from '@/utils/menu-planning/dayBalance';

const SUMMARY = 'summary';

/**
 * Cân đối một ngày: số trẻ, tab nhóm tuổi của khối và tab tổng hợp mua hàng. Mỗi lần sửa gọi BE tính thử; "Lưu" ghi cả
 * bản cân đối của ngày. `guardRef` nhận bộ chặn rời màn để trang hỏi trước khi đổi tuần, ngày.
 */
export function DayBalanceEditor({ date, round = 1, block, day, dishes, guardRef, onChangeDishes, onSaved }) {
  const toast = useToast();
  const query = useDayBalance(date, round);
  const [view, setView] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('');
  useEffect(() => {
    setView(query.data || null);
    setDirty(false);
  }, [query.data]);

  const recalculate = async (options) => {
    setBusy(true);
    try {
      setView(await dayBalanceApi.preview(date, round, toBalanceRequest(view, options)));
      setDirty(true);
    } catch (err) {
      toast.error(err, 'Chưa tính được khẩu phần');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      const saved = await dayBalanceApi.save(date, round, toBalanceRequest(view));
      query.setData(saved);
      toast.success('Đã lưu bản cân đối.');
      onSaved?.();
      return true;
    } catch (err) {
      toast.error(err, 'Chưa lưu được bản cân đối');
      // Người khác vừa lưu hoặc ngày đã khóa: nạp lại bản mới nhất
      if (err.status === 409) query.reload({ silent: true });
      return false;
    } finally {
      setBusy(false);
    }
  };
  const guard = useLeaveGuard({ when: dirty, onSave: save });
  useEffect(() => {
    if (!guardRef) return undefined;
    guardRef.current = guard;
    return () => {
      guardRef.current = null;
    };
  });

  if (query.error) return <ErrorState error={query.error} onRetry={query.reload} />;
  if (query.loading || !view) return <LoadingState />;

  const groups = view.ageGroups.filter((g) => g.block === block);
  const group = groups.find((g) => String(g.ageGroupId) === tab) || (tab === SUMMARY ? null : groups[0]);
  const evaluation = group && view.groups.find((g) => String(g.ageGroupId) === String(group.ageGroupId))?.evaluation;
  const sessions = group?.sessions || [...new Set(groups.flatMap((g) => g.sessions))];
  const editable = view.canEdit;

  return (
    <>
      <div className="td-week-bar">
        <div className="row td-week-status">
          <StatusBadge tone={view.passed ? 'green' : 'orange'} label={view.passed ? 'Ngày đạt cân đối' : 'Ngày chưa đạt'} />
          {!view.saved && <StatusBadge tone="gray" label="Chưa lưu cân đối" />}
          {view.stale && <StatusBadge tone="red" label="Thực đơn đã đổi, cần cân đối lại" />}
          {view.roundingStep == null && <span className="text-sm muted">Số chưa làm tròn</span>}
        </div>
        {editable && (
          <div className="row td-week-toolbar__actions">
            <Button variant="primary" icon={Save} loading={busy} disabled={!dirty && view.saved && !view.stale} onClick={save}>
              Lưu
            </Button>
          </div>
        )}
      </div>
      <BalanceCounts title="Trẻ dự kiến" view={view} busy={busy} onChange={editable ? (count) => recalculate({ count }) : undefined} />
      <Tabs
        ariaLabel="Nhóm tuổi"
        value={group ? String(group.ageGroupId) : SUMMARY}
        onChange={setTab}
        items={[...groups.map((g) => ({ key: String(g.ageGroupId), label: g.name })), { key: SUMMARY, label: 'Tổng hợp mua hàng' }]}
      />
      {group && <BalanceMoney evaluation={evaluation} />}
      <div className="td-bal">
        <BalanceSidebar
          meals={mealGroupsOf(day, block, sessions)}
          dishes={dishes}
          evaluation={evaluation}
          busy={busy}
          locked={dirty ? 'Lưu bản cân đối trước khi đổi món.' : ''}
          onChangeDishes={onChangeDishes}
          onRound={editable ? (roundingStep) => recalculate({ roundingStep, applyRounding: true }) : undefined}
          onReset={() => recalculate({ fromRecipe: true })}
        />
        <div className="td-bal__main">
          {group ? (
            <>
              <BalanceFoodTable
                view={view}
                group={group}
                busy={busy}
                onEdit={editable ? (edit) => recalculate({ edits: [edit] }) : undefined}
              />
              {evaluation ? (
                <BalanceNutrition evaluation={evaluation} />
              ) : (
                <section className="card">
                  <EmptyState title="Chưa có số liệu dinh dưỡng" />
                </section>
              )}
            </>
          ) : (
            <BalanceSummaryTable view={view} />
          )}
        </div>
      </div>
      <LeaveConfirmModal {...guard.modal} />
    </>
  );
}
