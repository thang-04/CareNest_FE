import { vpCoverage } from '@/utils/account/vpTasks';
import '@/styles/modules/permissions.css';

const Names = ({ names }) =>
  names.length ? (
    names.map((name) => (
      <span key={name} className="chip chip--green">
        {name}
      </span>
    ))
  ) : (
    <span className="chip chip--orange">Chưa giao</span>
  );

/** Đầu màn: việc nào đã giao cho Phó hiệu trưởng nào. "Chưa giao" nghĩa là Hiệu trưởng đang tự làm việc đó. */
export function VpCoverageCard({ holders, campuses, missing = [] }) {
  const rows = vpCoverage(holders, campuses);
  return (
    <section className="card vp-coverage mb-16" aria-label="Ai phụ trách việc gì">
      <div className="vp-coverage__head">
        <h2 className="fw-600">Ai phụ trách việc gì</h2>
        <p className="text-sm muted">Việc chưa giao thì Hiệu trưởng tự làm.</p>
        {missing.length > 0 && (
          <p className="text-sm vp-coverage__missing">Chưa tải được việc của {missing.join(', ')}, bảng dưới chưa tính người này.</p>
        )}
      </div>
      <div className="table-wrap">
        <table className="table table--grid table--compact">
          <thead>
            <tr>
              <th>Việc</th>
              {campuses.map((campus) => (
                <th key={campus.id}>{campus.shortName || campus.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td className="fw-600">{row.label}</td>
                {row.shared ? (
                  <td colSpan={campuses.length}>
                    <Names names={row.cells[0].names} /> <span className="text-sm muted">Dùng chung cả trường</span>
                  </td>
                ) : (
                  row.cells.map((cell) => (
                    <td key={cell.key}>
                      <Names names={cell.names} />
                    </td>
                  ))
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
