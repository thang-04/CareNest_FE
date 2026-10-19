import { useState } from 'react';
import { Download, Upload } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { saveFoodsBulk } from '@/services/menu-planning/menuPlanningService';
import { SidePanel } from '@/components/ui/SidePanel';
import { Spinner } from '@/components/ui/States';
import { IMPORT_TEMPLATE_URL, importFieldLabel, matchFoodRows, readFoodFile } from '@/utils/menu-planning/foodImport';
import { FOOD_GROUP_LABELS, formatMoney } from '@/models/menu-planning/menuPlanningConstants';

/** Nhập khẩu cập nhật thực phẩm từ file .xlsx: tải file mẫu → chọn file → xem trước Mới / Cập nhật / Lỗi → ghi các dòng hợp lệ. */
export function FoodImportPanel({ open, onClose, foods }) {
  const { user } = useAuth();
  const toast = useToast();
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState(null);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const valid = result ? [...result.creates, ...result.updates] : [];

  const reset = () => {
    setFileName('');
    setResult(null);
  };
  const close = () => {
    reset();
    onClose();
  };
  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setFileName(file.name);
    setReading(true);
    try {
      setResult(matchFoodRows(await readFoodFile(file), foods));
    } catch {
      setResult({ creates: [], updates: [], errors: [{ row: '—', reason: 'Không đọc được file. Hãy dùng file .xlsx theo file mẫu.' }] });
    } finally {
      setReading(false);
    }
  };
  const save = async () => {
    setSaving(true);
    try {
      const { created, updated } = await saveFoodsBulk(
        valid.map(({ key, id, data }) => ({ key, id, data })),
        user,
      );
      toast.success(`Đã thêm ${created} và cập nhật ${updated} thực phẩm.`);
      close();
    } catch (err) {
      toast.error(err.message, 'Không ghi được dữ liệu');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SidePanel
      open={open}
      title="Nhập khẩu cập nhật thực phẩm"
      onClose={close}
      wide
      footer={
        <>
          <button type="button" className="btn" onClick={close} disabled={saving}>
            Đóng
          </button>
          <button type="button" className="btn btn--primary" onClick={save} disabled={!valid.length || saving}>
            {saving ? <Spinner small /> : <Upload size={16} />} Ghi {valid.length} dòng hợp lệ
          </button>
        </>
      }
    >
      <ol className="td-import-steps">
        <li>
          Tải file mẫu, điền mỗi dòng một thực phẩm. Mã TP để trống là thực phẩm mới; có mã thì cập nhật các ô đã điền (ô trống giữ nguyên).
          <div>
            <a className="btn btn--sm" href={IMPORT_TEMPLATE_URL} download>
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
            <span className="chip chip--green">Thêm mới {result.creates.length}</span>
            <span className="chip chip--blue">Cập nhật {result.updates.length}</span>
            <span className={`chip ${result.errors.length ? 'chip--red' : 'chip--gray'}`}>Lỗi {result.errors.length}</span>
          </div>
          {result.errors.length > 0 && (
            <section>
              <h3>Dòng lỗi (không ghi)</h3>
              <table className="table table--compact">
                <thead>
                  <tr>
                    <th className="td-num-col">Dòng</th>
                    <th>Thực phẩm</th>
                    <th>Lý do</th>
                  </tr>
                </thead>
                <tbody>
                  {result.errors.map((e) => (
                    <tr key={e.row}>
                      <td className="td-num-col">{e.row}</td>
                      <td>{e.name || '—'}</td>
                      <td className="td-bad">{e.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
          {result.creates.length > 0 && (
            <section>
              <h3>Thêm mới</h3>
              <table className="table table--compact">
                <thead>
                  <tr>
                    <th className="td-num-col">Dòng</th>
                    <th>Tên thực phẩm</th>
                    <th>Nhóm</th>
                    <th className="right">Đơn giá</th>
                  </tr>
                </thead>
                <tbody>
                  {result.creates.map((c) => (
                    <tr key={c.key}>
                      <td className="td-num-col">{c.row}</td>
                      <td>{c.name}</td>
                      <td>{FOOD_GROUP_LABELS[c.data.group]}</td>
                      <td className="right">{c.data.unitPrice ? formatMoney(c.data.unitPrice) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
          {result.updates.length > 0 && (
            <section>
              <h3>Cập nhật</h3>
              <table className="table table--compact">
                <thead>
                  <tr>
                    <th className="td-num-col">Dòng</th>
                    <th>Mã</th>
                    <th>Tên thực phẩm</th>
                    <th>Trường thay đổi</th>
                  </tr>
                </thead>
                <tbody>
                  {result.updates.map((u) => (
                    <tr key={u.key}>
                      <td className="td-num-col">{u.row}</td>
                      <td className="text-primary fw-600">{u.code}</td>
                      <td>{u.name}</td>
                      <td className="text-sm">{u.changes.map(importFieldLabel).join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </div>
      )}
    </SidePanel>
  );
}
