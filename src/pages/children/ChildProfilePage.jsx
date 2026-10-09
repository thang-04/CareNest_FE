import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, LayoutGrid, HeartPulse, LineChart, ClipboardList, KeyRound, AlertTriangle } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useChildDetail } from '@/hooks/children/useChildRecords';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { LoadingState } from '@/components/ui/States';
import { ChildStatusBadge, ParentAccountBadge } from '@/components/children/ChildBadges';
import { ChildAccessState } from '@/components/children/ChildAccessState';
import { DeclarationSummary } from '@/components/children/DeclarationSummary';
import { CHILD_STATUS, GENDER_LABELS, ageGroupById, ageLabel } from '@/models/School';
import { SMS_STATUS } from '@/models/children/childrenConstants';
import { avatarTone, formatDate, formatDateTime, initials } from '@/utils/format';
import {
  canActivateParent,
  canDeclareHealth,
  canEditChild,
  canPlaceChild,
  canViewParentAccounts,
} from '@/utils/children/childrenPermissions';
import { childrenCrumbs } from '@/utils/children/breadcrumbs';
import '@/styles/modules/children.css';

const missing = <span className="muted">Chưa có thông tin</span>;

// Tổng quan hiện đủ thông tin bằng card; tab chỉ tách phần lịch sử
const TABS = [
  { key: 'overview', label: 'Tổng quan' },
  { key: 'placements', label: 'Lịch sử xếp lớp' },
];

