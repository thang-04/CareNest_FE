import { useRef, useState } from 'react';
import { Download, Upload } from '@/components/ui/icons';
import { Modal, Notice } from '@/components/education-plan/eduUi';
import { LoadingState } from '@/components/ui/States';
import { previewGoalFile } from '@/services/education-plan/educationPlanService';
import { missingThemeAbbrs, previewSummary } from '@/models/education-plan/importGoalFile.mjs';
import { domainLabel } from '@/models/education-plan/educationPlanConstants';
import { downloadDoc, goalTemplateFile } from '@/utils/education-plan/yearPlanDoc';

const ACCEPT = '.docx,.doc,.xlsx,.csv';
const SHOWN_WARNINGS = 8;

/**
 * Nhập file bảng mục tiêu (BE:EDU-46): BE đọc file thành bản xem trước; Thêm thì bổ sung vào bản đang soạn (bỏ mục tiêu
 * trùng câu), chỉ ghi khi bấm Lưu. onImport(preview) trả false khi không còn quyền sửa.
 */
export function ImportGoalFileModal({ themes, onImport, onClose }) {
  const fileRef = useRef(null);
  const [state, setState] = useState({ status: 'idle' });
  const preview = state.status === 'ready' ? state.preview : null;
  const summary = preview ? previewSummary(preview) : [];
  const goals = summary.reduce((n, d) => n + d.goals, 0);
  const missing = preview ? missingThemeAbbrs(preview, themes) : [];

  const read = async (file) => {
    if (!file) return;
    setState({ status: 'loading', name: file.name });
    try {
      setState({ status: 'ready', name: file.name, preview: await previewGoalFile(file) });
    } catch (error) {
      setState({ status: 'error', name: file.name, message: error.message || 'Không đọc được file' });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };
  const template = () => {
    const file = goalTemplateFile(themes);
    downloadDoc(file.html, file.name);
  };

  return (
    <Modal
      title="Nhập file mục tiêu"
      width={720}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Hủy
          </button>
          <button type="button" className="btn btn--primary" disabled={!goals} onClick={() => onImport(preview) && onClose()}>
            <Download size={16} aria-hidden /> Thêm {goals || ''} mục tiêu
          </button>
        </>
      }
    >
      <p className="muted text-sm">Word (.docx), Excel (.xlsx), CSV hoặc file Word CareNest xuất. Mục tiêu trùng câu được bỏ qua.</p>
      <div className="row row--wrap gap-2">
        <button type="button" className="btn btn--outline-primary" onClick={() => fileRef.current?.click()}>
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
          aria-label="Chọn file mục tiêu"
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
          {goals ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Lĩnh vực</th>
                    <th className="center">Mục tiêu</th>
                    <th className="center">Nội dung</th>
                    <th className="center">Dấu tích chủ đề</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((d) => (
                    <tr key={d.name}>
                      <td>{domainLabel(d.name)}</td>
                      <td className="center">{d.goals}</td>
                      <td className="center">{d.contents}</td>
                      <td className="center">{d.ticks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Notice tone="warn">File không có mục tiêu nào để thêm.</Notice>
          )}
          {missing.length > 0 && (
            <Notice tone="warn">
              Chưa có chủ đề {missing.join(', ')}: dấu tích ở các cột này sẽ bỏ. Thêm chủ đề ở tab Chủ đề và sự kiện rồi nhập lại nếu cần.
            </Notice>
          )}
          {preview.warnings?.length > 0 && (
            <Notice tone="warn">
              <ul>
                {preview.warnings.slice(0, SHOWN_WARNINGS).map((w, i) => (
                  <li key={i}>{w.row ? `Dòng ${w.row}: ${w.message}` : w.message}</li>
                ))}
                {preview.warnings.length > SHOWN_WARNINGS && <li>và {preview.warnings.length - SHOWN_WARNINGS} dòng khác</li>}
              </ul>
            </Notice>
          )}
        </>
      )}
    </Modal>
  );
}
