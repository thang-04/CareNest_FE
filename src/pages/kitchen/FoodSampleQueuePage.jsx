import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, Printer } from '@/components/ui/icons';
import { Breadcrumb, EmptyState, ErrorState, LoadingState, Modal, PrintToolbar } from '@/components';
import { KbCampusFilter, KbDateFilter } from '@/components/kitchen/KitchenFilters';
import { FoodSampleFormPrint } from '@/components/kitchen/FoodSampleFormPrint';
import { SampleDisposalBadge, SampleStatusBadge } from '@/components/kitchen/SampleRecordBadges';
import { useToast } from '@/contexts/ToastContext';
import { useStockCampus } from '@/hooks/kitchen/useDryStock';
import { useFoodSamples } from '@/hooks/kitchen/useKitchenRecords';
import { KITCHEN_RECORD_PAGES, MEAL_SESSION_LABELS } from '@/models/kitchen/kitchenRecordConstants';
import { kitchenRecordsApi } from '@/services/kitchenRecordsApi';
import { daysBefore, isPendingApproval, nextApproval, printableSamples, sortSamples } from '@/utils/kitchen/kitchenRecords';
import { kitchenCrumbs } from '@/utils/kitchen/breadcrumbs';
import { formatDate, formatDateTime, isIsoDate, todayInput } from '@/utils/format';
import '@/styles/modules/kitchen.css';
import '@/styles/modules/kitchen-records.css';

const DEFAULT_RANGE_DAYS = 30;

function SampleRow({ sample, busy, onApprove }) {
  const next = nextApproval(sample);
  return (
    <tr>
      <td>{formatDate(sample.date)}</td>
      <td>{MEAL_SESSION_LABELS[sample.session] || sample.session}</td>
      <td>
        <ul className="kr-dishes">
          {sample.dishes.map((dish) => (
            <li key={dish.id}>{dish.name}</li>
          ))}
        </ul>
        {sample.note && <div className="text-xs muted">{sample.note}</div>}
      </td>
      <td>{formatDateTime(sample.sampledAt)}</td>
      <td>
        <SampleStatusBadge status={sample.status} />
      </td>
      <td>
        <SampleDisposalBadge status={sample.disposalStatus} />
        {sample.disposalStatus !== 'NONE' && sample.disposedAt && (
          <div className="text-xs muted">Hủy lúc {formatDateTime(sample.disposedAt)}</div>
        )}
        {sample.disposalStatus === 'NONE' && sample.disposableFrom && (
          <div className="text-xs muted">Hủy được từ {formatDateTime(sample.disposableFrom)}</div>
        )}
      </td>
      <td>
        {next && (
          <button type="button" className="btn btn--sm btn--primary" disabled={busy} onClick={() => onApprove(sample, next)}>
            <Check size={14} /> {next === 'sample' ? 'Duyệt lưu mẫu' : 'Duyệt hủy mẫu'}
          </button>
        )}
      </td>
    </tr>
  );
}

/**
 * Lưu mẫu thức ăn (`/kitchen/food-samples`): hàng chờ duyệt của điểm trường theo khoảng ngày, duyệt lưu mẫu / duyệt hủy mẫu
 * (nút chỉ hiện khi BE đánh dấu `canApprove`; BE vẫn kiểm quyền) và in biểu mẫu chung từ các bản đã duyệt. Bếp ghi qua App.
 */
