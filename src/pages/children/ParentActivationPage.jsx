import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, Filter, KeyRound, Lock, Plus, Unlock, Users } from '@/components/ui/icons';
import { useCampusGuardianChildren } from '@/hooks/account/useGuardians';
import { useGuardianStructure } from '@/hooks/account/useGuardians';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { SearchSubmit } from '@/components/ui/SearchSubmit';
import { Modal } from '@/components/ui/Modal';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { RowActions } from '@/components/ui/RowActions';
import { AccountStatusBadge } from '@/components/account/AccountStatusBadge';
import { ParentAccountBadge } from '@/components/children/ChildBadges';
import { AccountSlip, GuardianPanel } from '@/components/account/GuardianPanel';
import { PeopleTabs } from '@/components/account/PeopleTabs';
import { StatCardIcon } from '@/components/ui/StatCardIcon';
import { IS_GUARDIAN_DEMO, resetParentPassword, updateParentStatus } from '@/services/account/guardianService';
import { getChildDetail } from '@/services/children/childrenService';
import { GUARDIAN_RELATIONSHIP_LABELS } from '@/models/account/guardianConstants';
import { groupChildrenByClass, missingAccount, NO_CLASS, sortMissingFirst } from '@/utils/account/guardianCoverage';
import { childrenCrumbs } from '@/utils/children/breadcrumbs';
import { formatDate, normalizeText } from '@/utils/format';
import '@/styles/modules/parent-accounts.css';

const TODO = 'todo';
// Ít lớp thì ô lọc lớp chỉ thêm rối
const CLASS_FILTER_MIN = 8;

// UI theo lớp từ G94-209, dữ liệu và phạm vi giữ nguồn legacy.
export default function ParentActivationPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [params] = useSearchParams();
  const targetId = params.get('childId');
  const handledTarget = useRef('');
  const structure = useGuardianStructure();
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
  useEffect(() => {
    if (!targetId || handledTarget.current === targetId || structure.loading || structure.error) return;
    let cancelled = false;
    getChildDetail(targetId, user)
      .then((detail) => {
        if (!cancelled) setCampusPick(detail.child.campusId);
      })
      .catch((err) => {
        if (!cancelled) {
          handledTarget.current = targetId;
          toast.error(err.message || 'Không thể mở hồ sơ phụ huynh.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [targetId, user, structure.loading, structure.error, toast]);
  useEffect(() => {
    const child = children.find((row) => row.id === targetId);
    if (!child || handledTarget.current === targetId || loading) return;
    handledTarget.current = targetId;
    setViewPick(child.classroomId || NO_CLASS);
    setOpenChild(child);
  }, [children, targetId, loading]);
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
    setOpenChild(null);
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
      {IS_GUARDIAN_DEMO && (
        <div className="alert alert--info">
          Bản demo Web: thao tác tài khoản chưa kết nối BE/App thật. Giữ phạm vi quản lý phụ huynh hiện tại của bạn.
        </div>
      )}
      <div className="pa-head">
        <div className="pa-head__title">
          <h1 className="page__title">Tài khoản phụ huynh</h1>
          <p className="text-sm text-2">Tra cứu theo lớp để xem và quản lý tài khoản phụ huynh của từng bé.</p>
        </div>
        <SearchSubmit
          className="pa-head__search"
          value={keyword}
          maxLength={100}
          placeholder="Tìm bé theo tên"
          label="Tìm bé theo tên"
          onSearch={setKeyword}
        />
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
          <button type="button" className="pa-todo__link" aria-pressed={view === TODO && !searching} onClick={() => pickView(TODO)}>
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
                        className="pa-seg__item"
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
                      <table className="table table--grid table--compact pa-table">
                        <thead>
                          <tr>
                            <th>Bé</th>
                            {main.showClass && <th className="pa-col-class">Lớp</th>}
                            <th>Phụ huynh</th>
                            <th className="pa-col-status">Tài khoản</th>
                            <th className="cell--actions pa-col-actions">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((child) => {
                            const guardians = child.guardians || [];
                            return (
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
                                {/* Mỗi phụ huynh là một dòng con cùng chiều cao ở 3 cột để trạng thái và nút thẳng hàng */}
                                <td>
                                  {guardians.length > 0 ? (
                                    guardians.map((g) => (
                                      <div key={g.userId} className="pa-line">
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
                                            <span>{GUARDIAN_RELATIONSHIP_LABELS[g.relationship] || 'Phụ huynh'}</span>
                                            <span>Tài khoản: {g.username}</span>
                                          </div>
                                        </div>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="pa-line muted">Chưa có phụ huynh</div>
                                  )}
                                </td>
                                <td className="pa-col-status">
                                  {guardians.length > 0 ? (
                                    guardians.map((g) => (
                                      <div key={g.userId} className="pa-line">
                                        <AccountStatusBadge status={g.status} />
                                      </div>
                                    ))
                                  ) : (
                                    <div className="pa-line">
                                      <ParentAccountBadge status="NO_ACCOUNT" />
                                    </div>
                                  )}
                                </td>
                                <td className="cell--actions pa-col-actions">
                                  {guardians.length > 0 ? (
                                    guardians.map((g) => {
                                      const active = g.status === 'ACTIVE';
                                      return (
                                        <div key={g.userId} className="pa-line pa-line--actions">
                                          <RowActions
                                            name={g.fullName}
                                            menu={
                                              child.canManage
                                                ? [
                                                    {
                                                      label: 'Cấp lại mật khẩu tạm',
                                                      icon: KeyRound,
                                                      onClick: () => setConfirmModal({ type: 'password', guardian: g, child }),
                                                    },
                                                    {
                                                      label: active ? 'Khóa tài khoản' : 'Mở khóa tài khoản',
                                                      icon: active ? Lock : Unlock,
                                                      danger: active,
                                                      onClick: () => setConfirmModal({ type: 'status', guardian: g, child }),
                                                    },
                                                  ]
                                                : []
                                            }
                                          />
                                        </div>
                                      );
                                    })
                                  ) : (
                                    <div className="pa-line pa-line--actions">
                                      <button
                                        type="button"
                                        className="btn btn--sm btn--primary"
                                        disabled={!child.canManage}
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
                            );
                          })}
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
          <fieldset disabled={!openChild.canManage} className="pa-guard-fieldset">
            <GuardianPanel
              key={openChild.id}
              child={openChild}
              classroomName={classOf(openChild)}
              initialAdding={openWithAdd}
              isModal
              onChanged={() => reload({ silent: true })}
            />
          </fieldset>
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
                ? `Khóa tài khoản phụ huynh ${confirmModal.guardian.fullName}? Phụ huynh không đăng nhập được App cho tới khi mở khóa.`
                : `Mở khóa tài khoản cho phụ huynh ${confirmModal.guardian.fullName}?`
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
