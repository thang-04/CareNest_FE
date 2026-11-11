import { PageHeader } from './PageHeader';

/**
 * Khung màn danh sách chuẩn: đầu trang + một thẻ chứa thanh lọc và bảng.
 *
 * <ListPage crumbs={crumbs} title="Nhà cung cấp" filters={<div className="filter-bar">…</div>}>
 *   <DataTable … />
 * </ListPage>
 */
export function ListPage({ crumbs, title, subtitle, actions, filters, children }) {
  return (
    <div className="page">
      <PageHeader crumbs={crumbs} title={title} subtitle={subtitle} actions={actions} />
      <section className="card">
        {filters}
        {children}
      </section>
    </div>
  );
}
