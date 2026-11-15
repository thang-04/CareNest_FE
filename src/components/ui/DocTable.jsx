/**
 * Bảng dạng văn bản (kế hoạch giáo dục theo mẫu Thái Dương): colgroup, gộp ô, dòng nhóm — thứ DataTable không diễn đạt được.
 * Chỉ gói `.table-wrap` + `.table`; className thêm class bảng của module (vd. `ga-plan-table`), props còn lại vào `<table>`.
 */
export function DocTable({ className = '', children, ...rest }) {
  return (
    <div className="table-wrap">
      <table className={`table ${className}`.trim()} {...rest}>
        {children}
      </table>
    </div>
  );
}
