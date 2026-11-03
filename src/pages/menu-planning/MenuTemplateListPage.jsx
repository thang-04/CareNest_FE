import { Link } from 'react-router-dom';
import { Plus } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { Breadcrumb, EmptyState, ErrorState, LoadingState } from '@/components';
import { RecordStatusBadge } from '@/components/menu-planning/MenuBadges';
import { useMenuTemplates } from '@/hooks/menu-planning/useMenuTemplates';
import { PERMISSIONS } from '@/models/bePermissions';
import { MEAL_BLOCK, MEAL_BLOCK_LABELS } from '@/models/menu-planning/menuPlanningConstants';
import { hasBePermission } from '@/utils/bePermissions';
import { templateCrumbs } from '@/utils/menu-planning/breadcrumbs';
import { TEMPLATE_WEEKS, weekItemCounts } from '@/utils/menu-planning/menuTemplateGrid';
import { formatDateTime } from '@/utils/format';
import '@/styles/modules/menu-planning.css';

/** Bộ thực đơn mẫu 4 tuần (NUT-13), gom theo khối; mỗi bộ có nhãn mùa, số món đã xếp từng tuần. */
export default function MenuTemplateListPage() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useMenuTemplates();
  const canCreate = hasBePermission(user, PERMISSIONS.MENU_MANAGE);
  const templates = data || [];

  return (
    <div className="page">
      <Breadcrumb items={templateCrumbs()} />
      <div className="page__head">
        <div>
          <h1 className="page__title">Bộ thực đơn mẫu</h1>
          <p className="page__desc">
            Mỗi bộ gồm 4 tuần (thứ Hai–thứ Sáu) cho một khối, có nhãn mùa. Kế hoạch tuần sao một tuần của bộ để xoay vòng.
          </p>
        </div>
        {canCreate && (
          <div className="page__actions">
            <Link className="btn btn--primary" to="/menu/templates/new">
              <Plus size={16} /> Thêm bộ mẫu
            </Link>
          </div>
        )}
      </div>
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : templates.length === 0 ? (
        <section className="card">
          <EmptyState
            title="Chưa có bộ thực đơn mẫu"
            description={canCreate ? 'Thêm bộ 4 tuần đầu tiên cho nhà trẻ hoặc mẫu giáo.' : 'Người lập thực đơn chưa tạo bộ nào.'}
          />
        </section>
      ) : (
        Object.values(MEAL_BLOCK)
          .filter((block) => templates.some((t) => t.block === block))
          .map((block) => (
            <section key={block} className="card">
              <div className="card__header">
                <h2 className="card__title">{MEAL_BLOCK_LABELS[block]}</h2>
              </div>
              <div className="table-wrap">
                <table className="table table--grid">
                  <thead>
                    <tr>
                      <th>Bộ thực đơn</th>
                      <th>Mùa</th>
                      {TEMPLATE_WEEKS.map((w) => (
                        <th key={w} className="num">
                          Tuần {w}
                        </th>
                      ))}
                      <th className="num">Số món</th>
                      <th>Trạng thái</th>
                      <th>Cập nhật</th>
                    </tr>
                  </thead>
                  <tbody>
                    {templates
                      .filter((t) => t.block === block)
                      .map((t) => {
                        const counts = weekItemCounts(t.items);
                        return (
                          <tr key={t.id}>
                            <td>
                              <Link to={`/menu/templates/${t.id}`} className="fw-600">
                                {t.name}
                              </Link>
                            </td>
                            <td>{t.seasonLabel || <span className="muted">—</span>}</td>
                            {TEMPLATE_WEEKS.map((w) => (
                              <td key={w} className="num">
                                {counts[w] ? `${counts[w]} món` : <span className="td-warn">Trống</span>}
                              </td>
                            ))}
                            <td className="num">{t.dishCount}</td>
                            <td>
                              <RecordStatusBadge status={t.status} />
                            </td>
                            <td className="text-sm muted nowrap">{t.updatedAt ? formatDateTime(t.updatedAt) : '—'}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </section>
          ))
      )}
    </div>
  );
}
