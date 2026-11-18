import { Save } from '@/components/ui/icons';
import { Modal } from '@/components/ui/Modal';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { Button } from '@/components/ui/Button';
import { FoodEditor } from '@/components/menu-planning/FoodEditor';
import { useFoodForm } from '@/hooks/menu-planning/useFoodForm';
import { useUnsavedMark } from '@/hooks/useLeaveGuard';

/** Sửa / thêm thực phẩm ngay trên danh sách, không rời trang. `foodId` rỗng = thêm mới. */
export function FoodEditModal({ foodId, onClose, onSaved }) {
  const f = useFoodForm(foodId || undefined, {
    onSaved: (saved) => {
      onSaved?.(saved);
      onClose();
    },
  });
  const title = foodId ? 'Sửa thực phẩm' : 'Thêm thực phẩm';

  useUnsavedMark(f.dirty);

  return (
    <Modal
      open
      size="xl"
      title={foodId && f.item ? `${title} · ${f.item.name}` : title}
      onClose={onClose}
      closeOnBackdrop={false}
      footer={
        <>
          <Button disabled={f.busy} onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" form="td-food-modal-form" variant="primary" icon={Save} loading={f.busy} disabled={f.loading}>
            Lưu
          </Button>
        </>
      }
    >
      {f.loading ? (
        <LoadingState />
      ) : foodId && f.error ? (
        <ErrorState error={f.error} onRetry={f.reload} />
      ) : (
        <form id="td-food-modal-form" onSubmit={f.submit} noValidate>
          <FoodEditor f={f} />
        </form>
      )}
    </Modal>
  );
}
