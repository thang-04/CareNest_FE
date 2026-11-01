import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Printer, ClipboardCheck, RotateCcw, ClipboardList } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useInspections } from '@/hooks/inventory-inspection/useInspections';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { SearchSubmit } from '@/components/ui/SearchSubmit';
import { FilterChips } from '@/components/ui/FilterChips';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { RowActions } from '@/components/ui/RowActions';
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
  const filter = (next) => {
    if (next.status !== undefined) setStatus(next.status);
    if (next.keyword !== undefined) setKeyword(next.keyword);
    setPage(1);
  };
  const filtered = status !== 'ALL' || Boolean(keyword);
  const chips = [
    keyword && { key: 'keyword', label: `Từ khóa: ${keyword}`, onRemove: () => filter({ keyword: '' }) },
    status !== 'ALL' && {
      key: 'status',
      label: `Trạng thái: ${stats.find((s) => s.key === status)?.label || ROUND_STATUS_LABELS[status] || status}`,
      onRemove: () => filter({ status: 'ALL' }),
    },
  ].filter(Boolean);

  return (
    <>
      <div className="page__head">
        <h1 className="page__title">Kiểm kê tài sản</h1>
        {canManageRounds(user) && (
          <Link to="/facility/inspections/new" className="btn btn--primary btn--lg kk-head-action">
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
            type="button"
            aria-pressed={status === s.key}
            className={`stat-card stat-card--${s.tone} ${status === s.key ? 'stat-card--active' : ''}`}
            onClick={() => filter({ status: s.key })}
          >
            <div className="stat-card__value">{s.value}</div>
            <div className="stat-card__label">{s.label}</div>
            <StatCardIcon tone={s.tone} />
          </button>
        ))}
      </div>
      <div className="card">
        <div className="filter-bar">
          <SearchSubmit
            className="flex-1"
            value={keyword}
            placeholder="Tìm mã hoặc tên đợt kiểm kê..."
            label="Tìm kiếm đợt kiểm kê"
            onSearch={(text) => filter({ keyword: text })}
          />
          <button className="btn" onClick={() => filter({ status: 'ALL', keyword: '' })} disabled={!filtered}>
            <RotateCcw size={15} /> Đặt lại bộ lọc
          </button>
        </div>
        <FilterChips count={loading ? null : rounds.length} unit="đợt" chips={chips} />
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <div className="table-wrap">
            <table className="table table--grid">
              <thead>
                <tr>
                  <th>Mã đợt</th>
                  <th>Tên đợt kiểm kê</th>
                  <th>Loại</th>
                  <th>Phạm vi</th>
                  <th>Thời gian</th>
                  <th className="kk-col-progress">Tiến độ (phiếu đã duyệt)</th>
                  <th className="center">Trạng thái</th>
                  <th className="cell--actions">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows rows={4} cols={8} />
                ) : rounds.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      {filtered ? (
                        <EmptyState
                          icon={Search}
                          title="Không có đợt kiểm kê phù hợp"
                          action={
                            <button className="btn" onClick={() => filter({ status: 'ALL', keyword: '' })}>
                              <RotateCcw size={15} /> Đặt lại bộ lọc
                            </button>
                          }
                        />
                      ) : (
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
                      )}
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
                        <td className="kk-wrap kk-wrap--280">{r.name}</td>
                        <td className="text-sm">{ROUND_TYPE_LABELS[r.type]?.split(' (')[0]}</td>
                        <td className="text-sm kk-wrap kk-wrap--220">
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
                        <td className="center">
                          <RoundStatusBadge status={r.status} />
                        </td>
                        <td className="cell--actions" onClick={(e) => e.stopPropagation()}>
                          {r.status === ROUND_STATUS.DRAFT ? (
                            <RowActions edit={{ to: `/facility/inspections/${r.id}/edit` }} name={r.code} />
                          ) : (
                            <RowActions
                              view={{ to: `/facility/inspections/${r.id}` }}
                              menu={[{ label: 'In biên bản', icon: Printer, to: `/facility/inspections/${r.id}/print` }]}
                              name={r.code}
                            />
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
          <div className="table-wrap">
            <table className="table table--grid">
              <thead>
                <tr>
                  <th>Mã phiếu</th>
                  <th>Đợt kiểm kê</th>
                  <th>Lớp/phòng</th>
                  <th>Hạn hoàn thành</th>
                  <th className="kk-col-counted">Đã kiểm</th>
                  <th className="center">Trạng thái</th>
                  <th className="cell--actions">Thao tác</th>
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
                        <td className="kk-wrap kk-wrap--260">{round.name}</td>
                        <td>{locationLabel(md.locationById(sheet.locationId))}</td>
                        <td>{formatDate(round.deadline)}</td>
                        <td>
                          <ProgressBar value={sum.counted} total={sum.total} tone={sum.counted === sum.total ? 'green' : 'primary'} />
                        </td>
                        <td className="center">
                          <SheetStatusBadge status={sheet.status} />
                        </td>
                        <td className="cell--actions" onClick={(e) => e.stopPropagation()}>
                          {todo ? (
                            <button className="btn btn--primary btn--sm" onClick={() => navigate(link)}>
                              <ClipboardCheck size={15} />{' '}
                              {sheet.status === SHEET_STATUS.RECOUNT_REQUESTED
                                ? 'Kiểm lại'
                                : sheet.status === SHEET_STATUS.IN_PROGRESS
                                  ? 'Tiếp tục'
                                  : 'Kiểm kê'}
                            </button>
                          ) : (
                            <RowActions view={{ to: link }} name={sheet.code} />
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
