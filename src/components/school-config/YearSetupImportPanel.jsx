import { useState } from 'react';
import { Download, Upload } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useMasterData } from '@/hooks/useMasterData';
import { SidePanel } from '@/components/ui/SidePanel';
import { Spinner } from '@/components/ui/States';
import { LottiePlayer } from '@/components/ui/LottiePlayer';
import { saveRoom, getRooms } from '@/services/masterDataService';
import {
  getStructure,
  getTeacherAssignments,
  getTeamLeaders,
  saveClass,
  saveClassTeachers,
  saveTeamLeader,
} from '@/services/school-config/schoolConfigService';
import {
  ROOM_CLASS_TEMPLATE_URL,
  SHEETS,
  TEACHER_TEMPLATE_URL,
  matchRoomClassRows,
  matchTeacherRows,
  readWorkbook,
} from '@/utils/school-config/yearSetupImport';
import '@/styles/modules/menu-planning.css';

const loadDocumentScan = () => import('@/assets/lottie/document-scan.json');

const MODES = {
  rooms: { title: 'Nhập phòng và lớp từ Excel', template: ROOM_CLASS_TEMPLATE_URL, sheets: [SHEETS.rooms, SHEETS.classes] },
  teachers: { title: 'Nhập giáo viên và tổ trưởng từ Excel', template: TEACHER_TEMPLATE_URL, sheets: [SHEETS.teachers, SHEETS.leaders] },
};

