import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Calculator, PackageMinus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRequiredQuantity } from '@/hooks/kitchen/useKitchen';
import { Breadcrumb, EmptyState, ErrorState, LoadingState } from '@/components';
import { IssueStatusBadge, MealCountStatusBadge } from '@/components/kitchen/KitchenBadges';
import { KbCampusFilter, KbDateFilter, KbSessionFilter, fmtQty } from '@/components/kitchen/KitchenFilters';
import { canSubmitMissingFood } from '@/utils/kitchen/kitchenPermissions';
import { kitchenCrumbs, KITCHEN_PAGES } from '@/utils/kitchen/breadcrumbs';
import { formatDateTime, todayInput } from '@/utils/format';
import { MEAL_SESSION_LABELS } from '@/models/kitchen/kitchenConstants';
import '@/styles/modules/kitchen.css';

/** Screen #95 – Required Food Quantity (UC 6.18): quantities from the published menu and the confirmed meal count + issue slip. */
export default function RequiredFoodQuantityPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const date = params.get('date') || todayInput();
  const [session, setSession] = useState('ALL');
  const campusId = user?.campusId;
  const { data, loading, error, reload } = useRequiredQuantity(campusId, date, session);
  const canReport = canSubmitMissingFood(user) && date >= todayInput();

  const sessions = data?.sessions || [];
  const withMenu = sessions.filter((s) => s.hasMenu);
  const unconfirmed = withMenu.filter((s) => s.mealCountStatus !== 'CONFIRMED');
  const flagged = withMenu.flatMap((s) => s.classes.map((c) => ({ ...c, session: s.session })));
  const warnings = withMenu.flatMap((s) => s.warnings);
  const reportLink = (foodId) =>
    `/kitchen/missing-food?new=1&date=${date}${session !== 'ALL' ? `&session=${session}` : ''}${foodId ? `&foodId=${foodId}` : ''}`;

  return (
    <div className="page">
      <Breadcrumb items={kitchenCrumbs(KITCHEN_PAGES.requiredQuantity)} />
      <div className="page__head">
        <h1 className="page__title">Định lượng thực phẩm cần dùng</h1>
        {canReport && (
          <Link className="btn btn--lg" to={reportLink()}>
            <PackageMinus size={18} /> Báo thiếu thực phẩm
          </Link>
        )}
      </div>
      <div className="kb-toolbar">
        <KbDateFilter value={date} onChange={(d) => setParams({ date: d }, { replace: true })} />
        <KbSessionFilter value={session} onChange={setSession} withAll />
        <div className="kb-toolbar__end">
          <KbCampusFilter campusId={campusId} canPick={false} />
        </div>
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : withMenu.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Calculator}
            title="Không có thực đơn đã công bố"
            description="Định lượng chỉ tính từ thực đơn đã công bố. Chọn ngày hoặc bữa khác."
          />
        </div>
      ) : (
        <>
          {unconfirmed.length > 0 && (
            <div className="alert alert--warning mb-16">
              <AlertTriangle size={18} />
              <div>
                {unconfirmed.map((s) => MEAL_SESSION_LABELS[s.session]).join(', ')}: số suất ăn chưa được xác nhận nên chưa tính định lượng.
              </div>
            </div>
          )}
          {warnings.length > 0 && (
            <div className="alert alert--warning mb-16">
              <AlertTriangle size={18} />
              <div>{warnings.join(' ')}</div>
            </div>
          )}

          <div className="card mb-16">
            <div className="card__header row row--between">
              <div className="card__title">Thực phẩm cần dùng</div>
              <div className="kb-totals">
                {withMenu.map((s) => (
                  <span key={s.session} className="row" style={{ gap: 6 }}>
                    <span className="text-sm">{MEAL_SESSION_LABELS[s.session]}:</span>
                    {s.mealCountStatus === 'CONFIRMED' ? (
                      <span className="chip chip--blue">
                        {s.totals.normal} thường · {s.totals.substitute} thay thế
                      </span>
                    ) : (
                      <MealCountStatusBadge status={s.mealCountStatus} />
                    )}
                  </span>
                ))}
              </div>
            </div>
            <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Thực phẩm</th>
                    <th>Đơn vị</th>
                    <th className="right">Cho suất thường</th>
                    <th className="right">Cho suất thay thế</th>
                    <th className="right">Tổng cần (làm tròn lên)</th>
                    {canReport && <th className="center">Thao tác</th>}
                  </tr>
                </thead>
                <tbody>
                  {data.foods.length === 0 ? (
                    <tr>
                      <td colSpan={canReport ? 6 : 5}>
                        <EmptyState
                          icon={Calculator}
                          title="Chưa có định lượng"
                          description="Định lượng hiển thị sau khi số suất ăn được xác nhận."
                        />
                      </td>
                    </tr>
                  ) : (
                    data.foods.map((f) => (
                      <tr key={f.foodId}>
                        <td className="fw-600">{f.name}</td>
                        <td>{f.unit}</td>
                        <td className="right">{fmtQty(f.normalQty)}</td>
                        <td className="right">{fmtQty(f.substituteQty)}</td>
                        <td className="right fw-600">{fmtQty(f.requiredQty)}</td>
                        {canReport && (
                          <td className="center">
                            <Link className="btn btn--sm" to={reportLink(f.foodId)}>
                              <PackageMinus size={15} /> Báo thiếu
                            </Link>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {flagged.length > 0 && (
            <div className="card mb-16">
              <div className="card__header">
                <div className="card__title">Suất thay thế theo lớp (dị ứng / chế độ ăn riêng)</div>
              </div>
              <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
                <table className="table table--compact">
                  <thead>
                    <tr>
                      <th>Bữa</th>
                      <th>Lớp</th>
                      <th className="right">Suất thay thế</th>
                      <th>Món được thay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flagged.map((c) => (
                      <tr key={`${c.session}-${c.classId}`}>
                        <td>{MEAL_SESSION_LABELS[c.session]}</td>
                        <td className="fw-600">{c.className}</td>
                        <td className="right">{c.substitute}</td>
                        <td className="kb-cell-wrap">{c.affectedDishes.length ? c.affectedDishes.join(', ') : 'Dùng thực đơn thay thế'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card__header row row--between">
              <div className="card__title">Phiếu xuất kho ngày</div>
              <IssueStatusBadge status={data.issueState} />
            </div>
            {data.issue ? (
              <>
                <div className="card__body text-sm">
                  Mã phiếu <span className="fw-600 text-primary">{data.issue.code}</span> · duyệt lúc{' '}
                  {formatDateTime(data.issue.approvedAt)}
                  {session !== 'ALL' && <span className="muted"> · phiếu tính cho cả ngày</span>}
                </div>
                <div className="table-wrap" style={{ border: 'none', borderTop: '1px solid var(--border)', borderRadius: 0 }}>
                  <table className="table table--compact">
                    <thead>
                      <tr>
                        <th>Thực phẩm</th>
                        <th className="right">Số lượng xuất</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.issue.items.map((it) => (
                        <tr key={it.foodId}>
                          <td>{it.name}</td>
                          <td className="right nowrap">
                            {fmtQty(it.requiredQty)} {it.unit}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {data.issueState === 'APPROVED' && canSubmitMissingFood(user) && (
                  <div className="card__body">
                    <Link className="btn btn--primary" to={`/kitchen/ingredient-receipts?date=${date}`}>
                      Xác nhận nhận thực phẩm
                    </Link>
                  </div>
                )}
              </>
            ) : (
              <div className="card__body muted">Phiếu xuất kho hiển thị sau khi Phó hiệu trưởng duyệt.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
