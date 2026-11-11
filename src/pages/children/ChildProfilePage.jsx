import { ChildAvatar } from '@/components/ChildAvatar';
import { PortraitImage } from '@/components/PortraitImage';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Pencil,
  LayoutGrid,
  HeartPulse,
  LineChart,
  ClipboardList,
  KeyRound,
  AlertTriangle,
  ChevronRight,
} from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useChildDetail } from '@/hooks/children/useChildRecords';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { LoadingState } from '@/components/ui/States';
import { ChildStatusBadge } from '@/components/children/ChildBadges';
import { ChildAccessState } from '@/components/children/ChildAccessState';
import { CHILD_STATUS, GENDER_LABELS, ageGroupById, ageLabel } from '@/models/School';
import { formatDate, formatDateTime } from '@/utils/format';
import { canEditChild, canPlaceChild } from '@/utils/children/childrenPermissions';
import { ChildProfileSummary } from '@/components/children/ChildProfileSummary';
import { ChildInfoTable } from '@/components/children/ChildInfoTable';
import { canActivateParent, canRecordMeasurement, canViewParentAccounts } from '@/utils/children/childrenPermissions';
import { SMS_STATUS } from '@/models/children/childrenConstants';
import { AllergyStateBadge, ParentAccountBadge, SmsStatusBadge } from '@/components/children/ChildBadges';
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
  const profileUpdate = [...(child.history || [])]
    .reverse()
    .find(
      (item) => item.action === 'UPDATED_FROM_EXAM' || (item.changes || []).some((change) => String(change.field).startsWith('profile.')),
    );

  return (
    <div className="page">
      <Breadcrumb items={crumbs} />
      <div className="page__head">
        <div className="row gap-4">
          <ChildAvatar child={child} size="xl" />
          <div className="stack gap-1">
            <div className="row row--wrap gap-3">
              <h1 className="page__title">{child.fullName}</h1>
              <ChildStatusBadge status={child.status} size="lg" />
            </div>
            <span className="muted">
              {child.code}
              {cls?.name ? ` · ${cls.name}` : ''}
            </span>
          </div>
        </div>
        <div className="row row--wrap gap-2">
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
      {child.status === CHILD_STATUS.LEFT && (
        <div className="alert alert--warning mb-16">
          Trẻ đã nghỉ học{child.leftAt ? ` từ ${formatDate(child.leftAt)}` : ''}
          {child.leftReason ? ` · ${child.leftReason}` : ''}. Hồ sơ được giữ để tra cứu, không chỉnh sửa.
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
                <ChildInfoTable
                  label="Thông tin của trẻ"
                  rows={[
                    ['Mã trẻ', child.code],
                    [
                      'Ngày sinh',
                      child.dateOfBirth ? (
                        <>
                          {formatDate(child.dateOfBirth)} <span className="muted">({ageLabel(child.dateOfBirth)})</span>
                        </>
                      ) : (
                        missing
                      ),
                    ],
                    ['Giới tính', GENDER_LABELS[child.gender] || missing],
                    ['Ngày tiếp nhận', child.enrolledAt ? formatDate(child.enrolledAt) : missing],
                    [
                      'Dị ứng đã xác nhận',
                      child.allergies?.length ? (
                        <span className="row row--wrap gap-1-5">
                          {child.allergies.map((a) => (
                            <span key={a} className="chip chip--red">
                              {a}
                            </span>
                          ))}
                        </span>
                      ) : declaration?.allergies?.state ? (
                        <AllergyStateBadge status={declaration.allergies.state} />
                      ) : (
                        <span className="muted">Chưa có khai báo</span>
                      ),
                    ],
                  ]}
                />
              </div>
            </section>
            <section className="card">
              <div className="card__header">
                <h2 className="card__title">Thông tin hành chính</h2>
              </div>
              <div className="card__body">
                <ChildProfileSummary profile={child.profile} />
                {profileUpdate && (
                  <p className="muted text-xs mt-8">
                    Cập nhật gần nhất: {profileUpdate.action === 'UPDATED_FROM_EXAM' ? profileUpdate.note : 'Sửa hồ sơ'} ·{' '}
                    {md.userById(profileUpdate.userId)?.fullName || '—'} · {formatDateTime(profileUpdate.at)}
                  </p>
                )}
              </div>
            </section>
            <section className="card">
              <div className="card__header row row--between">
                <h2 className="card__title">Phụ huynh / người giám hộ</h2>
                {canActivateParent(child, user) && (
                  <Link className="btn btn--sm" to={`/children/activation?childId=${child.id}`}>
                    <KeyRound size={15} /> Tài khoản phụ huynh
                  </Link>
                )}
              </div>
              {child.guardians.length === 0 ? (
                <div className="card__body muted">Chưa có thông tin phụ huynh.</div>
              ) : (
                <div className="table-wrap tr-table-flat">
                  <table className="table table--grid">
                    <thead>
                      <tr>
                        <th>Họ và tên</th>
                        <th>Quan hệ</th>
                        <th>Số điện thoại</th>
                        <th>Số CCCD</th>
                        <th>Email</th>
                        {canViewParentAccounts(user) && <th>Tài khoản</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {child.guardians.map((g) => (
                        <tr key={`${g.phone}${g.fullName}`}>
                          <td>
                            <span className="row gap-3 fw-600">
                              <PortraitImage
                                source={g.photoUrl}
                                alt={`Ảnh của ${g.fullName}`}
                                className="avatar avatar--lg avatar--photo"
                              />
                              {g.fullName}
                            </span>
                          </td>
                          <td>{g.relation}</td>
                          <td className="nowrap">{g.phone ? <a href={`tel:${g.phone}`}>{g.phone}</a> : missing}</td>
                          <td className="nowrap">{g.idNumber || missing}</td>
                          <td>{g.email || missing}</td>
                          {canViewParentAccounts(user) && (
                            <td className="center">
                              <ParentAccountBadge status={g.accountStatus} />
                              {g.smsStatus === SMS_STATUS.FAILED && (
                                <div className="mt-8">
                                  <SmsStatusBadge status={SMS_STATUS.FAILED} />
                                </div>
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
          </div>
          <aside className="detail-layout__aside">
            <section className="card">
              <div className="card__header">
                <h2 className="card__title">Lớp & năm học</h2>
              </div>
              <div className="card__body">
                <ChildInfoTable
                  label="Lớp và năm học"
                  rows={[
                    ['Điểm trường', md.campusById(child.campusId)?.name || missing],
                    ['Năm học', cls?.schoolYear || missing],
                    ['Nhóm tuổi', ageGroupById(cls?.ageGroupId)?.name || missing],
                    ['Lớp', cls?.name ? <span className="fw-600">{cls.name}</span> : <span className="muted">Chưa xếp lớp</span>],
                    ['Giáo viên chủ nhiệm', md.userById(cls?.homeroomTeacherId)?.fullName || missing],
                  ]}
                />
              </div>
            </section>
            <section className="card">
              <div className="card__header">
                <h2 className="card__title">Sức khỏe & theo dõi</h2>
                {canRecordMeasurement(child, user, cls) && (
                  <Link className="btn btn--sm" to={`/children/${child.id}/health/new`}>
                    Nhập số đo
                  </Link>
                )}
              </div>
              <div className="card__body tr-quicklinks tr-quicklinks--list">
                {[
                  {
                    to: `/children/${child.id}/health`,
                    icon: HeartPulse,
                    title: 'Sổ sức khỏe',
                    hint: 'Chiều cao, cân nặng, tình trạng dinh dưỡng',
                  },
                  {
                    to: `/children/health-trends?childId=${child.id}`,
                    icon: LineChart,
                    title: 'Xu hướng sức khỏe',
                    hint: 'Biểu đồ tăng trưởng và nhận định AI',
                  },
                  {
                    to: `/children/${child.id}/health-declaration`,
                    icon: ClipboardList,
                    title: 'Khai báo sức khỏe',
                    hint: 'Dị ứng, chế độ ăn, tiền sử',
                  },
                ].map(({ to, icon: Icon, title, hint }) => (
                  <Link key={title} className="tr-quicklink" to={to}>
                    <span className="tr-quicklink__icon" aria-hidden="true">
                      <Icon size={20} />
                    </span>
                    <span className="tr-quicklink__text">
                      <span className="fw-600">{title}</span>
                      <span className="muted text-sm">{hint}</span>
                    </span>
                    <ChevronRight size={18} className="tr-quicklink__go" aria-hidden="true" />
                  </Link>
                ))}
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
