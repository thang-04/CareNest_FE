/**
 * Thông tin chỉ xem của hồ sơ trẻ dạng bảng 2 cột nhãn | giá trị (user chọn 2026-11-11, thay `dl.info-list`).
 * rows: [label, value] hoặc { label, value } (giá trị là JSX không cần key); phần tử rỗng (dòng có điều kiện) bị bỏ. label: tên bảng cho trình đọc màn hình.
 */
export function ChildInfoTable({ label, rows }) {
  return (
    <div className="table-wrap">
      <table className="table table--grid tr-info-table" aria-label={label}>
        <colgroup>
          <col className="tr-info-table__col--label" />
          <col />
        </colgroup>
        <tbody>
          {rows.filter(Boolean).map((row) => {
            const [name, value] = Array.isArray(row) ? row : [row.label, row.value];
            return (
              <tr key={name}>
                <th scope="row">{name}</th>
                <td>{value}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
