import { Save } from '@/components/ui/icons';
import { Modal } from '@/components/ui/Modal';
import { ErrorState, LoadingState, Spinner } from '@/components/ui/States';
import { FoodEditor } from '@/components/menu-planning/FoodEditor';
import { useFoodForm } from '@/hooks/menu-planning/useFoodForm';

/** Sửa / thêm thực phẩm ngay trên danh sách, không rời trang. `foodId` rỗng = thêm mới. */
export function FoodEditModal({ foodId, onClose, onSaved }) {
  const f = useFoodForm(foodId || undefined, {
    onSaved: (saved) => {
      onSaved?.(saved);
      onClose();
    },
  });
  const title = foodId ? 'Sửa thực phẩm' : 'Thêm thực phẩm';

  return (
    <Modal
      open
      size="xl"
      title={foodId && f.item ? `${title} · ${f.item.name}` : title}
      onClose={onClose}
      closeOnBackdrop={false}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Hủy
          </button>
          <button type="submit" form="td-food-modal-form" className="btn btn--primary" disabled={f.busy || f.loading}>
            {f.busy ? <Spinner small /> : <Save size={16} />} Lưu
          </button>
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
