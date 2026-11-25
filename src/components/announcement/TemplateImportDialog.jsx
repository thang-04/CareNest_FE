import { useEffect, useRef, useState } from 'react';
import { DataTable } from '@/components';
import { ImportDialog } from '@/components/upload/ImportDialog';
import { exportWithPreview } from '@/components/ui/ExportPreview';
import {
  createTemplatesSequentially,
  matchTemplateRows,
  templateImportSample,
  TEMPLATE_IMPORT_MAX_ROWS,
} from '@/utils/announcement/templateImport.mjs';
import { announcements } from '@/services/announcement/announcementService';
import { AnnouncementAlert } from './announcementUi';

const MAX_SIZE = 5 * 1024 * 1024;

// Thư viện đọc Excel chỉ tải khi người dùng chọn tệp.
async function readFirstSheet(file) {
  const { readSheet } = await import('read-excel-file/browser');
  return readSheet(file);
}

/**
 * Nhập nhiều mẫu từ Excel: tải tệp mẫu → chọn tệp → xem trước dòng hợp lệ/lỗi → tạo lần lượt từng mẫu.
 * `onDone(created)` báo số mẫu đã tạo để màn gọi tải lại danh sách.
 */
export default function TemplateImportDialog({ user, campuses, viceRole, onDone, onClose }) {
  const generation = useRef(0);
  const alive = useRef(true);
  const [state, setState] = useState({ status: 'idle', name: '' });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  useEffect(() => {
    alive.current = true;
    const current = generation;
    return () => {
      alive.current = false;
      current.current += 1;
    };
  }, []);

  const read = async (file) => {
    if (busy) return;
    if (!/\.xlsx$/i.test(file.name)) {
      setState({ status: 'error', name: file.name, message: 'Chỉ nhận tệp Excel .xlsx.' });
      return;
    }
    const mine = ++generation.current;
    setResult(null);
    setState({ status: 'loading', name: file.name });
    try {
      const match = matchTemplateRows(await readFirstSheet(file), { campuses, viceRole });
      if (alive.current && mine === generation.current) setState({ status: 'ready', name: file.name, match });
    } catch {
      if (alive.current && mine === generation.current) {
        setState({ status: 'error', name: file.name, message: 'Không đọc được tệp Excel. Hãy kiểm tra tệp rồi thử lại.' });
      }
    }
  };

  const match = state.status === 'ready' ? state.match : null;
  const canCreate = !!match && !match.fatal && match.items.length > 0 && !result;
  const confirm = async () => {
    if (!canCreate || busy) return;
    setBusy(true);
    const outcome = await createTemplatesSequentially(match.items, (data) => announcements.createTemplate(data, user));
    if (!alive.current) return;
    setBusy(false);
    setResult(outcome);
    onDone(outcome.created);
    if (!outcome.failed.length) onClose();
  };

  return (
    <ImportDialog
      open
      title="Nhập mẫu thông báo từ Excel"
      guide={
        <>
          Tải xuống <b>tệp mẫu</b>, điền mỗi dòng một mẫu (Tên mẫu, Phạm vi, Tiêu đề, Nội dung) rồi tải lên. Tối đa{' '}
          {TEMPLATE_IMPORT_MAX_ROWS} dòng mỗi lần. Hệ thống cho xem trước; bấm tạo mới ghi mẫu.
        </>
      }
      onTemplate={() =>
        exportWithPreview(templateImportSample({ viceRole, campuses }), 'mau-thong-bao.xlsx', {
          sheetName: 'Mẫu thông báo',
          headerRow: 0,
          title: 'Tệp mẫu nhập mẫu thông báo',
        })
      }
      accept=".xlsx"
      hint="Tệp Excel .xlsx, tối đa 5 MB."
      maxSize={MAX_SIZE}
      fileName={state.name}
      reading={state.status === 'loading'}
      onFile={read}
      confirmLabel={`Tạo ${match?.items.length || 0} mẫu`}
      idleLabel="Tạo mẫu"
      confirmDisabled={!canCreate}
      busy={busy}
      onConfirm={confirm}
      onClose={onClose}
    >
      {state.status === 'error' && <AnnouncementAlert>{state.message}</AnnouncementAlert>}
      {match?.fatal && <AnnouncementAlert>{match.fatal}</AnnouncementAlert>}
      {match && !match.fatal && (
        <div className="announcement-import-preview">
          <p role="status">
            <b>{match.items.length}</b> dòng hợp lệ, <b>{match.errors.length}</b> dòng lỗi.
            {match.errors.length > 0 && ' Dòng lỗi sẽ bị bỏ qua; sửa trong tệp rồi tải lên lại nếu cần.'}
          </p>
          {match.errors.length > 0 && (
            <ul className="announcement-import-errors">
              {match.errors.map((error) => (
                <li key={error.row}>
                  Dòng {error.row}: {error.reason}
                </li>
              ))}
            </ul>
          )}
          {match.items.length > 0 && (
            <DataTable
              rows={match.items}
              rowKey="row"
              columns={[
                { key: 'row', header: 'Dòng', className: 'center' },
                { key: 'name', header: 'Tên mẫu', render: (item) => <span className="fw-600">{item.name}</span> },
                { key: 'campusLabel', header: 'Phạm vi', className: 'center' },
                { key: 'title', header: 'Tiêu đề thông báo' },
              ]}
            />
          )}
        </div>
      )}
      {result && (
        <div className="announcement-import-preview" role="status">
          <p>
            Đã tạo <b>{result.created}</b> mẫu{result.failed.length > 0 && `, chưa tạo được ${result.failed.length} mẫu`}.
          </p>
          {result.failed.length > 0 && (
            <ul className="announcement-import-errors">
              {result.failed.map((failure) => (
                <li key={failure.row}>
                  Dòng {failure.row}: {failure.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </ImportDialog>
  );
}
