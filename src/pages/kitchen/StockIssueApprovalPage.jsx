import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ClipboardList, Info, PackagePlus } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useStockIssue } from '@/hooks/kitchen/useKitchen';
import { Breadcrumb, ConfirmationModal, EmptyState, ErrorState, LoadingState, ProgressSteps } from '@/components';
import { IssueStatusBadge } from '@/components/kitchen/KitchenBadges';
import { KbDateFilter, fmtQty } from '@/components/kitchen/KitchenFilters';
import { CookingPlan, IssueHistory, ReceiptReconciliation } from '@/components/kitchen/IssueBlocks';
import { approveStockIssue } from '@/services/kitchen/kitchenService';
import { canApproveStockIssue } from '@/utils/kitchen/kitchenPermissions';
import { kitchenCrumbs, KITCHEN_PAGES } from '@/utils/kitchen/breadcrumbs';
import { formatDate, formatDateTime, todayInput } from '@/utils/format';
import { ISSUE_STATUS } from '@/models/kitchen/kitchenConstants';
import '@/styles/modules/kitchen.css';

const stepsFor = (state) => {
  const order = ['WAITING_MEAL_COUNT', ISSUE_STATUS.PENDING_APPROVAL, ISSUE_STATUS.APPROVED, ISSUE_STATUS.RECEIVED];
  const at = order.indexOf(state);
  return [
    { label: 'Xác nhận số suất ăn', done: at >= 1 },
    { label: 'Lập phiếu xuất kho', done: at >= 1 },
    { label: 'Phó hiệu trưởng duyệt', done: at >= 2 },
    { label: 'Bếp xác nhận nhận', done: at >= 3 },
  ];
};

/** Screen #91 – Stock Issue Approval (UC 6.24): required quantity vs stock, shortage handling, approval and deduction. */
export default function StockIssueApprovalPage() {
  const { user } = useAuth();
  const toast = useToast();
  const md = useMasterData();
  const [params, setParams] = useSearchParams();
  const date = params.get('date') || todayInput();
  const campusId = user?.campusId;
  const { data, loading, error, reload } = useStockIssue(campusId, date);
  const [confirming, setConfirming] = useState(false);

  const issue = data?.issue;
  const short = (issue?.items || []).filter((it) => it.shortage > 0);
  const pending = data?.state === ISSUE_STATUS.PENDING_APPROVAL;
  const shortageLink = `/kitchen/stock-receipts/new?issueDate=${date}&items=${short.map((s) => `${s.foodId}:${s.shortage}`).join(',')}`;

  const approve = async () => {
    try {
      await approveStockIssue({ campusId, date }, user);
      toast.success('Đã duyệt phiếu xuất kho, trừ tồn kho và gửi phiếu cho bếp.');
      setConfirming(false);
      reload({ silent: true });
    } catch (err) {
      toast.error(err.message || 'Không lưu được thay đổi. Vui lòng thử lại.', 'Không duyệt được phiếu');
      setConfirming(false);
      reload({ silent: true });
    }
  };

  return (
    <div className="page">
      <Breadcrumb items={kitchenCrumbs(KITCHEN_PAGES.stockIssues)} />
      <div className="page__head">
        <h1 className="page__title">Duyệt phiếu xuất kho</h1>
        {data && <IssueStatusBadge status={data.state} size="lg" />}
      </div>
      <div className="kb-toolbar">
        <KbDateFilter value={date} onChange={(d) => setParams({ date: d }, { replace: true })} />
        {issue?.code && (
          <div className="text-sm">
            Mã phiếu: <span className="fw-600 text-primary">{issue.code}</span>
          </div>
        )}
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : data.state === 'NO_MENU' ? (
        <div className="card">
          <EmptyState
            icon={ClipboardList}
            title="Không có thực đơn đã công bố"
            description="Ngày này không có bữa ăn cần xuất kho. Chọn ngày khác."
          />
        </div>
      ) : (
        <>
          <div className="card mb-16">
            <div className="card__body">
              <ProgressSteps steps={stepsFor(data.state)} />
            </div>
          </div>

          {data.state === 'WAITING_MEAL_COUNT' && (
            <div className="alert alert--warning mb-16">
              <Info size={18} />
              <div>Số suất ăn của ngày chưa được xác nhận đủ các bữa. Phiếu xuất kho được lập sau khi bạn xác nhận số suất ăn.</div>
            </div>
          )}
          {pending && short.length > 0 && (
            <div className="alert alert--danger mb-16">
              <AlertTriangle size={18} />
              <div className="stack" style={{ gap: 8 }}>
                <div>
                  Tồn kho không đủ cho <b>{short.length}</b> thực phẩm. Nhập kho bổ sung, hệ thống sẽ kiểm tra lại tồn kho trước khi duyệt.
                </div>
                <div>
                  <Link className="btn btn--sm" to={shortageLink}>
                    <PackagePlus size={15} /> Nhập kho bổ sung
                  </Link>
                </div>
              </div>
            </div>
          )}
          {pending && short.length === 0 && (
            <div className="alert alert--purple mb-16">
              <CheckCircle2 size={18} />
              <div>Tồn kho đủ cho toàn bộ phiếu. Kiểm tra và duyệt để trừ kho, gửi phiếu xuất và kế hoạch nấu cho bếp.</div>
            </div>
          )}

          {issue && (
            <div className="card mb-16">
              <div className="card__header">
                <div className="card__title">Thực phẩm xuất kho ngày {formatDate(date)}</div>
              </div>
              <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Thực phẩm</th>
                      <th>Đơn vị</th>
                      <th className="right">Cần xuất</th>
                      <th className="right">{pending ? 'Tồn kho hiện tại' : 'Tồn kho khi duyệt'}</th>
                      {pending && <th className="right">Thiếu</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {issue.items.map((it) => (
                      <tr key={it.foodId} className={it.shortage > 0 ? 'kb-row--short' : ''}>
                        <td className="fw-600">{it.name}</td>
                        <td>{it.unit}</td>
                        <td className="right">{fmtQty(it.requiredQty)}</td>
                        <td className="right">{fmtQty(pending ? it.stock : it.stockBefore)}</td>
                        {pending && (
                          <td className={`right ${it.shortage > 0 ? 'kb-short' : 'muted'}`}>
                            {it.shortage > 0 ? fmtQty(it.shortage) : '—'}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <CookingPlan sessions={data.sessions} />

          {data.receipt && <ReceiptReconciliation receipt={data.receipt} md={md} />}

          {issue?.history?.length > 0 && <IssueHistory history={issue.history} md={md} />}

          {issue?.approvedAt && (
            <p className="muted text-sm mt-8">
              Duyệt bởi {md.userById(issue.approvedBy)?.fullName || '—'} lúc {formatDateTime(issue.approvedAt)}.
            </p>
          )}

          {pending && canApproveStockIssue(issue, user) && (
            <div className="page-actions">
              <span />
              <button className="btn btn--primary" onClick={() => setConfirming(true)} disabled={short.length > 0}>
                <CheckCircle2 size={16} /> Duyệt phiếu xuất kho
              </button>
            </div>
          )}
        </>
      )}

      <ConfirmationModal
        open={confirming}
        title="Duyệt phiếu xuất kho?"
        message="Số lượng trong phiếu sẽ được trừ khỏi tồn kho và phiếu xuất cùng kế hoạch nấu được gửi cho bếp. Thao tác không hoàn tác được."
        confirmLabel="Duyệt phiếu xuất kho"
        onConfirm={approve}
        onClose={() => setConfirming(false)}
      />
    </div>
  );
}
