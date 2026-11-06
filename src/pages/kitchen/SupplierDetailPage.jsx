import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, IdCard, MapPin, Pencil, Phone, Trash2, Truck, UserRound } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useSupplier } from '@/hooks/kitchen/useKitchen';
import { Breadcrumb, ConfirmationModal, EmptyState, ErrorState, LoadingState } from '@/components';
import { ReceiptStatusBadge, SupplierStatusBadge } from '@/components/kitchen/KitchenBadges';
import { SupplierEditModal } from '@/components/kitchen/SupplierEditModal';
import { canEditSuppliers, deleteSupplier, saveSupplier } from '@/services/kitchen/kitchenService';
import { canManageStock } from '@/utils/kitchen/kitchenPermissions';
import { supplierCrumbs } from '@/utils/kitchen/breadcrumbs';
import { clickableRowProps } from '@/utils/clickableRow';
import { formatDate } from '@/utils/format';
import { formatMoney } from '@/models/menu-planning/menuPlanningConstants';
import { SUPPLIER_STATUS } from '@/models/kitchen/kitchenConstants';
import '@/styles/modules/kitchen.css';

/** Chi tiết nhà cung cấp (BA 01 Detail): thông tin cơ bản và các phiếu nhập kho liên kết (chỉ xem). */
export default function SupplierDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const { data: s, loading, error, reload } = useSupplier(id);
  const [ask, setAsk] = useState(null);
  const [editing, setEditing] = useState(false);
  const [actionError, setActionError] = useState('');
  const canManage = canEditSuppliers(user);
  // Phiếu nhập chỉ PHT mở được (route nhập kho dành cho PHT)
  const canOpenReceipt = canManageStock(user);

  const crumbs = supplierCrumbs(s?.name || 'Chi tiết');
  if (loading && !s) return <LoadingState />;
  if (error || !s)
    return (
      <div className="page">
        <Breadcrumb items={crumbs} />
        <ErrorState error={error} onRetry={reload} />
      </div>
    );

  const active = s.status === SUPPLIER_STATUS.ACTIVE;
  const toggle = async () => {
    try {
      await saveSupplier({ ...s, status: active ? SUPPLIER_STATUS.INACTIVE : SUPPLIER_STATUS.ACTIVE }, user);
      toast.success(active ? `Đã ngừng dùng ${s.name}.` : `Đã dùng lại ${s.name}.`);
      setActionError('');
    } catch (err) {
      setActionError(err.message);
    } finally {
      setAsk(null);
    }
  };
  const remove = async () => {
    try {
      await deleteSupplier({ id }, user);
      toast.success(`Đã xóa nhà cung cấp ${s.name}.`);
      navigate('/menu/suppliers');
    } catch (err) {
      setAsk(null);
      setActionError(err.message);
    }
  };

  // Trường nguồn dữ liệu không có (BE: mã số thuế; người chỉ xem không nhận CCCD) thì ẩn ô
  const facts = [
    { icon: UserRound, label: 'Người liên hệ', value: s.contactName },
    { icon: Phone, label: 'Số điện thoại', value: s.phone, href: s.phone ? `tel:${s.phone.replace(/\s/g, '')}` : undefined },
    { icon: IdCard, label: 'Mã số thuế', value: s.taxCode },
    { icon: IdCard, label: 'CCCD nhà cung cấp', value: s.idCard },
    { icon: MapPin, label: 'Địa chỉ', value: s.address, wide: true },
  ].filter((f) => f.value !== undefined);

  return (
    <div className="page">
      <Breadcrumb items={crumbs} />
      <section className="card kb-sup-hero">
        <span className="kb-sup-hero__avatar" aria-hidden="true">
          <Truck size={26} />
        </span>
        <div className="kb-sup-hero__main">
          <div className="kb-sup-hero__title">
            <h1 className="page__title">{s.name}</h1>
            <SupplierStatusBadge status={s.status} size="lg" />
          </div>
          <div className="kb-sup-hero__meta">
            {s.code && <span className="td-tag td-tag--blue">{s.code}</span>}
            <span className="text-sm muted">{s.receiptCount ?? s.receipts.length} phiếu nhập kho từ nhà cung cấp này</span>
          </div>
        </div>
        {canManage && (
          <div className="kb-sup-hero__actions">
            {s.receiptCount === 0 && (
              <button className="btn btn--outline-danger" onClick={() => setAsk('delete')}>
                <Trash2 size={16} /> Xóa
              </button>
            )}
            <button className="btn" onClick={() => setAsk('toggle')}>
              {active ? 'Ngừng dùng' : 'Dùng lại'}
            </button>
            <button type="button" className="btn btn--primary" onClick={() => setEditing(true)}>
              <Pencil size={16} /> Sửa nhà cung cấp
            </button>
          </div>
        )}
      </section>
      {actionError && (
        <div className="alert alert--danger mb-16">
          <AlertTriangle size={18} />
          <div>{actionError}</div>
        </div>
      )}
      <ul className="kb-sup-facts" aria-label="Thông tin nhà cung cấp">
        {facts.map(({ icon: Icon, label, value, href, wide }) => (
          <li key={label} className={`kb-sup-fact ${wide ? 'kb-sup-fact--wide' : ''}`}>
            <span className="kb-sup-fact__icon" aria-hidden="true">
              <Icon size={18} />
            </span>
            <div className="kb-sup-fact__body">
              <span className="kb-sup-fact__label">{label}</span>
              <span className="kb-sup-fact__value">
                {!value ? <span className="muted">—</span> : href ? <a href={href}>{value}</a> : value}
              </span>
            </div>
          </li>
        ))}
      </ul>
      <section className="card">
        <div className="card__header">
          <h2 className="card__title">Phiếu nhập kho từ nhà cung cấp này</h2>
          <span className="text-sm muted">{s.receipts.length} phiếu · chỉ xem</span>
        </div>
        {s.receipts.length === 0 ? (
          <EmptyState title="Chưa có phiếu nhập kho" description="Phiếu nhập chọn nhà cung cấp này sẽ hiện ở đây." />
        ) : (
          <div className="table-wrap">
            <table className="table table--grid">
              <thead>
                <tr>
                  <th>Mã phiếu</th>
                  <th>Ngày nhập</th>
                  <th>Điểm trường</th>
                  <th className="num">Số thực phẩm</th>
                  <th className="money">Tổng tiền</th>
                  <th className="center">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {s.receipts.map((r) => (
                  <tr
                    key={r.id}
                    {...(canOpenReceipt
                      ? { className: 'row-click', ...clickableRowProps(() => navigate(`/kitchen/stock-receipts/${r.id}/edit`)) }
                      : {})}
                  >
                    <td className="fw-600 text-primary">{r.code}</td>
                    <td>{formatDate(r.date)}</td>
                    <td>{r.campusName}</td>
                    <td className="num">{r.items.length}</td>
                    <td className="money nowrap">{formatMoney(r.totalAmount)}</td>
                    <td className="center">
                      <ReceiptStatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <ConfirmationModal
        open={ask === 'toggle'}
        title={active ? 'Ngừng dùng nhà cung cấp' : 'Dùng lại nhà cung cấp'}
        message={
          active
            ? `Ngừng dùng "${s.name}"? Phiếu nhập mới không chọn được nhà cung cấp này; phiếu đã có vẫn giữ tên.`
            : `Dùng lại "${s.name}" cho phiếu nhập mới?`
        }
        confirmLabel={active ? 'Ngừng dùng' : 'Dùng lại'}
        onConfirm={toggle}
        onClose={() => setAsk(null)}
      />
      <ConfirmationModal
        open={ask === 'delete'}
        danger
        title="Xóa nhà cung cấp"
        message={`Xóa "${s.name}" khỏi danh mục? Nhà cung cấp chưa có phiếu nhập nào.`}
        confirmLabel="Xóa nhà cung cấp"
        onConfirm={remove}
        onClose={() => setAsk(null)}
      />
      {editing && <SupplierEditModal supplierId={id} onClose={() => setEditing(false)} onSaved={() => reload({ silent: true })} />}
    </div>
  );
}
