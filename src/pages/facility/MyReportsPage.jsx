import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, PackagePlus, Eye, Info, ClipboardList, RotateCcw, Link2 } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useMyReports } from '@/hooks/facility/useFacility';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { IssueStatusBadge, RequestStatusBadge, IssueTypeChip } from '@/components/facility/FacilityBadges';
import { locationLabel } from '@/models/Location';
import { ISSUE_STATUS_LABELS, REQUEST_STATUS_LABELS, ISSUE_TYPES } from '@/models/facility/facilityConstants';
import { canReportIssue, canCreateRequest } from '@/utils/facility/facilityPermissions';
import { myReportCrumbs } from '@/utils/facility/breadcrumbs';
import { formatDate } from '@/utils/format';
import '@/styles/modules/facility.css';

const TABS = [
  { key: 'issues', label: 'Báo sự cố' },
  { key: 'requests', label: 'Đề nghị bổ sung' },
];

const issueQty = (i) =>
  i.type === ISSUE_TYPES.INSUFFICIENT ? `Có ${i.currentQuantity}, cần thêm ${i.quantity}` : `${i.quantity} ${i.unit.toLowerCase()}`;

/** Result text the reporter needs: reason when rejected, note / proposal when approved, who is deciding otherwise. */
const resultText = (doc) => {
  if (doc.status === 'REJECTED') return { tone: 'text-danger', text: `Lý do: ${doc.rejectReason}` };
  if (doc.status === 'APPROVED') {
    const parts = [doc.responseNote, doc.proposal ? `Đề xuất ${doc.proposal.code}` : ''].filter(Boolean);
    return { tone: 'text-2', text: parts.join(' · ') || 'Đã duyệt' };
  }
  if (doc.status === 'PENDING_PRINCIPAL') return { tone: 'muted', text: 'Phó hiệu trưởng đã chuyển Hiệu trưởng quyết định' };
  return { tone: 'muted', text: 'Chờ Phó hiệu trưởng xem xét' };
};

/** #112 Report & Request History: the reporter's own issue reports and additional requests with status and result. */
export default function MyReportsPage() {
  const { user } = useAuth();
  const md = useMasterData();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'requests' ? 'requests' : 'issues';
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(1);
  const { issues, requests, loading, error, reload } = useMyReports();

  const source = tab === 'issues' ? issues : requests;
  const rows = source.filter((x) => status === 'ALL' || x.status === status);
  const pageRows = paginate(rows, page);
  const labels = tab === 'issues' ? ISSUE_STATUS_LABELS : REQUEST_STATUS_LABELS;

  const switchTab = (key) => {
    setParams(key === 'requests' ? { tab: 'requests' } : {}, { replace: true });
    setStatus('ALL');
    setPage(1);
  };

  return (
    <div className="page">
      <Breadcrumb items={myReportCrumbs()} />
      <div className="page__head">
        <h1 className="page__title">Lịch sử báo cáo & đề nghị</h1>
        <div className="row row--wrap" style={{ gap: 8, marginTop: 6, justifyContent: 'flex-end' }}>
          {canCreateRequest(user) && (
            <Link className="btn" to="/facility/requests/new">
              <PackagePlus size={16} /> Đề nghị bổ sung
            </Link>
          )}
          {canReportIssue(user) && (
            <Link className="btn btn--primary" to="/facility/issues/new">
              <AlertTriangle size={16} /> Báo sự cố
            </Link>
          )}
        </div>
      </div>
      <div className="alert alert--info mb-16">
        <Info size={18} />
        <div>
          Các báo cáo sự cố và đề nghị bổ sung bạn đã gửi. Kết quả duyệt và lý do từ chối hiển thị ở cột <b>Kết quả</b>; bạn cũng nhận thông
          báo khi có quyết định.
        </div>
      </div>

      <div className="card">
        <div className="tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              className={`tab ${tab === t.key ? 'tab--active' : ''}`}
              onClick={() => switchTab(t.key)}
            >
              {t.label} <span className="tab__count">{(t.key === 'issues' ? issues : requests).length}</span>
            </button>
          ))}
        </div>
        <div className="filter-bar">
          <select
            className="select"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            aria-label="Trạng thái"
          >
            <option value="ALL">Tất cả trạng thái</option>
            {Object.entries(labels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <div className="table-wrap" style={{ border: 'none', borderTop: '1px solid var(--border)', borderRadius: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Tài sản</th>
                  <th>Lớp/phòng</th>
                  <th>{tab === 'issues' ? 'Loại sự cố' : 'Số lượng'}</th>
                  <th>Ngày gửi</th>
                  <th>Trạng thái</th>
                  <th>Kết quả</th>
                  <th className="center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows rows={4} cols={8} />
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      {status !== 'ALL' ? (
                        <EmptyState
                          title="Không có mục phù hợp"
                          action={
                            <button className="btn" onClick={() => setStatus('ALL')}>
                              <RotateCcw size={15} /> Đặt lại bộ lọc
                            </button>
                          }
                        />
                      ) : (
                        <EmptyState
                          icon={ClipboardList}
                          title={tab === 'issues' ? 'Bạn chưa gửi báo cáo sự cố nào' : 'Bạn chưa gửi đề nghị bổ sung nào'}
                          description="Mở danh sách tài sản của lớp/phòng để báo sự cố hoặc đề nghị bổ sung."
                          action={
                            <Link className="btn btn--primary" to={tab === 'issues' ? '/facility/issues/new' : '/facility/requests/new'}>
                              {tab === 'issues' ? <AlertTriangle size={16} /> : <PackagePlus size={16} />}{' '}
                              {tab === 'issues' ? 'Báo sự cố' : 'Đề nghị bổ sung'}
                            </Link>
                          }
                        />
                      )}
                    </td>
                  </tr>
                ) : (
                  pageRows.map((x) => {
                    const link = tab === 'issues' ? `/facility/issues/${x.id}` : `/facility/requests/${x.id}`;
                    const result = resultText(x);
                    const linked = tab === 'issues' && x.reporterId !== user.id;
                    return (
                      <tr key={x.id} className="row-click" onClick={() => navigate(link)}>
                        <td className="fw-600 text-primary nowrap">{x.code}</td>
                        <td className="bh-cell-wrap">
                          {tab === 'issues' ? x.assetName : x.itemName}
                          {linked && (
                            <div className="mt-8">
                              <span className="chip chip--teal" title="Bạn báo trùng sự cố này và được liên kết vào báo cáo">
                                <Link2 size={12} /> Báo trùng – đã liên kết
                              </span>
                            </div>
                          )}
                        </td>
                        <td>{locationLabel(md.locationById(x.locationId))}</td>
                        <td>
                          {tab === 'issues' ? (
                            <>
                              <IssueTypeChip type={x.type} />
                              <div className="muted text-xs mt-8">{issueQty(x)}</div>
                            </>
                          ) : (
                            `${x.quantity} ${x.unit.toLowerCase()}`
                          )}
                        </td>
                        <td className="nowrap">{formatDate(x.createdAt)}</td>
                        <td>{tab === 'issues' ? <IssueStatusBadge status={x.status} /> : <RequestStatusBadge status={x.status} />}</td>
                        <td className={`bh-cell-wrap text-sm ${result.tone}`}>{result.text}</td>
                        <td className="center" onClick={(e) => e.stopPropagation()}>
                          <Link className="icon-btn" to={link} title="Xem chi tiết" aria-label={`Xem ${x.code}`}>
                            <Eye size={17} />
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
        {!loading && rows.length > 0 && <Pagination page={page} total={rows.length} onChange={setPage} unit="mục" />}
      </div>
    </div>
  );
}
