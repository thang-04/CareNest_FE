import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, ListChecks, RotateCcw } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useMasterData } from '@/hooks/useMasterData';
import { usePendingApprovals } from '@/hooks/dashboard/useDashboard';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { ROLES } from '@/models/User';
import { APPROVAL_TYPE_META } from '@/models/dashboard/dashboardConstants';
import { approvalsCrumbs } from '@/utils/dashboard/breadcrumbs';
import { formatWhen } from '@/utils/dashboard/dashboardFormat';
import '@/styles/modules/dashboard.css';
import { StatCardIcon } from '@/components/ui/StatCardIcon';

const DESCRIPTIONS = {
  PRINCIPAL: 'Đề xuất khen thưởng cuối năm, đề xuất mua sắm – sửa chữa và đề nghị bổ sung CSVC đang chờ Hiệu trưởng quyết định.',
  VICE_PRINCIPAL:
    'Kế hoạch chủ đề, giáo án, đề xuất khen thưởng, báo cáo sự cố, đề nghị bổ sung, kiểm kê, sĩ số suất ăn và phiếu xuất kho của điểm trường đang chờ bạn.',
  TEAM_LEADER: 'Giáo án của giáo viên trong nhóm tuổi đang chờ tổ trưởng xem xét trước khi chuyển Phó hiệu trưởng.',
};

/**
 * #126 Pending Approval Requests (UC 3.4): everything waiting for the signed-in user's decision, grouped by type.
 * Filter by type (and campus for the Principal); each row opens the owning module's page, where the decision is made.
 */
export default function PendingApprovalsPage() {
  const { user } = useAuth();
  const md = useMasterData();
  const [params, setParams] = useSearchParams();
  const { groups, total, loading, error, reload } = usePendingApprovals();
  const type = params.get('type') || '';
  const campusId = params.get('campusId') || '';
  const principal = user.role === ROLES.PRINCIPAL;

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const inCampus = (i) => !campusId || !i.campusId || i.campusId === campusId;
  const scoped = groups.map((g) => ({ ...g, items: g.items.filter(inCampus) }));
  const shown = scoped.filter((g) => !type || g.type === type);
  const shownCount = shown.reduce((n, g) => n + g.items.length, 0);
  const filtered = !!(type || campusId);

  return (
    <div className="page">
      <Breadcrumb items={approvalsCrumbs()} />
      <h1 className="page__title">Chờ duyệt</h1>
      <p className="text-2 mb-16">{DESCRIPTIONS[user.role]}</p>

      {loading && !groups.length ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <>
          <div className="stat-grid">
            <button
              type="button"
              className={`stat-card stat-card--purple ${!type ? 'stat-card--active' : ''}`}
              aria-pressed={!type}
              onClick={() => setFilter('type', '')}
            >
              <div className="stat-card__value">{scoped.reduce((n, g) => n + g.items.length, 0)}</div>
              <div className="stat-card__label">Tất cả yêu cầu chờ bạn</div>
              <StatCardIcon tone="purple" />
            </button>
            {scoped.map((g) => (
              <button
                key={g.type}
                type="button"
                className={`stat-card stat-card--${APPROVAL_TYPE_META[g.type].tone} ${type === g.type ? 'stat-card--active' : ''}`}
                aria-pressed={type === g.type}
                onClick={() => setFilter('type', type === g.type ? '' : g.type)}
              >
                <div className="stat-card__value">{g.error ? '—' : g.items.length}</div>
                <div className="stat-card__label">{APPROVAL_TYPE_META[g.type].short}</div>
                <StatCardIcon tone={APPROVAL_TYPE_META[g.type].tone} />
              </button>
            ))}
          </div>

          <div className="card mb-16">
            <div className="filter-bar">
              <div className="field">
                <label className="field__label" htmlFor="db-type">
                  Loại yêu cầu
                </label>
                <select id="db-type" className="select" value={type} onChange={(e) => setFilter('type', e.target.value)}>
                  <option value="">Tất cả loại</option>
                  {groups.map((g) => (
                    <option key={g.type} value={g.type}>
                      {APPROVAL_TYPE_META[g.type].label}
                    </option>
                  ))}
                </select>
              </div>
              {principal && (
                <div className="field">
                  <label className="field__label" htmlFor="db-campus-filter">
                    Điểm trường
                  </label>
                  <select id="db-campus-filter" className="select" value={campusId} onChange={(e) => setFilter('campusId', e.target.value)}>
                    <option value="">Tất cả điểm trường</option>
                    {md.campuses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {filtered && (
                <button type="button" className="btn btn--ghost" onClick={() => setParams({}, { replace: true })}>
                  <RotateCcw size={16} /> Đặt lại bộ lọc
                </button>
              )}
            </div>
          </div>

          {total === 0 && !groups.some((g) => g.error) ? (
            <div className="card">
              <EmptyState
                icon={ListChecks}
                title="Không có yêu cầu nào chờ bạn duyệt"
                description="Khi có kế hoạch, đề xuất hoặc báo cáo cần bạn quyết định, chúng sẽ hiện ở đây và trong thông báo."
              />
            </div>
          ) : shownCount === 0 && !shown.some((g) => g.error) ? (
            <div className="card">
              <EmptyState
                title="Không có yêu cầu phù hợp bộ lọc"
                action={
                  <button type="button" className="btn btn--sm" onClick={() => setParams({}, { replace: true })}>
                    <RotateCcw size={14} /> Đặt lại bộ lọc
                  </button>
                }
              />
            </div>
          ) : (
            shown
              .filter((g) => g.items.length || g.error)
              .map((g) => (
                <ApprovalGroup
                  key={g.type}
                  group={g}
                  showCampus={principal}
                  campusName={(id) => md.campusById(id)?.shortName}
                  onRetry={reload}
                />
              ))
          )}
        </>
      )}
    </div>
  );
}

function ApprovalGroup({ group, showCampus, campusName, onRetry }) {
  const meta = APPROVAL_TYPE_META[group.type];
  return (
    <section className="card db-group" aria-labelledby={`db-group-${group.type}`}>
      <div className="card__header">
        <h2 className="card__title" id={`db-group-${group.type}`}>
          {meta.label} {!group.error && <span className="db-group__count">({group.items.length})</span>}
        </h2>
        <Link to={meta.listTo} className="db-widget__link">
          Mở danh sách của chức năng <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
      {group.error ? (
        <ErrorState error={group.error} onRetry={onRetry} />
      ) : (
        <div className="card__body">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Mã</th>
                  <th scope="col">Nội dung</th>
                  <th scope="col">Người gửi</th>
                  {showCampus && <th scope="col">Điểm trường</th>}
                  <th scope="col">Chờ từ</th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col" className="right">
                    <span className="sr-only">Thao tác</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {group.items.map((i) => (
                  <tr key={i.key}>
                    <td className="db-code nowrap">{i.code}</td>
                    <td>{i.title}</td>
                    <td>{i.by}</td>
                    {showCampus && <td>{(i.campusId && campusName(i.campusId)) || 'Toàn trường'}</td>}
                    <td className="nowrap">{formatWhen(i.at)}</td>
                    <td>
                      <span className="chip chip--purple">{i.statusLabel}</span>
                    </td>
                    <td className="right">
                      <Link to={i.to} className="btn btn--primary btn--sm nowrap" aria-label={`Xem và duyệt ${i.code}`}>
                        Xem và duyệt
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
