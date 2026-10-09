import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Award, Eye, FileCheck2, Info, Pencil, Plus, Search } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useRewardProposals } from '@/hooks/assessment/useAssessment';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { RewardStatusBadge } from '@/components/assessment/AssessmentBadges';
import { REWARD_STATUS as S } from '@/models/assessment/assessmentConstants';
import { formatDate, normalizeText } from '@/utils/format';
import {
  canCreateRewardProposal,
  canDecideRewardProposal,
  canEditRewardProposal,
  canReviewRewardProposal,
  isPrincipal,
  isVicePrincipal,
} from '@/utils/assessment/assessmentPermissions';
import { assessmentCrumbs, SECTIONS } from '@/utils/assessment/breadcrumbs';
import '@/styles/modules/assessment.css';

const done = [S.APPROVED];
const closed = [S.REJECTED, S.RETURNED];

const tabsFor = (user) => {
  if (isPrincipal(user))
    return [
      { key: 'TODO', label: 'Chờ tôi phê duyệt', match: (p) => p.status === S.PENDING_PRINCIPAL },
      { key: 'VP', label: 'Chờ Phó HT xem xét', match: (p) => p.status === S.PENDING_VP },
      { key: 'DONE', label: 'Đã phê duyệt', match: (p) => done.includes(p.status) },
      { key: 'CLOSED', label: 'Trả lại / từ chối', match: (p) => closed.includes(p.status) },
      { key: 'ALL', label: 'Tất cả', match: () => true },
    ];
  if (isVicePrincipal(user))
    return [
      { key: 'TODO', label: 'Chờ tôi xem xét', match: (p) => p.status === S.PENDING_VP },
      { key: 'FWD', label: 'Đã chuyển Hiệu trưởng', match: (p) => p.status === S.PENDING_PRINCIPAL },
      { key: 'DONE', label: 'Đã phê duyệt', match: (p) => done.includes(p.status) },
      { key: 'CLOSED', label: 'Trả lại / từ chối', match: (p) => closed.includes(p.status) },
      { key: 'ALL', label: 'Tất cả', match: () => true },
    ];
  return [
    { key: 'TODO', label: 'Cần hoàn thiện', match: (p) => [S.DRAFT, S.RETURNED].includes(p.status) },
    { key: 'PENDING', label: 'Đang duyệt', match: (p) => [S.PENDING_VP, S.PENDING_PRINCIPAL].includes(p.status) },
    { key: 'DONE', label: 'Đã phê duyệt', match: (p) => done.includes(p.status) },
    { key: 'REJECTED', label: 'Bị từ chối', match: (p) => p.status === S.REJECTED },
    { key: 'ALL', label: 'Tất cả', match: () => true },
  ];
};

/** #61 Year-end Reward Proposals: the teacher's own proposals, or the ones waiting for the Vice Principal / Principal. */
export default function RewardProposalListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { schoolYear } = useSchoolYear();
  const { proposals, loading, error, reload } = useRewardProposals({ schoolYear });
  const tabs = tabsFor(user);
  const [tab, setTab] = useState('TODO');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const current = tabs.find((t) => t.key === tab) || tabs[0];
  const searched = proposals.filter(
    (p) => !keyword || normalizeText(`${p.code} ${p.childName} ${p.rewardTitle} ${p.className}`).includes(normalizeText(keyword)),
  );
  const rows = searched.filter(current.match);
  const canCreate = canCreateRewardProposal(user);

  const action = (p) => {
    if (canEditRewardProposal(p, user))
      return {
        label: p.status === S.RETURNED ? 'Sửa và gửi lại' : 'Tiếp tục soạn',
        icon: Pencil,
        to: `/assessment/rewards/${p.id}/edit`,
        primary: true,
      };
    if (canReviewRewardProposal(p, user)) return { label: 'Xem xét', icon: FileCheck2, to: `/assessment/rewards/${p.id}`, primary: true };
    if (canDecideRewardProposal(p, user)) return { label: 'Phê duyệt', icon: FileCheck2, to: `/assessment/rewards/${p.id}`, primary: true };
    return { label: 'Xem', icon: Eye, to: `/assessment/rewards/${p.id}`, primary: false };
  };

  return (
    <div className="page">
      <Breadcrumb items={assessmentCrumbs(SECTIONS.rewards)} />
      <div className="page__head">
        <h1 className="page__title">Đề xuất khen thưởng cuối năm</h1>
        {canCreate && (
          <Link to="/assessment/rewards/new" className="btn btn--primary btn--lg" style={{ marginTop: 6 }}>
            <Plus size={18} /> Tạo đề xuất
          </Link>
        )}
      </div>
      <div className="alert alert--info mb-16">
        <Info size={18} />
        <div>
          Quy trình: Giáo viên đề xuất từ đánh giá cuối năm đã xác nhận → Phó hiệu trưởng xem xét → Hiệu trưởng phê duyệt hoặc từ chối. Chỉ
          khen thưởng đã phê duyệt mới được công bố cho phụ huynh. AI không quyết định khen thưởng.
        </div>
      </div>
      <div className="card">
        <div className="tabs" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={current.key === t.key}
              className={`tab ${current.key === t.key ? 'tab--active' : ''}`}
              onClick={() => {
                setTab(t.key);
                setPage(1);
              }}
            >
              {t.label} <span className="tab__count">{searched.filter(t.match).length}</span>
            </button>
          ))}
        </div>
        <div className="filter-bar">
          <label className="search-box" style={{ flex: 1 }}>
            <Search size={17} className="muted" />
            <input
              placeholder="Tìm mã đề xuất, tên trẻ, danh hiệu..."
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                setPage(1);
              }}
              aria-label="Tìm kiếm"
            />
          </label>
        </div>
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <div className="table-wrap" style={{ border: 'none', borderTop: '1px solid var(--border)', borderRadius: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Trẻ</th>
                  <th>Lớp</th>
                  <th>Danh hiệu</th>
                  <th>Ngày gửi</th>
                  <th>Trạng thái</th>
                  <th className="center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows rows={5} cols={7} />
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState
                        icon={Award}
                        title="Không có đề xuất"
                        description={
                          canCreate
                            ? 'Tạo đề xuất cho trẻ đã có đánh giá cuối năm được xác nhận.'
                            : 'Đề xuất cần bạn xử lý sẽ hiển thị tại đây.'
                        }
                        action={
                          canCreate && (
                            <Link className="btn btn--primary" to="/assessment/rewards/new">
                              <Plus size={16} /> Tạo đề xuất
                            </Link>
                          )
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  paginate(rows, page).map((p) => {
                    const a = action(p);
                    return (
                      <tr key={p.id} className="row-click" onClick={() => navigate(a.to)}>
                        <td className="fw-600 text-primary">{p.code}</td>
                        <td>{p.childName}</td>
                        <td>{p.className}</td>
                        <td>{p.rewardTitle}</td>
                        <td className="nowrap">{formatDate(p.submittedAt)}</td>
                        <td>
                          <RewardStatusBadge status={p.status} />
                        </td>
                        <td className="center" onClick={(e) => e.stopPropagation()}>
                          <Link className={`btn btn--sm ${a.primary ? 'btn--primary' : ''}`} to={a.to}>
                            <a.icon size={15} /> {a.label}
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
        {!loading && rows.length > 0 && <Pagination page={page} total={rows.length} onChange={setPage} unit="đề xuất" />}
      </div>
    </div>
  );
}
