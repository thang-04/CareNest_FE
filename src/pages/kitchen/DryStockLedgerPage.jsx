import { useNavigate } from 'react-router-dom';
import { Plus } from '@/components/ui/icons';
import { Button, EmptyState, ErrorState, LoadingState, PageHeader } from '@/components';
import { usePageReadOnly } from '@/contexts/PageReadOnlyContext';
import { Tabs } from '@/components/ui/Tabs';
import { KbCampusFilter } from '@/components/kitchen/KitchenFilters';
import { StockLotsTab } from '@/components/kitchen/StockLotsTab';
import { StockMovementsTab } from '@/components/kitchen/StockMovementsTab';
import { StockReceiptsTab } from '@/components/kitchen/StockReceiptsTab';
import { StockShortfallsTab } from '@/components/kitchen/StockShortfallsTab';
import { useCanManageStock, useStockCampus } from '@/hooks/kitchen/useDryStock';
import { kitchenCrumbs, KITCHEN_PAGES } from '@/utils/kitchen/breadcrumbs';
import '@/styles/modules/kitchen.css';

// Một trang, bốn tab; mỗi tab là một đường dẫn riêng (menu và liên kết từ "Bán trú hôm nay" mở thẳng tab)
const TABS = {
  stock: {
    label: 'Tồn kho khô',
    to: '/kitchen/dry-stock',
    crumb: KITCHEN_PAGES.dryStock,
    desc: 'Lô còn trong kho, gom theo thực phẩm. Số lượng hiện theo đơn vị mua.',
    View: StockLotsTab,
  },
  receipts: {
    label: 'Phiếu nhập',
    to: '/kitchen/stock-receipts',
    crumb: KITCHEN_PAGES.stockReceipts,
    desc: 'Phiếu nháp chưa vào kho; phiếu đã xác nhận tạo lô tồn kho.',
    View: StockReceiptsTab,
  },
  history: {
    label: 'Lịch sử nhập/trừ',
    to: '/kitchen/stock-history',
    crumb: KITCHEN_PAGES.stockHistory,
    desc: 'Mọi lần nhập, trừ theo số suất, điều chỉnh và hủy phiếu của kho.',
    View: StockMovementsTab,
  },
  shortfalls: {
    label: 'Phần thiếu chờ bổ sung',
    to: '/kitchen/stock-shortfalls',
    crumb: KITCHEN_PAGES.stockShortfalls,
    desc: 'Thực phẩm kho chưa đủ để trừ theo số suất. Nhập kho bổ sung để xử lý.',
    View: StockShortfallsTab,
  },
};

/** Kho khô (L2): tồn theo lô, phiếu nhập, lịch sử nhập/trừ, phần thiếu. Điểm trường chọn trên URL (?campusId=). */
export default function DryStockLedgerPage({ tab = 'stock' }) {
  const navigate = useNavigate();
  const { reason: viewOnlyReason } = usePageReadOnly();
  const campus = useStockCampus();
  const canManage = useCanManageStock(campus.campusId);
  const current = TABS[tab] || TABS.stock;
  const { View } = current;

  const openTab = (key) => navigate({ pathname: TABS[key].to, search: campus.campusId ? `?campusId=${campus.campusId}` : '' });

  let body;
  if (campus.error) body = <ErrorState error={campus.error} onRetry={campus.reload} />;
  else if (campus.loading) body = <LoadingState />;
  else if (!campus.campusId)
    body = <EmptyState title="Chưa có điểm trường" description="Tài khoản chưa được gán điểm trường để xem kho." />;
  else body = <View key={campus.campusId} campusId={campus.campusId} />;

  return (
    <div className="page">
      <PageHeader crumbs={kitchenCrumbs(current.crumb)} title={current.label} readOnly={!canManage} />
      <div className="kb-toolbar">
        <Tabs
          ariaLabel="Kho khô"
          value={tab}
          onChange={openTab}
          items={Object.entries(TABS).map(([key, t]) => ({ key, label: t.label }))}
        />
        <div className="kb-toolbar__end">
          {campus.campusId && <KbCampusFilter campusId={campus.campusId} onChange={campus.setCampusId} canPick={campus.canPick} />}
          {/* Nút lập phiếu đứng cạnh tab và ô điểm trường, không treo riêng ở góc trên */}
          {campus.campusId && (
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => navigate(`/kitchen/stock-receipts/new?campusId=${campus.campusId}`)}
              disabledReason={canManage ? undefined : viewOnlyReason}
            >
              Lập phiếu nhập
            </Button>
          )}
        </div>
      </div>
      {body}
    </div>
  );
}
