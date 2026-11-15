import { forwardRef } from 'react';
import { PrintHeader } from '@/components/print/PrintHeader';
import { INSPECTION_HAND_SIGN_LABELS } from '@/models/kitchen/inspectionConstants';
import { buildHeader, hasValidSignature } from '@/utils/kitchen/inspectionForm';
import { inspectionCellText, inspectionColumns, inspectionRows, inspectionTitle } from '@/utils/kitchen/inspectionExport';
import { formatDateTime } from '@/utils/format';

/*
 * Bản in biểu mẫu kiểm thực M1–M3 theo Quyết định 1246/QĐ-BYT, khổ A4 ngang: tiêu đề mẫu, phần đầu, bảng hai hàng tiêu đề, ba ô ký.
 * Ô tích in "x". PHT ký ảnh ở "Người kiểm tra" (chưa ký hiện "Chưa xác nhận"); hai ô còn lại để trống, ký tay sau khi in.
 */
export const InspectionPrint = forwardRef(function InspectionPrint({ tab, date, campusName, data, variant = 'main', sampleData }, ref) {
  const { top, sub, leaves } = buildHeader(inspectionColumns(tab, variant));
  const head = inspectionTitle(tab, date, variant);
  // M3 gộp: người ký tay là người lưu mẫu và hủy mẫu như biểu mẫu B3
  const hand = INSPECTION_HAND_SIGN_LABELS[variant === 'combined' ? 'sample' : tab];
  const rows = inspectionRows(tab, variant, data, sampleData);
  const signed = hasValidSignature(data);
  const sig = data.signature;
  const centered = (leaf) => !(leaf.col.wide && leaf.col.type !== 'check' && leaf.col.type !== 'passfail');

  return (
    <div className="print-sheet print-sheet--landscape" ref={ref}>
      <PrintHeader />
      <div className="ps-title ps-title--form">
        <div className="ps-form-ref">
          {head.decision}
          <br />
          {head.form}
        </div>
        <h1>{head.title}</h1>
        <div>{head.date}</div>
      </div>
      <div className="ps-form-meta">
        <div>Tên đơn vị: {campusName || '……………'}</div>
        <div>Thời gian kiểm tra: {data.header?.checkedAt ? formatDateTime(data.header.checkedAt) : '……………'}</div>
        <div>Địa điểm kiểm tra: {data.header?.place || '……………'}</div>
      </div>
      {head.part && <div className="ps-form-part">{head.part}</div>}
      <table className="ps-table ps-table--form">
        <thead>
          <tr>
            <th rowSpan={2}>TT</th>
            {top.map((cell) => (
              <th key={cell.key} colSpan={cell.colSpan} rowSpan={cell.rowSpan}>
                {cell.label}
              </th>
            ))}
          </tr>
          <tr>
            {sub.map((cell) => (
              <th key={cell.key}>{cell.label || cell.tick?.text}</th>
            ))}
          </tr>
          <tr className="ps-form-nums">
            <th>1</th>
            {leaves.map((leaf, index) => (
              <th key={leaf.key}>{index + 2}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.key}>
              <td className="c">{index + 1}</td>
              {leaves.map((leaf) => (
                <td key={leaf.key} className={centered(leaf) ? 'c' : ''}>
                  {inspectionCellText(leaf, row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <table className="ps-table ps-sign ps-sign--form">
        <tbody>
          <tr>
            <td>
              <div className="ps-sign__title">{hand[0]}</div>
              <div className="ps-sign__role">(Ký, họ tên)</div>
            </td>
            <td>
              <div className="ps-sign__title">Người kiểm tra</div>
              <div className="ps-sign__role">(Ký, họ tên)</div>
              {signed ? (
                <>
                  <div className="ps-sign__img">
                    <img src={sig.imageUrl} alt={`Chữ ký ${sig.signedByName}`} />
                  </div>
                  <div className="ps-sign__name">{sig.signedByName}</div>
                  <div>Ký lúc {formatDateTime(sig.signedAt)}</div>
                </>
              ) : (
                <div className="ps-sign__pending">Chưa xác nhận</div>
              )}
            </td>
            <td>
              <div className="ps-sign__title">{hand[1]}</div>
              <div className="ps-sign__role">(Ký, họ tên)</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
});