export default function FoodSampleQueuePage() {
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const campus = useStockCampus();
  const today = todayInput();
  const to = isIsoDate(params.get('to')) ? params.get('to') : today;
  const from = isIsoDate(params.get('from')) ? params.get('from') : daysBefore(to, DEFAULT_RANGE_DAYS);
  const pendingOnly = params.get('status') === 'pending';
  const samples = useFoodSamples(campus.campusId, from, to);
  const [busyId, setBusyId] = useState('');
  const [printing, setPrinting] = useState(false);
  const sheetRef = useRef(null);

  const setParam = (key, value) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );

  const rows = useMemo(() => {
    const sorted = sortSamples(samples.data);
    return pendingOnly ? sorted.filter(isPendingApproval) : sorted;
  }, [samples.data, pendingOnly]);
  const printable = useMemo(() => printableSamples(samples.data), [samples.data]);

  const approve = async (sample, kind) => {
    setBusyId(sample.id);
    try {
      if (kind === 'sample') await kitchenRecordsApi.approveSample(sample.id);
      else await kitchenRecordsApi.approveDisposal(sample.id);
      toast.success(kind === 'sample' ? 'Đã duyệt lưu mẫu.' : 'Đã duyệt hủy mẫu.');
      samples.reload({ silent: true });
    } catch (err) {
      // 403 (không có quyền duyệt ở điểm trường này) và 409 (đã đổi trạng thái) hiện thông điệp BE
      toast.error(err, 'Chưa duyệt được');
      if (err.status === 409) samples.reload({ silent: true });
    } finally {
      setBusyId('');
    }
  };

  const campusName = campus.campuses.find((c) => String(c.id) === String(campus.campusId));
  const printCampus = campusName?.shortName || campusName?.name;

  let body;
  if (campus.error) body = <ErrorState error={campus.error} onRetry={campus.reload} />;
  else if (campus.loading) body = <LoadingState />;
  else if (!campus.campusId)
    body = <EmptyState title="Chưa có điểm trường" description="Tài khoản chưa được gán điểm trường để xem lưu mẫu." />;
  else if (from > to) body = <EmptyState title="Khoảng ngày chưa hợp lệ" description="Ngày bắt đầu phải trước hoặc bằng ngày kết thúc." />;
  else if (samples.error) body = <ErrorState error={samples.error} onRetry={samples.reload} />;
  else if (samples.loading || !samples.data) body = <LoadingState />;
  else if (!rows.length)
    body = (
      <section className="card">
        <EmptyState
          title={pendingOnly ? 'Không có bản lưu mẫu chờ duyệt' : 'Chưa có bản lưu mẫu'}
          description="Bếp ghi lưu mẫu và hủy mẫu trên App; bản ghi hiện ở đây để duyệt."
        />
      </section>
    );
  else
    body = (
      <section className="card">
        <div className="table-wrap">
          <table className="table table--grid kr-table">
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Bữa ăn</th>
                <th>Món lưu mẫu</th>
                <th>Lấy mẫu lúc</th>
                <th>Lưu mẫu</th>
                <th>Hủy mẫu</th>
                <th>
                  <span className="sr-only">Duyệt</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((sample) => (
                <SampleRow key={sample.id} sample={sample} busy={busyId === sample.id} onApprove={approve} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );

  return (
    <div className="page">
      <Breadcrumb items={kitchenCrumbs(KITCHEN_RECORD_PAGES.foodSamples)} />
      <div className="page__head">
        <div>
          <h1 className="page__title">Lưu mẫu thức ăn</h1>
          <p className="page__desc">
            Duyệt bản lưu mẫu và hủy mẫu bếp đã ghi, từ {formatDate(from)} đến {formatDate(to)}.
          </p>
        </div>
        <div className="page__actions">
          <button type="button" className="btn" disabled={!printable.length} onClick={() => setPrinting(true)}>
            <Printer size={16} /> In biểu mẫu
          </button>
        </div>
      </div>
      <div className="kb-toolbar">
        <KbDateFilter label="Từ ngày" value={from} onChange={(next) => setParam('from', next)} />
        <KbDateFilter label="Đến ngày" value={to} onChange={(next) => setParam('to', next)} />
        {campus.campusId && <KbCampusFilter campusId={campus.campusId} onChange={campus.setCampusId} canPick={campus.canPick} />}
        <label className="date-filter">
          Hiển thị
          <select
            className="select"
            value={pendingOnly ? 'pending' : 'all'}
            onChange={(e) => setParam('status', e.target.value === 'pending' ? 'pending' : '')}
          >
            <option value="all">Tất cả bản ghi</option>
            <option value="pending">Chỉ việc chờ duyệt</option>
          </select>
        </label>
      </div>
      {body}
      <Modal
        open={printing}
        onClose={() => setPrinting(false)}
        size="xl"
        className="kb-print-modal"
        title="Sổ lưu và hủy mẫu thức ăn"
        footer={<PrintToolbar sheetRef={sheetRef} fileBase={`So_luu_mau_${from}_${to}`} printLabel="In" />}
      >
        <div className="print-preview__paper">
          <FoodSampleFormPrint ref={sheetRef} samples={printable} campusName={printCampus} from={from} to={to} />
        </div>
      </Modal>
    </div>
  );
}
