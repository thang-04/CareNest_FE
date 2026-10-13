import { DOMAIN_PREFIX, DOMAIN_SHORT } from '@/models/education-plan/educationPlanConstants';
import { Card } from '@/components/education-plan/eduUi';

/** Mã YCCĐ đang dùng trong lưới tuần (mỗi ô hoặc dòng "cả tuần" tính một lần). */
const usedCodes = (slots) =>
  slots.flatMap((s) => (s.allWeek ? s.all?.codes || [] : Object.values(s.cells || {}).flatMap((c) => c.codes || [])));

/** Bảng tham chiếu cạnh lưới kế hoạch tuần: YCCĐ của chủ đề, nội dung tổ trưởng đã viết, số lần đã gắn và độ phủ lĩnh vực. */
export default function WeekReference({ theme, slots }) {
  const rows = theme?.rows || [];
  const used = usedCodes(slots);
  const times = (code) => used.filter((c) => c === code).length;
  const domains = Object.keys(DOMAIN_PREFIX).map((d) => ({
    prefix: DOMAIN_PREFIX[d],
    name: DOMAIN_SHORT[d] || d,
    n: used.filter((c) => rows.find((r) => r.code === c)?.domain === d).length,
  }));

  return (
    <Card title="Tham chiếu chủ đề" actions={<span className="muted text-xs">{theme?.name}</span>}>
      <div className="stack gap-2">
        <div className="text-xs fw-600">Số lần gắn mã trong tuần theo lĩnh vực</div>
        <div className="row row--wrap gap-2">
          {domains.map((d) => (
            <span key={d.prefix} className={`chip ${d.n ? 'chip--blue' : 'chip--gray'}`} title={d.name}>
              {d.prefix} {d.n}
            </span>
          ))}
        </div>
        {domains.some((d) => !d.n) && <p className="muted text-xs">Lĩnh vực màu xám chưa có hoạt động nào trong tuần.</p>}
        <div className="ga-divider" />
        {rows.length === 0 && <p className="muted text-sm">Chủ đề chưa có YCCĐ.</p>}
        {rows.map((r) => (
          <div key={r.id || r.code} className="stack gap-1">
            <div className="row row--between">
              <span className="ga-goal-code">{r.code}</span>
              <span className="muted text-xs">{times(r.code) ? `đã gắn ${times(r.code)} lần` : 'chưa gắn'}</span>
            </div>
            <div className="text-sm">{r.requirement}</div>
            {r.content && <div className="muted text-xs">Nội dung: {r.content}</div>}
          </div>
        ))}
      </div>
    </Card>
  );
}
