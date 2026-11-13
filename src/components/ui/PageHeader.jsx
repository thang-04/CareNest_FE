import { Breadcrumb } from './Breadcrumb';

/**
 * Đầu trang chuẩn: breadcrumb + tiêu đề (+ mô tả) + vùng nút hành động bên phải.
 *
 * <PageHeader crumbs={supplierCrumbs()} title="Nhà cung cấp" actions={<Button variant="primary">Thêm</Button>} />
 */
export function PageHeader({ crumbs, title, subtitle, actions }) {
  return (
    <>
      {crumbs && <Breadcrumb items={crumbs} />}
      <div className="page__head">
        <div>
          <h1 className="page__title">{title}</h1>
          {subtitle && <p className="page__subtitle">{subtitle}</p>}
        </div>
        {actions}
      </div>
    </>
  );
}
