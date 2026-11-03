import { useEffect, useRef, useState } from 'react';
import { Download, Upload } from '@/components/ui/icons';
import { Modal, Notice, fmtDate } from '@/components/education-plan/eduUi';
import { LoadingState } from '@/components/ui/States';
import { previewGoalFile } from '@/services/education-plan/educationPlanService';
import { prepareFileImport, previewSummary, FILE_IMPORT_MODES } from '@/models/education-plan/importGoalFile.mjs';
import { AGE_GROUPS, domainLabel } from '@/models/education-plan/educationPlanConstants';
import { downloadDoc, goalTemplateFile } from '@/utils/education-plan/yearPlanDoc';
import { PLAN_IMPORT_ACCEPT as ACCEPT, validatePlanImportFile } from '@/utils/education-plan/planImportFile';

const SHOWN_WARNINGS = 8;

export function ImportGoalFileModal({ form, themes = [], allowedAgeGroupIds, yearRange, onImport, onClose }) {
  const fileRef = useRef(null);
  const generation = useRef(0);
  const alive = useRef(true);
  const applying = useRef(false);
  const [state, setState] = useState({ status: 'idle' });
  const [applyError, setApplyError] = useState('');
  const [mode, setMode] = useState(FILE_IMPORT_MODES.ALL);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      generation.current++;
    };
  }, []);
  const target = form || { themes, breaks: [], domains: [], ageGroupId: '', schoolYear: '' };
  const preview = state.status === 'ready' ? state.preview : null;
  const prepared = prepareFileImport(target, preview, { allowedAgeGroupIds, yearRange, mode });
  const summary = preview ? previewSummary(preview) : [];
  const goals = summary.reduce((n, d) => n + d.goals, 0);
  const metadata = preview?.metadata;
  const groupName = (id) => AGE_GROUPS.find((group) => group.id === id)?.name || 'Chưa xác định';
  const canAdd = !!preview && !prepared.error;
  const actionFor = (key) => (prepared.replace[key] ? (prepared.present[key] ? 'Thay theo file' : 'Để trống') : 'Giữ hiện có');
  const close = () => {
    if (applying.current) return;
    alive.current = false;
    generation.current++;
    onClose();
  };
  const read = async (file) => {
    if (!file || !alive.current || applying.current) return;
    const current = ++generation.current;
    setApplyError('');
    setState({ status: 'loading', name: file.name });
    try {
      const validation = validatePlanImportFile(file);
      if (validation) throw new Error(validation);
      const result = await previewGoalFile(file);
      if (alive.current && current === generation.current) setState({ status: 'ready', name: file.name, preview: result });
    } catch (error) {
      if (alive.current && current === generation.current)
        setState({ status: 'error', name: file.name, message: error.message || 'Không đọc được file' });
    } finally {
      if (alive.current && current === generation.current && fileRef.current) fileRef.current.value = '';
    }
  };
  const apply = () => {
    if (!alive.current || applying.current || !canAdd) return;
    applying.current = true;
    try {
      if (onImport(preview, mode)) {
        applying.current = false;
        close();
      } else setApplyError('Chưa thể áp dụng. Kiểm tra quyền sửa và thông tin kế hoạch hiện tại.');
    } finally {
      applying.current = false;
    }
  };
  const template = () => {
    const file = goalTemplateFile(target.themes || themes);
    downloadDoc(file.html, file.name);
  };
  return (
    <Modal
      title="Nhập file mục tiêu"
      width={720}
      onClose={close}
      footer={
        <>
          <button type="button" className="btn" onClick={close}>
            Hủy
          </button>
          <button type="button" className="btn btn--primary" disabled={!canAdd} onClick={apply}>
            <Download size={16} aria-hidden /> Áp dụng vào kế hoạch
          </button>
        </>
      }
    >
      <p className="muted text-sm">
        Word (.doc, .docx), Excel (.xlsx) hoặc CSV, tối đa 2 MB. Xem trước phần thay, xóa hoặc giữ theo cách nhập đã chọn. Chỉ ghi lên hệ
        thống khi bấm Lưu.
      </p>
      <fieldset className="ga-edit-fieldset stack">
        <legend className="field__label">Cách nhập file</legend>
        <label className="radio">
          <input
            type="radio"
            name="goal-file-mode"
            value={FILE_IMPORT_MODES.ALL}
            checked={mode === FILE_IMPORT_MODES.ALL}
            onChange={() => {
              setMode(FILE_IMPORT_MODES.ALL);
              setApplyError('');
            }}
          />
          <span>
            <b>Thay toàn bộ theo file</b>
            <br />
            <span className="muted text-sm">Phần file không có sẽ để trống.</span>
          </span>
        </label>
        <label className="radio">
          <input
            type="radio"
            name="goal-file-mode"
            value={FILE_IMPORT_MODES.PRESENT}
            checked={mode === FILE_IMPORT_MODES.PRESENT}
            onChange={() => {
              setMode(FILE_IMPORT_MODES.PRESENT);
              setApplyError('');
            }}
          />
          <span>
            <b>Chỉ thay phần có trong file</b>
            <br />
            <span className="muted text-sm">Phần file có thay nguyên phần cũ; phần thiếu giữ hiện có.</span>
          </span>
        </label>
      </fieldset>
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
          aria-label="Chọn file mục tiêu"
          onChange={(e) => read(e.target.files?.[0])}
        />
      </div>
      {state.status === 'loading' && <LoadingState text="Đang đọc file…" />}
      {state.status === 'error' && <Notice tone="err">{state.message}</Notice>}
      {applyError && <Notice tone="warn">{applyError}</Notice>}
      {preview && (
        <>
          <p className="text-sm">
            <b>{state.name}</b>
          </p>
          {prepared.error && <Notice tone="err">{prepared.error}</Notice>}
          <h3 className="text-md">Kế hoạch sau khi áp dụng</h3>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Phần nội dung</th>
                  <th>Cách xử lý</th>
                  <th>Kết quả</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Tên kế hoạch</th>
                  <td>{actionFor('title')}</td>
                  <td>{prepared.title || 'Để trống'}</td>
                </tr>
                <tr>
                  <th scope="row">Mô tả</th>
                  <td>{prepared.replace.description ? 'Để trống' : 'Giữ hiện có'}</td>
                  <td>{prepared.description || 'Để trống'}</td>
                </tr>
                <tr>
                  <th scope="row">Chủ đề</th>
                  <td>{actionFor('themes')}</td>
                  <td>{prepared.themes.length} chủ đề</td>
                </tr>
                <tr>
                  <th scope="row">Đợt nghỉ</th>
                  <td>{actionFor('breaks')}</td>
                  <td>{prepared.breaks.length} đợt nghỉ</td>
                </tr>
                <tr>
                  <th scope="row">Mục tiêu, nội dung</th>
                  <td>{actionFor('domains')}</td>
                  <td>{prepared.replace.domains ? `${goals} mục tiêu từ file` : 'Giữ mục tiêu và nội dung hiện có'}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="muted text-sm">
            Mô tả chưa được đọc từ file. Năm học, khoảng ngày hệ thống, nhóm tuổi đã khóa, người soạn và trạng thái kế hoạch được giữ
            nguyên.
          </p>
          <p className="text-sm">
            Năm học: {target.schoolYear || '—'} · Từ {fmtDate(yearRange?.start)} đến {fmtDate(yearRange?.end)}
          </p>

          {metadata && (
            <>
              <h3 className="text-md">Thông tin chung</h3>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Thông tin</th>
                      <th>Trong file</th>
                      <th>Khi áp dụng</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row">Tên kế hoạch</th>
                      <td>{metadata.title || '—'}</td>
                      <td>{prepared.title || 'Để trống'}</td>
                    </tr>
                    <tr>
                      <th scope="row">Năm học</th>
                      <td>{metadata.schoolYear || 'Chưa xác định'}</td>
                      <td>{target.schoolYear || '—'} · Giữ năm đang mở</td>
                    </tr>
                    <tr>
                      <th scope="row">Nhóm tuổi</th>
                      <td>{groupName(prepared.sourceAgeGroupId)}</td>
                      <td>{groupName(prepared.ageGroupId)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
          {!!prepared.shifted && (
            <Notice>
              Ngày chủ đề, đợt nghỉ được dời {Math.abs(prepared.shifted)} năm {prepared.shifted > 0 ? 'về sau' : 'về trước'} theo năm học
              đang mở. Kiểm tra lịch dưới đây trước khi áp dụng.
            </Notice>
          )}
          {prepared.themes.length > 0 && (
            <>
              <h3 className="text-md">Chủ đề sau khi áp dụng</h3>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Chủ đề</th>
                      <th>Viết tắt</th>
                      <th>Từ ngày sau dời</th>
                      <th>Đến ngày sau dời</th>
                      <th>Lễ hội</th>
                      <th>Ghi chú</th>
                      <th>Khi áp dụng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prepared.themes.map((t) => (
                      <tr key={t.id}>
                        <td>{t.name}</td>
                        <td>{t.abbr}</td>
                        <td>{fmtDate(t.start)}</td>
                        <td>{fmtDate(t.end)}</td>
                        <td>{t.festivals || '—'}</td>
                        <td>{t.note || '—'}</td>
                        <td>{prepared.replace.themes ? 'Theo file' : 'Giữ hiện có'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {prepared.breaks.length > 0 && (
            <>
              <h3 className="text-md">Đợt nghỉ sau khi áp dụng</h3>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Đợt nghỉ</th>
                      <th>Từ ngày sau dời</th>
                      <th>Đến ngày sau dời</th>
                      <th>Ghi chú</th>
                      <th>Khi áp dụng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prepared.breaks.map((b) => (
                      <tr key={b.id}>
                        <td>{b.label}</td>
                        <td>{fmtDate(b.start)}</td>
                        <td>{fmtDate(b.end)}</td>
                        <td>{b.note || '—'}</td>
                        <td>{prepared.replace.breaks ? 'Theo file' : 'Giữ hiện có'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <h3 className="text-md">Mục tiêu và dấu tích</h3>
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
            <Notice tone="warn">File không có mục tiêu. Phần này sẽ được xử lý theo cách nhập đã chọn ở trên.</Notice>
          )}
          {prepared.missingThemes.length > 0 && (
            <Notice tone="warn">
              Chưa có chủ đề {prepared.missingThemes.join(', ')}: không ghép được dấu tích tương ứng. Kiểm tra chủ đề trong file; nếu file
              thiếu danh sách chủ đề và muốn dùng chủ đề đang có, chọn “Chỉ thay phần có trong file”.
            </Notice>
          )}
          {prepared.warnings.length > 0 && (
            <Notice tone="warn">
              <ul>
                {prepared.warnings.slice(0, SHOWN_WARNINGS).map((w, i) => (
                  <li key={i}>{w.row ? `Dòng ${w.row}: ${w.message}` : w.message}</li>
                ))}
              </ul>
              {prepared.warnings.length > SHOWN_WARNINGS && (
                <details>
                  <summary>Xem thêm {prepared.warnings.length - SHOWN_WARNINGS} cảnh báo</summary>
                  <ul>
                    {prepared.warnings.slice(SHOWN_WARNINGS).map((w, i) => (
                      <li key={i}>{w.row ? `Dòng ${w.row}: ${w.message}` : w.message}</li>
                    ))}
                  </ul>
                </details>
              )}
            </Notice>
          )}
        </>
      )}
    </Modal>
  );
}
