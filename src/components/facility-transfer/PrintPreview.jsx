import { forwardRef, useRef } from 'react';
import { PrintHeader } from '@/components/print/PrintHeader';
import { formatDate, formatDateTime } from '@/utils/format';
import { DEFAULT_PRINT_TEMPLATE } from '@/config/printTemplate';
import { exportPrintModelToCsv } from '@/utils/facility-transfer/exportTransfer';
import { PrintToolbar } from '@/components/print/PrintToolbar';

/** The single A4 transfer template (PhieuIn mockup). */
export const PrintSheet = forwardRef(function PrintSheet({ model, template = DEFAULT_PRINT_TEMPLATE }, ref) {
  return (
    <div className="print-sheet" ref={ref}>
      <PrintHeader template={template} />

      <div className="ps-title">
        <h1>{template.title}</h1>
        <div>
          Số: <b>{model.code}</b>
          {model.version > 1 ? <span className="ps-version"> (phiên bản {model.version})</span> : null}
        </div>
        <span className={`ps-stamp ps-stamp--${model.statusTone}`}>{model.statusLabel}</span>
      </div>

      <div className="ps-section">1. Thông tin chung</div>
      <table className="ps-table ps-table--info">
        <tbody>
          <tr>
            <th>Ngày lập:</th>
            <td>{formatDate(model.createdDate)}</td>
          </tr>
          <tr>
            <th>Ngày dự kiến bàn giao:</th>
            <td>{formatDate(model.expectedHandoverDate)}</td>
          </tr>
          <tr>
            <th>Loại luân chuyển:</th>
            <td>{model.typeLabel}</td>
          </tr>
          <tr>
            <th>Từ:</th>
            <td>{model.from}</td>
          </tr>
          <tr>
            <th>Đến:</th>
            <td>{model.to}</td>
          </tr>
          <tr>
            <th>Lý do:</th>
            <td>{model.reason}</td>
          </tr>
          <tr>
            <th>Ghi chú:</th>
            <td>{model.note || '—'}</td>
          </tr>
        </tbody>
      </table>

      <div className="ps-section">2. Danh sách tài sản luân chuyển</div>
      <table className="ps-table">
        <thead>
          <tr>
            <th style={{ width: 60 }}>STT</th>
            <th>Mã tài sản</th>
            <th>Tên tài sản</th>
            <th>Đơn vị</th>
            <th>Số lượng</th>
            {model.showHandoverColumn && <th>SL bàn giao</th>}
            {model.showReceivedColumn && <th>SL thực nhận</th>}
          </tr>
        </thead>
        <tbody>
          {model.items.map((i) => (
            <tr key={i.code}>
              <td className="c">{i.stt}</td>
              <td className="c">{i.code}</td>
              <td>{i.name}</td>
              <td className="c">{i.unit}</td>
              <td className="c">{i.quantity}</td>
              {model.showHandoverColumn && <td className="c">{i.handoverQuantity ?? '—'}</td>}
              {model.showReceivedColumn && <td className="c">{i.receivedQuantity ?? '—'}</td>}
            </tr>
          ))}
          <tr className="ps-total">
            <td colSpan={4} className="c">
              Tổng cộng
            </td>
            <td className="c">{model.total}</td>
            {model.showHandoverColumn && <td className="c">{model.totalHandover}</td>}
            {model.showReceivedColumn && <td className="c">{model.totalReceived}</td>}
          </tr>
        </tbody>
      </table>

      <div className="ps-section">3. Chữ ký xác nhận</div>
      <table className="ps-table ps-sign">
        <tbody>
          <tr>
            {model.signers.map((s) => (
              <td key={s.type}>
                <div className="ps-sign__title">{s.title}</div>
                <div className="ps-sign__role">({s.roleLabel})</div>
                <div className="ps-sign__img">
                  {s.signatureUrl ? (
                    <img src={s.signatureUrl} alt={`Chữ ký ${s.name}`} />
                  ) : (
                    <span className="ps-sign__pending">Chưa xác nhận</span>
                  )}
                </div>
                {s.signatureUrl && (
                  <>
                    <div className="ps-sign__name">{s.name}</div>
                    <div>{s.signedAt ? formatDateTime(s.signedAt) : 'Chưa gửi phiếu'}</div>
                  </>
                )}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
});

/** Toolbar: print, export PDF, export Excel (CSV). */
export function PrintActions({ model, sheetRef, compact }) {
  const fileBase = `Phieu_luan_chuyen_${model.code.replace(/[^\w]/g, '') || 'nhap'}`;
  return (
    <PrintToolbar
      sheetRef={sheetRef}
      fileBase={fileBase}
      onCsv={() => exportPrintModelToCsv(model, `${fileBase}.csv`)}
      printLabel="In phiếu"
      compact={compact}
    />
  );
}

/** Scaled A4 preview + actions, used in modals and the print page. */
export function PrintPreview({ model }) {
  const sheetRef = useRef(null);
  return (
    <div className="print-preview">
      <div className="print-preview__toolbar no-print">
        <span className="muted">Xem trước khổ A4 · Mẫu phiếu dùng chung cho mọi trạng thái</span>
        <PrintActions model={model} sheetRef={sheetRef} compact />
      </div>
      <div className="print-preview__paper">
        <PrintSheet ref={sheetRef} model={model} />
      </div>
    </div>
  );
}
