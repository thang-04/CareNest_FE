import { Fragment } from 'react';
import { Card, Notice } from '@/components/education-plan/eduUi';
import { Cell, focusCell } from '@/components/education-plan/planUi';
import { domainLabel } from '@/models/education-plan/educationPlanConstants';
import { domainRoman, numberGoals } from '@/models/education-plan/goalTable';
import { themeGoalBlocks } from '@/models/education-plan/classPlan';

/** Dòng của một mục tiêu: nội dung mặc định = các nội dung đã tích cho chủ đề ở kế hoạch năm. */
export const themeRowOf = (draft, g) => draft?.rows?.[g.id] || { contents: g.contents.map((c) => `- ${c}`).join('\n'), activities: '' };

/**
 * Nội dung kế hoạch chủ đề (I. mục tiêu, nội dung, hoạt động; II. môi trường). Dùng ở trang soạn và chỉ đọc ở trang
 * duyệt giáo án tuần đầu của chủ đề (kế hoạch chủ đề duyệt chung với tuần đó).
 */
export function ThemePlanBody({ yearPlan, themeId, draft, editable = false, setRow, setField }) {
  const blocks = themeGoalBlocks(yearPlan.domains, numberGoals(yearPlan.domains), themeId);
  const goals = blocks.flatMap((b) => b.goals);
  const rowOf = (g) => themeRowOf(draft, g);
  return (
    <>
      {goals.length === 0 && <Notice tone="warn">Kế hoạch năm chưa tích nội dung nào vào chủ đề này.</Notice>}
      <Card title="I. Mục tiêu, nội dung và hoạt động giáo dục" bodyClass={null}>
        <div className="card__body">
          <div className="table-wrap">
            <table className="table ga-plan-table ga-goal-table" onMouseDown={focusCell}>
              <colgroup>
                <col className="ga-goal-table__del" />
                <col className="ga-goal-table__goaltext" />
                <col />
                <col />
              </colgroup>
              <thead>
                <tr>
                  <th className="ga-goal-table__fixed">TT</th>
                  <th className="ga-goal-table__fixed">Mục tiêu giáo dục</th>
                  <th>Nội dung giáo dục</th>
                  <th>Hoạt động giáo dục</th>
                </tr>
              </thead>
              <tbody>
                {blocks.map((b, i) => (
                  <Fragment key={`${b.domain}-${b.sub}-${i}`}>
                    {(i === 0 || blocks[i - 1].domain !== b.domain) && (
                      <tr>
                        <td colSpan={4} className="ga-goal-table__domain">
                          <div className="ga-goal-table__pad">
                            <h3>
                              {domainRoman(b.domain)}. {domainLabel(b.domain).toUpperCase()}
                            </h3>
                          </div>
                        </td>
                      </tr>
                    )}
                    {b.sub && (
                      <tr>
                        <td colSpan={4} className="ga-goal-table__subband">
                          <div className="ga-goal-table__subname">{b.sub}</div>
                        </td>
                      </tr>
                    )}
                    {b.goals.map((g) => (
                      <tr key={g.id}>
                        <td className="ga-goal-table__fixed">
                          <div className="ga-goal-table__pad">
                            <span className="ga-goal-code">MT {g.no}</span>
                          </div>
                        </td>
                        <td className="ga-goal-table__fixed">
                          <div className="ga-goal-table__pad">{g.text}</div>
                        </td>
                        <td>
                          <Cell
                            editable={editable}
                            value={rowOf(g).contents}
                            label={`Nội dung của MT ${g.no}`}
                            onChange={(v) => setRow(g, 'contents', v)}
                          />
                        </td>
                        <td>
                          <Cell
                            editable={editable}
                            value={rowOf(g).activities}
                            label={`Hoạt động giáo dục của MT ${g.no}`}
                            placeholder="Ghi theo loại giờ: TDS, HĐ học, Chơi HĐ ngoài trời, Chơi ở các góc, Chơi buổi chiều…"
                            onChange={(v) => setRow(g, 'activities', v)}
                          />
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
      <Card title="II. Môi trường giáo dục" bodyClass={null}>
        <div className="card__body">
          <div className="table-wrap">
            <table className="table ga-plan-table ga-goal-table" onMouseDown={focusCell}>
              <thead>
                <tr>
                  <th>1. Trong lớp</th>
                  <th>2. Ngoài lớp</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <Cell
                      editable={editable}
                      value={draft.envIn}
                      label="Môi trường trong lớp"
                      placeholder="Trang trí, góc chơi, đồ dùng…"
                      onChange={(v) => setField('envIn', v)}
                    />
                  </td>
                  <td>
                    <Cell
                      editable={editable}
                      value={draft.envOut}
                      label="Môi trường ngoài lớp"
                      placeholder="Sân chơi, khu vực ngoài lớp…"
                      onChange={(v) => setField('envOut', v)}
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </>
  );
}
