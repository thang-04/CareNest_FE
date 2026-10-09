import { Link, useNavigate } from 'react-router-dom';
import { Plus, Building2, Eye, Pencil, Star } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useCampusList } from '@/hooks/school-config/useSchoolConfig';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { ScNoAccess } from '@/components/school-config/ScNoAccess';
import { canListCampuses, canManageCampus } from '@/utils/school-config/schoolConfigPermissions';
import { campusCrumbs } from '@/utils/school-config/breadcrumbs';
import '@/styles/modules/school-config.css';

/** #20 Campus List (UC 2.3). Principal manages; a Vice Principal sees the assigned campus. */
export default function CampusListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { schoolYear } = useSchoolYear();
  const { campuses, loading, error, reload } = useCampusList(schoolYear);
  const manage = canManageCampus(user);

  if (!canListCampuses(user))
    return (
      <div className="page">
        <Breadcrumb items={campusCrumbs()} />
        <h1 className="page__title">Điểm trường</h1>
        <ScNoAccess />
      </div>
    );

  return (
    <div className="page">
      <Breadcrumb items={campusCrumbs()} />
      <div className="page__head">
        <h1 className="page__title">Điểm trường</h1>
        {manage && (
          <Link to="/school/campuses/new" className="btn btn--primary btn--lg">
            <Plus size={18} /> Thêm điểm trường
          </Link>
        )}
      </div>

      <div className="card">
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <div className="table-wrap sc-table-flat">
            <table className="table">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Điểm trường</th>
                  <th>Địa chỉ</th>
                  <th>Phó hiệu trưởng phụ trách</th>
                  <th className="center">Lớp ({schoolYear})</th>
                  <th className="center">Trẻ</th>
                  <th className="right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows rows={2} cols={7} />
                ) : campuses.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState
                        icon={Building2}
                        title="Chưa có điểm trường"
                        description="Thêm điểm trường chính trước khi cấu hình lớp và phân công nhân sự."
                        action={
                          manage && (
                            <Link className="btn btn--primary" to="/school/campuses/new">
                              <Plus size={16} /> Thêm điểm trường
                            </Link>
                          )
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  campuses.map((c) => (
                    <tr key={c.id} className="row-click" onClick={() => navigate(`/school/campuses/${c.id}`)}>
                      <td className="fw-600 text-primary">{c.code}</td>
                      <td>
                        <div className="fw-600">{c.shortName}</div>
                        <div className="text-xs muted sc-wrap">{c.name}</div>
                        {c.isMain && (
                          <span className="chip chip--teal mt-8">
                            <Star size={12} /> Điểm trường chính
                          </span>
                        )}
                      </td>
                      <td className="text-sm sc-wrap">{c.address}</td>
                      <td>
                        {c.vicePrincipals.length ? (
                          c.vicePrincipals.map((v) => <div key={v.id}>{v.fullName}</div>)
                        ) : (
                          <span className="chip chip--orange">Chưa phân công</span>
                        )}
                      </td>
                      <td className="center">{c.classCount}</td>
                      <td className="center">{c.childCount}</td>
                      <td className="right nowrap" onClick={(e) => e.stopPropagation()}>
                        <Link className="icon-btn" to={`/school/campuses/${c.id}`} title="Xem" aria-label={`Xem ${c.shortName}`}>
                          <Eye size={17} />
                        </Link>
                        {manage && (
                          <Link className="icon-btn" to={`/school/campuses/${c.id}/edit`} title="Sửa" aria-label={`Sửa ${c.shortName}`}>
                            <Pencil size={17} />
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
