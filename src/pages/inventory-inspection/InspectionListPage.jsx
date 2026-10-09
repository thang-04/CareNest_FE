import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Eye, Printer, ClipboardCheck, RotateCcw, ClipboardList } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useInspections } from '@/hooks/inventory-inspection/useInspections';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { RoundStatusBadge, SheetStatusBadge, ProgressBar } from '@/components/inventory-inspection/InspectionBadges';
import { formatDate } from '@/utils/format';
import { locationLabel } from '@/models/Location';
import { ROUND_STATUS, ROUND_STATUS_LABELS, ROUND_TYPE_LABELS, SHEET_STATUS } from '@/models/inventory-inspection/inspectionConstants';
import { sheetSummary } from '@/models/inventory-inspection/InspectionRound';
import { canManageRounds, canCountSheet, isVicePrincipal } from '@/utils/inventory-inspection/inspectionPermissions';
import { inspectionCrumbs } from '@/utils/inventory-inspection/breadcrumbs';
import { describeScope } from '@/utils/inventory-inspection/inspectionScope';
import '@/styles/modules/inventory-inspection.css';
import { StatCardIcon } from '@/components/ui/StatCardIcon';

const roundProgress = (r) => {
  const active = r.sheets.filter((s) => s.status !== SHEET_STATUS.CANCELLED);
  return {
    total: active.length,
    submitted: active.filter((s) => [SHEET_STATUS.SUBMITTED, SHEET_STATUS.APPROVED].includes(s.status)).length,
    approved: active.filter((s) => s.status === SHEET_STATUS.APPROVED).length,
  };
};

