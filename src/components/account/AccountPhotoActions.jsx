import { useId, useState } from 'react';
import { FileInput } from '@/components/form/FileInput';
import { Button } from '@/components/ui/Button';
import { Camera, Trash2 } from '@/components/ui/icons';
import { useToast } from '@/contexts/ToastContext';
import { ACCOUNT_PHOTO_ENABLED, deleteMyPhoto, uploadMyPhoto } from '@/services/account/accountPhotoService';

const ACCEPT = 'image/jpeg,image/png,image/webp';

/**
 * Đổi/xóa ảnh đại diện của chính mình (BE AUTH-27). Định dạng, dung lượng (2 MB) do BE kiểm và báo lỗi.
 * Tài khoản kiêm phụ huynh không xóa được (BE trả 403/1145, toast nêu lý do).
 */
export function AccountPhotoActions({ user }) {
  const inputId = useId();
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  if (!ACCOUNT_PHOTO_ENABLED || !user?.userId) return null;

  const run = async (kind, action, success) => {
    setBusy(kind);
    try {
      await action();
      toast.success(success);
    } catch (err) {
      toast.error(err, kind === 'upload' ? 'Không đổi được ảnh đại diện' : 'Không xóa được ảnh đại diện');
    } finally {
      setBusy(null);
    }
  };

  const onPick = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) run('upload', () => uploadMyPhoto(user.userId, file), 'Đã đổi ảnh đại diện');
  };

  return (
    <div className="ac-photo-actions">
      <Button
        size="sm"
        variant="outline-primary"
        icon={Camera}
        loading={busy === 'upload'}
        disabled={busy !== null}
        onClick={() => document.getElementById(inputId)?.click()}
      >
        Đổi ảnh
      </Button>
      <Button
        size="sm"
        variant="ghost"
        icon={Trash2}
        loading={busy === 'delete'}
        disabled={busy !== null}
        onClick={() => run('delete', () => deleteMyPhoto(user.userId), 'Đã xóa ảnh đại diện')}
      >
        Xóa ảnh
      </Button>
      <FileInput id={inputId} accept={ACCEPT} hidden onChange={onPick} />
    </div>
  );
}
