import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building, Search, UserPlus, Users } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useStaffAccounts, useStaffRoster, useStaffStructure } from '@/hooks/account/useStaff';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Pagination } from '@/components/ui/Pagination';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/form/FormField';
import { PeopleTabs } from '@/components/account/PeopleTabs';
import { StaffSummaryCards } from '@/components/account/StaffSummaryCards';
import { AccountStatusBadge } from '@/components/account/AccountStatusBadge';
import { EndAssignmentModal } from '@/components/account/StaffDialogs';
import { StaffFormModal } from '@/pages/school-config/StaffFormPage';
import { PEOPLE_CONTRACT_READY, USE_MOCK } from '@/config/env';
import { assignStaff, endAssignment } from '@/services/account/staffService';
import { PERMISSIONS } from '@/models/account/permissionConstants';
import { staffCrumbs } from '@/utils/school-config/breadcrumbs';
import { formatDate, todayInput } from '@/utils/format';
import '@/styles/modules/staff-hub.css';

const CANDIDATE_PAGE_SIZE = 20;

function AssignmentPeople({ people, scope, canEnd, onEnd }) {
  if (!people.length) return <span className="sh-roster__empty">Chưa có phân công</span>;
  return (
    <ul className="sh-roster__people">
      {people.map((person) => (
        <li key={person.assignmentId}>
          <span className="sh-roster__person-details">
            <Link className="sh-roster__person-name" to={`/school/staff/${person.userId}`}>
              {person.fullName}
            </Link>
            <small>Từ {formatDate(person.validFrom)}</small>
          </span>
          <AccountStatusBadge status={person.status} />
          {canEnd && (
            <button className="btn btn--sm" type="button" onClick={() => onEnd(person, scope)}>
              Kết thúc
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function StaffAssignmentTable({ people, scope, canEnd, onEnd }) {
  if (!people.length) return <div className="sh-roster__empty">Chưa có phân công tại điểm trường này.</div>;
  return (
    <div className="table-wrap">
      <table className="table sh-roster__table">
        <thead>
          <tr>
            <th>Nhân sự</th>
            <th>Trạng thái tài khoản</th>
            {canEnd && <th className="text-right">Thao tác</th>}
          </tr>
        </thead>
        <tbody>
          {people.map((person) => (
            <tr key={person.assignmentId}>
              <td>
                <Link className="sh-roster__person-name" to={`/school/staff/${person.userId}`}>
                  {person.fullName}
                </Link>
                <small>Từ {formatDate(person.validFrom)}</small>
              </td>
              <td>
                <AccountStatusBadge status={person.status} />
              </td>
              {canEnd && (
                <td className="text-right">
                  <button className="btn btn--sm" type="button" onClick={() => onEnd(person, scope)}>
                    Kết thúc
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AssignFromPlaceModal({ place, campusId, onClose, onSaved, onCreate }) {
  const { user, hasPermission } = useAuth();
  const toast = useToast();
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [personId, setPersonId] = useState('');
  const [validFrom, setValidFrom] = useState(todayInput());
  const [saving, setSaving] = useState(false);
  const { data, loading, error, reload } = useStaffAccounts({
    role: place.role,
    q: query,
    staffOnly: true,
    page,
    size: CANDIDATE_PAGE_SIZE,
  });
  const canCreate = hasPermission(PERMISSIONS.ACCOUNT_MANAGE);
  const selectedCandidate =
    !!personId &&
    !loading &&
    !error &&
    !!data?.items?.some(
      (person) =>
        String(person.userId) === String(personId) &&
        String(person.userId) !== String(user?.id) &&
        !place.existingUserIds?.includes(String(person.userId)),
    );
  const submit = async () => {
    if (!selectedCandidate || !validFrom) return;
    setSaving(true);
    try {
      await assignStaff(
        place.classroomId ? { userId: personId, classroomId: place.classroomId, validFrom } : { userId: personId, campusId, validFrom },
        user,
      );
      toast.success('Đã thêm phân công.');
      onSaved();
    } catch (err) {
      toast.error(err.message, 'Không phân công được');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      size="lg"
      title={`Phân công vào ${place.label}`}
      onClose={saving ? undefined : onClose}
      footer={
        <>
          <button className="btn" type="button" disabled={saving} onClick={onClose}>
            Hủy
          </button>
          <button className="btn btn--primary" type="button" disabled={!selectedCandidate || !validFrom || saving} onClick={submit}>
            Lưu phân công
          </button>
        </>
      }
    >
      <p className="text-sm text-2">Chọn người có chức vụ phù hợp. BE sẽ kiểm tra quyền và phạm vi trước khi lưu.</p>
      <form
        className="sh-roster__search"
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(draft.trim());
          setPage(0);
          setPersonId('');
        }}
      >
        <label className="search-box">
          <Search size={16} className="muted" />
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            aria-label="Tìm nhân sự để phân công"
            placeholder="Tìm tên hoặc tài khoản"
          />
        </label>
        <button className="btn" type="submit">
          Tìm
        </button>
      </form>
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading ? (
        <LoadingState />
      ) : !data?.items?.length ? (
        <EmptyState icon={Users} title="Không có nhân sự phù hợp" description="Thử từ khóa khác hoặc tạo tài khoản nhân sự mới." />
      ) : (
        <>
          <div className="sh-roster__candidates" role="radiogroup" aria-label="Chọn nhân sự">
            {data.items.map((person) => (
              <label key={person.userId} className="sh-roster__candidate">
                <input
                  type="radio"
                  name="staff-candidate"
                  checked={String(personId) === String(person.userId)}
                  disabled={String(person.userId) === String(user?.id) || !!place.existingUserIds?.includes(String(person.userId))}
                  onChange={() => setPersonId(person.userId)}
                />
                <span>
                  <strong>{person.fullName}</strong>
                  <small>
                    {person.username} ·{' '}
                    {place.existingUserIds?.includes(String(person.userId))
                      ? 'Đã phân công ở đây'
                      : person.status === 'ACTIVE'
                        ? 'Hoạt động'
                        : 'Đã khóa'}
                  </small>
                </span>
              </label>
            ))}
          </div>
          <Pagination
            page={page + 1}
            total={data.totalElements}
            pageSize={CANDIDATE_PAGE_SIZE}
            onChange={(next) => {
              setPage(next - 1);
              setPersonId('');
            }}
            unit="nhân sự"
          />
        </>
      )}
      <FormField label="Bắt đầu từ ngày" required>
        <input className="input" type="date" value={validFrom} onChange={(event) => setValidFrom(event.target.value)} />
      </FormField>
      {canCreate && (
        <p className="text-sm">
          <button
            className="link-btn"
            type="button"
            onClick={() => onCreate({ role: place.role, campusId, classroomId: place.classroomId || '' })}
          >
            Chưa có người này? Tạo tài khoản nhân sự tại nơi đã chọn
          </button>
        </p>
      )}
    </Modal>
  );
}

function StaffRosterContent() {
  const { user, hasRole, hasPermission } = useAuth();
  const toast = useToast();
  const structure = useStaffStructure();
  const isPrincipal = hasRole('PRINCIPAL');
  const [campusPick, setCampusPick] = useState('');
  const [rosterTab, setRosterTab] = useState(() => (isPrincipal ? 'vice-principal' : 'kitchen'));
  const campusId = campusPick || structure.campuses[0]?.id;
  const { data: roster, loading, error, reload } = useStaffRoster(campusId);
  const rosterMatchesCampus = String(roster?.campusId) === String(campusId);
  const [dialog, setDialog] = useState(null);
  const canEnd = hasPermission(PERMISSIONS.STAFF_ASSIGNMENT_MANAGE);
  const campusName = structure.campusName(campusId);
  const rosterTabs = [
    ...(isPrincipal ? [{ key: 'vice-principal', label: 'Phó hiệu trưởng' }] : []),
    { key: 'kitchen', label: 'Nhân viên bếp' },
    { key: 'classrooms', label: 'Lớp học' },
  ];
  const selectedTab = rosterTabs.find((tab) => tab.key === rosterTab) || rosterTabs[0];
  const onEnd = (person, scope) => setDialog({ type: 'end', person, scope, campusId });
  const finish = async (validTo) => {
    if (String(dialog?.campusId) !== String(campusId)) return setDialog(null);
    try {
      await endAssignment(dialog.person.assignmentId, validTo, user);
      toast.success('Đã kết thúc phân công.');
      setDialog(null);
      reload({ silent: true });
    } catch (err) {
      toast.error(err.message, 'Không kết thúc được phân công');
    }
  };
  const assignButton = (role, label, classroomId, people = []) => (
    <button
      className="btn btn--sm"
      type="button"
      onClick={() =>
        setDialog({
          type: 'assign',
          campusId,
          place: { role, label, classroomId, existingUserIds: people.map((person) => String(person.userId)) },
        })
      }
    >
      <UserPlus size={15} /> Phân công
    </button>
  );

  return (
    <div className="page">
      <Breadcrumb items={staffCrumbs('Phân công theo nơi')} />
      <PeopleTabs />
      <div className="sh-head">
        <div>
          <h1>Phân công theo nơi</h1>
          <p className="text-sm text-2">Xem người đang làm ở từng điểm trường và lớp; ô trống chỉ có nghĩa chưa có phân công.</p>
        </div>
      </div>
      <StaffSummaryCards campusId={campusId} enabled={!structure.loading && !structure.error && !!campusId} />
      <nav className="sh-views" aria-label="Cách xem nhân sự">
        <Link to="/school/staff">Danh sách nhân sự</Link>
        <span className="sh-views__active" aria-current="page">
          Phân công theo nơi
        </span>
      </nav>
      {structure.error ? (
        <ErrorState error={structure.error} onRetry={structure.reload} />
      ) : structure.loading ? (
        <LoadingState />
      ) : !structure.campuses.length ? (
        <EmptyState icon={Building} title="Chưa có điểm trường" description="Không có điểm trường trong phạm vi bạn được quản lý." />
      ) : (
        <>
          <div className="sh-roster__campuses" role="group" aria-label="Chọn điểm trường">
            {structure.campuses.map((campus) => (
              <button
                key={campus.id}
                type="button"
                aria-pressed={String(campus.id) === String(campusId)}
                onClick={() => {
                  setCampusPick(campus.id);
                  setDialog(null);
                }}
              >
                {campus.name}
              </button>
            ))}
          </div>
          {error ? (
            <ErrorState error={error} onRetry={reload} />
          ) : loading || !rosterMatchesCampus ? (
            <LoadingState />
          ) : (
            <div className="sh-roster">
              <div className="sh-roster__tabs" role="group" aria-label="Nhóm phân công">
                {rosterTabs.map((tab) => (
                  <button
                    key={tab.key}
                    className={`sh-roster__tab ${selectedTab.key === tab.key ? 'sh-roster__tab--active' : ''}`}
                    type="button"
                    aria-pressed={selectedTab.key === tab.key}
                    onClick={() => setRosterTab(tab.key)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <section className="sh-roster__panel">
                <div className="sh-roster__panel-head">
                  <div>
                    <h2>{selectedTab.label}</h2>
                    <p className="text-sm text-2">{selectedTab.key === 'classrooms' ? campusName : `Đang làm việc tại ${campusName}`}</p>
                  </div>
                  {selectedTab.key === 'vice-principal' && assignButton('VICE_PRINCIPAL', campusName, null, roster.vicePrincipals)}
                  {selectedTab.key === 'kitchen' && assignButton('KITCHEN_STAFF', campusName, null, roster.kitchenStaff)}
                </div>

                {selectedTab.key === 'vice-principal' && (
                  <StaffAssignmentTable people={roster.vicePrincipals} scope={campusName} canEnd={canEnd} onEnd={onEnd} />
                )}
                {selectedTab.key === 'kitchen' && (
                  <StaffAssignmentTable people={roster.kitchenStaff} scope={campusName} canEnd={canEnd} onEnd={onEnd} />
                )}
                {selectedTab.key === 'classrooms' &&
                  (roster.classrooms.length ? (
                    <div className="table-wrap">
                      <table className="table sh-roster__table">
                        <thead>
                          <tr>
                            <th>Lớp</th>
                            <th>Giáo viên được phân công</th>
                            <th className="text-right">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody>
                          {roster.classrooms.map((room) => (
                            <tr key={room.classroomId}>
                              <td className="fw-600">{room.name}</td>
                              <td>
                                <AssignmentPeople people={room.teachers} scope={room.name} canEnd={canEnd} onEnd={onEnd} />
                              </td>
                              <td className="text-right">{assignButton('TEACHER', room.name, room.classroomId, room.teachers)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="sh-roster__empty">Chưa có lớp học tại điểm trường này.</div>
                  ))}
              </section>
            </div>
          )}
        </>
      )}
      {dialog?.type === 'assign' && (
        <AssignFromPlaceModal
          place={dialog.place}
          campusId={campusId}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            reload({ silent: true });
          }}
          onCreate={(initialValues) => setDialog({ type: 'create', initialValues, campusId })}
        />
      )}
      {dialog?.type === 'create' && (
        <StaffFormModal
          initialValues={dialog.initialValues}
          onClose={() => setDialog(null)}
          onCreated={() => {
            setDialog(null);
            reload({ silent: true });
          }}
        />
      )}
      {dialog?.type === 'end' && (
        <EndAssignmentModal
          assignment={{ id: dialog.person.assignmentId, validFrom: dialog.person.validFrom }}
          scope={dialog.scope}
          onClose={() => setDialog(null)}
          onSubmit={finish}
        />
      )}
    </div>
  );
}

export default function StaffRosterPage() {
  if (!USE_MOCK && !PEOPLE_CONTRACT_READY)
    return (
      <div className="page">
        <Breadcrumb items={staffCrumbs('Phân công theo nơi')} />
        <PeopleTabs />
        <section className="card sh-directory">
          <EmptyState
            icon={Users}
            title="Phân công theo nơi đang chờ kết nối"
            description="Danh sách phân công theo điểm trường chưa sẵn sàng trên máy chủ."
          />
        </section>
      </div>
    );
  return <StaffRosterContent />;
}
