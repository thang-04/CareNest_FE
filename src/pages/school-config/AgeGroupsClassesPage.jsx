import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Info, Copy } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useSchoolStructure, useSchoolYears } from '@/hooks/school-config/useSchoolConfig';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { YearStatusBadge } from '@/components/school-config/SchoolConfigBadges';
import { YearPicker } from '@/components/school-config/YearPicker';
import { ScNoAccess } from '@/components/school-config/ScNoAccess';
import { ClassFormModal } from '@/components/school-config/ClassFormModal';
import { AgeGroupFormModal } from '@/components/school-config/AgeGroupFormModal';
import { CopyClassesModal, copySourcesFor } from '@/components/school-config/CopyClassesModal';
import { ClassListSection } from '@/components/school-config/ClassListSection';
import { deleteAgeGroup, deleteClass } from '@/services/school-config/schoolConfigService';
import { canManageClasses, canViewSchoolStructure, isPrincipal } from '@/utils/school-config/schoolConfigPermissions';
import { classCrumbs } from '@/utils/school-config/breadcrumbs';
import { YEAR_STATUS, ageRangeLabel, mealSessionsLabel } from '@/models/school-config/schoolConfigConstants';
import '@/styles/modules/school-config.css';

/**
 * #18 Age Groups & Classes (SRS 4.1.3, UC 2.2). Principal configures; VP / team leader / teacher view their scope.
 * Teachers and team leaders are assigned on Teacher Assignment and only shown here.
 */
export default function AgeGroupsClassesPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { schoolYear: headerYear } = useSchoolYear();
  const [params, setParams] = useSearchParams();
  const yearId = params.get('year') || headerYear;
  // Bộ lọc nằm trên URL để tải lại trang vẫn giữ (?year=&campus=&q=&group=&status=)
  const campusId = params.get('campus') || '';
  const md = useMasterData();
  const { years, error: yearsError } = useSchoolYears();
  const { structure, loading, error, reload } = useSchoolStructure(yearId, campusId);
  const [classModal, setClassModal] = useState(null); // { cls, defaults }
  const [groupModal, setGroupModal] = useState(null); // { group }
  const [copyOpen, setCopyOpen] = useState(false);
  const [removing, setRemoving] = useState(null); // { kind, item }

  const year = structure?.year;
  const ageGroups = useMemo(() => structure?.ageGroups || [], [structure]);
  const classes = useMemo(() => structure?.classes || [], [structure]);
  const teamLeaders = useMemo(() => structure?.teamLeaders || [], [structure]);
  // Năm học đã kết thúc: chỉ xem, ẩn Thêm / Sửa / Xóa / Sao chép (SRS 4.1.3)
  const editable = canManageClasses(year, user);
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
      setRemoving(null);
      toast.error(err.message, 'Không xóa được');
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
        <div className="row" style={{ gap: 12 }}>
          <h1 className="page__title">Nhóm tuổi & lớp</h1>
          {year && <YearStatusBadge status={year.status} />}
        </div>
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

      <div className="card mb-16">
        <div className="filter-bar">
          <YearPicker years={years} value={yearId} onChange={(v) => setParams({ year: v })} />
        </div>
      </div>

      {yearsError && <ErrorState error={yearsError} />}
      {year && (
        <p className="sc-summary text-2">
          Năm học <b>{year.name}</b> · {ageGroups.length} nhóm tuổi · {classes.length} lớp
        </p>
      )}
      <div className="alert alert--info mb-16">
        <Info size={18} />
        <div>
          {year?.status === YEAR_STATUS.CLOSED
            ? `Năm học ${year.name} đã kết thúc: lớp và nhóm tuổi chỉ còn xem.`
            : principal
              ? 'Giáo viên của lớp và tổ trưởng nhóm tuổi do Phó hiệu trưởng phân công ở màn Phân công giáo viên; màn này chỉ hiển thị.'
              : 'Bạn đang xem các lớp trong phạm vi được phân công. Chỉ Hiệu trưởng được cấu hình nhóm tuổi và lớp.'}
        </div>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading && !structure ? (
        <LoadingState />
      ) : (
        <>
          <section className="card mb-16">
            <div className="card__header">
              <h2 className="card__title">Nhóm tuổi</h2>
              {editable && (
                <button className="btn btn--sm" onClick={() => setGroupModal({ group: null })}>
                  <Plus size={15} /> Thêm nhóm tuổi
                </button>
              )}
            </div>
            <div className="table-wrap sc-table-flat">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nhóm tuổi</th>
                    <th>Độ tuổi</th>
                    <th>Bữa trong ngày</th>
                    <th className="center">Sĩ số tối đa/lớp</th>
                    <th>Tổ trưởng</th>
                    <th className="center">Số lớp</th>
                    {editable && <th className="right">Thao tác</th>}
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
                        <td className="center">{g.maxClassSize ?? '—'}</td>
                        <td>
                          {teamLeaders
                            .filter((a) => a.ageGroupId === g.id)
                            .map((a) => `${md.userById(a.userId)?.fullName} (${md.campusById(a.campusId)?.shortName})`)
                            .join(', ') || <span className="muted">—</span>}
                        </td>
                        <td className="center">{count}</td>
                        {editable && (
                          <td className="right nowrap">
                            <button
                              className="icon-btn"
                              aria-label={`Thêm lớp ${g.shortName}`}
                              title="Thêm lớp"
                              onClick={() => addClass(g.id)}
                            >
                              <Plus size={17} />
                            </button>
                            <button
                              className="icon-btn"
                              aria-label={`Sửa nhóm tuổi ${g.shortName}`}
                              title="Sửa"
                              onClick={() => setGroupModal({ group: g })}
                            >
                              <Pencil size={17} />
                            </button>
                            {count === 0 && (
                              <button
                                className="icon-btn"
                                aria-label={`Xóa nhóm tuổi ${g.shortName}`}
                                title="Xóa"
                                onClick={() => setRemoving({ kind: 'group', item: g })}
                              >
                                <Trash2 size={17} />
                              </button>
                            )}
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
            teamLeaders={teamLeaders}
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
        onClose={() => setRemoving(null)}
      />
    </div>
  );
}
