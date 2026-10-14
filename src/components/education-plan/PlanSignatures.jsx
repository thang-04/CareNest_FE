import { Card, SignatureView, fmtDate } from '@/components/education-plan/eduUi';
import { yearSigners } from '@/utils/education-plan/yearPlanDoc';

/** Phần ký cuối kế hoạch năm học như bản Word: các người xây dựng theo cấu hình (mặc định Phó HT và Tổ trưởng). */
export default function PlanSignatures({ plan, className }) {
  const list = yearSigners(plan);
  return (
    <Card title="Người xây dựng kế hoạch" className={className}>
      <div className={list.length > 2 ? 'grid-3' : 'grid-2'}>
        {list.map(({ role, title, sign }) => (
          <div key={role} className="stack center">
            <div className="fw-600">{title}</div>
            {sign ? <SignatureView sig={sign.sig} name={sign.name} /> : <span className="muted">Chưa ký</span>}
            <div className="fw-600">{sign?.name || '—'}</div>
            {sign?.at && <div className="muted text-xs">Ký ngày {fmtDate(sign.at)}</div>}
          </div>
        ))}
      </div>
    </Card>
  );
}
