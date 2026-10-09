import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, PackageMinus } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useFoodCatalog, useMissingFoodReports } from '@/hooks/kitchen/useKitchen';
import { Breadcrumb, EmptyState, ErrorState, FormField, Modal, Pagination, SkeletonRows, Spinner, paginate } from '@/components';
import { MissingStatusBadge } from '@/components/kitchen/KitchenBadges';
import { MissingFoodForm } from '@/components/kitchen/MissingFoodForm';
import { fmtQty } from '@/components/kitchen/KitchenFilters';
import { markMissingFoodSupplied, submitMissingFoodReport } from '@/services/kitchen/kitchenService';
import { canSubmitMissingFood, canSupplyMissingFood } from '@/utils/kitchen/kitchenPermissions';
import { kitchenCrumbs, KITCHEN_PAGES } from '@/utils/kitchen/breadcrumbs';
import { formatDate, formatDateTime } from '@/utils/format';
import { MEAL_SESSION_LABELS, MISSING_STATUS, NOTE_MAX } from '@/models/kitchen/kitchenConstants';
import '@/styles/modules/kitchen.css';

const TABS = [
  { key: 'ALL', label: 'Tất cả' },
  { key: MISSING_STATUS.SUBMITTED, label: 'Chờ bổ sung' },
  { key: MISSING_STATUS.SUPPLIED, label: 'Đã bổ sung' },
];

function SupplyModal({ report, onClose, onDone }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await onDone(report, note);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={!!report}
      title={report ? `Xác nhận đã bổ sung – ${report.code}` : ''}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>
            Quay lại
          </button>
          <button className="btn btn--primary" onClick={submit} disabled={busy}>
            {busy ? <Spinner small /> : <CheckCircle2 size={16} />} Xác nhận đã bổ sung
          </button>
        </>
      }
    >
      {report && (
        <div className="stack">
          <div>
            Bếp báo thiếu{' '}
            <b>
              {fmtQty(report.quantity)} {report.unit} {report.foodName}
            </b>{' '}
            cho ngày {formatDate(report.date)}. Bếp sẽ nhận thông báo đã bổ sung.
          </div>
          <FormField label="Ghi chú cho bếp" hint={`Không bắt buộc, tối đa ${NOTE_MAX} ký tự`}>
            <textarea className="textarea" rows={3} maxLength={NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} />
          </FormField>
        </div>
      )}
    </Modal>
  );
}

