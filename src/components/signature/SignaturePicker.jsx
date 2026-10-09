import { useEffect, useState } from 'react';
import { CheckCircle2, MoreHorizontal, Plus, Star, Trash2, Images, Upload } from '@/components/ui/icons';
import { useSignatures } from '@/hooks/useSignatures';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { ROLE_LABELS } from '@/models/User';
import { formatDate } from '@/utils/format';
import { SignatureUploader } from './SignatureUploader';
import { Modal } from '@/components/ui/Modal';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { LoadingState } from '@/components/ui/States';

function SavedSignatureCard({ sig, selected, ownerName, onSelect, onMakeDefault, onDelete }) {
  const [menu, setMenu] = useState(false);
  return (
    <div
      className={`sig-card ${selected ? 'sig-card--selected' : ''}`}
      onClick={() => onSelect(sig)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(sig)}
    >
      {selected && <CheckCircle2 size={20} className="sig-card__check" />}
      {sig.isDefault && (
        <span className="sig-card__default">
          <Star size={11} /> Mặc định
        </span>
      )}
      <img src={sig.imageUrl} alt={`Chữ ký ${ownerName}`} />
      <div className="sig-card__name">{ownerName}</div>
      <div className="sig-card__date">(Đã lưu ngày {formatDate(sig.createdAt)})</div>
      <button
        className="icon-btn sig-card__menu"
        onClick={(e) => {
          e.stopPropagation();
          setMenu((m) => !m);
        }}
        aria-label="Tùy chọn chữ ký"
      >
        <MoreHorizontal size={16} />
      </button>
      {menu && (
        <div className="sig-card__dropdown" onClick={(e) => e.stopPropagation()} onMouseLeave={() => setMenu(false)}>
          <button
            disabled={sig.isDefault}
            onClick={() => {
              setMenu(false);
              onMakeDefault(sig);
            }}
          >
            <Star size={14} /> Đặt làm mặc định
          </button>
          <button
            className="text-danger"
            onClick={() => {
              setMenu(false);
              onDelete(sig);
            }}
          >
            <Trash2 size={14} /> Xóa chữ ký
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Lets the current user pick a saved signature or upload a new one.
 * value: selected image URL. onChange({ url, id }).
 * variant "full" = tabs (VP wizard), "compact" = preview + 2 buttons (staff pages).
 */
export function SignaturePicker({ value, onChange, variant = 'full', error, disabled, title }) {
  const { user } = useAuth();
  const toast = useToast();
  const { signatures, defaultSignature, loading, save, makeDefault, remove } = useSignatures();
  const [tab, setTab] = useState('saved');
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [modal, setModal] = useState(null); // 'saved' | 'upload' (compact variant)

  // Account already has a signature: preselect it so the user does not upload again.
  useEffect(() => {
    if (!value && defaultSignature && !disabled) onChange({ url: defaultSignature.imageUrl, id: defaultSignature.id });
  }, [value, defaultSignature, disabled, onChange]);

  useEffect(() => {
    if (!loading && signatures.length === 0) setTab('upload');
  }, [loading, signatures.length]);

  const handleUse = async ({ url, saveToAccount, makeDefault: asDefault }) => {
    setBusy(true);
    try {
      let id = null;
      if (saveToAccount) {
        const sig = await save(url, asDefault);
        id = sig.id;
        toast.success('Đã lưu chữ ký cho tài khoản');
      }
      onChange({ url, id });
      setTab('saved');
      setModal(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    try {
      await remove(toDelete.id);
      if (value === toDelete.imageUrl) onChange({ url: null, id: null });
      toast.success('Đã xóa chữ ký');
    } catch (err) {
      toast.error(err.message);
    }
    setToDelete(null);
  };

  const handleDefault = async (sig) => {
    await makeDefault(sig.id);
    toast.success('Đã đặt chữ ký mặc định');
  };

  const select = (sig) => {
    onChange({ url: sig.imageUrl, id: sig.id });
    setModal(null);
  };

  const savedGrid = loading ? (
    <LoadingState text="Đang tải chữ ký..." />
  ) : (
    <div className="sig-grid">
      {signatures.map((sig) => (
        <SavedSignatureCard
          key={sig.id}
          sig={sig}
          selected={value === sig.imageUrl}
          ownerName={user.fullName}
          onSelect={select}
          onMakeDefault={handleDefault}
          onDelete={setToDelete}
        />
      ))}
      <button
        type="button"
        className="sig-card sig-card--add"
        onClick={() => (variant === 'compact' ? setModal('upload') : setTab('upload'))}
      >
        <Plus size={26} />
        <span>Tải lên chữ ký mới</span>
      </button>
    </div>
  );

  const confirmDelete = (
    <ConfirmationModal
      open={!!toDelete}
      title="Xóa chữ ký đã lưu?"
      message="Chữ ký này sẽ bị xóa khỏi tài khoản. Các phiếu đã ký trước đó không bị ảnh hưởng."
      confirmLabel="Xóa chữ ký"
      danger
      onConfirm={handleDelete}
      onClose={() => setToDelete(null)}
    />
  );

  if (variant === 'compact') {
    return (
      <div className="sig-compact">
        <div className={`sig-compact__preview ${error ? 'sig-compact__preview--error' : ''}`}>
          {value ? <img src={value} alt="Chữ ký đã chọn" /> : <span className="muted">Chưa chọn chữ ký</span>}
          <div className="fw-600">{user.fullName}</div>
          <div className="muted text-xs">{ROLE_LABELS[user.role]}</div>
        </div>
        {!disabled && (
          <div className="stack" style={{ gap: 8, flex: 1 }}>
            <button type="button" className="btn btn--outline-primary btn--block" onClick={() => setModal('saved')}>
              <Images size={17} /> Chọn chữ ký đã lưu
            </button>
            <button type="button" className="btn btn--block sig-compact__upload" onClick={() => setModal('upload')}>
              <Upload size={17} /> Tải chữ ký mới
            </button>
            <div className="muted text-xs">Hỗ trợ định dạng ảnh: PNG, JPG (tối đa 2MB)</div>
            {error && <div className="field__error">{error}</div>}
          </div>
        )}
        <Modal open={modal === 'saved'} title="Chọn chữ ký đã lưu" onClose={() => setModal(null)} size="lg">
          {savedGrid}
        </Modal>
        <Modal open={modal === 'upload'} title="Tải chữ ký mới" onClose={() => setModal(null)}>
          <SignatureUploader onUse={handleUse} busy={busy} />
        </Modal>
        {confirmDelete}
      </div>
    );
  }

  return (
    <div className="sig-picker">
      {title && <div className="subsection-title">{title}</div>}
      <div className="sig-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'saved'}
          className={`sig-tab ${tab === 'saved' ? 'sig-tab--active' : ''}`}
          onClick={() => setTab('saved')}
        >
          Chữ ký đã lưu
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'upload'}
          className={`sig-tab ${tab === 'upload' ? 'sig-tab--active' : ''}`}
          onClick={() => setTab('upload')}
        >
          Tải lên / cập nhật chữ ký
        </button>
      </div>
      <div className="sig-picker__body">
        {tab === 'saved' ? (
          signatures.length === 0 && !loading ? (
            <div className="muted">Tài khoản chưa có chữ ký đã lưu.</div>
          ) : (
            savedGrid
          )
        ) : (
          <div className="sig-upload-layout">
            <SignatureUploader onUse={handleUse} busy={busy} />
            {value && (
              <div className="sig-current">
                <div className="muted mb-8 text-sm">Chữ ký đang dùng</div>
                <img src={value} alt="Chữ ký đang dùng" />
                <div className="fw-600 text-sm">{user.fullName}</div>
              </div>
            )}
          </div>
        )}
      </div>
      {error && <div className="field__error mt-8">{error}</div>}
      {confirmDelete}
    </div>
  );
}
