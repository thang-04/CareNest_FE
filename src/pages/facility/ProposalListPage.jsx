import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, RotateCcw, ClipboardCheck, FileText, FilePlus2 } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useFilterParams } from '@/hooks/useFilterParams';
import { useProposals } from '@/hooks/facility/useFacility';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { SearchSubmit } from '@/components/ui/SearchSubmit';
import { FilterChips } from '@/components/ui/FilterChips';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { RowActions } from '@/components/ui/RowActions';
import { ProposalStatusBadge } from '@/components/facility/FacilityBadges';
import { ManagerLinks } from '@/components/facility/ManagerLinks';
import { PROPOSAL_STATUS, PROPOSAL_STATUS_LABELS, PROPOSAL_ACTION_LABELS } from '@/models/facility/facilityConstants';
import { isPrincipal, canDecideProposal, canEditProposal, canCreateProposal } from '@/utils/facility/facilityPermissions';
import { proposalCrumbs } from '@/utils/facility/breadcrumbs';
import { formatMoney, proposalTotal } from '@/utils/facility/facilityFormat';
import { formatDate } from '@/utils/format';
import { activeFilterKeys } from '@/utils/filterParams';
import '@/styles/modules/facility.css';
import { StatCardIcon } from '@/components/ui/StatCardIcon';

const EMPTY = { status: 'ALL', keyword: '', campusId: '' };

/** Purchase / repair proposals: the VP's own campus, or sent proposals of both campuses for the Principal (GBR-FAC-10). */
export default function ProposalListPage() {
  const { user } = useAuth();
  const md = useMasterData();
  const navigate = useNavigate();
  const principal = isPrincipal(user);
  const [filters, setFilters] = useFilterParams(principal ? { ...EMPTY, status: PROPOSAL_STATUS.SUBMITTED } : EMPTY);
  const [page, setPage] = useState(1);
  const { proposals, loading, error, reload } = useProposals(filters);
  const { proposals: all } = useProposals({});

  const set = (patch) => {
    setFilters(patch);
    setPage(1);
  };
  // So với EMPTY (không phải mặc định theo vai trò) để "Chờ phê duyệt" của Hiệu trưởng vẫn hiện chip và đặt lại được
  const filtered = activeFilterKeys(filters, EMPTY).length > 0;
  const count = (s) => all.filter((p) => p.status === s).length;
  const waiting = all.filter((p) => canDecideProposal(p, user)).length;
  const stats = [
    { key: 'ALL', label: 'Tổng đề xuất', value: all.length, tone: 'blue' },
    ...(principal ? [] : [{ key: PROPOSAL_STATUS.DRAFT, label: 'Bản nháp', value: count(PROPOSAL_STATUS.DRAFT), tone: 'orange' }]),
    { key: PROPOSAL_STATUS.SUBMITTED, label: 'Chờ phê duyệt', value: count(PROPOSAL_STATUS.SUBMITTED), tone: 'purple' },
    { key: PROPOSAL_STATUS.APPROVED, label: 'Đã phê duyệt', value: count(PROPOSAL_STATUS.APPROVED), tone: 'green' },
    { key: PROPOSAL_STATUS.REJECTED, label: 'Bị từ chối', value: count(PROPOSAL_STATUS.REJECTED), tone: 'red' },
  ];
  const chips = [
    filters.keyword && { key: 'keyword', label: `Từ khóa: ${filters.keyword}`, onRemove: () => set({ keyword: '' }) },
    filters.campusId && {
      key: 'campusId',
      label: `Điểm trường: ${md.campusById(filters.campusId)?.shortName || ''}`,
      onRemove: () => set({ campusId: '' }),
    },
    filters.status !== 'ALL' && {
      key: 'status',
      label: `Trạng thái: ${stats.find((s) => s.key === filters.status)?.label || PROPOSAL_STATUS_LABELS[filters.status] || filters.status}`,
      onRemove: () => set({ status: 'ALL' }),
    },
  ].filter(Boolean);
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
          <SearchSubmit
            className="flex-1"
            value={filters.keyword}
            placeholder="Tìm mã hoặc tên đề xuất..."
            label="Tìm kiếm đề xuất"
            onSearch={(text) => set({ keyword: text })}
          />
          {principal && (
            <select
              className="select"
              value={filters.campusId}
              onChange={(e) => set({ campusId: e.target.value })}
              aria-label="Điểm trường"
            >
              <option value="">Tất cả điểm trường</option>
              {md.campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.shortName}
                </option>
              ))}
            </select>
          )}
          <button className="btn" onClick={() => set(EMPTY)} disabled={!filtered}>
            <RotateCcw size={15} /> Đặt lại bộ lọc
          </button>
        </div>
        <FilterChips count={loading ? null : proposals.length} unit="đề xuất" chips={chips} />
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <div className="table-wrap">
            <table className="table table--grid table--wrap-head">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Tên đề xuất</th>
                  <th>Hình thức</th>
                  {principal && <th>Điểm trường</th>}
                  <th className="num">Số tài sản</th>
                  <th className="money">Dự toán</th>
                  <th>Người lập</th>
                  <th>Ngày gửi</th>
                  <th className="center">Trạng thái</th>
                  <th className="cell--actions">Thao tác</th>
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
                        {principal && <td className="nowrap">{md.campusById(p.campusId)?.shortName}</td>}
                        <td className="num">{p.lines.length}</td>
                        <td className="money nowrap">{formatMoney(proposalTotal(p.lines))}</td>
                        <td>{md.userById(p.createdBy)?.fullName || '—'}</td>
                        <td className="nowrap">{p.submittedAt ? formatDate(p.submittedAt) : <span className="muted">Chưa gửi</span>}</td>
                        <td className="center">
                          <ProposalStatusBadge status={p.status} />
                        </td>
                        <td className="cell--actions" onClick={(e) => e.stopPropagation()}>
                          {decide ? (
                            <button className="btn btn--primary btn--sm" onClick={() => navigate(link)}>
                              <ClipboardCheck size={15} /> Phê duyệt
                            </button>
                          ) : edit ? (
                            <RowActions edit={{ to: link, label: 'Tiếp tục soạn' }} name={p.code} />
                          ) : (
                            <RowActions view={{ to: link }} name={p.code} />
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