/** Screen #97 – Missing Food Report (UC 6.19): the kitchen reports shortages, the campus Vice Principal supplies them. */
export default function MissingFoodReportPage() {
  const { user } = useAuth();
  const toast = useToast();
  const md = useMasterData();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState('ALL');
  const [page, setPage] = useState(1);
  const [supplying, setSupplying] = useState(null);
  const campusId = user?.campusId;
  const { reports, loading, error, reload } = useMissingFoodReports(campusId, 'ALL');
  const canSubmit = canSubmitMissingFood(user);
  const { foods } = useFoodCatalog();
  const formOpen = canSubmit && params.get('new') === '1';
  const initial = {
    ...(params.get('date') ? { date: params.get('date') } : {}),
    ...(params.get('session') ? { session: params.get('session') } : {}),
    ...(params.get('foodId') ? { foodId: params.get('foodId') } : {}),
    ...(params.get('quantity') ? { quantity: params.get('quantity') } : {}),
  };

  const visible = reports.filter((r) => tab === 'ALL' || r.status === tab);
  const pageRows = paginate(visible, page);

  const submit = async (form) => {
    try {
      const report = await submitMissingFoodReport(form, user);
      toast.success(`Đã gửi báo thiếu ${report.code} cho Phó hiệu trưởng.`);
      setParams({}, { replace: true });
      reload({ silent: true });
    } catch (err) {
      toast.error(err.message || 'Không lưu được thay đổi. Vui lòng thử lại.', 'Không gửi được báo thiếu');
      throw err;
    }
  };

  const supply = async (report, note) => {
    try {
      await markMissingFoodSupplied(report.id, note, user);
      toast.success(`Đã xác nhận bổ sung ${report.code}.`);
      setSupplying(null);
      reload({ silent: true });
    } catch (err) {
      toast.error(err.message || 'Không lưu được thay đổi. Vui lòng thử lại.', 'Không xác nhận được');
    }
  };

  return (
    <div className="page">
      <Breadcrumb items={kitchenCrumbs(KITCHEN_PAGES.missingFood)} />
      <div className="page__head">
        <h1 className="page__title">Báo thiếu thực phẩm</h1>
        {canSubmit && (
          <button className="btn btn--primary btn--lg" onClick={() => setParams({ new: '1' }, { replace: true })}>
            <PackageMinus size={18} /> Báo thiếu thực phẩm
          </button>
        )}
      </div>
      <p className="muted mb-16">
        {canSubmit
          ? 'Báo thực phẩm còn thiếu cho bữa ăn để Phó hiệu trưởng bổ sung. Báo thiếu không tự thay đổi thực đơn hay số suất ăn.'
          : 'Các báo thiếu thực phẩm của bếp điểm trường. Xác nhận khi đã bổ sung để bếp được thông báo.'}
      </p>
      <div className="card">
        <div className="tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              className={`tab ${tab === t.key ? 'tab--active' : ''}`}
              onClick={() => {
                setTab(t.key);
                setPage(1);
              }}
            >
              {t.label} <span className="tab__count">{reports.filter((r) => t.key === 'ALL' || r.status === t.key).length}</span>
            </button>
          ))}
        </div>
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Ngày / bữa</th>
                  <th>Thực phẩm</th>
                  <th className="right">Số lượng thiếu</th>
                  <th>Mô tả</th>
                  <th>Người báo</th>
                  <th>Trạng thái</th>
                  <th className="center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows rows={4} cols={8} />
                ) : visible.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <EmptyState
                        icon={PackageMinus}
                        title="Không có báo thiếu thực phẩm"
                        description={
                          canSubmit
                            ? 'Khi thiếu thực phẩm cho bữa ăn, gửi báo thiếu để Phó hiệu trưởng bổ sung.'
                            : 'Báo thiếu của bếp sẽ hiển thị tại đây.'
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  pageRows.map((r) => (
                    <tr key={r.id}>
                      <td className="fw-600 text-primary nowrap">{r.code}</td>
                      <td className="nowrap">
                        {formatDate(r.date)}
                        <div className="muted text-xs">{r.session ? MEAL_SESSION_LABELS[r.session] : 'Cả ngày'}</div>
                      </td>
                      <td>{r.foodName}</td>
                      <td className="right nowrap">
                        {fmtQty(r.quantity)} {r.unit}
                      </td>
                      <td className="kb-cell-wrap">
                        {r.description}
                        {r.supplyNote && <div className="muted text-xs">Phản hồi: {r.supplyNote}</div>}
                      </td>
                      <td>
                        {md.userById(r.submittedBy)?.fullName || '—'}
                        <div className="muted text-xs">{formatDateTime(r.submittedAt)}</div>
                      </td>
                      <td>
                        <MissingStatusBadge status={r.status} />
                        {r.suppliedAt && <div className="muted text-xs">{formatDateTime(r.suppliedAt)}</div>}
                      </td>
                      <td className="center">
                        {canSupplyMissingFood(r, user) ? (
                          <button className="btn btn--sm btn--primary" onClick={() => setSupplying(r)}>
                            <CheckCircle2 size={15} /> Đã bổ sung
                          </button>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        {!loading && visible.length > 0 && <Pagination page={page} total={visible.length} onChange={setPage} unit="báo cáo" />}
      </div>
      {formOpen && (
        <MissingFoodForm open foods={foods} initial={initial} onClose={() => setParams({}, { replace: true })} onSubmit={submit} />
      )}
      <SupplyModal report={supplying} onClose={() => setSupplying(null)} onDone={supply} />
    </div>
  );
}
