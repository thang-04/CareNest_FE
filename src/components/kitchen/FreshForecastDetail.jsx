import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Printer, RefreshCw, Trash2 } from '@/components/ui/icons';
import {
  Breadcrumb,
  Button,
  ConfirmationModal,
  EmptyState,
  ErrorState,
  LoadingState,
  Modal,
  PrintPaperFit,
  PrintToolbar,
} from '@/components';
import { ForecastCountsTable, ForecastDryCard, ForecastDryOrderTable, ForecastLinesTable } from '@/components/kitchen/FreshForecastTables';
import { FreshForecastPrint } from '@/components/kitchen/FreshForecastPrint';
import { useToast } from '@/contexts/ToastContext';
import { useFreshForecast } from '@/hooks/kitchen/useFreshGoods';
import { freshGoodsApi } from '@/services/freshGoodsApi';
import { kitchenCrumbs, KITCHEN_PAGES } from '@/utils/kitchen/breadcrumbs';
import { personName } from '@/utils/kitchen/stockLots';
import { formatDate, formatDateTime, todayInput } from '@/utils/format';

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
  const [refreshing, setRefreshing] = useState(false);
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

  // Cân đối đổi sau khi lập: lập bản mới cho các ngày còn lại của kỳ, giữ số trẻ và hàng khô đã chốt
  const refresh = async () => {
    setRefreshing(true);
    try {
      const today = todayInput();
      const saved = await freshGoodsApi.saveForecast({
        campusId: forecast.campusId,
        periodFrom: forecast.periodFrom < today ? today : forecast.periodFrom,
        periodTo: forecast.periodTo,
        note: forecast.note,
        counts: forecast.counts.map(({ ageGroupId, expectedCount }) => ({ ageGroupId, expectedCount })),
        dryOrder: forecast.dryOrder,
      });
      toast.success('Đã lập bản dự trù mới theo cân đối.');
      navigate(`/kitchen/forecast/${saved.id}?campusId=${saved.campusId}`);
    } catch (err) {
      toast.error(err, 'Chưa cập nhật được bản dự trù');
    } finally {
      setRefreshing(false);
    }
  };
  const canRefresh = forecast?.outdated && forecast.canManage && forecast.periodTo >= todayInput();

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
        {forecast.outdated && (
          <div className="alert alert--warning mb-16">
            <div>Bản cân đối khẩu phần đã đổi sau khi lập bản dự trù này. Cập nhật để đặt hàng đúng số mới.</div>
            {canRefresh && (
              <Button variant="primary" icon={RefreshCw} loading={refreshing} onClick={refresh}>
                Cập nhật bản dự trù
              </Button>
            )}
          </div>
        )}
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
        <section className="card mb-16">
          <div className="card__header">
            <div>
              <div className="card__title">Hàng khô đặt cho kỳ</div>
              <div className="text-sm muted">Lượng chốt lúc lưu bản dự trù; dùng để in và đối chiếu khi lập phiếu nhập hàng khô.</div>
            </div>
          </div>
          {forecast.dryOrder.length ? (
            <ForecastDryOrderTable lines={forecast.dryOrder} />
          ) : (
            <EmptyState title="Không đặt hàng khô cho kỳ này" description="Lúc lập bản dự trù, kho khô đủ hoặc lượng đặt để 0." />
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
            {/* NUT-12: bản đã làm căn cứ kiểm nhận thì BE không cho xóa (deletable false) */}
            {forecast.canManage && forecast.deletable !== false && (
              <Button variant="outline-danger" icon={Trash2} onClick={() => setDeleting(true)}>
                Xóa bản dự trù
              </Button>
            )}
            <Button icon={Printer} disabled={!forecast.lines.length && !forecast.dryOrder.length} onClick={() => setPrinting(true)}>
              In danh sách đặt hàng
            </Button>
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
          footer={<PrintToolbar sheetRef={sheetRef} fileBase={`Dat_hang_${forecast.periodFrom}`} onClose={() => setPrinting(false)} />}
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
