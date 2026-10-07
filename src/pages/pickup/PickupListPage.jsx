import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarDays, ClipboardList, Search, ShieldCheck, School, UserCheck } from 'lucide-react';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState, ErrorState, LoadingState, SkeletonRows } from '@/components/ui/States';
import { PickupStatusBadge } from '@/components/pickup/PickupBadges';
import { usePickupBoard, usePickupClasses } from '@/hooks/pickup/usePickups';
import { PICKUP_STATUS, VERIFICATION_LABELS } from '@/models/pickup/pickupConstants';
import { pickupCrumbs } from '@/utils/pickup/breadcrumbs';
import { formatDate, normalizeText, todayInput } from '@/utils/format';
import '@/styles/modules/pickup.css';

const TABS = [
  { key: PICKUP_STATUS.WAITING, label: 'Chờ đón' },
  { key: PICKUP_STATUS.PICKED_UP, label: 'Đã đón' },
  { key: 'ALL', label: 'Tất cả' },
];

const timeOf = (iso) => (iso ? new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—');

/** #99 Pickup List: children of the class waiting to be picked up (UC 3.15 entry point). */
export default function PickupListPage() {
  const [params, setParams] = useSearchParams();
  const today = todayInput();
  const date = params.get('date') || today;
  const { classes, loading: loadingClasses, error: classError, reload: reloadClasses } = usePickupClasses();
  const classId = params.get('classId') || classes[0]?.id || '';
  const { board, loading, error, reload } = usePickupBoard(classId, date);
  const [tab, setTab] = useState(PICKUP_STATUS.WAITING);
  const [keyword, setKeyword] = useState('');

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    if (!next.get('classId') && classId) next.set('classId', classId);
    setParams(next, { replace: true });
  };

  const rows = board?.rows || [];
  const count = (k) => (k === 'ALL' ? rows.length : rows.filter((r) => r.status === k).length);
  const visible = rows
    .filter((r) => tab === 'ALL' || r.status === tab)
    .filter((r) => !keyword || normalizeText(r.child.fullName).includes(normalizeText(keyword)));
  const isToday = date === today;

  if (loadingClasses) return <LoadingState />;

  return (
    <div className="page">
      <Breadcrumb items={pickupCrumbs()} />
      <h1 className="page__title">Đón trẻ</h1>
      {classError ? (
        <ErrorState error={classError} onRetry={reloadClasses} />
      ) : classes.length === 0 ? (
        <div className="card">
          <EmptyState icon={ClipboardList} title="Bạn chưa được phân công lớp" description="Chỉ giáo viên của lớp trả trẻ cho người đón." />
        </div>
      ) : (
        <>
          <div className="alert alert--info mb-16">
            <ShieldCheck size={18} />
            <div>
              So sánh người đón với <b>ảnh phụ huynh đã đăng ký</b>. Nếu không khớp, gọi điện cho phụ huynh và chỉ trả trẻ khi phụ huynh
              đồng ý. Kết quả được gửi thông báo cho phụ huynh.
            </div>
          </div>
          <div className="card">
            <div className="filter-bar dt-bar">
              <div className="dt-field">
                <label className="field__label" htmlFor="dt-class">
                  <School size={15} /> Lớp
                </label>
                <select id="dt-class" className="select" value={classId} onChange={(e) => setParam('classId', e.target.value)}>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="dt-field">
                <label className="field__label" htmlFor="dt-date">
                  <CalendarDays size={15} /> Ngày
                </label>
                <input
                  id="dt-date"
                  type="date"
                  className="input"
                  value={date}
                  max={today}
                  onChange={(e) => e.target.value && setParam('date', e.target.value)}
                />
              </div>
              <label className="search-box dt-search">
                <Search size={17} className="muted" />
                <input placeholder="Tìm tên trẻ..." value={keyword} onChange={(e) => setKeyword(e.target.value)} aria-label="Tìm tên trẻ" />
              </label>
            </div>
            <div className="tabs dt-tabs" role="tablist">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={tab === t.key}
                  className={`tab ${tab === t.key ? 'tab--active' : ''}`}
                  onClick={() => setTab(t.key)}
                >
                  {t.label} <span className="tab__count">{count(t.key)}</span>
                </button>
              ))}
            </div>
            {error ? (
              <ErrorState error={error} onRetry={reload} />
            ) : (
              <div className="table-wrap dt-table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Trẻ</th>
                      <th>Trạng thái</th>
                      <th>Người đón</th>
                      <th>Giờ trả</th>
                      <th>Xác minh</th>
                      <th className="center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading || !board ? (
                      <SkeletonRows rows={5} cols={6} />
                    ) : visible.length === 0 ? (
                      <tr>
                        <td colSpan={6}>
                          <EmptyState
                            icon={UserCheck}
                            title={tab === PICKUP_STATUS.WAITING && rows.length > 0 ? 'Đã trả hết trẻ của lớp' : 'Không có trẻ phù hợp'}
                            description={`Ngày ${formatDate(date)}`}
                          />
                        </td>
                      </tr>
                    ) : (
                      visible.map((r) => {
                        const failed = r.attempts.filter((a) => a.outcome !== 'HANDED_OVER').length;
                        return (
                          <tr key={r.child.id}>
                            <td>
                              <div className="fw-600">{r.child.fullName}</div>
                              <div className="text-xs muted">
                                {r.child.code}
                                {!r.attendanceStatus && r.status === PICKUP_STATUS.WAITING ? ' · chưa điểm danh' : ''}
                              </div>
                            </td>
                            <td>
                              <PickupStatusBadge status={r.status} />
                              {failed > 0 && r.status === PICKUP_STATUS.WAITING && (
                                <div className="text-xs text-danger mt-8">{failed} lần không trả trẻ</div>
                              )}
                            </td>
                            <td>
                              {r.pickup ? (
                                <>
                                  <div>{r.pickup.pickupPersonName}</div>
                                  <div className="text-xs muted">{r.pickup.pickupPersonRelation}</div>
                                </>
                              ) : (
                                <span className="muted">—</span>
                              )}
                            </td>
                            <td className="nowrap">{timeOf(r.pickup?.handedOverAt)}</td>
                            <td className="text-sm">
                              {r.pickup ? VERIFICATION_LABELS[r.pickup.verification] : <span className="muted">—</span>}
                            </td>
                            <td className="center">
                              {isToday && r.status === PICKUP_STATUS.WAITING && (
                                <Link className="btn btn--sm btn--primary" to={`/pickup/${r.child.id}/verify`}>
                                  <UserCheck size={15} /> Trả trẻ
                                </Link>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="page-actions">
            <span />
            <Link className="btn" to="/pickup/result">
              <ClipboardList size={16} /> Kết quả trả trẻ hôm nay
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
