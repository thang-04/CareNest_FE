import { signCells } from '@/components/print/docTemplate';

/**
 * Hàng ô ký cuối tờ in, cùng bố cục với bản Word (signRowHtml): dòng nơi, ngày ký trên ô người ký chính,
 * chức danh in hoa, (Ký, ghi rõ họ tên), khoảng ký, họ tên. signers = [{ title, name }].
 */
export function PrintSignRow({ signers, date, lead, className = '' }) {
  const cells = signCells(signers, { date, lead });
  if (!cells.length) return null;
  return (
    <div className={`ps-sign-row ${className}`.trim()}>
      {cells.map((c, i) => (
        <div key={`${c.title}-${i}`} className="ps-sign-row__cell">
          <div className="ps-sign-row__date">{c.dateLine || ' '}</div>
          <div className="ps-sign__title">{c.title}</div>
          <div className="ps-sign__role">(Ký, ghi rõ họ tên)</div>
          <div className="ps-sign-row__space" />
          <div className="ps-sign__name">{c.name}</div>
        </div>
      ))}
    </div>
  );
}