/* ---------------- Vice Principal ---------------- */
function RoundList({ user, md }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState('ALL');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const { rounds, loading, error, reload } = useInspections({ status, keyword });
  const pageRows = paginate(rounds, page);
  const { rounds: all } = useInspections({});
  const count = (s) => all.filter((r) => r.status === s).length;
  const stats = [
    { key: 'ALL', label: 'Tổng số đợt', value: all.length, tone: 'blue' },
    { key: ROUND_STATUS.IN_PROGRESS, label: 'Đang kiểm kê', value: count(ROUND_STATUS.IN_PROGRESS), tone: 'orange' },
    { key: ROUND_STATUS.PENDING_APPROVAL, label: 'Chờ phê duyệt', value: count(ROUND_STATUS.PENDING_APPROVAL), tone: 'purple' },
    { key: ROUND_STATUS.COMPLETED, label: 'Hoàn thành', value: count(ROUND_STATUS.COMPLETED), tone: 'green' },
  ];
  const waitingReview = all.flatMap((r) =>
    r.status === ROUND_STATUS.IN_PROGRESS ? r.sheets.filter((s) => s.status === SHEET_STATUS.SUBMITTED) : [],
  ).length;

  return (
    <>
      <div className="page__head">
        <h1 className="page__title">Kiểm kê tài sản</h1>
        {canManageRounds(user) && (
          <Link to="/facility/inspections/new" className="btn btn--primary btn--lg" style={{ marginTop: 6 }}>
            <Plus size={18} /> Tạo đợt kiểm kê
          </Link>
        )}
      </div>
      {waitingReview > 0 && (
        <div className="alert alert--purple mb-16">
          <ClipboardCheck size={18} />
          <div>
            Có <b>{waitingReview}</b> phiếu kiểm kê đã nộp đang chờ bạn duyệt.
          </div>
        </div>
      )}
      <div className="stat-grid">
        {stats.map((s) => (
          <button
            key={s.key}
            className={`stat-card stat-card--${s.tone} ${status === s.key ? 'stat-card--active' : ''}`}
            onClick={() => {
              setStatus(s.key);
              setPage(1);
            }}
          >
            <div className="stat-card__value">{s.value}</div>
            <div className="stat-card__label">{s.label}</div>
            <StatCardIcon tone={s.tone} />
          </button>
        ))}
      </div>
      <div className="card">
        <div className="filter-bar">
          <label className="search-box" style={{ flex: 1 }}>
            <Search size={17} className="muted" />
            <input
              placeholder="Tìm mã hoặc tên đợt kiểm kê..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              aria-label="Tìm kiếm"
            />
          </label>
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Trạng thái">
            <option value="ALL">Tất cả trạng thái</option>
            {Object.entries(ROUND_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <button
            className="btn"
            onClick={() => {
              setStatus('ALL');
              setKeyword('');
            }}
            disabled={status === 'ALL' && !keyword}
          >
            <RotateCcw size={15} /> Đặt lại
          </button>
        </div>
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <div className="table-wrap" style={{ border: 'none', borderTop: '1px solid var(--border)', borderRadius: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Mã đợt</th>
                  <th>Tên đợt kiểm kê</th>
                  <th>Loại</th>
                  <th>Phạm vi</th>
                  <th>Thời gian</th>
                  <th style={{ minWidth: 170 }}>Tiến độ (phiếu đã duyệt)</th>
                  <th>Trạng thái</th>
                  <th className="center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows rows={4} cols={8} />
                ) : rounds.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <EmptyState
                        icon={ClipboardList}
                        title="Chưa có đợt kiểm kê"
                        description="Tạo đợt kiểm kê để giao phiếu kiểm đếm cho từng lớp/phòng."
                        action={
                          <Link className="btn btn--primary" to="/facility/inspections/new">
                            <Plus size={16} /> Tạo đợt kiểm kê
                          </Link>
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  pageRows.map((r) => {
                    const p = roundProgress(r);
                    return (
                      <tr
                        key={r.id}
                        className="row-click"
                        onClick={() =>
                          navigate(r.status === ROUND_STATUS.DRAFT ? `/facility/inspections/${r.id}/edit` : `/facility/inspections/${r.id}`)
                        }
                      >
                        <td className="fw-600 text-primary">{r.code}</td>
                        <td style={{ maxWidth: 280, whiteSpace: 'normal' }}>{r.name}</td>
                        <td className="text-sm">{ROUND_TYPE_LABELS[r.type]?.split(' (')[0]}</td>
                        <td className="text-sm" style={{ maxWidth: 220, whiteSpace: 'normal' }}>
                          {(() => {
                            const d = describeScope(r, md);
                            return (
                              <>
                                <div>{d.where}</div>
                                <div className="muted">{d.what}</div>
                              </>
                            );
                          })()}
                        </td>
                        <td className="nowrap">
                          {formatDate(r.startDate)} – {formatDate(r.deadline)}
                        </td>
                        <td>
                          {r.status === ROUND_STATUS.DRAFT ? (
                            <span className="muted">{r.scope.length} lớp/phòng</span>
                          ) : (
                            <ProgressBar value={p.approved} total={p.total} tone={p.approved === p.total ? 'green' : 'primary'} />
                          )}
                        </td>
                        <td>
                          <RoundStatusBadge status={r.status} />
                        </td>
                        <td className="center nowrap" onClick={(e) => e.stopPropagation()}>
                          <Link
                            className="icon-btn"
                            to={r.status === ROUND_STATUS.DRAFT ? `/facility/inspections/${r.id}/edit` : `/facility/inspections/${r.id}`}
                            title="Xem"
                            aria-label="Xem"
                          >
                            <Eye size={17} />
                          </Link>
                          {r.status !== ROUND_STATUS.DRAFT && (
                            <Link
                              className="icon-btn"
                              to={`/facility/inspections/${r.id}/print`}
                              title="In biên bản"
                              aria-label="In biên bản"
                            >
                              <Printer size={17} />
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
        {!loading && rounds.length > 0 && <Pagination page={page} total={rounds.length} onChange={setPage} unit="đợt" />}
      </div>
    </>
  );
}

/* ---------------- Teacher / staff ---------------- */
const STAFF_TABS = [
  { key: 'TODO', label: 'Cần kiểm kê', match: (s, r) => canCountSheet(r, s, { id: s.inspectorUserId }) },
  { key: SHEET_STATUS.RECOUNT_REQUESTED, label: 'Yêu cầu kiểm lại', match: (s) => s.status === SHEET_STATUS.RECOUNT_REQUESTED },
  { key: SHEET_STATUS.SUBMITTED, label: 'Đã nộp', match: (s) => s.status === SHEET_STATUS.SUBMITTED },
  { key: SHEET_STATUS.APPROVED, label: 'Đã duyệt', match: (s) => s.status === SHEET_STATUS.APPROVED },
  { key: 'ALL', label: 'Tất cả', match: () => true },
];

function MySheetList({ user, md }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState('TODO');
  const { rounds, loading, error, reload } = useInspections({});
  const rows = useMemo(
    () => rounds.flatMap((r) => r.sheets.filter((s) => s.inspectorUserId === user.id).map((s) => ({ round: r, sheet: s }))),
    [rounds, user.id],
  );
  const current = STAFF_TABS.find((t) => t.key === tab);
  const visible = rows.filter(({ round, sheet }) => current.match(sheet, round));
  const [page, setPage] = useState(1);
  const pageRows = paginate(visible, page);

  return (
    <>
      <h1 className="page__title">Phiếu kiểm kê của tôi</h1>
      <div className="alert alert--info mb-16">
        <ClipboardCheck size={18} />
        <div>
          Kiểm đếm thực tế từng tài sản, nhập số lượng và tình trạng. Lệch sổ sách phải ghi chú; tài sản <b>Hỏng</b> phải có mô tả và ảnh.
          Nộp phiếu kèm chữ ký để Phó hiệu trưởng duyệt.
        </div>
      </div>
      <div className="card">
        <div className="tabs" role="tablist">
          {STAFF_TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              className={`tab ${tab === t.key ? 'tab--active' : ''}`}
              onClick={() => {
                setTab(t.key);
                setPage(1);
              }}
            >
              {t.label} <span className="tab__count">{rows.filter(({ round, sheet }) => t.match(sheet, round)).length}</span>
            </button>
          ))}
        </div>
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Mã phiếu</th>
                  <th>Đợt kiểm kê</th>
                  <th>Lớp/phòng</th>
                  <th>Hạn hoàn thành</th>
                  <th style={{ minWidth: 160 }}>Đã kiểm</th>
                  <th>Trạng thái</th>
                  <th className="center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows rows={3} cols={7} />
                ) : visible.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState
                        icon={ClipboardCheck}
                        title="Không có phiếu kiểm kê"
                        description="Phiếu được Phó hiệu trưởng giao cho bạn sẽ hiển thị tại đây."
                      />
                    </td>
                  </tr>
                ) : (
                  pageRows.map(({ round, sheet }) => {
                    const sum = sheetSummary(sheet);
                    const todo = canCountSheet(round, sheet, user);
                    const link = `/facility/inspections/${round.id}/sheets/${sheet.id}`;
                    return (
                      <tr key={sheet.id} className="row-click" onClick={() => navigate(link)}>
                        <td className="fw-600 text-primary">{sheet.code}</td>
                        <td style={{ maxWidth: 260, whiteSpace: 'normal' }}>{round.name}</td>
                        <td>{locationLabel(md.locationById(sheet.locationId))}</td>
                        <td>{formatDate(round.deadline)}</td>
                        <td>
                          <ProgressBar value={sum.counted} total={sum.total} tone={sum.counted === sum.total ? 'green' : 'primary'} />
                        </td>
                        <td>
                          <SheetStatusBadge status={sheet.status} />
                        </td>
                        <td className="center" onClick={(e) => e.stopPropagation()}>
                          {todo ? (
                            <button className="btn btn--sm btn--primary" onClick={() => navigate(link)}>
                              <ClipboardCheck size={15} />{' '}
                              {sheet.status === SHEET_STATUS.RECOUNT_REQUESTED
                                ? 'Kiểm lại'
                                : sheet.status === SHEET_STATUS.IN_PROGRESS
                                  ? 'Tiếp tục'
                                  : 'Kiểm kê'}
                            </button>
                          ) : (
                            <button className="btn btn--sm" onClick={() => navigate(link)}>
                              <Eye size={15} /> Xem
                            </button>
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
        {!loading && visible.length > 0 && <Pagination page={page} total={visible.length} onChange={setPage} unit="phiếu" />}
      </div>
    </>
  );
}

export default function InspectionListPage() {
  const { user } = useAuth();
  const md = useMasterData();
  return (
    <div className="page">
      <Breadcrumb items={inspectionCrumbs()} />
      {isVicePrincipal(user) ? <RoundList user={user} md={md} /> : <MySheetList user={user} md={md} />}
    </div>
  );
}
