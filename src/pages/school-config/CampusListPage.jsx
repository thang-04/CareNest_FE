import { Link, useNavigate } from 'react-router-dom';
import { Plus, Building2, Star } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useCampusList } from '@/hooks/school-config/useSchoolConfig';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { RowActions } from '@/components/ui/RowActions';
import { ScNoAccess } from '@/components/school-config/ScNoAccess';
import { UnassignedBadge } from '@/components/school-config/SchoolConfigBadges';
import { canListCampuses, canManageCampus } from '@/utils/school-config/schoolConfigPermissions';
import { campusCrumbs } from '@/utils/school-config/breadcrumbs';
import { YearReadOnlyNotice } from '@/components/school-config/YearReadOnlyNotice';
import '@/styles/modules/school-config.css';

/** #20 Campus List (UC 2.3). Principal manages; a Vice Principal sees the assigned campus. */
export default function CampusListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { schoolYear, yearReadOnly } = useSchoolYear();
  const { campuses, loading, error, reload } = useCampusList(schoolYear);
  const manage = canManageCampus(user) && !yearReadOnly;

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
      <YearReadOnlyNotice />

      <div className="card">
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <div className="table-wrap sc-table-flat">
            <table className="table table--grid table--compact">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Điểm trường</th>
                  <th>Địa chỉ</th>
                  <th>Phó hiệu trưởng phụ trách</th>
                  <th className="num">Lớp ({schoolYear})</th>
                  <th className="num">Trẻ</th>
                  <th className="cell--actions">Thao tác</th>
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
                        {c.vicePrincipals.length ? c.vicePrincipals.map((v) => <div key={v.id}>{v.fullName}</div>) : <UnassignedBadge />}
                      </td>
                      <td className="num">{c.classCount}</td>
                      <td className="num">{c.childCount}</td>
                      <td className="cell--actions" onClick={(e) => e.stopPropagation()}>
                        <RowActions
                          view={{ to: `/school/campuses/${c.id}` }}
                          edit={manage ? { to: `/school/campuses/${c.id}/edit` } : null}
                          name={c.shortName}
                        />
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
