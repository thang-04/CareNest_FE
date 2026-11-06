import { Breadcrumb, EmptyState, ErrorState, LoadingState } from '@/components';
import { FreshForecastDetail } from '@/components/kitchen/FreshForecastDetail';
import { FreshForecastList } from '@/components/kitchen/FreshForecastList';
import { useStockCampus } from '@/hooks/kitchen/useDryStock';
import { kitchenCrumbs, KITCHEN_PAGES } from '@/utils/kitchen/breadcrumbs';
import '@/styles/modules/kitchen.css';

const NewForecast = (props) => <FreshForecastList {...props} autoOpen />;
const VIEWS = { list: FreshForecastList, new: NewForecast, detail: FreshForecastDetail };

/**
 * Bản dự trù hàng tươi trên BE: `/kitchen/forecast` (danh sách; nút Lập mở hộp xem trước rồi lưu), `/new` (danh sách mở sẵn hộp lập),
 * `/:id` (xem, in, xóa).
 * Điểm trường chọn trên URL (?campusId=). Số lượng do BE tính; trang chỉ gom kỳ và số trẻ dự kiến.
 */
export default function FreshForecastPage({ mode = 'list' }) {
  const campus = useStockCampus();
  const View = VIEWS[mode] || FreshForecastList;

  if (campus.error || campus.loading || !campus.campusId) {
    let body = <LoadingState />;
    if (campus.error) body = <ErrorState error={campus.error} onRetry={campus.reload} />;
    else if (!campus.loading)
      body = <EmptyState title="Chưa có điểm trường" description="Tài khoản chưa được gán điểm trường để xem bản dự trù." />;
    return (
      <div className="page">
        <Breadcrumb items={kitchenCrumbs(KITCHEN_PAGES.forecast)} />
        {body}
      </div>
    );
  }
  return <View key={campus.campusId} campus={campus} />;
}
