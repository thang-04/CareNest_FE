import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Printer, Trash2 } from '@/components/ui/icons';
import { Breadcrumb, ConfirmationModal, EmptyState, ErrorState, LoadingState, Modal, PrintPaperFit, PrintToolbar } from '@/components';
import { ForecastCountsTable, ForecastDryCard, ForecastLinesTable } from '@/components/kitchen/FreshForecastTables';
import { FreshForecastPrint } from '@/components/kitchen/FreshForecastPrint';
import { useToast } from '@/contexts/ToastContext';
import { useFreshForecast } from '@/hooks/kitchen/useFreshGoods';
import { freshGoodsApi } from '@/services/freshGoodsApi';
import { kitchenCrumbs, KITCHEN_PAGES } from '@/utils/kitchen/breadcrumbs';
import { personName } from '@/utils/kitchen/stockLots';
import { formatDate, formatDateTime } from '@/utils/format';

/** Một bản dự trù đã lưu: số trẻ, hàng tươi theo ngày, hàng khô cần nhập thêm, in danh sách đặt hàng, xóa (có xác nhận). */
export function FreshForecastDetail({ campus }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const forecastQ = useFreshForecast(id);
  const forecast = forecastQ.data;
  const [printing, setPrinting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const sheetRef = useRef(null);

  const campusId = forecast ? String(forecast.campusId) : campus.campusId;
  const listPath = `/kitchen/forecast${campusId ? `?campusId=${campusId}` : ''}`;
  const campusName = campus.campuses.find((c) => String(c.id) === campusId);
  const title = forecast ? `Bản dự trù ${formatDate(forecast.periodFrom)} – ${formatDate(forecast.periodTo)}` : 'Bản dự trù';

  const remove = async () => {
    try {
      await freshGoodsApi.deleteForecast(id);
      toast.success('Đã xóa bản dự trù.');
      setDeleting(false);
      navigate(listPath, { replace: true });
    } catch (err) {
      setDeleteError(err.message);
    }
  };

  let content;
  if (forecastQ.error) content = <ErrorState error={forecastQ.error} onRetry={forecastQ.reload} />;
  else if (forecastQ.loading || !forecast) content = <LoadingState />;
  else
    content = (
      <>
        <p className="text-sm muted mb-16">
          Lập{personName(forecast.createdBy) ? ` bởi ${personName(forecast.createdBy)}` : ''} lúc {formatDateTime(forecast.createdAt)}.
          {forecast.note && <> Ghi chú: {forecast.note}</>}
        </p>
        {forecast.counts.length > 0 && (
          <section className="card mb-16">
            <div className="card__header">
              <div className="card__title">Số trẻ theo nhóm tuổi</div>
            </div>
            <ForecastCountsTable counts={forecast.counts} />
          </section>
        )}
        <section className="card mb-16">
          <div className="card__header">
            <div className="card__title">Hàng tươi cần đặt</div>
          </div>
          {forecast.lines.length ? (
            <ForecastLinesTable forecast={forecast} />
          ) : (
            <EmptyState
              title="Kỳ này chưa có thực phẩm tươi cần đặt"
              description="Kiểm tra thực đơn của các ngày trong kỳ đã được lập chưa."
            />
          )}
        </section>
        <ForecastDryCard forecast={forecast} />
      </>
    );

  return (
    <div className="page">
      <Breadcrumb items={kitchenCrumbs(KITCHEN_PAGES.forecast, title)} />
      <div className="page__head">
        <h1 className="page__title">{title}</h1>
      </div>
      {content}
      <div className="page-actions">
        <Link className="btn" to={listPath}>
          <ArrowLeft size={16} /> Quay lại
        </Link>
        {forecast && (
          <div className="row">
            {forecast.canManage && (
              <button type="button" className="btn btn--outline-danger" onClick={() => setDeleting(true)}>
                <Trash2 size={16} /> Xóa bản dự trù
              </button>
            )}
            <button
              type="button"
              className="btn"
              disabled={!forecast.lines.length && !forecast.dryLines.length}
              onClick={() => setPrinting(true)}
            >
              <Printer size={16} /> In danh sách đặt hàng
            </button>
          </div>
        )}
      </div>

      {forecast && (
        <Modal
          open={printing}
          onClose={() => setPrinting(false)}
          size="xl"
          className="print-modal"
          title="Danh sách đặt hàng"
          footer={<PrintToolbar sheetRef={sheetRef} fileBase={`Dat_hang_${forecast.periodFrom}`} printLabel="In danh sách" />}
        >
          <PrintPaperFit>
            <FreshForecastPrint ref={sheetRef} forecast={forecast} campusName={campusName?.shortName || campusName?.name} />
          </PrintPaperFit>
        </Modal>
      )}
      <ConfirmationModal
        open={deleting}
        danger
        title="Xóa bản dự trù?"
        message="Bản dự trù bị xóa hẳn. Lần kiểm nhận hàng tươi đã ghi nhận không bị ảnh hưởng."
        confirmLabel="Xóa bản dự trù"
        error={deleteError}
        onConfirm={remove}
        onClose={() => {
          setDeleting(false);
          setDeleteError('');
        }}
      />
    </div>
  );
}
