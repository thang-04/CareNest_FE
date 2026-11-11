import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { getFoods, saveFoodsBulk } from '@/services/menu-planning/menuPlanningService';
import { ImportDialog } from '@/components/upload/ImportDialog';
import { IMPORT_TEMPLATE_URL, importFieldLabel, matchFoodRows, readFoodFile } from '@/utils/menu-planning/foodImport';
import { FOOD_GROUP_LABELS, formatMoney } from '@/models/menu-planning/menuPlanningConstants';

/** Nhập thực phẩm từ file .xlsx (hộp ImportDialog): tải tệp mẫu → chọn tệp → xem trước Mới / Cập nhật / Lỗi → ghi các dòng hợp lệ. */
export function FoodImportPanel({ open, onClose }) {
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
  const pick = async (file) => {
    setFileName(file.name);
    setReading(true);
    // Danh mục hiện có lấy lúc chọn file (trang không tải sẵn) để đối chiếu Mới / Cập nhật với dữ liệu mới nhất
    const foods = getFoods({}, user);
    let rows;
    try {
      rows = await readFoodFile(file);
    } catch {
      foods.catch(() => {}); // file hỏng thì không cần danh mục nữa
      setResult({ creates: [], updates: [], errors: [{ row: '—', reason: 'Không đọc được file. Hãy dùng file .xlsx theo file mẫu.' }] });
      setReading(false);
      return;
    }
    try {
      setResult(matchFoodRows(rows, await foods));
    } catch (err) {
      toast.error(err, 'Không tải được danh mục thực phẩm để đối chiếu');
      setFileName('');
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
      toast.error(err, 'Không ghi được dữ liệu');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ImportDialog
      open={open}
      title="Nhập thực phẩm từ Excel"
      guide={
        <>
          Tải xuống <b>tệp mẫu</b>, điền mỗi dòng một thực phẩm rồi tải lên. Mã TP để trống là thực phẩm mới; có mã thì cập nhật các ô đã
          điền (ô trống giữ nguyên).
        </>
      }
      templateHref={IMPORT_TEMPLATE_URL}
      fileName={fileName}
      reading={reading}
      onFile={pick}
      confirmLabel={`Ghi ${valid.length} dòng hợp lệ`}
      confirmDisabled={!valid.length}
      busy={saving}
      onConfirm={save}
      onClose={close}
    >
      {result && (
        <div className="import-preview">
          <div className="row td-chips">
            <span className="chip chip--green">Thêm mới {result.creates.length}</span>
            <span className="chip chip--blue">Cập nhật {result.updates.length}</span>
            <span className={`chip ${result.errors.length ? 'chip--red' : 'chip--gray'}`}>Lỗi {result.errors.length}</span>
          </div>
          {!valid.length && !result.errors.length && (
            <p className="text-sm muted">Tệp chưa có dòng dữ liệu nào. Điền vào tệp mẫu rồi tải lên lại.</p>
          )}
          {result.errors.length > 0 && (
            <section>
              <h3>Dòng lỗi (không ghi)</h3>
              <div className="table-wrap">
                <table className="table table--grid table--compact">
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
              </div>
            </section>
          )}
          {result.creates.length > 0 && (
            <section>
              <h3>Thêm mới</h3>
              <div className="table-wrap">
                <table className="table table--grid table--compact">
                  <thead>
                    <tr>
                      <th className="td-num-col">Dòng</th>
                      <th>Tên thực phẩm</th>
                      <th>Nhóm</th>
                      <th className="money">Đơn giá</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.creates.map((c) => (
                      <tr key={c.key}>
                        <td className="td-num-col">{c.row}</td>
                        <td>{c.name}</td>
                        <td>{FOOD_GROUP_LABELS[c.data.group]}</td>
                        <td className="money">{c.data.unitPrice ? formatMoney(c.data.unitPrice) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {result.updates.length > 0 && (
            <section>
              <h3>Cập nhật</h3>
              <div className="table-wrap">
                <table className="table table--grid table--compact">
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
              </div>
            </section>
          )}
        </div>
      )}
    </ImportDialog>
  );
}
