import { useRef, useState } from 'react';
import { Upload, Download } from '@/components/ui/icons';
import { Modal, Notice } from '@/components/education-plan/eduUi';
import { LoadingState } from '@/components/ui/States';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { previewBranchFile } from '@/services/education-plan/educationPlanService';
import { branchFileChanges } from '@/models/education-plan/importBranchFile.mjs';
import { USE_MOCK } from '@/config/env';
import { branchTemplateFile } from '@/utils/education-plan/classPlanDoc';
import { downloadDoc } from '@/utils/education-plan/yearPlanDoc';

const ACCEPT = '.docx,.doc,.xlsx,.csv';
const SHOWN_WARNINGS = 8;

export function ImportBranchFileModal({ classId, yearPlanId, user, draft, weeks, onImport, onClose }) {
  const fileRef = useRef(null);
  const [state, setState] = useState({ status: 'idle' });
  const [confirm, setConfirm] = useState(false);
  const preview = state.status === 'ready' ? state.preview : null;
  const changes = preview ? branchFileChanges(draft, preview) : [];
  const overwrites = changes.filter((change) => change.overwrite).length;
  const read = async (file) => {
    if (!file) return;
    setState({ status: 'loading', name: file.name });
    try {
      setState({ status: 'ready', name: file.name, preview: await previewBranchFile(file, { classId, yearPlanId }, user) });
    } catch (error) {
      setState({ status: 'error', message: error.message || 'Không đọc được file' });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };
  const apply = () => {
    setConfirm(false);
    if (onImport(preview, { classId, yearPlanId })) onClose();
  };
  const template = () => {
    const file = branchTemplateFile(weeks);
    downloadDoc(file.html, file.name);
  };
  return (
    <Modal
      title="Nhập file chủ đề nhánh"
      width={720}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Hủy
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!changes.length}
            onClick={() => (overwrites ? setConfirm(true) : apply())}
          >
            <Download size={16} aria-hidden /> Thêm {changes.length || ''} tên nhánh
          </button>
        </>
      }
    >
      <p className="muted text-sm">
        Word (.doc, .docx), Excel (.xlsx) hoặc CSV, tối đa 2 MB. Bảng cần cột Chủ đề và Chủ đề nhánh. Tuần học lấy từ hệ thống; ngày trong
        file không thay lịch. Chỉ lưu khi bấm Lưu.
      </p>
      {USE_MOCK && <Notice tone="warn">Chế độ demo chỉ đọc CSV. Word và Excel cần kết nối máy chủ.</Notice>}
      <div className="row row--wrap gap-2">
        <button
          type="button"
          className="btn btn--outline-primary"
          disabled={state.status === 'loading'}
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={16} aria-hidden /> Chọn file
        </button>
        <button type="button" className="btn btn--ghost" onClick={template}>
          <Download size={16} aria-hidden /> Tải file mẫu
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          hidden
          aria-label="Chọn file chủ đề nhánh"
          onChange={(e) => read(e.target.files?.[0])}
        />
      </div>
      {state.status === 'loading' && <LoadingState text="Đang đọc file…" />}
      {state.status === 'error' && <Notice tone="err">{state.message}</Notice>}
      {preview && (
        <>
          <p className="text-sm">
            <b>{state.name}</b>
          </p>
          {changes.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Chủ đề</th>
                    <th>Tuần hệ thống bắt đầu</th>
                    <th>Tên hiện tại</th>
                    <th>Tên từ file</th>
                  </tr>
                </thead>
                <tbody>
                  {changes.map((change) => (
                    <tr key={change.weekStart}>
                      <td>{change.themeName}</td>
                      <td>{change.weekStart}</td>
                      <td>{change.previous || '—'}</td>
                      <td>{change.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Notice tone="warn">Không có tên nhánh khớp để thêm.</Notice>
          )}
          {preview.warnings?.length > 0 && (
            <Notice tone="warn">
              <ul>
                {preview.warnings.slice(0, SHOWN_WARNINGS).map((warning, i) => (
                  <li key={i}>
                    {warning.row ? `Dòng ${warning.row}: ` : ''}
                    {warning.message}
                  </li>
                ))}
                {preview.warnings.length > SHOWN_WARNINGS && <li>và {preview.warnings.length - SHOWN_WARNINGS} dòng khác</li>}
              </ul>
            </Notice>
          )}
        </>
      )}
      <ConfirmationModal
        open={confirm}
        title="Thay tên chủ đề nhánh đã có?"
        message={`Có ${overwrites} tuần đang có tên khác. Chỉ thay tên ở các tuần trong bản xem trước; ghi chú và các tuần khác giữ nguyên.`}
        confirmLabel="Thay tên và thêm"
        onConfirm={apply}
        onClose={() => setConfirm(false)}
      />
    </Modal>
  );
}
