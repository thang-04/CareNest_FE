import { useSyncExternalStore } from 'react';
import { Download, X } from '@/components/ui/icons';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/contexts/ToastContext';
import { downloadXlsx } from '@/utils/exportXlsx';

/*
 * Xem trước khi xuất Excel (DESIGN §6.3): mọi nút "Xuất Excel" gọi exportWithPreview(rows, fileName) thay vì tải ngay;
 * hộp hiện đúng các dòng sẽ ghi ra file, người dùng bấm "Tải file Excel" mới tải. Host gắn một lần ở App.
 */
const PREVIEW_LIMIT = 200;
let request = null;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());
const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** Mở hộp xem trước. rows: mảng các mảng (dòng một ô = tiêu đề / tên phần); options như downloadXlsx + `title`. */
export const exportWithPreview = (rows, fileName, options = {}) => {
  request = { rows, fileName: fileName.replace(/\.csv$/i, '.xlsx'), ...options };
  emit();
};
const close = () => {
  request = null;
  emit();
};

const headerIndex = (rows, headerRow) => headerRow ?? (rows[0]?.length === 1 && rows.length > 1 ? 1 : 0);

export function ExportPreviewHost() {
  const toast = useToast();
  const req = useSyncExternalStore(subscribe, () => request);
  if (!req) return null;
  const { rows, fileName, title, sheetName, headerRow } = req;
  const head = headerIndex(rows, headerRow);
  const width = Math.max(1, ...rows.map((r) => r.length));
  // Dòng một ô (tiêu đề báo cáo, tên phần) trải hết bảng; dòng trống giữ làm khoảng cách như trong file
  const dataCount = rows.filter((r, i) => i > head && r.length > 1).length;
  const shown = rows.slice(0, PREVIEW_LIMIT);
  const download = () => {
    downloadXlsx(rows, fileName, { sheetName, headerRow });
    toast.success(`Đã tải ${fileName}`);
    close();
  };
  return (
    <Modal
      open
      size="xl"
      title={title || 'Xem trước khi xuất Excel'}
      onClose={close}
      footer={
        <>
          <button type="button" className="btn" onClick={close}>
            <X size={16} /> Đóng
          </button>
          <button type="button" className="btn btn--primary" onClick={download}>
            <Download size={16} /> Tải file Excel
          </button>
        </>
      }
    >
      <p className="text-sm muted export-preview__meta">
        File <b>{fileName}</b> · {dataCount} dòng dữ liệu
        {rows.length > PREVIEW_LIMIT && ` · đang hiện ${PREVIEW_LIMIT} dòng đầu, file có đủ ${rows.length} dòng`}
      </p>
      <div className="table-wrap export-preview">
        <table className="table table--grid table--compact">
          <tbody>
            {shown.map((r, i) =>
              r.length <= 1 ? (
                <tr key={i} className="export-preview__section">
                  <th colSpan={width} scope="colgroup">
                    {r[0] ?? ' '}
                  </th>
                </tr>
              ) : (
                <tr key={i} className={i === head ? 'export-preview__head' : undefined}>
                  {Array.from({ length: width }, (_, c) => {
                    const v = r[c];
                    const Cell = i === head ? 'th' : 'td';
                    return (
                      <Cell key={c} className={typeof v === 'number' ? 'num' : undefined}>
                        {v == null || v === '' ? '' : typeof v === 'number' ? v.toLocaleString('vi-VN') : String(v)}
                      </Cell>
                    );
                  })}
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
