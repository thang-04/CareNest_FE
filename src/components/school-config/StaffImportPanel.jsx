import { useState } from 'react';
import { useToast } from '@/contexts/ToastContext';
import { ImportDialog } from '@/components/upload/ImportDialog';
import { ROLE_LABELS } from '@/models/User';
import { createStaffAccount, listAllStaffAccounts } from '@/services/school-config/schoolConfigService';
import { readWorkbook } from '@/utils/school-config/yearSetupImport';
import '@/styles/modules/menu-planning.css';
import { STAFF_SHEET, STAFF_TEMPLATE_URL, matchStaffRows, normalizePhone, toCreatePayload } from '@/utils/school-config/staffImport';

function PreviewTable({ title, head, rows, bad = false }) {
  if (!rows.length) return null;
  return (
    <section>
      <h3>{title}</h3>
      <div className="table-wrap">
        <table className="table table--grid table--compact">
          <thead>
            <tr>
              {head.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((cells, i) => (
              <tr key={i}>
                {cells.map((c, j) => (
                  <td key={j} className={bad && j === cells.length - 1 ? 'td-bad' : undefined}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Nhập tài khoản nhân sự từ Excel (Cần 31/10/2026): xem trước, tạo lần lượt dòng hợp lệ qua POST /accounts, dòng BE từ chối hiện đỏ. */
export function StaffImportPanel({ open, campuses, teacherCampusRequired = false, onClose }) {
  const toast = useToast();
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState(null);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [changed, setChanged] = useState(false);
  const valid = result?.items.length || 0;

  const close = (savedNow = false) => {
    setFileName('');
    setResult(null);
    onClose(changed || savedNow === true);
    setChanged(false);
  };

  const pick = async (file) => {
    setFileName(file.name);
    setReading(true);
    try {
      const [sheets, accounts] = await Promise.all([readWorkbook(file, [STAFF_SHEET]), listAllStaffAccounts()]);
      const existing = accounts.map((a) => ({ phone: normalizePhone(a.username), email: a.email }));
      setResult(matchStaffRows(sheets[STAFF_SHEET], { campuses, existing, teacherCampusRequired }));
    } catch {
      setResult({
        items: [],
        errors: [{ row: '—', name: '—', reason: 'Không đọc được file. Hãy dùng file .xlsx theo file mẫu.' }],
        ignoredColumns: [],
      });
    } finally {
      setReading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    const failed = [];
    let saved = 0;
    for (const item of result.items) {
      try {
        await createStaffAccount(toCreatePayload(item.form));
        saved += 1;
      } catch (err) {
        failed.push({ row: item.row, name: item.form.fullName, reason: err.message });
      }
    }
    setSaving(false);
    if (saved) {
      setChanged(true);
      toast.success(`Đã tạo ${saved} tài khoản.`);
    }
    if (failed.length) {
      toast.error('Một số dòng chưa tạo được, xem lý do ở bảng lỗi.');
      setResult({ items: [], errors: failed, ignoredColumns: [] });
    } else close(true);
  };

  return (
    <ImportDialog
      open={open}
      title={'Nhập tài khoản nhân sự từ Excel'}
      guide={
        <>
          Tải xuống <b>tệp mẫu</b>, điền sheet &quot;{STAFF_SHEET}&quot; rồi tải lên để xem trước.
        </>
      }
      templateHref={STAFF_TEMPLATE_URL}
      fileName={fileName}
      reading={reading}
      onFile={pick}
      confirmLabel={`Tạo ${valid} tài khoản hợp lệ`}
      confirmDisabled={!valid}
      busy={saving}
      onConfirm={save}
      onClose={() => close()}
    >
      {result && (
        <div className="import-preview">
          <div className="row td-chips">
            <span className="chip chip--green">Hợp lệ {valid}</span>
            <span className={`chip ${result.errors.length ? 'chip--red' : 'chip--gray'}`}>Lỗi {result.errors.length}</span>
          </div>
          {!valid && !result.errors.length && (
            <p className="text-sm muted">Tệp chưa có dòng dữ liệu nào. Điền vào tệp mẫu rồi tải lên lại.</p>
          )}
          {result.ignoredColumns.length > 0 && (
            <div className="alert alert--info">
              <div>
                Bỏ qua cột {result.ignoredColumns.map((c) => `"${c}"`).join(', ')}. Giáo viên mới được xếp lớp sau ở màn Phân công giáo
                viên.
              </div>
            </div>
          )}
          <PreviewTable
            bad
            title="Dòng lỗi (không tạo)"
            head={['Dòng', 'Họ tên', 'Lý do']}
            rows={result.errors.map((e) => [e.row, e.name, e.reason])}
          />
          <PreviewTable
            title="Tài khoản sẽ tạo"
            head={['Dòng', 'Họ tên', 'Số điện thoại', 'Email', 'Vai trò', 'Điểm trường']}
            rows={result.items.map((i) => [
              i.row,
              i.form.fullName,
              normalizePhone(i.form.phone),
              i.form.email || '—',
              ROLE_LABELS[i.form.role],
              i.campusName || '—',
            ])}
          />
        </div>
      )}
    </ImportDialog>
  );
}
