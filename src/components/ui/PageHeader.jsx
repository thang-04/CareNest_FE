import { Breadcrumb } from './Breadcrumb';
import { ReadOnlyTag } from './ReadOnlyTag';
import { usePageReadOnly } from '@/contexts/PageReadOnlyContext';

/**
 * Đầu trang chuẩn: breadcrumb + tiêu đề (+ mô tả) + vùng nút hành động bên phải.
 * readOnly: người dùng chỉ có quyền xem màn ⇒ nhãn "Chỉ xem"; tự bật khi AreaGate báo cả màn chỉ xem.
 * Nút chính trong actions dùng Button disabledReason (lấy `reason` từ usePageReadOnly).
 *
 * <PageHeader crumbs={supplierCrumbs()} title="Nhà cung cấp" actions={<Button variant="primary">Thêm</Button>} />
 */
export function PageHeader({ crumbs, title, subtitle, actions, readOnly: readOnlyProp = false }) {
  const readOnly = usePageReadOnly().readOnly || readOnlyProp;
  return (
    <>
      {crumbs && <Breadcrumb items={crumbs} />}
      <div className="page__head">
        <div>
          <h1 className="page__title">{title}</h1>
          {readOnly ? (
            <div className="page__meta">
              <ReadOnlyTag />
              {subtitle && <p className="page__subtitle">{subtitle}</p>}
            </div>
          ) : (
            subtitle && <p className="page__subtitle">{subtitle}</p>
          )}
        </div>
        {actions}
      </div>
    </>
  );
}
