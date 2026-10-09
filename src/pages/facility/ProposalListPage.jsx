import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, RotateCcw, Eye, ClipboardCheck, FileText, FilePlus2, Pencil } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useProposals } from '@/hooks/facility/useFacility';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { ProposalStatusBadge } from '@/components/facility/FacilityBadges';
import { ManagerLinks } from '@/components/facility/ManagerLinks';
import { PROPOSAL_STATUS, PROPOSAL_STATUS_LABELS, PROPOSAL_ACTION_LABELS } from '@/models/facility/facilityConstants';
import { isPrincipal, canDecideProposal, canEditProposal, canCreateProposal } from '@/utils/facility/facilityPermissions';
import { proposalCrumbs } from '@/utils/facility/breadcrumbs';
import { formatMoney, proposalTotal } from '@/utils/facility/facilityFormat';
import { formatDate } from '@/utils/format';
import '@/styles/modules/facility.css';
import { StatCardIcon } from '@/components/ui/StatCardIcon';

const EMPTY = { status: 'ALL', keyword: '', campusId: '' };

/** Purchase / repair proposals: the VP's own campus, or sent proposals of both campuses for the Principal (GBR-FAC-10). */
export default function ProposalListPage() {
  const { user } = useAuth();
  const md = useMasterData();
  const navigate = useNavigate();
  const principal = isPrincipal(user);
  const [filters, setFilters] = useState(principal ? { ...EMPTY, status: PROPOSAL_STATUS.SUBMITTED } : EMPTY);
  const [page, setPage] = useState(1);
  const { proposals, loading, error, reload } = useProposals(filters);
  const { proposals: all } = useProposals({});

  const set = (patch) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };
  const filtered = filters.status !== 'ALL' || filters.keyword || filters.campusId;
  const count = (s) => all.filter((p) => p.status === s).length;
  const waiting = all.filter((p) => canDecideProposal(p, user)).length;
  const stats = [
    { key: 'ALL', label: 'Tổng đề xuất', value: all.length, tone: 'blue' },
    ...(principal ? [] : [{ key: PROPOSAL_STATUS.DRAFT, label: 'Bản nháp', value: count(PROPOSAL_STATUS.DRAFT), tone: 'orange' }]),
    { key: PROPOSAL_STATUS.SUBMITTED, label: 'Chờ phê duyệt', value: count(PROPOSAL_STATUS.SUBMITTED), tone: 'purple' },
    { key: PROPOSAL_STATUS.APPROVED, label: 'Đã phê duyệt', value: count(PROPOSAL_STATUS.APPROVED), tone: 'green' },
    { key: PROPOSAL_STATUS.REJECTED, label: 'Bị từ chối', value: count(PROPOSAL_STATUS.REJECTED), tone: 'red' },
  ];
  const statusOptions = Object.entries(PROPOSAL_STATUS_LABELS).filter(([k]) => !principal || k !== PROPOSAL_STATUS.DRAFT);
  const pageRows = paginate(proposals, page);
  const linkOf = (p) => (canEditProposal(p, user) ? `/facility/proposals/${p.id}/edit` : `/facility/proposals/${p.id}`);

  return (
    <div className="page">
      <Breadcrumb items={proposalCrumbs()} />
      <div className="page__head">
        <h1 className="page__title">Đề xuất mua sắm, sửa chữa</h1>
        <ManagerLinks user={user} current="proposals" />
      </div>
      {waiting > 0 && (
        <div className="alert alert--purple mb-16">
          <ClipboardCheck size={18} />
          <div>
            Có <b>{waiting}</b> đề xuất đang chờ bạn phê duyệt.
          </div>
        </div>
      )}
      <div className="stat-grid">
        {stats.map((s) => (
          <button
            key={s.key}
            className={`stat-card stat-card--${s.tone} ${filters.status === s.key ? 'stat-card--active' : ''}`}
            onClick={() => set({ status: s.key })}
            aria-pressed={filters.status === s.key}
          >
            <div className="stat-card__value">{s.value}</div>
            <div className="stat-card__label">{s.label}</div>
            <StatCardIcon tone={s.tone} />
          </button>
        ))}
      </div>
      <div className="card">
        <div className="filter-bar">
          <label className="search-box" style={{ flex: 1, minWidth: 200 }}>
            <Search size={17} className="muted" />
            <input
              placeholder="Tìm mã hoặc tên đề xuất..."
              value={filters.keyword}
              onChange={(e) => set({ keyword: e.target.value })}
              aria-label="Tìm kiếm"
            />
          </label>
          {principal && (
            <select className="select" value={filters.campusId} onChange={(e) => set({ campusId: e.target.value })} aria-label="Campus">
              <option value="">Tất cả campus</option>
              {md.campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.shortName}
                </option>
              ))}
            </select>
          )}
          <select className="select" value={filters.status} onChange={(e) => set({ status: e.target.value })} aria-label="Trạng thái">
            <option value="ALL">Tất cả trạng thái</option>
            {statusOptions.map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <button className="btn" onClick={() => set(EMPTY)} disabled={!filtered}>
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
                  <th>Mã</th>
                  <th>Tên đề xuất</th>
                  <th>Hình thức</th>
                  {principal && <th>Campus</th>}
                  <th className="right">Số tài sản</th>
                  <th className="right">Dự toán</th>
                  <th>Người lập</th>
                  <th>Ngày gửi</th>
                  <th>Trạng thái</th>
                  <th className="center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows rows={4} cols={principal ? 10 : 9} />
                ) : proposals.length === 0 ? (
                  <tr>
                    <td colSpan={principal ? 10 : 9}>
                      {filtered ? (
                        <EmptyState
                          icon={Search}
                          title="Không có đề xuất phù hợp"
                          action={
                            <button className="btn" onClick={() => set(EMPTY)}>
                              <RotateCcw size={15} /> Đặt lại bộ lọc
                            </button>
                          }
                        />
                      ) : (
                        <EmptyState
                          icon={FileText}
                          title="Chưa có đề xuất"
                          description={
                            principal
                              ? 'Đề xuất do Phó hiệu trưởng gửi sẽ hiển thị tại đây.'
                              : 'Tổng hợp các báo cáo sự cố và đề nghị đã duyệt thành đề xuất gửi Hiệu trưởng.'
                          }
                          action={
                            canCreateProposal(user) && (
                              <Link className="btn btn--primary" to="/facility/proposals/new">
                                <FilePlus2 size={16} /> Lập đề xuất
                              </Link>
                            )
                          }
                        />
                      )}
                    </td>
                  </tr>
                ) : (
                  pageRows.map((p) => {
                    const link = linkOf(p);
                    const decide = canDecideProposal(p, user);
                    const edit = canEditProposal(p, user);
                    return (
                      <tr key={p.id} className="row-click" onClick={() => navigate(link)}>
                        <td className="fw-600 text-primary nowrap">{p.code}</td>
                        <td className="bh-cell-wrap">{p.title}</td>
                        <td className="text-sm">{PROPOSAL_ACTION_LABELS[p.action]}</td>
                        {principal && <td>{md.campusById(p.campusId)?.shortName}</td>}
                        <td className="right">{p.lines.length}</td>
                        <td className="right nowrap">{formatMoney(proposalTotal(p.lines))}</td>
                        <td>{md.userById(p.createdBy)?.fullName || '—'}</td>
                        <td className="nowrap">{p.submittedAt ? formatDate(p.submittedAt) : <span className="muted">Chưa gửi</span>}</td>
                        <td>
                          <ProposalStatusBadge status={p.status} />
                        </td>
                        <td className="center nowrap" onClick={(e) => e.stopPropagation()}>
                          {decide ? (
                            <button className="btn btn--sm btn--primary" onClick={() => navigate(link)}>
                              <ClipboardCheck size={15} /> Phê duyệt
                            </button>
                          ) : edit ? (
                            <button className="btn btn--sm" onClick={() => navigate(link)}>
                              <Pencil size={15} /> Tiếp tục soạn
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
        {!loading && proposals.length > 0 && <Pagination page={page} total={proposals.length} onChange={setPage} unit="đề xuất" />}
      </div>
    </div>
  );
}