function PreviewTable({ title, head, rows }) {
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
                  <td key={j} className={j === cells.length - 1 && title.startsWith('Dòng lỗi') ? 'td-bad' : undefined}>
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

/**
 * Thiết lập năm học: nhập Excel theo file mẫu (Cần 30/10/2026). mode "rooms": sheet Phòng + Lớp (bước Phòng & lớp);
 * mode "teachers": sheet Giáo viên + Tổ trưởng (bước Tổ trưởng & giáo viên). Xem trước rồi ghi các dòng hợp lệ;
 * dòng BE từ chối hiện lỗi đỏ ở bảng kết quả.
 */
export function YearSetupImportPanel({ open, mode, yearId, onClose }) {
  const { user } = useAuth();
  const toast = useToast();
  const md = useMasterData();
  const cfg = MODES[mode] || MODES.rooms;
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState(null);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [changed, setChanged] = useState(false);

  const isRooms = mode === 'rooms';
  const valid = result ? (isRooms ? result.rooms.length + result.classes.length : result.classes.length + result.leaders.length) : 0;

  const close = (savedNow = false) => {
    setFileName('');
    setResult(null);
    onClose(changed || savedNow === true);
    setChanged(false);
  };

  const match = async (sheets) => {
    const campuses = md.campuses.filter((c) => c.status !== 'INACTIVE');
    if (isRooms) {
      const [rooms, structure] = await Promise.all([
        getRooms({ schoolYear: yearId }, user),
        getStructure({ schoolYear: yearId, campusId: '' }, user),
      ]);
      return matchRoomClassRows(sheets, {
        campuses,
        ageGroups: structure?.ageGroups || [],
        rooms: rooms || [],
        classes: structure?.classes || [],
        schoolYear: yearId,
      });
    }
    const [assign, leaders] = await Promise.all([
      getTeacherAssignments({ schoolYear: yearId, campusId: 'all' }, user),
      getTeamLeaders({ schoolYear: yearId }, user),
    ]);
    const teachers = [...(assign?.teachers || [])];
    (leaders?.leaderCandidates || []).forEach((t) => {
      if (!teachers.some((x) => x.id === t.id)) teachers.push(t);
    });
    return matchTeacherRows(sheets, {
      campuses,
      ageGroups: assign?.ageGroups || [],
      classes: assign?.classes || [],
      teachers,
      leaders: Object.fromEntries((leaders?.teamLeaders || []).map((l) => [l.ageGroupId, l.userId])),
      schoolYear: yearId,
    });
  };

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setFileName(file.name);
    setReading(true);
    try {
      setResult(await match(await readWorkbook(file, cfg.sheets)));
    } catch {
      setResult({
        rooms: [],
        classes: [],
        leaders: [],
        errors: [{ sheet: '—', row: '—', reason: 'Không đọc được file. Hãy dùng file .xlsx theo file mẫu.' }],
      });
    } finally {
      setReading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    const failed = [];
    let saved = 0;
    if (isRooms) {
      const idOf = {};
      for (const r of result.rooms) {
        try {
          const res = await saveRoom(r.id, r.form, user);
          idOf[r.key] = res?.id;
          saved += 1;
        } catch (err) {
          failed.push({ sheet: SHEETS.rooms, row: r.row, name: r.form.room, reason: err.message });
        }
      }
      for (const c of result.classes) {
        const locationId = idOf[c.form.locationId] || c.form.locationId;
        if (String(locationId).startsWith('new-')) {
          failed.push({
            sheet: SHEETS.classes,
            row: c.row,
            name: c.form.name,
            reason: `Phòng ${c.roomCode} chưa lưu được nên chưa lưu lớp`,
          });
          continue;
        }
        try {
          await saveClass(c.id, { ...c.form, locationId }, user);
          saved += 1;
        } catch (err) {
          failed.push({ sheet: SHEETS.classes, row: c.row, name: c.form.name, reason: err.message });
        }
      }
    } else {
      // Lớp ít giáo viên lưu trước để người chuyển lớp được nhả ra; lỗi thì thử lại một lần
      let pending = [...result.classes].sort((a, b) => a.form.teacherIds.length - b.form.teacherIds.length);
      for (let round = 0; round < 2 && pending.length; round += 1) {
        const retry = [];
        for (const c of pending) {
          try {
            await saveClassTeachers(c.id, c.form, user);
            saved += 1;
          } catch (err) {
            if (round === 0) retry.push(c);
            else failed.push({ sheet: SHEETS.teachers, row: c.row, name: c.name, reason: err.message });
          }
        }
        pending = retry;
      }
      for (const l of result.leaders) {
        try {
          await saveTeamLeader(l.payload, user);
          saved += 1;
        } catch (err) {
          failed.push({ sheet: SHEETS.leaders, row: l.row, name: l.groupName, reason: err.message });
        }
      }
    }
    setSaving(false);
    if (saved) {
      setChanged(true);
      toast.success(`Đã lưu ${saved} dòng.`);
    }
    if (failed.length) {
      toast.error('Một số dòng chưa lưu được, xem lý do ở bảng lỗi.');
      setResult({ rooms: [], classes: [], leaders: [], errors: failed });
    } else close(true);
  };

  const errorRows = (result?.errors || []).map((e) => [e.sheet, e.row, e.name || '—', e.reason]);
  return (
    <SidePanel
      open={open}
      title={cfg.title}
      onClose={() => close()}
      wide
      footer={
        <>
          <button type="button" className="btn" onClick={() => close()} disabled={saving}>
            Đóng
          </button>
          <button type="button" className="btn btn--primary" onClick={save} disabled={!valid || saving}>
            {saving ? <Spinner small /> : <Upload size={16} />} Lưu {valid} dòng hợp lệ
          </button>
        </>
      }
    >
      <ol className="td-import-steps">
        <li>
          Tải file mẫu và điền theo từng sheet.
          <div>
            <a className="btn btn--sm" href={cfg.template} download>
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
            {reading && <LottiePlayer load={loadDocumentScan} speed={0.6} className="import-reading import-reading--inline" />}
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
          <PreviewTable title="Dòng lỗi (không lưu)" head={['Sheet', 'Dòng', 'Tên', 'Lý do']} rows={errorRows} />
          {isRooms ? (
            <>
              <PreviewTable
                title="Phòng"
                head={['Dòng', 'Điểm trường', 'Mã phòng', 'Tên phòng', 'Sức chứa', '']}
                rows={(result.rooms || []).map((r) => [
                  r.row,
                  r.campusName,
                  r.form.room,
                  r.form.name,
                  r.form.capacity,
                  r.id ? 'Cập nhật' : 'Thêm mới',
                ])}
              />
              <PreviewTable
                title="Lớp"
                head={['Dòng', 'Điểm trường', 'Tên lớp', 'Nhóm tuổi', 'Phòng', 'Sĩ số tối đa', '']}
                rows={(result.classes || []).map((c) => [
                  c.row,
                  c.campusName,
                  c.form.name,
                  c.groupName,
                  c.roomCode,
                  c.form.capacity,
                  c.id ? 'Cập nhật' : 'Thêm mới',
                ])}
              />
            </>
          ) : (
            <>
              <PreviewTable
                title="Giáo viên"
                head={['Dòng', 'Điểm trường', 'Lớp', 'Giáo viên', 'Chủ nhiệm']}
                rows={(result.classes || []).map((c) => [c.row, c.campusName, c.name, c.teacherNames.join(', '), c.homeroomName])}
              />
              <PreviewTable
                title="Tổ trưởng"
                head={['Dòng', 'Nhóm tuổi', 'Tổ trưởng']}
                rows={(result.leaders || []).map((l) => [l.row, l.groupName, l.leaderName])}
              />
            </>
          )}
        </div>
      )}
    </SidePanel>
  );
}
