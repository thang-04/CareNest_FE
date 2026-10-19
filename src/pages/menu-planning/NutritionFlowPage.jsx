import { Link } from 'react-router-dom';
import { Bowl, CalendarRange, Carrot, ClipboardList, Gear, ShoppingCart, Sparkles } from '@/components/ui/icons';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ErrorState } from '@/components/ui/States';
import { useMenuCatalog, useWeeklyMenus } from '@/hooks/menu-planning/useMenuPlanning';
import { FLOW_STEPS, flowSummary } from '@/utils/menu-planning/nutritionFlow';
import { flowCrumbs } from '@/utils/menu-planning/breadcrumbs';
import { todayInput } from '@/utils/format';
import '@/styles/modules/menu-planning.css';

const ICONS = { setup: Gear, foods: Carrot, dishes: Bowl, menus: ClipboardList, weekly: CalendarRange, market: ShoppingCart };

/** Trang vào luồng dinh dưỡng: 6 bước theo thứ tự, mỗi bước có trạng thái và mở đúng màn. */
export default function NutritionFlowPage() {
  const { catalog, loading: catalogLoading, error: catalogError, reload } = useMenuCatalog();
  const { items: weeklyMenus, loading: weeklyLoading, error: weeklyError } = useWeeklyMenus({});
  const loading = catalogLoading || weeklyLoading;
  const error = catalogError || weeklyError;
  const summary = loading || error ? null : flowSummary({ ...catalog, weeklyMenus, today: todayInput() });

  return (
    <div className="page">
      <Breadcrumb items={flowCrumbs()} />
      <div className="page__head">
        <div>
          <h1 className="page__title">Quản lý dinh dưỡng</h1>
          <p className="page__desc">Đi lần lượt từ thiết lập tới đi chợ. Bấm vào một bước để mở.</p>
        </div>
      </div>
      <section className="card">
        <div className="card__body">
          <ol className="td-flow">
            {FLOW_STEPS.map((step, i) => {
              const Icon = ICONS[step.key];
              return (
                <li key={step.key}>
                  <Link className="td-flow__step" to={step.to}>
                    <span className="td-flow__icon">
                      <Icon size={30} />
                    </span>
                    <b>
                      {i + 1}. {step.label}
                    </b>
                    <small>{loading ? 'Đang tải…' : summary?.[step.key]?.text}</small>
                  </Link>
                </li>
              );
            })}
          </ol>
          {error && <ErrorState error={error} onRetry={reload} />}
          <div className="td-flow__cta">
            <Link className="btn btn--outline-primary" to={FLOW_STEPS[0].to}>
              <Gear size={16} /> {FLOW_STEPS[0].label}
            </Link>
          </div>
        </div>
      </section>
      <div className="alert alert--info">
        <Sparkles size={18} />
        <div>
          <b>AI ở đâu:</b> chỉ ở hai chỗ — soạn thực đơn mẫu và soạn thực đơn tuần, luôn là bản nháp chờ bạn sửa và duyệt. Các cảnh báo khác
          là kiểm tra tự động bằng quy tắc.
        </div>
      </div>
    </div>
  );
}
