import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Award, FileCheck2, RotateCcw } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useRewardLists } from '@/hooks/assessment/useAssessment';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { SearchSubmit } from '@/components/ui/SearchSubmit';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { RowActions } from '@/components/ui/RowActions';
import { RewardStatusBadge } from '@/components/assessment/AssessmentBadges';
import { REWARD_STATUS as S, REWARD_STATUS_LABELS } from '@/models/assessment/assessmentConstants';
import { formatDate, normalizeText } from '@/utils/format';
import { isLeader, isPrincipal, isVicePrincipal } from '@/utils/assessment/assessmentPermissions';
import { assessmentCrumbs, SECTIONS } from '@/utils/assessment/breadcrumbs';
import '@/styles/modules/assessment.css';

const STATUS_FILTERS = ['NONE', S.DRAFT, S.RETURNED, S.PENDING_VP, S.PENDING_PRINCIPAL, S.APPROVED];

/** Đề xuất khen thưởng cuối năm: mỗi lớp một danh sách; GV lập, PHT xem xét, HT phê duyệt. */
export default function RewardListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const leader = isLeader(user);
  const { rows, loading, error, reload } = useRewardLists();
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('');
  const [campusId, setCampusId] = useState('');
  const [page, setPage] = useState(1);
  const campuses = useMemo(() => {
    const seen = new Map();
    rows.forEach((r) => seen.has(String(r.campusId)) || seen.set(String(r.campusId), r.campusName || r.campusId));
    return [...seen].map(([id, name]) => ({ id, name }));
  }, [rows]);
  const multiCampus = campuses.length > 1;

  const filtered = rows
    .filter((r) => !campusId || String(r.campusId) === campusId)
    .filter((r) => !status || (r.status || 'NONE') === status)
    .filter((r) => !keyword || normalizeText(r.className).includes(normalizeText(keyword)));

  const action = (r) => {
    if (!leader && [undefined, null, S.DRAFT, S.RETURNED].includes(r.status))
      return { primary: true, label: r.status ? 'Tiếp tục lập' : 'Lập danh sách' };
    if (isVicePrincipal(user) && r.status === S.PENDING_VP) return { primary: true, label: 'Xem xét' };
    if (isPrincipal(user) && [S.PENDING_VP, S.PENDING_PRINCIPAL].includes(r.status)) return { primary: true, label: 'Phê duyệt' };
    return { primary: false, label: 'Xem danh sách' };
  };
  const hasFilter = !!(keyword || status || campusId);

  return (
    <div className="page">
      <Breadcrumb items={assessmentCrumbs(SECTIONS.rewards)} />
      <h1 className="page__title">Đề xuất khen thưởng cuối năm</h1>
      <div className="card">
        <div className="filter-bar">
          <SearchSubmit
            className="flex-1"
            value={keyword}
            placeholder="Tìm lớp..."
            label="Tìm lớp"
            onSearch={(text) => {
              setKeyword(text);
              setPage(1);
            }}
          />
          {leader && multiCampus && (
            <select
              className="select"
              value={campusId}
              aria-label="Điểm trường"
              onChange={(e) => {
                setCampusId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả điểm trường</option>
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <select
            className="select"
            value={status}
            aria-label="Trạng thái"
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả trạng thái</option>
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {REWARD_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <div className="table-wrap">
            <table className="table table--grid">
              <thead>
                <tr>
                  <th>Lớp</th>
                  {leader && multiCampus && <th>Điểm trường</th>}
                  <th className="num">Số trẻ</th>
                  <th className="num">Trẻ được đề xuất</th>
                  <th className="center">Trạng thái</th>
                  <th>Ngày gửi</th>
                  <th className="cell--actions">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows rows={5} cols={leader && multiCampus ? 7 : 6} />
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={leader && multiCampus ? 7 : 6}>
                      <EmptyState
                        icon={Award}
                        title={hasFilter ? 'Không tìm thấy lớp' : leader ? 'Chưa có lớp trong phạm vi' : 'Bạn chưa được phân công lớp'}
                        description={hasFilter ? 'Thử đổi từ khóa hoặc bộ lọc.' : 'Chọn năm học khác ở thanh trên cùng.'}
                        action={
                          hasFilter && (
                            <button
                              className="btn"
                              onClick={() => {
                                setKeyword('');
                                setStatus('');
                                setCampusId('');
                                setPage(1);
                              }}
                            >
                              <RotateCcw size={15} /> Đặt lại bộ lọc
                            </button>
                          )
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  paginate(filtered, page).map((r) => {
                    const a = action(r);
                    const to = `/assessment/rewards/${r.classId}`;
                    return (
                      <tr key={r.classId} className="row-click" onClick={() => navigate(to)}>
                        <td className="fw-600">{r.className}</td>
                        {leader && multiCampus && <td>{r.campusName}</td>}
                        <td className="num">{r.children}</td>
                        <td className="num">{r.awarded ?? '—'}</td>
                        <td className="center">
                          <RewardStatusBadge status={r.status || 'NONE'} />
                        </td>
                        <td className="nowrap">{r.submittedAt ? formatDate(r.submittedAt) : '—'}</td>
                        <td className="cell--actions" onClick={(e) => e.stopPropagation()}>
                          {a.primary ? (
                            <Link className="btn btn--primary btn--sm" to={to}>
                              <FileCheck2 size={15} /> {a.label}
                            </Link>
                          ) : (
                            <RowActions view={{ to, label: a.label }} name={r.className} />
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
        {!loading && filtered.length > 0 && <Pagination page={page} total={filtered.length} onChange={setPage} unit="lớp" />}
      </div>
    </div>
  );
}
