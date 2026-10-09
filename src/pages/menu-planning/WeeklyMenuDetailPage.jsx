import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2, Send, CopyPlus, Info, AlertTriangle, Sparkles } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useAllergyContext, useMenuAccess, useMenuCatalog, useWeeklyMenu } from '@/hooks/menu-planning/useMenuPlanning';
import { createWeeklyReplacement, deleteWeeklyMenu, publishWeeklyMenu } from '@/services/menu-planning/menuPlanningService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { Modal } from '@/components/ui/Modal';
import { ProgressSteps } from '@/components/ui/ProgressSteps';
import { FormField } from '@/components/form/FormField';
import { ErrorState, LoadingState, Spinner } from '@/components/ui/States';
import { HistoryCard, WeeklyStatusBadge } from '@/components/menu-planning/MenuBadges';
import { WeekDaysView } from '@/components/menu-planning/WeekDaysView';
import { WeekChecks } from '@/components/menu-planning/WeekChecks';
import { priceOn } from '@/utils/menu-planning/menuCalculations';
import {
  canDeleteWeeklyMenu,
  canEditWeeklyMenu,
  canPublishWeeklyMenu,
  canReplaceWeeklyMenu,
} from '@/utils/menu-planning/menuPlanningPermissions';
import { weeklyCrumbs } from '@/utils/menu-planning/breadcrumbs';
import { formatDateTime } from '@/utils/format';
import { ageGroupById } from '@/models/School';
import { WEEKLY_STATUS, formatMoney, weekLabel } from '@/models/menu-planning/menuPlanningConstants';
import '@/styles/modules/menu-planning.css';

