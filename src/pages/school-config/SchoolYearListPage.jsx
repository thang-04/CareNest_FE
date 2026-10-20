import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, CalendarRange, Play, Archive, Trash2, Shapes, Clock4 } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useSchoolYears } from '@/hooks/school-config/useSchoolConfig';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { RowActions } from '@/components/ui/RowActions';
import { YearStatusBadge } from '@/components/school-config/SchoolConfigBadges';
import { ScNoAccess } from '@/components/school-config/ScNoAccess';
import { closeSchoolYear, deleteSchoolYear } from '@/services/school-config/schoolConfigService';
import { ActivateYearModal, YearReadinessCard } from '@/components/school-config/YearReadiness';
import { YEAR_STATUS } from '@/models/school-config/schoolConfigConstants';
import {
  canActivateYear,
  canCloseYear,
  canConfigureSchool,
  canDeleteYear,
  canEditYear,
  canViewSchoolStructure,
} from '@/utils/school-config/schoolConfigPermissions';
import { yearCrumbs } from '@/utils/school-config/breadcrumbs';
import { formatDate } from '@/utils/format';
import '@/styles/modules/school-config.css';

/** #16 School Year List (UC 2.1). Principal configures; other school roles view. */
export default function SchoolYearListPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { years, loading, error, reload } = useSchoolYears();
  const [pending, setPending] = useState(null); // { kind, year }
  const [activating, setActivating] = useState(null);

  if (!canViewSchoolStructure(user))
    return (
      <div className="page">
        <Breadcrumb items={yearCrumbs()} />
        <h1 className="page__title">Năm học</h1>
        <ScNoAccess />
      </div>
    );

  const active = years.find((y) => y.status === YEAR_STATUS.ACTIVE);
  const ACTIONS = {
    close: {
      title: 'Kết thúc năm học',
      label: 'Kết thúc năm học',
      danger: true,
      run: closeSchoolYear,
      done: 'Đã kết thúc năm học',
      message: (y) => (
        <>
          Kết thúc năm học <b>{y.name}</b>? Lớp, phân công và dữ liệu của năm học sẽ chỉ còn xem, không sửa được nữa.
        </>
      ),
    },
    remove: {
      title: 'Xóa năm học',
      label: 'Xóa năm học',
      danger: true,
      run: deleteSchoolYear,
      done: 'Đã xóa bản ghi.',
      message: (y) => (
        <>
          Xóa năm học <b>{y.name}</b>? Chỉ xóa được năm học chưa bắt đầu và chưa có lớp.
        </>
      ),
    },
  };
  const action = pending && ACTIONS[pending.kind];

  const confirm = async () => {
    try {
      await action.run(pending.year.id, user);
      toast.success(`${action.done} ${pending.kind === 'remove' ? '' : pending.year.name}`.trim());
      setPending(null);
      reload({ silent: true });
    } catch (err) {
      setPending(null);
      toast.error(err, `Không ${action.label.toLowerCase()} được`);
    }
  };

  return (
    <div className="page">
      <Breadcrumb items={yearCrumbs()} />
      <div className="page__head">
        <h1 className="page__title">Năm học</h1>
        {canConfigureSchool(user) && (
          <Link to="/school/years/new" className="btn btn--primary btn--lg">
            <Plus size={18} /> Thêm năm học
          </Link>
        )}
      </div>

      {canConfigureSchool(user) &&
        years
          .filter((y) => y.status === YEAR_STATUS.PLANNED)
          .map((y) => <YearReadinessCard key={y.id} year={y} onActivate={setActivating} />)}

      <div className="card">
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <div className="table-wrap sc-table-flat">
            <table className="table table--grid table--compact">
              <thead>
                <tr>
                  <th>Năm học</th>
                  <th>Bắt đầu</th>
                  <th>Kết thúc</th>
                  <th className="num">Số lớp</th>
                  <th className="center">Trạng thái</th>
                  <th className="cell--actions">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows rows={3} cols={6} />
                ) : years.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState
                        icon={CalendarRange}
                        title="Chưa có năm học"
                        description="Tạo năm học trước khi cấu hình nhóm tuổi, lớp và phân công nhân sự."
                        action={
                          canConfigureSchool(user) && (
                            <Link className="btn btn--primary" to="/school/years/new">
                              <Plus size={16} /> Thêm năm học
                            </Link>
                          )
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  years.map((y) => (
                    <tr key={y.id}>
                      <td className="fw-600 text-primary">{y.name}</td>
                      <td>{formatDate(y.startDate)}</td>
                      <td>{formatDate(y.endDate)}</td>
                      <td className="num">{y.classCount}</td>
                      <td className="center">
                        <YearStatusBadge status={y.status} />
                      </td>
                      <td className="cell--actions">
                        <div className="row">
                          {canActivateYear(y, user) && (
                            <button className="btn btn--primary btn--sm" onClick={() => setActivating(y)}>
                              <Play size={15} /> Kích hoạt
                            </button>
                          )}
                          <RowActions
                            edit={canEditYear(y, user) ? { to: `/school/years/${y.id}/edit`, label: 'Sửa năm học' } : null}
                            menu={[
                              { label: 'Nhóm tuổi & lớp', icon: Shapes, to: `/school/classes?year=${y.id}` },
                              ...(canConfigureSchool(user) && y.status !== YEAR_STATUS.CLOSED
                                ? [{ label: 'Giờ chốt điểm danh', icon: Clock4, to: `/school/cutoff?year=${y.id}` }]
                                : []),
                              ...(canCloseYear(y, user)
                                ? [
                                    {
                                      label: 'Kết thúc năm học',
                                      icon: Archive,
                                      danger: true,
                                      onClick: () => setPending({ kind: 'close', year: y }),
                                    },
                                  ]
                                : []),
                              ...(canDeleteYear(y, user)
                                ? [
                                    {
                                      label: 'Xóa năm học',
                                      icon: Trash2,
                                      danger: true,
                                      onClick: () => setPending({ kind: 'remove', year: y }),
                                    },
                                  ]
                                : []),
                            ]}
                            name={y.name}
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ActivateYearModal
        year={activating}
        activeYear={active}
        onClose={() => setActivating(null)}
        onDone={() => {
          setActivating(null);
          reload({ silent: true });
        }}
      />
      <ConfirmationModal
        open={!!pending}
        title={action?.title}
        message={pending && action?.message(pending.year)}
        confirmLabel={action?.label}
        danger={action?.danger}
        onConfirm={confirm}
        onClose={() => setPending(null)}
      />
    </div>
  );
}
