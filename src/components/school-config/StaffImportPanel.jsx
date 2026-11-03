import { useState } from 'react';
import { Download, Upload } from '@/components/ui/icons';
import { useToast } from '@/contexts/ToastContext';
import { SidePanel } from '@/components/ui/SidePanel';
import { Spinner } from '@/components/ui/States';
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
export function StaffImportPanel({ open, campuses, classes, onClose }) {
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

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setFileName(file.name);
    setReading(true);
    try {
      const [sheets, accounts] = await Promise.all([readWorkbook(file, [STAFF_SHEET]), listAllStaffAccounts()]);
      const existing = accounts.map((a) => ({ phone: normalizePhone(a.username), email: a.email }));
      setResult(matchStaffRows(sheets[STAFF_SHEET], { campuses, classes, existing }));
    } catch {
      setResult({ items: [], errors: [{ row: '—', name: '—', reason: 'Không đọc được file. Hãy dùng file .xlsx theo file mẫu.' }] });
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
      setResult({ items: [], errors: failed });
    } else close(true);
  };

  return (
    <SidePanel
      open={open}
      title="Nhập tài khoản nhân sự từ Excel"
      onClose={() => close()}
      wide
      footer={
        <>
          <button type="button" className="btn" onClick={() => close()} disabled={saving}>
            Đóng
          </button>
          <button type="button" className="btn btn--primary" onClick={save} disabled={!valid || saving}>
            {saving ? <Spinner small /> : <Upload size={16} />} Tạo {valid} tài khoản hợp lệ
          </button>
        </>
      }
    >
      <ol className="td-import-steps">
        <li>
          Tải file mẫu và điền sheet &quot;{STAFF_SHEET}&quot;.
          <div>
            <a className="btn btn--sm" href={STAFF_TEMPLATE_URL} download>
              <Download size={15} /> Tải file mẫu (.xlsx)
            </a>
          </div>
        </li>
        <li>
          Chọn file đã điền để xem trước.
          <div className="row td-import-file">
            <label className="btn btn--sm btn--outline-primary">
              <Upload size={15} /> Chọn file
              <input type="file" accept=".xlsx" className="sr-only" onChange={pick} />
            </label>
            <span className="text-sm muted">{reading ? 'Đang đọc file…' : fileName || 'Chưa chọn file'}</span>
          </div>
        </li>
      </ol>

      {result && (
        <div className="td-import-preview">
          <div className="row td-chips">
            <span className="chip chip--green">Hợp lệ {valid}</span>
            <span className={`chip ${result.errors.length ? 'chip--red' : 'chip--gray'}`}>Lỗi {result.errors.length}</span>
          </div>
          <PreviewTable
            bad
            title="Dòng lỗi (không tạo)"
            head={['Dòng', 'Họ tên', 'Lý do']}
            rows={result.errors.map((e) => [e.row, e.name, e.reason])}
          />
          <PreviewTable
            title="Tài khoản sẽ tạo"
            head={['Dòng', 'Họ tên', 'Số điện thoại', 'Email', 'Vai trò', 'Điểm trường / lớp']}
            rows={result.items.map((i) => [
              i.row,
              i.form.fullName,
              normalizePhone(i.form.phone),
              i.form.email || '—',
              ROLE_LABELS[i.form.role],
              i.className || i.campusName,
            ])}
          />
        </div>
      )}
    </SidePanel>
  );
}
