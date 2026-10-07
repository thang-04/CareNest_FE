import { DOMAIN_SHORT } from '@/models/education-plan/educationPlanConstants';
import { fmtDate } from '@/components/education-plan/eduUi';

/** Theme plan table, same layout as the paper template: Domain | Code – requirement | Content | Method – form – environment | Adjustment */
export function ThemeTable({ rows }) {
  if (!rows?.length) return <p>Chưa có mục tiêu.</p>;
  const domains = [...new Set(rows.map((r) => r.domain))];
  return (
    <div className="table-wrap">
      <table className="table ga-plan-table">
        <thead>
          <tr>
            <th style={{ width: 110 }}>Lĩnh vực</th>
            <th>Mục tiêu / yêu cầu cần đạt</th>
            <th>Nội dung giáo dục</th>
            <th>Phương pháp – Hình thức – Môi trường</th>
            <th style={{ width: 110 }}>Điều chỉnh</th>
          </tr>
        </thead>
        <tbody>
          {domains.map((d) =>
            rows
              .filter((r) => r.domain === d)
              .map((r, i, arr) => (
                <tr key={r.id}>
                  {i === 0 && (
                    <td rowSpan={arr.length} className="fw-600">
                      {DOMAIN_SHORT[d] || d}
                    </td>
                  )}
                  <td>
                    <span className="fw-600">{r.code}:</span> {r.requirement || '—'}
                  </td>
                  <td>{r.content || '—'}</td>
                  <td>
                    {r.method && (
                      <div>
                        <span className="fw-600">Phương pháp:</span> {r.method}
                      </div>
                    )}
                    {r.form && (
                      <div>
                        <span className="fw-600">Hình thức:</span> {r.form}
                      </div>
                    )}
                    {r.environment && (
                      <div>
                        <span className="fw-600">Môi trường:</span> {r.environment}
                      </div>
                    )}
                    {!r.method && !r.form && !r.environment && '—'}
                  </td>
                  <td>{r.adjust || ''}</td>
                </tr>
              )),
          )}
        </tbody>
      </table>
    </div>
  );
}

export function BranchList({ branches }) {
  if (!branches?.length) return <p>Chưa chia tuần.</p>;
  return (
    <div className="ga-branch-list">
      {branches.map((b) => (
        <div key={b.index} className="ga-branch-row">
          <span className="fw-600">Tuần {b.index}</span>
          <span className="muted text-xs">
            {fmtDate(b.start).slice(0, 5)} – {fmtDate(b.end).slice(0, 5)}
          </span>
          <span>{b.name || '—'}</span>
        </div>
      ))}
    </div>
  );
}
