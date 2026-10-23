import { formatDate } from '@/utils/format';

/*
 * Lỗi nghiệp vụ của API Cấu hình trường: BE trả desc tiếng Anh, không kèm field. Bảng này đổi desc thành câu tiếng Việt
 * và gắn vào ô nhập tương ứng (field theo tên field của form FE); `_form` = lỗi chung hiển thị đầu form/hộp thoại.
 * TODO(Cần): bỏ bảng khi BE trả mã lỗi + field cho lỗi nghiệp vụ (đề xuất trong docs/validation-cau-hinh-truong.md).
 */
const RULES = [
  // Body không đọc được (sai kiểu số/id/enum)
  [/^Malformed request/, '_form', () => 'Dữ liệu gửi lên không đúng định dạng, kiểm tra lại các ô đã nhập'],
  // Năm học
  [/^School year name must be YYYY-YYYY/, 'name', () => 'Tên năm học có dạng NNNN-NNNN, năm sau lớn hơn năm trước 1 năm (ví dụ 2027-2028)'],
  [/^End date must be after start date/, 'endDate', () => 'Ngày kết thúc phải sau ngày bắt đầu'],
  [/^School year (\S+) already exists/, 'name', (m) => `Năm học ${m[1]} đã tồn tại`],
  [/^Dates overlap school year (\S+)/, 'endDate', (m) => `Khoảng thời gian trùng với năm học ${m[1]}`],
  [/^School year name can only change before it starts/, 'name', () => 'Chỉ đổi được tên năm học khi năm học chưa bắt đầu'],
  [/^School year already has classes, name cannot change/, 'name', () => 'Năm học đã có lớp, không đổi được tên'],
  [/^School year already has classes and cannot be deleted/, '_form', () => 'Năm học đã có lớp, không xóa được'],
  [/^Only a planned school year can be deleted/, '_form', () => 'Chỉ xóa được năm học chưa bắt đầu'],
  [/^School year is not ready to activate: (.+)/, '_form', (m) => `Năm học chưa đủ điều kiện kích hoạt: ${m[1]}`],
  [/^Only a planned school year can be activated/, '_form', () => 'Chỉ kích hoạt được năm học chưa bắt đầu'],
  [/^Type the school year name exactly/, 'confirmName', () => 'Gõ đúng tên năm học để xác nhận'],
  [/^School year can be activated from (\S+)/, '_form', (m) => `Chỉ kích hoạt được từ ${formatDate(m[1])}`],
  [/^Activate school year (\S+) first/, '_form', (m) => `Kích hoạt năm học ${m[1]} trước`],
  [
    /^School year can only be closed after its end date (\S+)/,
    '_form',
    (m) => `Chỉ kết thúc được năm học sau ngày kết thúc ${formatDate(m[1])}`,
  ],
  [/^Only the active school year can be closed/, '_form', () => 'Chỉ kết thúc được năm học đang hoạt động'],
  [/^School year (\S+) is closed/, '_form', (m) => `Năm học ${m[1]} đã kết thúc, chỉ xem được`],
  // Điểm trường
  [/^Campus code already exists/, 'code', () => 'Mã điểm trường đã tồn tại'],
  [/^Campus name already exists/, 'name', () => 'Tên điểm trường đã tồn tại'],
  [/^The main campus cannot be deleted/, '_form', () => 'Không xóa được điểm trường chính'],
  [/^Campus already has classes and cannot be deleted/, '_form', () => 'Điểm trường đã có lớp, không xóa được'],
  [/^Campus already has rooms and cannot be deleted/, '_form', () => 'Điểm trường đã có phòng, không xóa được'],
  [/^Campus already has staff and cannot be deleted/, '_form', () => 'Điểm trường đã có nhân sự, không xóa được'],
  [/^The main campus cannot be deactivated/, '_form', () => 'Không ngừng hoạt động được điểm trường chính.'],
  [
    /^Campus has classes in the active or planned school year/,
    '_form',
    () => 'Điểm trường còn lớp ở năm học đang hoạt động hoặc sắp diễn ra. Chuyển hoặc xóa lớp trước.',
  ],
  [
    /^Campus still has vice principals assigned: (.+)/,
    '_form',
    (m) => `Điểm trường còn PHT phụ trách: ${m[1]}. Gỡ phân công PHT trước khi ngừng hoạt động.`,
  ],
  [/^Campus is inactive/, 'campusId', () => 'Điểm trường đã ngừng hoạt động, chọn điểm trường khác.'],
  // Phòng
  [/^Room is used by a class and cannot change type/, 'type', () => 'Phòng đang là phòng học của lớp, không đổi được loại phòng'],
  [/^Campus already has a room with this code/, 'room', () => 'Điểm trường đã có phòng cùng mã'],
  [/^Campus already has a room with this name/, 'name', () => 'Điểm trường đã có phòng cùng tên'],
  [/^Classroom type room needs a capacity/, 'capacity', () => 'Nhập sức chứa của phòng học'],
  [/^Person in charge must be staff working at this campus/, 'managerUserId', () => 'Người phụ trách phải là nhân sự của điểm trường này'],
  [
    /^A class using this room has max size (\d+)/,
    'capacity',
    (m) => `Lớp đang dùng phòng có sĩ số tối đa ${m[1]}, sức chứa không được nhỏ hơn`,
  ],
  [/^Room cannot be (\S+): it is the room of (.+)/, '_form', (m) => `Phòng đang là phòng học của ${m[2]}, không thực hiện được`],
  // Nhóm tuổi
  [/^Age group already has classes and cannot be deleted/, '_form', () => 'Nhóm tuổi đã có lớp, không xóa được'],
  [/^Age group has a team leader and cannot be deleted/, '_form', () => 'Nhóm tuổi đã có tổ trưởng, không xóa được'],
  [/^Age to must be greater than age from/, 'ageToMonths', () => 'Độ tuổi đến phải lớn hơn độ tuổi từ'],
  [/^Age group name already exists/, 'name', () => 'Tên nhóm tuổi đã tồn tại'],
  [/^Age range overlaps age group (.+)/, 'ageToMonths', (m) => `Độ tuổi trùng với nhóm ${m[1]}`],
  [/^Cannot lower max class size: (.+) exceed (\d+) children/, 'maxClassSize', (m) => `Không hạ được: ${m[1]} đang vượt ${m[2]} trẻ`],
  // Lớp
  [/^A class cannot move to another school year/, 'schoolYear', () => 'Không chuyển lớp sang năm học khác được'],
  [/^Class already has children; age group cannot change/, 'ageGroupId', () => 'Lớp đã có trẻ, không đổi được nhóm tuổi'],
  [/^Class already has children and cannot be deleted/, '_form', () => 'Lớp đã có trẻ, không xóa được'],
  [/^Choose another school year to copy from/, 'sourceYearId', () => 'Chọn năm học khác với năm đang cấu hình để sao chép'],
  [/^Room does not belong to the selected campus/, 'locationId', () => 'Phòng không thuộc điểm trường đã chọn'],
  [/^Room is no longer in use/, 'locationId', () => 'Phòng đã ngừng sử dụng'],
  [/^Campus already has a class with this name/, 'name', () => 'Điểm trường đã có lớp cùng tên trong năm học này'],
  [/^Room is already used by another class/, 'locationId', () => 'Phòng đã được lớp khác dùng trong năm học này'],
  [
    /^Class max size must be between (\d+) and (\d+)/,
    'capacity',
    (m) => `Sĩ số tối đa từ ${m[1]} đến ${m[2]} (theo nhóm tuổi và sức chứa phòng)`,
  ],
  // Giờ chốt
  [/^Cutoff time and effective date have not changed/, 'time', () => 'Giờ chốt và ngày áp dụng chưa thay đổi'],
  [/^Effective date must be inside school year (\S+)/, 'effectiveFrom', (m) => `Ngày áp dụng phải nằm trong năm học ${m[1]}`],
  // Phân công giáo viên / tổ trưởng
  [/^Choose 2 different teachers for the class/, 'teacherIds', () => 'Chọn 2 giáo viên khác nhau cho lớp'],
  [
    /^Homeroom teacher must be one of the class teachers/,
    'homeroomTeacherId',
    () => 'Giáo viên chủ nhiệm phải là một trong 2 giáo viên của lớp',
  ],
  [/^Only teachers of the class campus can be assigned/, 'teacherIds', () => 'Chỉ phân công giáo viên thuộc điểm trường của lớp'],

  [/^A class of the active school year needs a replacement teacher/, 'teacherIds', () => 'Năm học đang hoạt động: chọn giáo viên thay thế'],
  [/^Teacher account is locked/, 'teacherIds', () => 'Tài khoản giáo viên đã bị khóa'],
  [/^Teacher (.+) already teaches class (.+)/, 'teacherIds', (m) => `Giáo viên ${m[1]} đang dạy lớp ${m[2]}; gỡ ở lớp đó trước`],
  [/^Team leader must be a working teacher/, 'userId', () => 'Tổ trưởng phải là giáo viên đang làm việc'],
  // Xếp lớp năm mới
  [/^Oldest age group: choose graduate or stay/, '_form', () => 'Trẻ nhóm tuổi lớn nhất chỉ chọn Ra trường hoặc Ở lại'],
  [/^Choose a class of the new school year/, '_form', () => 'Chọn lớp của năm học mới'],
  [/^Class max size exceeded: (.+)/, '_form', (m) => `Vượt sĩ số tối đa: ${m[1]}`],
  [/^Placements are only for an upcoming school year/, '_form', () => 'Chỉ xếp lớp cho năm học chưa bắt đầu'],
  [/^No active school year to move children from/, '_form', () => 'Không có năm học đang hoạt động để chuyển trẻ'],
  [/^(.+) has no age group; set it before placing children/, '_form', (m) => `${m[1]} chưa có nhóm tuổi, cập nhật lớp trước khi xếp`],
  [/^(.+) is not the right age group for (\w+)/, '_form', (m) => `${m[1]} không đúng nhóm tuổi cho lựa chọn này`],
  [/^Child (\S+) is not in a class of the active year/, '_form', () => 'Có trẻ không thuộc lớp nào của năm học đang hoạt động'],
  // Điểm danh (đợt 1)
  [/^Attendance is locked after (\S+)/, '_form', (m) => `Điểm danh và báo ăn đã khóa sau ${m[1]}.`],
  [/^Attendance can only be recorded for today/, '_form', () => 'Chỉ điểm danh được cho ngày hôm nay.'],
  [/^Selected date is not a school day/, '_form', () => 'Ngày đã chọn không phải ngày học.'],
  [
    /^Attendance can only be recorded for classes of the active school year/,
    '_form',
    () => 'Lớp thuộc năm học đã kết thúc hoặc chưa bắt đầu, chỉ xem được.',
  ],
  [/^Child list does not match the class/, '_form', () => 'Danh sách trẻ đã thay đổi, tải lại trang rồi điểm danh lại.'],
  [/^Absent child cannot have meals/, '_form', () => 'Trẻ vắng mặt không thể đăng ký suất ăn.'],
  [/^Meal session is not served to this class/, '_form', () => 'Bữa ăn không thuộc nhóm tuổi của lớp. Chọn lại bữa ăn.'],
  [/^Choose a school day from the start of the school year to today/, 'date', () => 'Chọn một ngày học từ đầu năm học đến hôm nay.'],
  [/^Attendance of this day is not locked yet/, '_form', () => 'Chưa đến giờ khóa, giáo viên vẫn điểm danh được.'],
  [/^Unlock deadline must be after now/, 'until', () => 'Chọn hạn mở lại sau thời điểm hiện tại và không quá ngày kết thúc năm học.'],
  [/^This class already has an active unlock for this day/, '_form', () => 'Lớp/ngày này đang có lần mở lại còn hiệu lực.'],
  [/^Only classes of the active school year can be unlocked/, '_form', () => 'Chỉ mở lại lớp thuộc năm học đang hoạt động.'],
  [/^This unlock has already ended/, '_form', () => 'Lần mở lại này đã hết hiệu lực.'],
  [/^(From and to dates are required|To date must not)/, 'to', () => 'Chọn khoảng ngày hợp lệ, không chọn ngày trong tương lai.'],
  [/^Date range must not exceed 366 days/, 'to', () => 'Khoảng ngày tối đa 1 năm.'],
  // Sức khỏe trong ngày
  [/^Save the child as present today before recording health/, '_form', () => 'Chỉ ghi nhận cho trẻ đã lưu Có mặt trong ngày hôm nay.'],
  [/^Health can only be recorded for today/, '_form', () => 'Chỉ ghi nhận sức khỏe cho ngày hôm nay.'],
  [/^Health can only be recorded for classes of the active school year/, '_form', () => 'Lớp không thuộc năm học đang hoạt động.'],
  [/^A noted observation needs symptoms or a note/, 'note', () => 'Ghi biểu hiện hoặc ghi chú cần lưu ý.'],
  [/^Actions are only recorded for a noted observation/, 'actions', () => 'Chỉ ghi xử trí khi có dấu hiệu cần lưu ý.'],
  [/^Referral needs a place and a time/, 'referral', () => 'Nhập nơi chuyển trẻ đến và giờ chuyển.'],
  [/^Child is not in this class/, '_form', () => 'Trẻ không thuộc danh sách lớp hiện tại.'],
];

/** Lỗi validation của BE (400, data=[{field,message}]) khi FE chưa chặn trước. */
const FIELD_INVALID = 'Giá trị không hợp lệ';
// Tên field của DTO BE khác tên field form FE
const FIELD_ALIAS = { schoolYearId: 'schoolYear', roomId: 'locationId' };

/** { message, details } tiếng Việt cho lỗi BE; null nếu không nhận ra. */
export const translateBeError = (desc, data) => {
  if (Array.isArray(data) && data.length) {
    return {
      message: 'Dữ liệu chưa hợp lệ, xem các ô báo đỏ',
      details: Object.fromEntries(data.map((e) => [FIELD_ALIAS[e.field] || e.field, FIELD_INVALID])),
    };
  }
  for (const [re, field, text] of RULES) {
    const m = re.exec(desc || '');
    if (m) {
      const message = text(m);
      return { message, details: { [field]: message } };
    }
  }
  return null;
};
