import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getSchoolYears } from '@/services/school-config/schoolConfigService';
import { readPickedSchoolYear, savePickedSchoolYear } from '@/services/school-config/schoolYearPick';
import { DB_CHANGED_EVENT } from '@/mocks/dbEvents';
import { lockedYearOf, preparingYearOf } from '@/utils/schoolYearPrep';

const SchoolYearContext = createContext(null);

// Nhãn trạng thái cạnh năm học ở header: biết ngay năm đang xem còn sửa được hay chỉ xem
const STATUS_LABELS = { ACTIVE: 'Đang hoạt động', PLANNED: 'Sắp diễn ra', CLOSED: 'Đã kết thúc' };

// Năm tự chọn giữ qua F5 trong cùng tab, không thì tải lại trang về năm đang hoạt động và trang của năm khác
// (vd. lớp năm sau) báo "Không tìm thấy"; tab mới vẫn theo năm đang hoạt động
const readPicked = (user) => readPickedSchoolYear(user?.id);
const savePicked = (user, id) => savePickedSchoolYear(user?.id, id);

const toOption = (y) => ({
  id: y.id,
  beId: y.beId,
  label: String(y.name || y.id).replace('-', ' - '),
  status: y.status,
  // BE CFG-YR-05: năm sắp diễn ra đã tới ngày mở chuẩn bị
  preparing: !!y.preparing,
  prepDate: y.prepDate || null,
  statusLabel: y.preparing ? 'Đang chuẩn bị' : STATUS_LABELS[y.status] || '',
  startDate: y.startDate || null,
  endDate: y.endDate || null,
  semester1Start: y.semester1Start || null,
  semester1End: y.semester1End || null,
  semester2Start: y.semester2Start || null,
  semester2End: y.semester2End || null,
});

/**
 * Current school year chosen in the header, shared by every page.
 * Use: const { schoolYear, setSchoolYear, schoolYears } = useSchoolYear();
 * The list comes from school configuration (#16); the service supplies the available years.
 */
export function SchoolYearProvider({ children }) {
  const { user } = useAuth();
  const [schoolYears, setSchoolYears] = useState([]);
  const [schoolYear, setChosenYear] = useState('');
  // Người dùng tự chọn năm ở header thì giữ; chưa chọn thì luôn theo năm đang hoạt động (kể cả sau khi chuyển năm)
  const picked = useRef(false);
  const optionsRef = useRef(schoolYears);
  optionsRef.current = schoolYears;
  const userRef = useRef(user);
  userRef.current = user;
  // Ô chọn ở header trả id dạng chuỗi; giữ đúng kiểu id của danh sách năm (BE: số) để các màn so khớp được
  const setSchoolYear = useCallback((id) => {
    picked.current = true;
    savePicked(userRef.current, id);
    setChosenYear(optionsRef.current.find((o) => String(o.id) === String(id))?.id ?? id);
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    let alive = true;
    const load = () =>
      getSchoolYears(user)
        .then((list) => {
          if (!alive || !Array.isArray(list)) return;
          // DB chưa có năm học nào (vd. vừa xóa sạch để test): header trống, không hiện danh sách năm demo cứng
          if (!list.length) {
            setSchoolYears([]);
            setChosenYear('');
            return;
          }
          const options = list.map(toOption);
          setSchoolYears(options);
          // Mặc định: năm đang hoạt động; chưa có thì năm sắp diễn ra sớm nhất (năm sẽ kích hoạt tiếp)
          const nextPlanned = options
            .filter((o) => o.status === 'PLANNED')
            .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)))[0];
          const active = (options.find((o) => o.status === 'ACTIVE') || nextPlanned || options[0]).id;
          // Chưa chọn trong lần mở này ⇒ lấy năm đã chọn trước F5 (nếu còn trong danh sách)
          const saved = picked.current ? null : options.find((o) => String(o.id) === readPicked(user));
          if (saved) picked.current = true;
          setChosenYear((current) => {
            if (saved) return saved.id;
            return picked.current && options.some((o) => o.id === current) ? current : active;
          });
        })
        .catch(() => {
          if (alive) {
            setSchoolYears([]);
            setChosenYear('');
          }
        });
    load();
    window.addEventListener(DB_CHANGED_EVENT, load);
    return () => {
      alive = false;
      window.removeEventListener(DB_CHANGED_EVENT, load);
    };
  }, [user]);

  // Năm đang chọn đã kết thúc ⇒ mọi màn Cấu hình trường chỉ xem (Cần chốt 22/10/2026)
  const yearReadOnly = schoolYears.find((o) => o.id === schoolYear)?.status === 'CLOSED';
  // Việc trong ngày, tiếp nhận, xếp lớp luôn theo năm đang hoạt động dù header chọn năm khác (user chốt 2026-10-28, Y-1, Y-3)
  const activeYear = schoolYears.find((o) => o.status === 'ACTIVE') || null;
  // CFG-YR-05/CHD-12: header ở năm sắp diễn ra chưa tới ngày mở chuẩn bị ⇒ màn trẻ, sức khỏe, đón trẻ chỉ xem
  const lockedYear = lockedYearOf(schoolYears, schoolYear);
  const yearLocked = !!lockedYear;
  // CHD-11: đã tới ngày mở chuẩn bị ⇒ được tiếp nhận, xếp lớp cho năm đó
  const preparingYear = preparingYearOf(schoolYears, schoolYear);
  const value = useMemo(
    () => ({ schoolYear, setSchoolYear, schoolYears, yearReadOnly, activeYear, yearLocked, lockedYear, preparingYear }),
    [schoolYear, setSchoolYear, schoolYears, yearReadOnly, activeYear, yearLocked, lockedYear, preparingYear],
  );
  return <SchoolYearContext.Provider value={value}>{children}</SchoolYearContext.Provider>;
}

export const useSchoolYear = () => useContext(SchoolYearContext);
