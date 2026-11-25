import { useRef, useState } from 'react';
import { PrintPaperFit } from '@/components/print/PrintPaperFit';
import { PrintToolbar } from '@/components/print/PrintToolbar';
import { Modal } from '@/components/ui/Modal';
import { Tabs } from '@/components/ui/Tabs';
import { exportWithPreviewWorkbook } from '@/components/ui/ExportPreview';
import { InspectionLabelPrint } from '@/components/kitchen/inspection/InspectionLabelPrint';
import { InspectionPrint } from '@/components/kitchen/inspection/InspectionPrint';
import { INSPECTION_PRINT_VARIANTS, INSPECTION_TAB_LABELS } from '@/models/kitchen/inspectionConstants';
import { inspectionExportRows } from '@/utils/kitchen/inspectionExport';

/**
 * Xem trước biểu mẫu khổ A4 ngang rồi In, Xuất PDF hoặc Xuất Excel; luôn lấy dữ liệu đã lưu của mẫu.
 * Mẫu có nhiều bản in thì chọn ở thanh tab: M3 (hoặc M3 gộp lưu mẫu), M5 (hoặc M4 nhãn mẫu). `sampleData` = mẫu M5 của ngày.
 */
export function InspectionPrintDialog({ tab, date, campusName, data, sampleData, initialVariant = 'main', onClose }) {
  const sheetRef = useRef(null);
  const variants = INSPECTION_PRINT_VARIANTS[tab];
  const [variant, setVariant] = useState(initialVariant);
  const excel = inspectionExportRows(tab, data, { date, campusName, variant, sampleData });
  const exportExcel = () =>
    exportWithPreviewWorkbook([{ sheetName: excel.sheetName, rows: excel.rows, headerRow: excel.headerRow }], `${excel.fileBase}.xlsx`, {
      title: INSPECTION_TAB_LABELS[tab],
    });
  return (
    // Hộp vừa đủ xem tờ giấy (không toàn màn hình); `print-modal` để khi in tờ giấy không bị khung modal cắt. M4 nhãn in A4 dọc, các mẫu còn lại A4 ngang
    <Modal
      open
      size={variant === 'label' ? 'lg' : 'xl'}
      className="print-modal"
      title={`In / xuất · ${variants.find((v) => v.key === variant)?.label ?? INSPECTION_TAB_LABELS[tab]}`}
      onClose={onClose}
      footer={
        <PrintToolbar
          sheetRef={sheetRef}
          fileBase={excel.fileBase}
          onClose={onClose}
          orientation={variant === 'label' ? 'portrait' : 'landscape'}
          onCsv={exportExcel}
        />
      }
    >
      {variants.length > 1 && (
        <Tabs ariaLabel="Bản in" value={variant} onChange={setVariant} items={variants.map((v) => ({ key: v.key, label: v.label }))} />
      )}
      <PrintPaperFit>
        {variant === 'label' ? (
          <InspectionLabelPrint ref={sheetRef} date={date} data={data} />
        ) : (
          <InspectionPrint
            ref={sheetRef}
            tab={tab}
            date={date}
            campusName={campusName}
            data={data}
            variant={variant}
            sampleData={sampleData}
          />
        )}
      </PrintPaperFit>
    </Modal>
  );
}
