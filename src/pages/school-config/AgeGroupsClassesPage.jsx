import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Trash2, Info, Copy, UserCheck } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useConfigYear } from '@/hooks/school-config/useConfigYear';
import { useMasterData } from '@/hooks/useMasterData';
import { useSchoolStructure, useSchoolYears } from '@/hooks/school-config/useSchoolConfig';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { RowActions } from '@/components/ui/RowActions';
import { ScNoAccess } from '@/components/school-config/ScNoAccess';
import { ClassFormModal } from '@/components/school-config/ClassFormModal';
import { AgeGroupFormModal } from '@/components/school-config/AgeGroupFormModal';
import { CopyClassesModal, copySourcesFor } from '@/components/school-config/CopyClassesModal';
import { ClassListSection } from '@/components/school-config/ClassListSection';
import { deleteAgeGroup, deleteClass } from '@/services/school-config/schoolConfigService';
import {
  ASSIGN_TEACHER,
  canManageClasses,
  canViewSchoolStructure,
  canViewTeamLeaders,
  isPrincipal,
  permissionAccess,
} from '@/utils/school-config/schoolConfigPermissions';
import { classCrumbs } from '@/utils/school-config/breadcrumbs';
import { PERMISSION_ACCESS, YEAR_STATUS, ageRangeLabel, mealSessionsLabel } from '@/models/school-config/schoolConfigConstants';
import '@/styles/modules/school-config.css';

/**
 * #18 Age Groups & Classes (SRS 4.1.3, UC 2.2). Principal configures; VP / team leader / teacher view their scope.
 * Teachers and team leaders are assigned on Teacher Assignment and only shown here.
 */
