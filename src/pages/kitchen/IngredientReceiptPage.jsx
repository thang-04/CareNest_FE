import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ClipboardCheck, Info, PackageCheck, PackageMinus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useStockIssue } from '@/hooks/kitchen/useKitchen';
import { Breadcrumb, ConfirmationModal, EmptyState, ErrorState, LoadingState, Spinner } from '@/components';
import { IssueStatusBadge } from '@/components/kitchen/KitchenBadges';
import { KbDateFilter, fmtQty } from '@/components/kitchen/KitchenFilters';
import { CookingPlan, ReceiptReconciliation } from '@/components/kitchen/IssueBlocks';
import { confirmIngredientReceipt } from '@/services/kitchen/kitchenService';
import { canConfirmIngredientReceipt, isKitchenStaff } from '@/utils/kitchen/kitchenPermissions';
import { itemError, validateIngredientReceipt } from '@/utils/kitchen/kitchenValidation';
import { kitchenCrumbs, KITCHEN_PAGES } from '@/utils/kitchen/breadcrumbs';
import { formatDate, formatDateTime, todayInput } from '@/utils/format';
import { ISSUE_STATUS, NOTE_MAX } from '@/models/kitchen/kitchenConstants';
import '@/styles/modules/kitchen.css';

/** Screen #96 – Ingredient Receipt (UC 6.25): the kitchen enters what it actually received; differences go to the VP. */
export default function IngredientReceiptPage() {
  const { user } = useAuth();
  const toast = useToast();
  const md = useMasterData();
  const [params, setParams] = useSearchParams();
  const date = params.get('date') || todayInput();
  const campusId = user?.campusId;
  const kitchen = isKitchenStaff(user);
  // The kitchen types quantities here: no silent reload while editing.
  const { data, loading, error, reload } = useStockIssue(campusId, date, { live: !kitchen });
  const issue = data?.issue;
  const editable = issue && canConfirmIngredientReceipt(issue, user);

  const [lines, setLines] = useState([]);
  const [errors, setErrors] = useState({});
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLines(editable ? issue.items.map((it) => ({ foodId: it.foodId, receivedQty: String(it.requiredQty), note: '' })) : []);
    setErrors({});
  }, [editable, issue]);

  const setLine = (i, field, value) => {
    setLines((ls) => ls.map((l, k) => (k === i ? { ...l, [field]: value } : l)));
    setErrors((e) => ({ ...e, [`items.${i}.${field}`]: undefined }));
  };

  const openConfirm = () => {
    const found = validateIngredientReceipt(lines);
    setErrors(found);
    if (Object.keys(found).length) toast.error('Kiểm tra lại các ô được đánh dấu đỏ.', 'Chưa xác nhận được');
    else setConfirming(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const receipt = await confirmIngredientReceipt({ campusId, date, items: lines }, user);
      toast.success(receipt.hasDifference ? 'Đã ghi nhận. Chênh lệch đã được báo cho Phó hiệu trưởng.' : 'Đã xác nhận nhận đủ thực phẩm.');
      setConfirming(false);
      reload({ silent: true });
    } catch (err) {
      if (err.details) setErrors(err.details);
      toast.error(err.message || 'Không lưu được thay đổi. Vui lòng thử lại.', 'Không xác nhận được');
      setConfirming(false);
    } finally {
      setSaving(false);
    }
  };

  const shortages = data?.receipt?.items.filter((it) => it.difference < 0) || [];

  return (
    <div className="page">
      <Breadcrumb items={kitchenCrumbs(KITCHEN_PAGES.ingredientReceipts)} />
      <div className="page__head">
        <h1 className="page__title">Nhận thực phẩm từ kho</h1>
        {data && issue?.id && <IssueStatusBadge status={data.state} size="lg" />}
      </div>
      <div className="kb-toolbar">
        <KbDateFilter value={date} onChange={(d) => setParams({ date: d }, { replace: true })} />
        {issue?.id && (
          <div className="text-sm">
            Phiếu xuất kho <span className="fw-600 text-primary">{issue.code}</span> · duyệt lúc {formatDateTime(issue.approvedAt)}
          </div>
        )}
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !issue?.id ? (
        <div className="card">
          <EmptyState
            icon={PackageCheck}
            title="Chưa có phiếu xuất kho đã duyệt"
            description={`Ngày ${formatDate(date)} chưa có phiếu xuất kho được Phó hiệu trưởng duyệt. Bạn sẽ nhận thông báo khi phiếu được duyệt.`}
          />
        </div>
      ) : (
        <>
          {editable && (
            <div className="alert alert--info mb-16">
              <Info size={18} />
              <div>Kiểm đếm thực phẩm nhận được và nhập số lượng thực nhận. Chênh lệch so với phiếu sẽ được báo cho Phó hiệu trưởng.</div>
            </div>
          )}
          {!editable && data.state === ISSUE_STATUS.APPROVED && (
            <div className="alert alert--warning mb-16">
              <Info size={18} />
              <div>Đang chờ bếp xác nhận số lượng thực nhận.</div>
            </div>
          )}

          {data.receipt ? (
            <>
              <ReceiptReconciliation receipt={data.receipt} md={md} />
              {kitchen && shortages.length > 0 && date >= todayInput() && (
                <div className="alert alert--danger mb-16">
                  <PackageMinus size={18} />
                  <div className="stack" style={{ gap: 8 }}>
                    <div>Có {shortages.length} thực phẩm nhận thiếu. Báo thiếu để Phó hiệu trưởng bổ sung.</div>
                    <div className="row row--wrap" style={{ gap: 8 }}>
                      {shortages.map((s) => (
                        <Link
                          key={s.foodId}
                          className="btn btn--sm"
                          to={`/kitchen/missing-food?new=1&date=${date}&foodId=${s.foodId}&quantity=${Math.abs(s.difference)}`}
                        >
                          Báo thiếu {s.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="card mb-16">
              <div className="card__header">
                <div className="card__title">Thực phẩm theo phiếu xuất kho</div>
              </div>
              <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Thực phẩm</th>
                      <th className="right">Số lượng xuất</th>
                      {editable && (
                        <>
                          <th>
                            Thực nhận <span className="req">*</span>
                          </th>
                          <th className="right">Chênh lệch</th>
                          <th style={{ minWidth: 200 }}>Ghi chú</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {issue.items.map((it, i) => {
                      const line = lines[i];
                      const diff =
                        line && line.receivedQty !== '' ? Math.round((Number(line.receivedQty) - it.requiredQty) * 1000) / 1000 : null;
                      return (
                        <tr key={it.foodId}>
                          <td className="fw-600">{it.name}</td>
                          <td className="right nowrap">
                            {fmtQty(it.requiredQty)} {it.unit}
                          </td>
                          {editable && line && (
                            <>
                              <td>
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  className={`input kb-num ${itemError(errors, i, 'receivedQty') ? 'input--error' : ''}`}
                                  value={line.receivedQty}
                                  onChange={(e) => setLine(i, 'receivedQty', e.target.value)}
                                  aria-label={`Thực nhận ${it.name}`}
                                />
                                <span className="muted text-xs"> {it.unit}</span>
                                {itemError(errors, i, 'receivedQty') && (
                                  <div className="field__error">{itemError(errors, i, 'receivedQty')}</div>
                                )}
                              </td>
                              <td className={`right nowrap ${diff < 0 ? 'kb-short' : diff > 0 ? 'kb-over' : 'muted'}`}>
                                {!diff ? '—' : `${diff > 0 ? '+' : ''}${fmtQty(diff)}`}
                              </td>
                              <td>
                                <input
                                  className="input"
                                  value={line.note}
                                  maxLength={NOTE_MAX}
                                  onChange={(e) => setLine(i, 'note', e.target.value)}
                                  aria-label={`Ghi chú ${it.name}`}
                                />
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <CookingPlan sessions={data.sessions} />

          {editable && (
            <div className="page-actions">
              <span />
              <button className="btn btn--primary" onClick={openConfirm} disabled={saving}>
                {saving ? <Spinner small /> : <ClipboardCheck size={16} />} Xác nhận nhận thực phẩm
              </button>
            </div>
          )}
        </>
      )}

      <ConfirmationModal
        open={confirming}
        title="Xác nhận nhận thực phẩm?"
        message="Số lượng thực nhận được ghi lại và đối chiếu với phiếu xuất kho. Sau khi xác nhận không sửa được."
        confirmLabel="Xác nhận nhận thực phẩm"
        onConfirm={save}
        onClose={() => setConfirming(false)}
      />
    </div>
  );
}