/** Screen #86 – one weekly menu with its daily menus; publish or replace (UC 6.8, GBR-MENU-01/05). */
export default function WeeklyMenuDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const md = useMasterData();
  const access = useMenuAccess();
  const { catalog, loading: catLoading } = useMenuCatalog();
  const { item: wm, loading, error, reload } = useWeeklyMenu(id);
  const { rows: allergyRows } = useAllergyContext(wm?.ageGroupId || '');
  const [modal, setModal] = useState(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  if (loading || catLoading || access.loading) return <LoadingState />;
  if (error || !wm)
    return (
      <div className="page">
        <Breadcrumb items={weeklyCrumbs('Chi tiết thực đơn tuần')} />
        <ErrorState error={error} onRetry={reload} />
      </div>
    );

  const accessData = { sharedService: access.sharedService };
  const price = priceOn(catalog.mealPrices, wm.ageGroupId, wm.weekStart)?.price;
  const published = wm.status !== WEEKLY_STATUS.DRAFT;

  const publish = async () => {
    try {
      await publishWeeklyMenu(id, user);
      toast.success('Xuất bản thực đơn thành công. Người liên quan đã được thông báo.');
      setActionError('');
    } catch (err) {
      setActionError(err.message);
    } finally {
      setModal(null);
    }
  };
  const remove = async () => {
    try {
      await deleteWeeklyMenu(id, user);
      toast.success('Đã xóa bản ghi.');
      navigate('/menu/weekly');
    } catch (err) {
      setModal(null);
      setActionError(err.message);
    }
  };
  const replace = async () => {
    if (!reason.trim()) {
      setReasonError('Trường này là bắt buộc.');
      return;
    }
    setBusy(true);
    try {
      const draft = await createWeeklyReplacement(id, reason, user);
      toast.success('Đã tạo phiên bản thay thế ở trạng thái nháp.');
      navigate(`/menu/weekly/${draft.id}/edit`);
    } catch (err) {
      toast.error(err.message, 'Không tạo được phiên bản thay thế');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <Breadcrumb items={weeklyCrumbs(wm.code)} />
      <div className="page__head">
        <div className="row" style={{ gap: 12 }}>
          <h1 className="page__title">
            Thực đơn tuần {weekLabel(wm.weekStart)} – {ageGroupById(wm.ageGroupId)?.shortName}
          </h1>
          <WeeklyStatusBadge status={wm.status} size="lg" />
        </div>
        <div className="row row--wrap td-actions">
          {canDeleteWeeklyMenu(wm, user, accessData) && (
            <button className="btn btn--outline-danger" onClick={() => setModal('delete')}>
              <Trash2 size={16} /> Xóa nháp
            </button>
          )}
          {canEditWeeklyMenu(wm, user, accessData) && (
            <Link className="btn" to={`/menu/weekly/${id}/edit`}>
              <Pencil size={16} /> Sửa
            </Link>
          )}
          {canPublishWeeklyMenu(wm, user, accessData) && (
            <button className="btn btn--primary" onClick={() => setModal('publish')}>
              <Send size={16} /> Xuất bản thực đơn
            </button>
          )}
          {canReplaceWeeklyMenu(wm, user, accessData) &&
            (wm.replacedBy ? (
              <Link className="btn btn--primary" to={`/menu/weekly/${wm.replacedBy}`}>
                <CopyPlus size={16} /> Mở phiên bản thay thế
              </Link>
            ) : (
              <button className="btn btn--primary" onClick={() => setModal('replace')}>
                <CopyPlus size={16} /> Tạo phiên bản thay thế
              </button>
            ))}
        </div>
      </div>

      <div className="card mb-16">
        <div className="card__body">
          <ProgressSteps
            steps={[
              { label: 'Lập thực đơn', sub: formatDateTime(wm.createdAt), done: true },
              { label: 'Kiểm tra & cân đối', sub: 'Phó hiệu trưởng xem lại', done: published },
              {
                label: 'Xuất bản',
                sub: wm.publishedAt ? formatDateTime(wm.publishedAt) : 'Gửi bếp, giáo viên, phụ huynh',
                done: published,
              },
            ]}
          />
        </div>
      </div>

      {actionError && (
        <div className="alert alert--danger mb-16">
          <AlertTriangle size={18} />
          <div>{actionError}</div>
        </div>
      )}
      {wm.status === WEEKLY_STATUS.DRAFT && (
        <div className="alert alert--info mb-16">
          <Info size={18} />
          <div>
            Bản nháp chưa đến bếp, giáo viên và phụ huynh. Xem lại các ngày, cân đối dinh dưỡng nếu cần rồi bấm <b>Xuất bản thực đơn</b>.
            {wm.replacesId && ' Đây là phiên bản thay thế – khi xuất bản, phiên bản đang dùng sẽ được thay và bếp được thông báo lại.'}
          </div>
        </div>
      )}
      {wm.status === WEEKLY_STATUS.REPLACED && (
        <div className="alert alert--warning mb-16">
          <Info size={18} />
          <div>
            Phiên bản này đã được thay thế. {wm.replacedBy && <Link to={`/menu/weekly/${wm.replacedBy}`}>Xem phiên bản đang áp dụng</Link>}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card__header">
          <div className="card__title">Thông tin chung</div>
        </div>
        <div className="card__body info-columns">
          <dl className="info-list">
            <dt>Mã:</dt>
            <dd className="fw-600">{wm.code}</dd>
            <dt>Nhóm tuổi:</dt>
            <dd>{ageGroupById(wm.ageGroupId)?.name}</dd>
            <dt>Tuần:</dt>
            <dd>{weekLabel(wm.weekStart)}</dd>
            <dt>Phiên bản:</dt>
            <dd>
              {wm.version}
              {wm.replacesId && (
                <>
                  {' '}
                  (thay cho <Link to={`/menu/weekly/${wm.replacesId}`}>phiên bản {wm.version - 1}</Link>)
                </>
              )}
            </dd>
          </dl>
          <dl className="info-list">
            <dt>Người lập:</dt>
            <dd>{md.userById(wm.createdBy)?.fullName || '—'}</dd>
            <dt>Xuất bản:</dt>
            <dd>
              {wm.publishedAt ? `${md.userById(wm.publishedBy)?.fullName || ''} · ${formatDateTime(wm.publishedAt)}` : 'Chưa xuất bản'}
            </dd>
            <dt>Giá suất ăn:</dt>
            <dd>{price ? `${formatMoney(price)} / trẻ / ngày` : 'Chưa có'}</dd>
            <dt>Ghi chú:</dt>
            <dd>
              {wm.note || '—'}
              {wm.aiDraftId && (
                <div className="text-sm muted">
                  <Sparkles size={13} /> Lập từ bản nháp AI đã được người dùng xem xét.
                </div>
              )}
            </dd>
          </dl>
        </div>
      </div>

      <div className="card mt-16">
        <div className="card__header">
          <div className="card__title">Thực đơn các ngày</div>
        </div>
        <WeekDaysView wm={wm} catalog={catalog} linkMenus balanceLink />
      </div>

      <div className="card mt-16">
        <div className="card__header">
          <div className="card__title">Kiểm tra quy tắc tuần</div>
        </div>
        <div className="card__body">
          <WeekChecks wm={wm} catalog={catalog} previousDays={wm.previousWeek?.days || []} allergyRows={allergyRows} />
        </div>
      </div>

      <HistoryCard history={wm.history} />
      <div className="page-actions">
        <Link className="btn" to="/menu/weekly">
          <ArrowLeft size={16} /> Quay lại danh sách
        </Link>
      </div>

      <ConfirmationModal
        open={modal === 'publish'}
        title="Xuất bản thực đơn tuần"
        message={`Xuất bản thực đơn tuần ${weekLabel(wm.weekStart)} cho ${ageGroupById(wm.ageGroupId)?.name}? Thực đơn sẽ bị khóa, bếp hai điểm trường, giáo viên và phụ huynh được thông báo.`}
        confirmLabel="Xuất bản thực đơn"
        onConfirm={publish}
        onClose={() => setModal(null)}
      />
      <ConfirmationModal
        open={modal === 'delete'}
        danger
        title="Xóa bản nháp"
        message={`Xóa bản nháp ${wm.code}?`}
        confirmLabel="Xóa bản nháp"
        onConfirm={remove}
        onClose={() => setModal(null)}
      />
      <Modal
        open={modal === 'replace'}
        title="Tạo phiên bản thay thế"
        onClose={() => !busy && setModal(null)}
        footer={
          <>
            <button className="btn" onClick={() => setModal(null)} disabled={busy}>
              Quay lại
            </button>
            <button className="btn btn--primary" onClick={replace} disabled={busy}>
              {busy && <Spinner small />} Tạo phiên bản thay thế
            </button>
          </>
        }
      >
        <p className="mb-12">
          Thực đơn đã xuất bản không sửa trực tiếp. Hệ thống tạo một bản nháp phiên bản {wm.version + 1}; phiên bản hiện tại vẫn áp dụng đến
          khi bạn xuất bản bản mới.
        </p>
        <FormField label="Lý do thay đổi" required error={reasonError}>
          <textarea
            className="textarea"
            rows={3}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setReasonError('');
            }}
          />
        </FormField>
      </Modal>
    </div>
  );
}
