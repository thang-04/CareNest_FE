import { useMemo, useState } from 'react';
import { AlertCircle, Filter, KeyRound, Lock, Plus, Search, Unlock, Users } from '@/components/ui/icons';
import { useCampusGuardianChildren } from '@/hooks/account/useGuardians';
import { useStaffStructure } from '@/hooks/account/useStaff';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Modal } from '@/components/ui/Modal';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { AccountStatusBadge } from '@/components/account/AccountStatusBadge';
import { AccountSlip, GuardianPanel } from '@/components/account/GuardianPanel';
import { PeopleTabs } from '@/components/account/PeopleTabs';
import { StatCardIcon } from '@/components/ui/StatCardIcon';
import { resetParentPassword, updateParentStatus } from '@/services/account/guardianService';
import { GUARDIAN_RELATIONSHIP_LABELS } from '@/models/account/guardianConstants';
import { groupChildrenByClass, missingAccount, NO_CLASS, sortMissingFirst } from '@/utils/account/guardianCoverage';
import { childrenCrumbs } from '@/utils/children/breadcrumbs';
import { formatDate, normalizeText } from '@/utils/format';
import '@/styles/modules/parent-accounts.css';

const TODO = 'todo';
// Ít lớp thì ô lọc lớp chỉ thêm rối
const CLASS_FILTER_MIN = 8;

/**
 * Tài khoản phụ huynh theo lớp (BE AUTH-18, AUTH-19): chọn điểm trường, chọn lớp, mở một bé để quản lý phụ huynh.
 * Số liệu đếm từ danh sách trẻ trong phạm vi người xem; BE vẫn áp phạm vi campus.
 */