/** embedded: nằm trong Thiết lập năm học, bỏ nút dẫn sang màn phân công (đã là bước kế tiếp) */
export default function AgeGroupsClassesPage({ embedded = false }) {
  const { user } = useAuth();
  const toast = useToast();
  const [params] = useSearchParams();
  const yearId = useConfigYear();
  // Bộ lọc nằm trên URL để tải lại trang vẫn giữ (?campus=&q=&group=&status=); năm học theo header
  const campusId = params.get('campus') || '';
  const md = useMasterData();
  const { years, error: yearsError } = useSchoolYears();
  const { structure, loading, error, reload } = useSchoolStructure(yearId, campusId);
  const [classModal, setClassModal] = useState(null); // { cls, defaults }
  const [groupModal, setGroupModal] = useState(null); // { group }
  const [copyOpen, setCopyOpen] = useState(false);
  const [removing, setRemoving] = useState(null); // { kind, item }
  const [removeError, setRemoveError] = useState('');

  const year = structure?.year;
  const ageGroups = useMemo(() => structure?.ageGroups || [], [structure]);
  const classes = useMemo(() => structure?.classes || [], [structure]);
  const teamLeaders = useMemo(() => structure?.teamLeaders || [], [structure]);
  // Năm học đã kết thúc: chỉ xem, ẩn Thêm / Sửa / Xóa / Sao chép (SRS 4.1.3)
  const editable = canManageClasses(year, user);
  // Nút sang màn Phân công giáo viên: theo từng quyền (phân công giáo viên / phân công tổ trưởng)
  const canAssignTeacherArea = permissionAccess(user, ASSIGN_TEACHER).access !== PERMISSION_ACCESS.NONE;
  const canLeaders = canViewTeamLeaders(user);
  const assignUrl = (hash = '') => `/school/teachers${yearId ? `?year=${yearId}` : ''}${hash}`;
  const principal = isPrincipal(user);
  const canCopy = editable && copySourcesFor(years, year).length > 0;
  // Principal sees both campuses; other roles only the campus of their scope (GBR-GEN-01).
  const campuses = principal ? md.campuses : md.campuses.filter((c) => c.id === user?.campusId);

  if (!canViewSchoolStructure(user))
    return (
      <div className="page">
        <Breadcrumb items={classCrumbs()} />
        <h1 className="page__title">Nhóm tuổi & lớp</h1>
        <ScNoAccess />
      </div>
    );

  const confirmRemove = async () => {
    try {
      if (removing.kind === 'class') await deleteClass(removing.item.id, user);
      else await deleteAgeGroup(removing.item.id, user);
      toast.success('Đã xóa bản ghi.');
      setRemoving(null);
      reload({ silent: true });
    } catch (err) {
      setRemoveError(err.message);
    }
  };

  const closeModal = (setter) => (changed) => {
    setter(null);
    if (changed) reload({ silent: true });
  };
  const closeCopy = (changed) => {
    setCopyOpen(false);
    if (changed) reload({ silent: true });
  };

  const addClass = (ageGroupId) => setClassModal({ cls: null, defaults: { campusId, ageGroupId } });

  return (
    <div className="page">
      <Breadcrumb items={classCrumbs()} />
      <div className="page__head">
        <h1 className="page__title">Nhóm tuổi & lớp</h1>
        {editable && (
          <div className="row row--wrap">
            {canCopy && (
              <button className="btn btn--lg" onClick={() => setCopyOpen(true)}>
                <Copy size={18} /> Sao chép từ năm khác
              </button>
            )}
            <button className="btn btn--primary btn--lg" onClick={() => addClass('')}>
              <Plus size={18} /> Thêm lớp
            </button>
          </div>
        )}
      </div>

      {yearsError && <ErrorState error={yearsError} />}
      {year?.status === YEAR_STATUS.CLOSED && (
        <div className="alert alert--info mb-16">
          <Info size={18} />
          <div>Năm học {year.name} đã kết thúc: lớp và nhóm tuổi chỉ còn xem.</div>
        </div>
      )}

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading && !structure ? (
        <LoadingState />
      ) : (
        <>
          <section className="card mb-16">
            <div className="card__header">
              <h2 className="card__title">Nhóm tuổi</h2>
              <div className="row row--wrap">
                {/* Giáo viên và tổ trưởng cùng ở màn Phân công giáo viên ⇒ một nút (Cần 30/10/2026); nhãn theo quyền đang có */}
                {!embedded && (canAssignTeacherArea || canLeaders) && (
                  <Link className="btn btn--sm" to={canAssignTeacherArea ? assignUrl() : assignUrl('#to-truong')}>
                    <UserCheck size={15} />{' '}
                    {canAssignTeacherArea && canLeaders
                      ? 'Phân công giáo viên & tổ trưởng'
                      : canAssignTeacherArea
                        ? 'Phân công giáo viên'
                        : 'Phân công tổ trưởng'}
                  </Link>
                )}
                {editable && (
                  <button className="btn btn--sm" onClick={() => setGroupModal({ group: null })}>
                    <Plus size={15} /> Thêm nhóm tuổi
                  </button>
                )}
              </div>
            </div>
            <div className="table-wrap sc-table-flat">
              <table className="table table--grid table--compact">
                <thead>
                  <tr>
                    <th>Nhóm tuổi</th>
                    <th>Độ tuổi</th>
                    <th>Bữa trong ngày</th>
                    <th className="num">Sĩ số tối đa/lớp</th>
                    <th>Tổ trưởng</th>
                    <th className="num">Số lớp</th>
                    {editable && <th className="cell--actions">Thao tác</th>}
                  </tr>
                </thead>
                <tbody>
                  {ageGroups.map((g) => {
                    const count = classes.filter((c) => c.ageGroupId === g.id).length;
                    return (
                      <tr key={g.id}>
                        <td className="fw-600">{g.name}</td>
                        <td>{ageRangeLabel(g)}</td>
                        <td>{mealSessionsLabel(g)}</td>
                        <td className="num">{g.maxClassSize ?? '—'}</td>
                        <td>
                          {teamLeaders
                            .filter((a) => a.ageGroupId === g.id)
                            .map(
                              (a) =>
                                `${a.fullName || md.userById(a.userId)?.fullName || '—'} (${md.campusById(a.campusId)?.shortName || '—'})`,
                            )
                            .join(', ') || <span className="muted">—</span>}
                        </td>
                        <td className="num">{count}</td>
                        {editable && (
                          <td className="cell--actions">
                            <RowActions
                              edit={{ onClick: () => setGroupModal({ group: g }), label: 'Sửa nhóm tuổi' }}
                              menu={[
                                { label: 'Thêm lớp', icon: Plus, onClick: () => addClass(g.id) },
                                ...(count === 0
                                  ? [
                                      {
                                        label: 'Xóa nhóm tuổi',
                                        icon: Trash2,
                                        danger: true,
                                        onClick: () => setRemoving({ kind: 'group', item: g }),
                                      },
                                    ]
                                  : []),
                              ]}
                              name={g.shortName}
                            />
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <ClassListSection
            year={year}
            campuses={campuses}
            ageGroups={ageGroups}
            classes={classes}
            groupStats={structure?.groupStats}
            loading={loading}
            editable={editable}
            principal={principal}
            canCopy={canCopy}
            onAdd={addClass}
            onEdit={(c) => setClassModal({ cls: c, defaults: null })}
            onDelete={(c) => setRemoving({ kind: 'class', item: c })}
            onCopy={() => setCopyOpen(true)}
            onChanged={() => reload({ silent: true })}
          />
        </>
      )}

      <ClassFormModal
        open={!!classModal}
        onClose={closeModal(setClassModal)}
        cls={classModal?.cls}
        defaults={classModal?.defaults}
        schoolYear={yearId}
        yearName={year?.name}
        campuses={md.campuses}
        ageGroups={ageGroups}
        locations={md.locations}
        existing={classes}
      />
      <AgeGroupFormModal
        open={!!groupModal}
        onClose={closeModal(setGroupModal)}
        group={groupModal?.group}
        existing={ageGroups}
        classes={classes}
        yearName={year?.name}
      />
      <CopyClassesModal open={copyOpen} onClose={closeCopy} target={year} years={years} />
      <ConfirmationModal
        open={!!removing}
        title={removing?.kind === 'class' ? 'Xóa lớp' : 'Xóa nhóm tuổi'}
        message={
          removing && (
            <>
              Xóa {removing.kind === 'class' ? 'lớp' : 'nhóm tuổi'} <b>{removing.item.name}</b>?{' '}
              {removing.kind === 'class'
                ? 'Lớp đã có trẻ hoặc dữ liệu điểm danh, suất ăn, đánh giá sẽ không xóa được.'
                : 'Nhóm tuổi đã có lớp ở bất kỳ năm học nào sẽ không xóa được.'}
            </>
          )
        }
        confirmLabel={removing?.kind === 'class' ? 'Xóa lớp' : 'Xóa nhóm tuổi'}
        danger
        onConfirm={confirmRemove}
        error={removeError}
        onClose={() => {
          setRemoving(null);
          setRemoveError('');
        }}
      />
    </div>
  );
}
