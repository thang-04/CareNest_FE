import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Star, ChefHat, UserCog, Shapes, Users } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useCampusDetail } from '@/hooks/school-config/useSchoolConfig';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { ScNoAccess } from '@/components/school-config/ScNoAccess';
import { UnassignedBadge } from '@/components/school-config/SchoolConfigBadges';
import { StaffQuickPanel } from '@/components/school-config/StaffQuickPanel';
import { canAssignVicePrincipal, canManageCampus } from '@/utils/school-config/schoolConfigPermissions';
import { campusCrumbs } from '@/utils/school-config/breadcrumbs';
import { YearReadOnlyNotice } from '@/components/school-config/YearReadOnlyNotice';
import '@/styles/modules/school-config.css';

function PersonRow({ person, sub }) {
  return (
    <li className="sc-person">
      <Avatar user={person} size="sm" />
      <div className="sc-person__text">
        <div className="fw-600">{person.fullName}</div>
        <div className="text-xs muted">{sub || person.email}</div>
      </div>
    </li>
  );
}

/** #22 Campus Detail: a campus with its classes and kitchen. */
export default function CampusDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { schoolYear, yearReadOnly } = useSchoolYear();
  const md = useMasterData();
  const { detail, loading, error, reload } = useCampusDetail(id, schoolYear);
  const [staffId, setStaffId] = useState(null);

  if (error?.status === 403)
    return (
      <div className="page">
        <Breadcrumb items={campusCrumbs('Chi tiết')} />
        <h1 className="page__title">Điểm trường</h1>
        <ScNoAccess description="Bạn chỉ xem được điểm trường được phân công." />
      </div>
    );

  const campus = detail?.campus;
  const ageGroupName = (gid) => (detail?.ageGroups || []).find((g) => g.id === gid)?.shortName;

  return (
    <div className="page">
      <Breadcrumb items={campusCrumbs(campus?.shortName || 'Chi tiết')} />
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading || !detail ? (
        <LoadingState />
      ) : (
        <>
          <div className="page__head">
            <div className="row row--wrap gap-3">
              <h1 className="page__title">{campus.shortName}</h1>
              {campus.isMain && (
                <span className="chip chip--teal chip--lg">
                  <Star size={14} /> Điểm trường chính
                </span>
              )}
            </div>
            {canManageCampus(user) && !yearReadOnly && (
              <Link className="btn" to={`/school/campuses/${campus.id}/edit`}>
                <Pencil size={16} /> Sửa điểm trường
              </Link>
            )}
          </div>
          <YearReadOnlyNotice />

          <div className="split-2">
            <section className="card">
              <div className="card__header">
                <h2 className="card__title">Thông tin chung</h2>
              </div>
              <div className="card__body">
                <dl className="info-list">
                  <dt>Mã</dt>
                  <dd className="fw-600">{campus.code}</dd>
                  <dt>Tên đầy đủ</dt>
                  <dd>{campus.name}</dd>
                  <dt>Địa chỉ</dt>
                  <dd>{campus.address}</dd>
                  <dt>Điện thoại</dt>
                  <dd>{campus.phone || '—'}</dd>
                  <dt>Số lớp ({schoolYear})</dt>
                  <dd>{detail.classes.length}</dd>
                  <dt>Số trẻ</dt>
                  <dd>{detail.classes.reduce((s, c) => s + c.childCount, 0)}</dd>
                  <dt>Giáo viên</dt>
                  <dd>{detail.teachers.length}</dd>
                </dl>
              </div>
            </section>

            <div className="stack gap-4">
              <section className="card">
                <div className="card__header">
                  <h2 className="card__title row gap-2">
                    <UserCog size={18} /> Phó hiệu trưởng phụ trách
                  </h2>
                  {canAssignVicePrincipal(user) && (
                    <Link className="link-btn" to="/school/vice-principals">
                      Phân công
                    </Link>
                  )}
                </div>
                <div className="card__body">
                  {detail.vicePrincipals.length ? (
                    <ul className="sc-people">
                      {detail.vicePrincipals.map((v) => (
                        <PersonRow key={v.id} person={v} />
                      ))}
                    </ul>
                  ) : (
                    <UnassignedBadge label="Chưa phân công Phó hiệu trưởng" />
                  )}
                </div>
              </section>

              <section className="card">
                <div className="card__header">
                  <h2 className="card__title row gap-2">
                    <ChefHat size={18} /> Bếp ăn
                  </h2>
                </div>
                <div className="card__body">
                  {detail.kitchen.locations.length ? (
                    detail.kitchen.locations.map((l) => (
                      <div key={l.id} className="fw-600 mb-8">
                        {l.name}
                        {l.room ? ` · ${l.room}` : ''}
                      </div>
                    ))
                  ) : (
                    <div className="alert alert--warning mb-8">
                      <ChefHat size={18} />
                      <div>Điểm trường chưa có bếp. Mỗi điểm trường cần đúng một bếp ăn.</div>
                    </div>
                  )}
                  {detail.kitchen.staff.length ? (
                    <ul className="sc-people">
                      {detail.kitchen.staff.map((s) => (
                        <PersonRow key={s.id} person={s} sub="Nhân viên bếp" />
                      ))}
                    </ul>
                  ) : (
                    <div className="muted text-sm">Chưa có nhân viên bếp.</div>
                  )}
                </div>
              </section>
            </div>
          </div>

          <section className="card mt-16">
            <div className="card__header">
              <h2 className="card__title row gap-2">
                <Shapes size={18} /> Lớp năm học {schoolYear}
              </h2>
              <span className="row gap-3">
                <Link className="link-btn" to={`/school/rooms?campus=${campus.id}`}>
                  Xem phòng học
                </Link>
                <Link className="link-btn" to={`/school/classes?year=${schoolYear}`}>
                  Xem nhóm tuổi & lớp
                </Link>
              </span>
            </div>
            <div className="table-wrap sc-table-flat">
              <table className="table table--grid table--compact">
                <thead>
                  <tr>
                    <th>Lớp</th>
                    <th>Nhóm tuổi</th>
                    <th>Phòng</th>
                    <th className="num">Sĩ số</th>
                    <th>Chủ nhiệm</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.classes.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <EmptyState
                          icon={Shapes}
                          title="Chưa có lớp"
                          description="Lớp của điểm trường trong năm học này sẽ hiển thị tại đây."
                        />
                      </td>
                    </tr>
                  ) : (
                    detail.classes.map((c) => (
                      <tr key={c.id}>
                        <td className="fw-600">{c.name}</td>
                        <td>{ageGroupName(c.ageGroupId) || c.ageGroupId}</td>
                        <td>{md.locationById(c.locationId)?.room || '—'}</td>
                        <td className="num nowrap">
                          <span className="row row--center gap-1">
                            <Users size={14} className="muted" /> {c.childCount}/{c.capacity}
                          </span>
                        </td>
                        <td>
                          {/* Bấm tên giáo viên chủ nhiệm để xem nhanh thông tin, không rời trang */}
                          {c.homeroomTeacherId ? (
                            <button type="button" className="link-btn" onClick={() => setStaffId(c.homeroomTeacherId)}>
                              {c.homeroomTeacherName || md.userById(c.homeroomTeacherId)?.fullName || c.homeroomTeacherId}
                            </button>
                          ) : (
                            <span className="muted">Chưa phân công</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <div className="page-actions">
            <Link className="btn" to="/school/campuses">
              <ArrowLeft size={16} /> Quay lại
            </Link>
          </div>
          <StaffQuickPanel userId={staffId} classes={detail.classes} onClose={() => setStaffId(null)} />
        </>
      )}
    </div>
  );
}
