import { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, Printer, ShoppingBasket } from '@/components/ui/icons';
import { useStockCampus } from '@/hooks/kitchen/useDryStock';
import { useDayMarket } from '@/hooks/kitchen/useFreshGoods';
import { Breadcrumb, EmptyState, ErrorState, LoadingState, StatusBadge } from '@/components';
import { Modal } from '@/components/ui/Modal';
import { PrintToolbar } from '@/components/print/PrintToolbar';
import { exportWithPreview } from '@/components/ui/ExportPreview';
import { KbCampusFilter, KbDateFilter } from '@/components/kitchen/KitchenFilters';
import { DayMarketMenu, DayMarketMoney, DayMarketTable } from '@/components/kitchen/DayMarketBlocks';
import { DayMarketPrint } from '@/components/kitchen/DayMarketPrint';
import { kitchenCrumbs, KITCHEN_PAGES } from '@/utils/kitchen/breadcrumbs';
import { dayMarketCsvRows } from '@/utils/kitchen/kitchenExport';
import { formatDate, formatDateTime, isIsoDate, todayInput } from '@/utils/format';
import { mondayOf } from '@/utils/week';
import '@/styles/modules/kitchen.css';

/**
 * Đi chợ theo ngày: bảng thực phẩm có đơn giá, lượng xuất kho / mua chợ, thành tiền chia theo nhóm tuổi; thu–chi trong ngày;
 * thực đơn theo bữa; in và xuất Excel. Mọi số do BE tính (ngày đã chốt suất dùng số chốt, chưa chốt dùng sĩ số đang học).
 */
export default function DayMarketPage() {
  const [params, setParams] = useSearchParams();
  const date = isIsoDate(params.get('date')) ? params.get('date') : todayInput();
  const campus = useStockCampus();
  const market = useDayMarket(campus.campusId, date);
  const campusInfo = campus.campuses.find((c) => String(c.id) === campus.campusId);
  // Tên điểm trường lấy từ danh mục của tài khoản để bản in và tệp xuất có tiêu đề
  const data = market.data ? { ...market.data, campusName: campusInfo?.shortName || campusInfo?.name || '' } : null;
  const error = campus.error || market.error;
  const loading = campus.loading || market.loading;
  const reload = campus.error ? campus.reload : market.reload;
  const [printing, setPrinting] = useState(false);
  const sheetRef = useRef(null);

  const setParam = (key, value) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set(key, value);
        return next;
      },
      { replace: true },
    );

  const ready = data?.status === 'READY' && data.lines.length > 0;

  let body;
  if (error) body = <ErrorState error={error} onRetry={reload} />;
  else if (!loading && !campus.campusId)
    body = (
      <section className="card">
        <EmptyState title="Chưa có điểm trường" description="Tài khoản chưa được gán điểm trường để xem bảng đi chợ." />
      </section>
    );
  else if (loading || !data) body = <LoadingState />;
  else if (data.status === 'HOLIDAY')
    body = (
      <section className="card">
        <EmptyState title={`Ngày ${formatDate(date)} là ngày nghỉ`} description="Ngày nghỉ không có suất ăn nên không đi chợ." />
      </section>
    );
  else if (data.status === 'NO_MENU')
    body = (
      <section className="card">
        <EmptyState
          title={`Chưa có thực đơn đã công bố cho ngày ${formatDate(date)}`}
          description="Bảng đi chợ tính từ thực đơn tuần đã công bố. Công bố thực đơn tuần trước rồi quay lại."
          action={
            <Link className="btn" to={`/menu/weekly?week=${mondayOf(date)}`}>
              Mở Thực đơn tuần
            </Link>
          }
        />
      </section>
    );
  else if (!ready)
    body = (
      <section className="card">
        <EmptyState title="Ngày này chưa có suất ăn" description="Chưa có lớp nào có suất ăn nên chưa có thực phẩm cần mua." />
      </section>
    );
  else
    body = (
      <div className="kb-stack">
        {data.warnings.length > 0 && (
          <div className="alert alert--warning">
            {data.warnings.map((text) => (
              <div key={text}>{text}</div>
            ))}
          </div>
        )}
        <section className="card">
          <div className="card__header">
            <h2 className="card__title">
              <ShoppingBasket size={18} /> Thực phẩm ngày {formatDate(date)}
            </h2>
            <span className="text-xs muted">Số lượng theo đơn vị mua; đồ khô xuất kho, hàng tươi mua chợ.</span>
          </div>
          <DayMarketTable data={data} />
        </section>
        <section className="card">
          <div className="card__header">
            <h2 className="card__title">Thu – chi trong ngày</h2>
          </div>
          <DayMarketMoney data={data} />
        </section>
        {data.menu.length > 0 && (
          <section className="card">
            <div className="card__header">
              <h2 className="card__title">Thực đơn trong ngày</h2>
            </div>
            <DayMarketMenu data={data} />
          </section>
        )}
      </div>
    );

  return (
    <div className="page">
      <Breadcrumb items={kitchenCrumbs(KITCHEN_PAGES.forecast, KITCHEN_PAGES.dayMarket.label)} />
      <div className="page__head">
        <div>
          <h1 className="page__title">Đi chợ theo ngày</h1>
        </div>
      </div>
      <div className="kb-toolbar">
        <KbDateFilter value={date} onChange={(next) => setParam('date', next)} />
        <KbCampusFilter campusId={campus.campusId} onChange={campus.setCampusId} canPick={campus.canPick} />
        {data && data.status !== 'HOLIDAY' && data.status !== 'NO_MENU' && (
          <span className="date-filter__static">
            {data.basis === 'CONFIRMED' ? (
              <StatusBadge tone="green" label={`Theo số suất đã chốt${data.confirmedAt ? ` ${formatDateTime(data.confirmedAt)}` : ''}`} />
            ) : (
              <StatusBadge tone="orange" label="Theo số trẻ đang học, chưa chốt suất" />
            )}
          </span>
        )}
        {ready && (
          <div className="kb-toolbar__end">
            <button
              type="button"
              className="btn"
              onClick={() => exportWithPreview(dayMarketCsvRows(data), `bang-di-cho-${date}.xlsx`, { headerRow: 1, size: 'full' })}
            >
              <Download size={16} /> Xuất Excel
            </button>
            <button type="button" className="btn" onClick={() => setPrinting(true)}>
              <Printer size={16} /> In bảng đi chợ
            </button>
          </div>
        )}
      </div>
      {body}

      {ready && (
        <Modal
          open={printing}
          onClose={() => setPrinting(false)}
          size="full"
          className="kb-print-modal"
          title="Bảng đi chợ"
          footer={<PrintToolbar sheetRef={sheetRef} fileBase={`Bang_di_cho_${date}`} printLabel="In bảng" orientation="landscape" />}
        >
          <div className="print-preview__paper">
            <DayMarketPrint ref={sheetRef} data={data} />
          </div>
        </Modal>
      )}
    </div>
  );
}