export default function ParentActivationPage() {
  const { user } = useAuth();
  const toast = useToast();
  const structure = useStaffStructure();
  const [campusPick, setCampusPick] = useState('');
  const campusId = campusPick || (structure.campuses[0]?.id ?? '');
  const { data, loading, error, reload } = useCampusGuardianChildren(campusId, { enabled: !structure.loading });
  const [viewPick, setViewPick] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [openChild, setOpenChild] = useState(null);
  const [openWithAdd, setOpenWithAdd] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);
  const [slipModal, setSlipModal] = useState(null);

  const children = useMemo(() => data || [], [data]);
  const groups = groupChildrenByClass(
    children,
    structure.classrooms.filter((c) => !campusId || String(c.campusId) === String(campusId)),
    structure.classroomName,
  );
  const missingTotal = children.filter(missingAccount).length;
  const linkedTotal = children.length - missingTotal;
  const stats = [
    { label: 'Tổng số bé', value: children.length, tone: 'blue' },
    { label: 'Đã có tài khoản', value: linkedTotal, tone: 'green' },
    { label: 'Chưa có tài khoản', value: missingTotal, tone: 'orange' },
    { label: 'Lớp có trẻ', value: groups.filter((group) => group.id !== NO_CLASS).length, tone: 'teal' },
  ];
  const view = viewPick === TODO || groups.some((g) => g.id === viewPick) ? viewPick : groups[0]?.id || '';
  const current = groups.find((g) => g.id === view);
  const classOf = (child) => (child.classroomId ? structure.classroomName(child.classroomId) : '');
  const searching = !!keyword.trim();

  const main = searching
    ? {
        title: 'Kết quả tìm',
        sub: `Trong ${campusId ? structure.campusName(campusId) : 'phạm vi của bạn'}`,
        rows: children.filter((c) => normalizeText(c.fullName).includes(normalizeText(keyword.trim()))),
        showClass: true,
      }
    : view === TODO
      ? {
          title: 'Bé chưa có tài khoản phụ huynh',
          sub: 'Mở từng bé để nhập số điện thoại phụ huynh',
          rows: children.filter(missingAccount),
          showClass: true,
        }
      : current
        ? { title: current.name, sub: `${current.total} bé`, rows: current.children, showClass: false, group: current }
        : null;
  const rows = main ? sortMissingFirst(main.rows.filter((c) => !onlyMissing || missingAccount(c))) : [];
  const shownGroups = groups.filter((g) => !classFilter.trim() || normalizeText(g.name).includes(normalizeText(classFilter.trim())));

  const pickView = (id) => {
    setViewPick(id);
    setOnlyMissing(false);
    setKeyword('');
  };
  const pickCampus = (id) => {
    setCampusPick(id);
    setViewPick('');
    setClassFilter('');
  };
  const openChildProfile = (child, addGuardian = false) => {
    setOpenChild(child);
    setOpenWithAdd(addGuardian);
  };
  const handleChildRowClick = (event, child) => {
    if (event.target.closest('button, a, input, select, textarea')) return;
    openChildProfile(child);
  };
  const handleChildRowKeyDown = (event, child) => {
    if (event.target !== event.currentTarget || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    openChildProfile(child);
  };

  const handleConfirmAction = async () => {
    if (!confirmModal) return;
    const { type, guardian, child } = confirmModal;
    if (type === 'password') {
      try {
        const result = await resetParentPassword(guardian.userId, user);
        setConfirmModal(null);
        if (result) {
          setSlipModal({
            slip: { username: result.username, fullName: guardian.fullName, password: result.temporaryPassword }, // carenest:allow-secret
            child,
          });
        }
        reload({ silent: true });
      } catch (err) {
        setConfirmModal(null);
        toast.error(err.message || 'Không thể cấp lại mật khẩu', 'Lỗi cấp lại mật khẩu');
      }
      return;
    }
    if (type === 'status') {
      const active = guardian.status === 'ACTIVE';
      const nextStatus = active ? 'INACTIVE' : 'ACTIVE';
      try {
        await updateParentStatus(guardian.userId, nextStatus, user);
        toast.success(
          active ? `Đã khóa tài khoản phụ huynh ${guardian.fullName}.` : `Đã mở khóa tài khoản cho phụ huynh ${guardian.fullName}.`,
        );
        setConfirmModal(null);
        reload({ silent: true });
      } catch (err) {
        setConfirmModal(null);
        toast.error(err.message || 'Không thể cập nhật trạng thái', 'Lỗi trạng thái tài khoản');
      }
    }
  };

  return (
    <div className="page">
      <Breadcrumb items={childrenCrumbs('Tài khoản phụ huynh')} />
      <div className="pa-head">
        <div className="pa-head__title">
          <h1 className="page__title">Tài khoản phụ huynh</h1>
          <p className="text-sm text-2">Tra cứu theo lớp để xem và quản lý tài khoản phụ huynh của từng bé.</p>
        </div>
        <label className="search-box pa-head__search">
          <Search size={17} className="muted" />
          <input
            placeholder="Tìm bé theo tên"
            value={keyword}
            maxLength={100}
            onChange={(e) => setKeyword(e.target.value)}
            aria-label="Tìm bé theo tên"
          />
        </label>
      </div>

      {!loading && !error && !structure.loading && !structure.error && (
        <div className="stat-grid people-stats" aria-label="Tổng quan tài khoản phụ huynh">
          {stats.map((stat) => (
            <div key={stat.label} className={`stat-card stat-card--${stat.tone}`}>
              <span className="stat-card__value">{stat.value}</span>
              <span className="stat-card__label">{stat.label}</span>
              <StatCardIcon tone={stat.tone} />
            </div>
          ))}
        </div>
      )}

      {missingTotal > 0 && (
        <div className="pa-todo" role="status">
          <AlertCircle size={18} />
          <b>Cần xử lý:</b>
          <button type="button" aria-pressed={view === TODO && !searching} onClick={() => pickView(TODO)}>
            {missingTotal} bé chưa có tài khoản phụ huynh
          </button>
        </div>
      )}

      {error || structure.error ? (
        <section className="card pa-state-panel">
          <PeopleTabs embedded />
          <ErrorState error={error || structure.error} onRetry={error ? reload : structure.reload} />
        </section>
      ) : loading || structure.loading ? (
        <section className="card pa-state-panel">
          <PeopleTabs embedded />
          <LoadingState />
        </section>
      ) : !groups.length ? (
        <section className="card pa-state-panel">
          <PeopleTabs embedded />
          <EmptyState icon={Users} title="Chưa có bé nào" description="Chỉ hiện bé đang học trong phạm vi bạn phụ trách." />
        </section>
      ) : (
        <section className="card people-list-workspace pa-workspace">
          <PeopleTabs embedded />
          <div className="pa-layout">
            <section className="pa-classes" aria-label="Lớp">
              <div className="pa-classes__toolbar">
                {structure.campuses.length > 1 && (
                  <div className="pa-seg" role="group" aria-label="Điểm trường">
                    {structure.campuses.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        title={c.name}
                        aria-pressed={String(c.id) === String(campusId)}
                        onClick={() => pickCampus(c.id)}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
                {groups.length >= CLASS_FILTER_MIN && (
                  <label className="search-box pa-classes__filter">
                    <Filter size={16} className="muted" />
                    <input
                      placeholder="Lọc lớp"
                      value={classFilter}
                      maxLength={50}
                      onChange={(e) => setClassFilter(e.target.value)}
                      aria-label="Lọc lớp"
                    />
                  </label>
                )}
              </div>
              <div className="pa-classlist">
                {shownGroups.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    className="pa-class"
                    aria-current={!searching && view === g.id}
                    onClick={() => pickView(g.id)}
                  >
                    <span className="pa-class__top">
                      <span className="pa-class__name">{g.name}</span>
                      {g.missing > 0 && <span className="pa-dot" aria-label="Còn bé chưa có tài khoản" />}
                      <span className="pa-class__count">{g.total} bé</span>
                    </span>
                    <span className="pa-bar" aria-hidden="true">
                      <i style={{ width: `${Math.round((g.withAccount / g.total) * 100)}%` }} />
                    </span>
                    <span className="pa-class__sub">{g.missing ? `${g.missing} bé chưa có tài khoản` : 'Đủ tài khoản'}</span>
                  </button>
                ))}
                {!shownGroups.length && <p className="text-sm text-2 pa-classes__none">Không có lớp khớp “{classFilter}”.</p>}
              </div>
            </section>

            <section className="pa-main">
              {main && (
                <>
                  <div className="pa-main__head">
                    <div>
                      <h2 className="pa-main__title">{main.title}</h2>
                      <div className="text-sm text-2">{main.sub}</div>
                    </div>
                    {main.group && (
                      <div className="pa-main__progress">
                        <span className="text-sm text-2">Có tài khoản phụ huynh</span>
                        <ProgressBar value={main.group.withAccount} total={main.group.total} />
                      </div>
                    )}
                  </div>

                  {main.group && main.group.missing > 0 && (
                    <div className="pa-chips" role="group" aria-label="Lọc bé">
                      <button type="button" className="pa-chip" aria-pressed={!onlyMissing} onClick={() => setOnlyMissing(false)}>
                        Tất cả · {main.group.total}
                      </button>
                      <button type="button" className="pa-chip" aria-pressed={onlyMissing} onClick={() => setOnlyMissing(true)}>
                        Chưa có tài khoản · {main.group.missing}
                      </button>
                    </div>
                  )}

                  {!rows.length ? (
                    <EmptyState
                      icon={Users}
                      title={searching ? 'Không tìm thấy bé' : 'Không có bé nào'}
                      description={searching ? 'Thử tên khác hoặc đổi điểm trường.' : ''}
                    />
                  ) : (
                    <div className="table-wrap">
                      <table className="table pa-table">
                        <thead>
                          <tr>
                            <th>Bé</th>
                            {main.showClass && <th className="pa-col-class">Lớp</th>}
                            <th>Phụ huynh & Tài khoản</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((child) => (
                            <tr
                              key={child.id}
                              tabIndex={0}
                              aria-label={`Mở hồ sơ phụ huynh của bé ${child.fullName}`}
                              onClick={(event) => handleChildRowClick(event, child)}
                              onKeyDown={(event) => handleChildRowKeyDown(event, child)}
                            >
                              <td>
                                <button type="button" className="pa-kid text-left" onClick={() => openChildProfile(child)}>
                                  {child.fullName}
                                </button>
                                <div className="text-xs muted">{formatDate(child.dateOfBirth)}</div>
                              </td>
                              {main.showClass && (
                                <td className="pa-col-class">{classOf(child) || <span className="muted">Chưa xếp lớp</span>}</td>
                              )}
                              <td>
                                {child.guardians && child.guardians.length > 0 ? (
                                  <div className="pa-guardian-list">
                                    {child.guardians.map((g) => {
                                      const active = g.status === 'ACTIVE';
                                      const rel = GUARDIAN_RELATIONSHIP_LABELS[g.relationship] || 'Phụ huynh';
                                      return (
                                        <div key={g.userId} className="pa-guardian-item">
                                          <div className="pa-guardian-info">
                                            <button
                                              type="button"
                                              className="pa-guardian-name pa-guardian-name--button"
                                              aria-label={`Mở hồ sơ của bé ${child.fullName}, phụ huynh ${g.fullName}`}
                                              onClick={() => openChildProfile(child)}
                                            >
                                              {g.fullName}
                                            </button>
                                            <div className="pa-guardian-meta">
                                              <span>{rel}</span>
                                              <span>Tài khoản: {g.username}</span>
                                            </div>
                                          </div>
                                          <AccountStatusBadge status={g.status} />
                                          <div className="pa-guardian-actions">
                                            <button
                                              type="button"
                                              className="btn btn--sm"
                                              title="Cấp lại mật khẩu tạm"
                                              onClick={() => setConfirmModal({ type: 'password', guardian: g, child })}
                                            >
                                              <KeyRound size={13} /> Cấp lại MK
                                            </button>
                                            <button
                                              type="button"
                                              className={`btn btn--sm ${active ? 'btn--outline-danger' : 'btn--outline-success'}`}
                                              title={active ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                                              onClick={() => setConfirmModal({ type: 'status', guardian: g, child })}
                                            >
                                              {active ? <Lock size={13} /> : <Unlock size={13} />} {active ? 'Khóa' : 'Mở'}
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="pa-empty-actions">
                                    <span className="pa-status pa-status--missing">Chưa có tài khoản</span>
                                    <button
                                      type="button"
                                      className="btn btn--sm btn--primary"
                                      onClick={() => {
                                        openChildProfile(child, true);
                                      }}
                                    >
                                      <Plus size={13} /> Thêm phụ huynh
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        </section>
      )}

      {/* Modal chi tiết phụ huynh */}
      {openChild && (
        <Modal
          open={!!openChild}
          title={`Phụ huynh của bé ${openChild.fullName}`}
          size="lg"
          className="pa-guardian-modal"
          onClose={() => {
            setOpenChild(null);
            setOpenWithAdd(false);
          }}
        >
          <GuardianPanel
            key={openChild.id}
            child={openChild}
            classroomName={classOf(openChild)}
            initialAdding={openWithAdd}
            isModal
            onChanged={() => reload({ silent: true })}
          />
        </Modal>
      )}

      {/* Modal xác nhận thao tác Cấp lại MK hoặc Khóa/Mở */}
      {confirmModal && (
        <ConfirmationModal
          open={!!confirmModal}
          title={
            confirmModal.type === 'password'
              ? `Cấp lại mật khẩu cho ${confirmModal.guardian.fullName}?`
              : confirmModal.guardian.status === 'ACTIVE'
                ? `Khóa tài khoản ${confirmModal.guardian.fullName}?`
                : `Mở khóa tài khoản ${confirmModal.guardian.fullName}?`
          }
          message={
            confirmModal.type === 'password'
              ? `Hệ thống sẽ tạo một mật khẩu tạm ngẫu nhiên mới và vô hiệu mật khẩu cũ của phụ huynh ${confirmModal.guardian.fullName}. Bạn có thể in hoặc sao chép phiếu mật khẩu ngay sau thao tác.`
              : confirmModal.guardian.status === 'ACTIVE'
                ? `Khóa tài khoản phụ huynh ${confirmModal.guardian.fullName}? Người này sẽ không đăng nhập vào ứng dụng được cho tới khi mở lại.`
                : `Mở khóa tài khoản cho phụ huynh ${confirmModal.guardian.fullName}? Người này sẽ có thể đăng nhập lại vào ứng dụng CareNest.`
          }
          danger={confirmModal.type === 'status' && confirmModal.guardian.status === 'ACTIVE'}
          confirmLabel={
            confirmModal.type === 'password' ? 'Cấp lại mật khẩu' : confirmModal.guardian.status === 'ACTIVE' ? 'Khóa tài khoản' : 'Mở khóa'
          }
          onConfirm={handleConfirmAction}
          onClose={() => setConfirmModal(null)}
        />
      )}

      {/* Modal phiếu in mật khẩu tạm */}
      {slipModal && (
        <AccountSlip
          slip={slipModal.slip}
          child={slipModal.child}
          classroomName={classOf(slipModal.child)}
          onClose={() => setSlipModal(null)}
        />
      )}
    </div>
  );
}
