import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Info, RefreshCw } from '@/components/ui/icons';
import { useMasterData } from '@/hooks/useMasterData';
import { useMenuCatalog, useWeeklyMenu } from '@/hooks/menu-planning/useMenuPlanning';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { AllergenChips, WeeklyStatusBadge } from '@/components/menu-planning/MenuBadges';
import { WeekDaysView } from '@/components/menu-planning/WeekDaysView';
import { priceOn } from '@/utils/menu-planning/menuCalculations';
import { planCrumbs } from '@/utils/menu-planning/breadcrumbs';
import { formatDate, formatDateTime } from '@/utils/format';
import { ageGroupById } from '@/models/School';
import { RECORD_STATUS, WEEKLY_STATUS, formatMoney, portionFactorOf, weekLabel } from '@/models/menu-planning/menuPlanningConstants';
import '@/styles/modules/menu-planning.css';

/** Screen #89 – the Principal views one published weekly menu (view only; not edited, approved or published here). */
export default function MenuPlanDetailPage() {
  const { id } = useParams();
  const md = useMasterData();
  const { catalog, loading: catLoading } = useMenuCatalog();
  const { item: wm, loading, error, reload } = useWeeklyMenu(id);

  if (loading || catLoading) return <LoadingState />;
  if (error || !wm)
    return (
      <div className="page">
        <Breadcrumb items={planCrumbs('Chi tiết thực đơn')} />
        <ErrorState error={error} onRetry={reload} />
      </div>
    );

  const price = priceOn(catalog.mealPrices, wm.ageGroupId, wm.weekStart)?.price;
  const alternatives = wm.days
    .filter((d) => !d.holiday && d.menuId)
    .flatMap((d) =>
      catalog.allergyMenus
        .filter((a) => a.baseMenuId === d.menuId && a.status === RECORD_STATUS.ACTIVE)
        .map((a) => ({ date: d.date, ...a })),
    );

  return (
    <div className="page">
      <Breadcrumb items={planCrumbs(wm.code)} />
      <div className="page__head">
        <div className="row" style={{ gap: 12 }}>
          <h1 className="page__title">
            Thực đơn tuần {weekLabel(wm.weekStart)} – {ageGroupById(wm.ageGroupId)?.shortName}
          </h1>
          <WeeklyStatusBadge status={wm.status} size="lg" />
        </div>
        <button className="btn" onClick={() => reload()}>
          <RefreshCw size={16} /> Tải lại
        </button>
      </div>
      {wm.status === WEEKLY_STATUS.REPLACED && (
        <div className="alert alert--warning mb-16">
          <Info size={18} />
          <div>
            Phiên bản này đã được thay thế. {wm.replacedBy && <Link to={`/menu/plans/${wm.replacedBy}`}>Xem phiên bản đang áp dụng</Link>}
          </div>
        </div>
      )}
      <div className="card">
        <div className="card__header">
          <div className="card__title">Thông tin chung</div>
        </div>
        <div className="card__body info-columns">
          <dl className="info-list">
            <dt>Mã:</dt>
            <dd className="fw-600">{wm.code}</dd>
            <dt>Nhóm tuổi:</dt>
            <dd>{ageGroupById(wm.ageGroupId)?.name || 'Chưa có thông tin nhóm tuổi'}</dd>
            <dt>Phiên bản:</dt>
            <dd>{wm.version}</dd>
          </dl>
          <dl className="info-list">
            <dt>Xuất bản:</dt>
            <dd>
              {md.userById(wm.publishedBy)?.fullName || '—'} · {formatDateTime(wm.publishedAt)}
            </dd>
            <dt>Giá suất ăn:</dt>
            <dd>{price ? `${formatMoney(price)} / trẻ / ngày` : 'Chưa có thông tin giá'}</dd>
            <dt>Khẩu phần:</dt>
            <dd>Hệ số {String(portionFactorOf(wm.ageGroupId)).replace('.', ',')} so với khẩu phần chuẩn của món</dd>
          </dl>
        </div>
      </div>
      <div className="card mt-16">
        <div className="card__header">
          <div className="card__title">Bữa ăn trong tuần</div>
        </div>
        <WeekDaysView wm={wm} catalog={catalog} />
      </div>
      <div className="card mt-16">
        <div className="card__header">
          <div className="card__title">Thực đơn thay thế cho trẻ dị ứng ({alternatives.length})</div>
        </div>
        <div className="card__body">
          {alternatives.length === 0 ? (
            <span className="muted">Tuần này không có thực đơn thay thế.</span>
          ) : (
            <ul className="td-check-list">
              {alternatives.map((a) => (
                <li key={`${a.date}_${a.id}`}>
                  <div>
                    <b>{formatDate(a.date)}</b> · {a.name} · tránh <AllergenChips allergens={a.restrictions} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="page-actions">
        <Link className="btn" to="/menu/plans">
          <ArrowLeft size={16} /> Quay lại danh sách
        </Link>
      </div>
    </div>
  );
}