export default function ChildProfilePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const md = useMasterData();
  const { detail, loading, error, reload } = useChildDetail(id);
  const child = detail?.child;
  const crumbs = childrenCrumbs(child?.fullName || 'Hồ sơ trẻ');
  const [tab, setTab] = useState('overview');

  if (loading)
    return (
      <div className="page">
        <Breadcrumb items={crumbs} />
        <LoadingState />
      </div>
    );
  if (error || !child)
    return (
      <div className="page">
        <Breadcrumb items={crumbs} />
        <ChildAccessState error={error} onRetry={reload} />
      </div>
    );

  const { cls, declaration, placements } = detail;
  const showAccounts = canViewParentAccounts(user);
  const hasPendingParent = child.guardians.some((g) => g.accountStatus === 'NOT_ACTIVATED');

  return (
    <div className="page">
      <Breadcrumb items={crumbs} />
      <div className="page__head">
        <div className="row" style={{ gap: 16, flexWrap: 'nowrap' }}>
          <span className={`avatar avatar--xl avatar--tone-${avatarTone(child.fullName)}`} aria-hidden="true">
            {initials(child.fullName)}
          </span>
          <div className="stack" style={{ gap: 4 }}>
            <div className="row row--wrap" style={{ gap: 12 }}>
              <h1 className="page__title">{child.fullName}</h1>
              <ChildStatusBadge status={child.status} size="lg" />
            </div>
            <span className="muted">
              {child.code}
              {cls?.name ? ` · ${cls.name}` : ''}
            </span>
          </div>
        </div>
        <div className="row row--wrap" style={{ gap: 8 }}>
          {canPlaceChild(child, user) && (
            <Link className="btn" to={`/children/placement?childId=${child.id}`}>
              <LayoutGrid size={16} /> {child.classId ? 'Chuyển lớp' : 'Xếp lớp'}
            </Link>
          )}
          {canEditChild(child, user) && (
            <Link className="btn btn--primary" to={`/children/${child.id}/edit`}>
              <Pencil size={16} /> Sửa hồ sơ
            </Link>
          )}
        </div>
      </div>

      {child.status === CHILD_STATUS.PENDING_PLACEMENT && (
        <div className="alert alert--warning mb-16">
          <AlertTriangle size={18} />
          <div>Trẻ chưa được xếp lớp nên việc tiếp nhận chưa hoàn tất.</div>
        </div>
      )}

      <div className="tabs mb-16" role="tablist" aria-label="Phần hồ sơ">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`tab ${tab === t.key ? 'tab--active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="detail-layout" role="tabpanel">
          <div className="detail-layout__main">
            <section className="card">
              <div className="card__header">
                <h2 className="card__title">Thông tin của trẻ</h2>
              </div>
              <div className="card__body">
                <dl className="info-list info-list--wide">
                  <dt>Mã trẻ</dt>
                  <dd className="fw-600 text-primary">{child.code}</dd>
                  <dt>Ngày sinh</dt>
                  <dd>
                    {child.dateOfBirth ? (
                      <>
                        {formatDate(child.dateOfBirth)} <span className="muted">({ageLabel(child.dateOfBirth)})</span>
                      </>
                    ) : (
                      missing
                    )}
                  </dd>
                  <dt>Giới tính</dt>
                  <dd>{GENDER_LABELS[child.gender] || missing}</dd>
                  <dt>Ngày tiếp nhận</dt>
                  <dd>{child.enrolledAt ? formatDate(child.enrolledAt) : missing}</dd>
                  <dt>Dị ứng đã xác nhận</dt>
                  <dd>
                    {child.allergies?.length ? (
                      <span className="row row--wrap" style={{ gap: 6 }}>
                        {child.allergies.map((a) => (
                          <span key={a} className="chip chip--red">
                            {a}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="muted">Không có</span>
                    )}
                  </dd>
                </dl>
              </div>
            </section>
            <section className="card">
              <div className="card__header row row--between">
                <h2 className="card__title">Phụ huynh / người giám hộ</h2>
                {canActivateParent(child, user) && hasPendingParent && (
                  <Link className="btn btn--sm" to={`/children/activation?childId=${child.id}`}>
                    <KeyRound size={15} /> Kích hoạt tài khoản
                  </Link>
                )}
              </div>
              {child.guardians.length === 0 ? (
                <div className="card__body muted">Chưa có thông tin phụ huynh.</div>
              ) : (
                <div className="table-wrap tr-table-flat">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Họ và tên</th>
                        <th>Quan hệ</th>
                        <th>Số điện thoại</th>
                        <th>Email</th>
                        {showAccounts && <th>Tài khoản ứng dụng</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {child.guardians.map((g) => (
                        <tr key={`${g.phone}${g.fullName}`}>
                          <td className="fw-600">{g.fullName}</td>
                          <td>{g.relation}</td>
                          <td className="nowrap">{g.phone || missing}</td>
                          <td>{g.email || missing}</td>
                          {showAccounts && (
                            <td>
                              <ParentAccountBadge status={g.accountStatus} />
                              {g.smsStatus === SMS_STATUS.FAILED && (
                                <div className="text-danger text-xs mt-8">Gửi SMS lỗi – cần gửi lại</div>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
            <section className="card">
              <div className="card__header row row--between">
                <h2 className="card__title">Sức khỏe khi tiếp nhận</h2>
                {canDeclareHealth(child, user) && (
                  <Link className="btn btn--sm" to={`/children/${child.id}/health-declaration`}>
                    <Pencil size={15} /> Cập nhật khai báo
                  </Link>
                )}
              </div>
              <div className="card__body">
                <DeclarationSummary
                  declaration={declaration}
                  confirmedAllergies={child.allergies}
                  confirmedByName={declaration?.confirmedByName}
                />
              </div>
            </section>
          </div>
          <aside className="detail-layout__aside">
            <section className="card">
              <div className="card__header">
                <h2 className="card__title">Lớp & năm học</h2>
              </div>
              <div className="card__body">
                <dl className="info-list info-list--wide">
                  <dt>Điểm trường</dt>
                  <dd>{md.campusById(child.campusId)?.name || missing}</dd>
                  <dt>Năm học</dt>
                  <dd>{cls?.schoolYear || missing}</dd>
                  <dt>Nhóm tuổi</dt>
                  <dd>{ageGroupById(cls?.ageGroupId)?.name || missing}</dd>
                  <dt>Lớp</dt>
                  <dd className="fw-600">{cls?.name || <span className="muted">Chưa xếp lớp</span>}</dd>
                  <dt>Giáo viên chủ nhiệm</dt>
                  <dd>{md.userById(cls?.homeroomTeacherId)?.fullName || missing}</dd>
                </dl>
              </div>
            </section>
            <section className="card">
              <div className="card__header">
                <h2 className="card__title">Sức khỏe & theo dõi</h2>
              </div>
              <div className="card__body tr-quicklinks tr-quicklinks--list">
                <Link className="tr-quicklink" to={`/children/${child.id}/health`}>
                  <HeartPulse size={20} />
                  <span>
                    <span className="fw-600">Sổ sức khỏe</span>
                    <span className="muted text-sm">Chiều cao, cân nặng, tình trạng dinh dưỡng</span>
                  </span>
                </Link>
                <Link className="tr-quicklink" to={`/children/health-trends?childId=${child.id}`}>
                  <LineChart size={20} />
                  <span>
                    <span className="fw-600">Xu hướng sức khỏe</span>
                    <span className="muted text-sm">Biểu đồ tăng trưởng và nhận định AI</span>
                  </span>
                </Link>
                <Link className="tr-quicklink" to={`/children/${child.id}/health-declaration`}>
                  <ClipboardList size={20} />
                  <span>
                    <span className="fw-600">Khai báo sức khỏe</span>
                    <span className="muted text-sm">Dị ứng, chế độ ăn khi tiếp nhận</span>
                  </span>
                </Link>
              </div>
            </section>
          </aside>
        </div>
      )}
      {tab === 'placements' && (
        <div role="tabpanel">
          <section className="card">
            <div className="card__header">
              <h2 className="card__title">Lịch sử xếp lớp</h2>
            </div>
            <div className="card__body">
              {placements.length === 0 ? (
                <p className="muted">Chưa có thay đổi lớp nào được ghi nhận trên hệ thống.</p>
              ) : (
                <ul className="history-list">
                  {placements.map((p) => (
                    <li key={p.id}>
                      <span className="history-list__dot" />
                      <div>
                        <div>
                          {p.fromClassName ? (
                            <>
                              Chuyển từ <b>{p.fromClassName}</b> sang <b>{p.toClassName}</b>
                            </>
                          ) : (
                            <>
                              Xếp vào <b>{p.toClassName}</b>
                            </>
                          )}
                        </div>
                        <div className="muted text-sm">
                          {p.userName} · {formatDateTime(p.at)}
                          {p.reason ? ` · Lý do: ${p.reason}` : ''}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      )}

      <div className="page-actions">
        <Link className="btn" to="/children">
          <ArrowLeft size={16} /> Về danh sách trẻ
        </Link>
      </div>
    </div>
  );
}
