import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CookingPot, Lock, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useConfirmedMealCount, useKitchenCampus } from '@/hooks/kitchen/useKitchen';
import { Breadcrumb, EmptyState, ErrorState, LoadingState } from '@/components';
import { MealCountStatusBadge } from '@/components/kitchen/KitchenBadges';
import { KbCampusFilter, KbDateFilter, KbSessionFilter } from '@/components/kitchen/KitchenFilters';
import { canUpdatePreparation } from '@/utils/kitchen/kitchenPermissions';
import { kitchenCrumbs, KITCHEN_PAGES } from '@/utils/kitchen/breadcrumbs';
import { formatDateTime, todayInput } from '@/utils/format';
import { MEAL_SESSION_LABELS } from '@/models/kitchen/kitchenConstants';
import '@/styles/modules/kitchen.css';

/** Screen #94 – Confirmed Meal Count (UC 6.16): normal and substitute servings per class, read only. */
export default function ConfirmedMealCountPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const date = params.get('date') || todayInput();
  const [session, setSession] = useState('ALL');
  const [classId, setClassId] = useState('ALL');
  const { campusId, setCampusId, canPick } = useKitchenCampus();
  const { sessions, loading, error, reload } = useConfirmedMealCount(campusId, date);

  const classOptions = useMemo(() => {
    const map = new Map();
    sessions.forEach((s) => s.classes.forEach((c) => map.set(c.classId, c.className)));
    return [...map.entries()];
  }, [sessions]);
  const visible = sessions.filter((s) => (session === 'ALL' || s.session === session) && s.hasMenu);

  return (
    <div className="page">
      <Breadcrumb items={kitchenCrumbs(KITCHEN_PAGES.mealCount)} />
      <div className="page__head">
        <h1 className="page__title">Số suất ăn đã xác nhận</h1>
        {canUpdatePreparation(user) && (
          <Link className="btn btn--primary btn--lg" to={`/kitchen/preparation/update?date=${date}`}>
            <CookingPot size={18} /> Cập nhật chế biến
          </Link>
        )}
      </div>
      <div className="alert alert--info mb-16">
        <Lock size={18} />
        <div>Số suất ăn do Phó hiệu trưởng xác nhận từ dữ liệu chốt lúc 8:45. Bếp chỉ xem, không sửa được.</div>
      </div>
      <div className="kb-toolbar">
        <KbDateFilter value={date} onChange={(d) => setParams({ date: d }, { replace: true })} />
        <KbSessionFilter value={session} onChange={setSession} withAll />
        <label className="date-filter">
          Lớp
          <select className="select" value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="ALL">Tất cả lớp</option>
            {classOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <div className="kb-toolbar__end">
          <KbCampusFilter campusId={campusId} onChange={setCampusId} canPick={canPick} />
        </div>
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : visible.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Users}
            title="Không có số suất ăn"
            description="Ngày đã chọn không có bữa ăn theo thực đơn đã công bố. Chọn ngày khác."
          />
        </div>
      ) : (
        <div className="kb-sessions">
          {visible.map((s) => {
            const rows = classId === 'ALL' ? s.classes : s.classes.filter((c) => c.classId === classId);
            return (
              <div key={s.session} className="card">
                <div className="card__header row row--between">
                  <div className="card__title">{MEAL_SESSION_LABELS[s.session]}</div>
                  <MealCountStatusBadge status={s.status} />
                </div>
                {s.status !== 'CONFIRMED' ? (
                  <div className="card__body muted">
                    Số suất ăn chưa được Phó hiệu trưởng xác nhận. Bếp sẽ được thông báo khi có số chính thức.
                  </div>
                ) : (
                  <>
                    <div className="card__body kb-totals">
                      <span className="chip chip--blue chip--lg">{s.totals.normal} suất thường</span>
                      <span className="chip chip--orange chip--lg">{s.totals.substitute} suất thay thế</span>
                      <span className="muted text-sm">Xác nhận lúc {formatDateTime(s.confirmedAt)}</span>
                    </div>
                    <div className="table-wrap" style={{ border: 'none', borderTop: '1px solid var(--border)', borderRadius: 0 }}>
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Lớp</th>
                            <th className="right">Suất thường</th>
                            <th className="right">Suất thay thế</th>
                            <th>Món cần thay thế</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((c) => (
                            <tr key={c.classId}>
                              <td className="fw-600">{c.className}</td>
                              <td className="right">{c.normal}</td>
                              <td className="right">{c.substitute}</td>
                              <td className="kb-cell-wrap">
                                {c.affectedDishes.length ? (
                                  <span className="chip chip--red">
                                    <AlertTriangle size={13} /> {c.affectedDishes.join(', ')}
                                  </span>
                                ) : (
                                  <span className="muted">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {s.warnings.length > 0 && (
                      <div className="card__body">
                        <div className="alert alert--warning">
                          <AlertTriangle size={18} />
                          <div>{s.warnings.join(' ')}</div>
                        </div>
                      </div>
                    )}
                    {s.adjustments.length > 0 && (
                      <div className="card__body">
                        <div className="subsection-title mb-8">Điều chỉnh sau xác nhận</div>
                        <ul className="history-list">
                          {s.adjustments.map((a, i) => (
                            <li key={`${a.at}-${i}`}>
                              <div className="history-list__dot" />
                              <div>
                                <div>
                                  {s.classes.find((c) => c.classId === a.classId)?.className || 'Lớp'}: {a.normal > 0 ? '+' : ''}
                                  {a.normal ?? 0} suất thường, {a.substitute > 0 ? '+' : ''}
                                  {a.substitute ?? 0} suất thay thế
                                </div>
                                {a.note && <div className="text-2">“{a.note}”</div>}
                                <div className="muted text-xs">{formatDateTime(a.at)}</div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
