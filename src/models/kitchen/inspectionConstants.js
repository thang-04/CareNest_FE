/*
 * Kiểm thực ba bước (M1 tươi / M1 khô, M2, M3) theo Quyết định 1246/QĐ-BYT. Mã khóa ô và lựa chọn dùng chung cho mock, API đề xuất,
 * màn nhập và bản in. Mỗi cột: { key, label, type, group?, readOnly?, wide?, ... }:
 * - `check`: một ô tích, giá trị `checkedValue` khi tích, rỗng khi bỏ tích (Có chứng từ, Đảm bảo…);
 * - `passfail`: hai ô tích Đạt / Không đạt loại trừ nhau (PASS / FAIL), rỗng = chưa chọn;
 * - `group`: tên nhóm cột liền kề ở hàng tiêu đề trên (Nơi cung cấp, Kiểm tra điều kiện vệ sinh).
 * `readOnly` = BE điền sẵn từ thực đơn, suất, hàng nhập.
 */
export const INSPECTION_TAB = { FRESH: 'fresh', DRY: 'dry', PROCESS: 'process', SERVE: 'serve', SAMPLE: 'sample' };
export const INSPECTION_TAB_ORDER = [
  INSPECTION_TAB.FRESH,
  INSPECTION_TAB.DRY,
  INSPECTION_TAB.PROCESS,
  INSPECTION_TAB.SERVE,
  INSPECTION_TAB.SAMPLE,
];

/** Cột bắt buộc đã chọn Đạt / Không đạt ở mọi dòng thì mới ký được; M5 không có (bếp ghi, PHT soát). */
export const INSPECTION_REQUIRED = { fresh: 'sensory', dry: 'sensory', process: 'sensory', serve: 'sensory', sample: null };

export const INSPECTION_TAB_LABELS = {
  fresh: 'M1 · Thực phẩm tươi',
  dry: 'M1 · Thực phẩm khô',
  process: 'M2 · Khi chế biến',
  serve: 'M3 · Trước khi ăn',
  sample: 'M5 · Lưu và hủy mẫu',
};

export const INSPECTION_DECISION = '1246/QĐ-BYT';

/** Tiêu đề trên biểu mẫu: bước, tên mẫu, mục con (M1 tách hai bảng tươi / khô). */
export const INSPECTION_FORMS = {
  fresh: {
    step: 'BƯỚC 1',
    title: 'KIỂM TRA TRƯỚC KHI CHẾ BIẾN THỨC ĂN',
    part: 'I. Thực phẩm tươi sống: thịt, cá, rau, củ, quả...',
    form: 'Mẫu 1',
    hint: 'Kiểm tra thực phẩm tươi nhập trong ngày.',
  },
  dry: {
    step: 'BƯỚC 1',
    title: 'KIỂM TRA TRƯỚC KHI CHẾ BIẾN THỨC ĂN',
    part: 'II. Thực phẩm khô, thực phẩm bao gói sẵn, phụ gia thực phẩm',
    form: 'Mẫu 1',
    hint: 'Kiểm tra thực phẩm khô, bao gói sẵn xuất kho trong ngày.',
  },
  process: {
    step: 'BƯỚC 2',
    title: 'KIỂM TRA KHI CHẾ BIẾN THỨC ĂN',
    part: '',
    form: 'Mẫu 2',
    hint: 'Kiểm tra từng món trong lúc sơ chế, chế biến.',
  },
  serve: {
    step: 'BƯỚC 3',
    title: 'KIỂM TRA TRƯỚC KHI ĂN',
    part: '',
    form: 'Mẫu 3',
    hint: 'Kiểm tra từng món trước khi chia cho trẻ ăn.',
  },
  sample: {
    step: 'BƯỚC 3',
    title: 'MẪU BIỂU THEO DÕI LƯU VÀ HỦY MẪU THỨC ĂN LƯU',
    part: '',
    form: 'Mẫu 5',
    hint: 'Sổ lưu mẫu do bếp ghi trên App; PHT soát và ký xác nhận.',
  },
};

/** Biến thể in: M3 gộp lưu mẫu (B3) và M4 nhãn mẫu lập từ dữ liệu M5. */
export const INSPECTION_VARIANT_FORMS = {
  combined: {
    step: 'B3',
    title: 'KIỂM TRA TRƯỚC KHI ĂN - LƯU MẪU THỨC ĂN VÀ HỦY MẪU THỨC ĂN LƯU',
    part: '',
    form: 'Mẫu 3',
  },
  label: { step: '', title: 'MẪU SỐ 4: NHÃN MẪU THỨC ĂN LƯU', part: '', form: 'Mẫu 4' },
};

/** Các bản in của từng mẫu: key `main` là chính mẫu đó. */
export const INSPECTION_PRINT_VARIANTS = {
  fresh: [{ key: 'main', label: 'M1 · Thực phẩm tươi' }],
  dry: [{ key: 'main', label: 'M1 · Thực phẩm khô' }],
  process: [{ key: 'main', label: 'M2 · Khi chế biến' }],
  serve: [
    { key: 'main', label: 'M3 · Kiểm tra trước khi ăn' },
    { key: 'combined', label: 'M3 gộp · Kiểm tra và lưu mẫu' },
  ],
  sample: [
    { key: 'main', label: 'M5 · Theo dõi lưu và hủy mẫu' },
    { key: 'label', label: 'M4 · Nhãn mẫu thức ăn lưu' },
  ],
};

export const STORAGE_OPTIONS = [
  { value: 'ROOM', label: 'Nhiệt độ thường' },
  { value: 'COOL', label: 'Mát, lạnh' },
  { value: 'FROZEN', label: 'Đông lạnh' },
];

export const PASS = 'PASS';
export const FAIL = 'FAIL';

/** Biện pháp xử lý gợi ý khi dòng Không đạt (QĐ 1246 Điều 3.1: loại bỏ, trả lại, tiêu hủy; Điều 4.2, 5.5: loại bỏ). Bấm để điền vào ghi chú. */
export const INSPECTION_ACTIONS = {
  fresh: ['Loại bỏ', 'Trả lại nhà cung cấp', 'Tiêu hủy'],
  dry: ['Loại bỏ', 'Trả lại nhà cung cấp', 'Tiêu hủy'],
  process: ['Loại bỏ', 'Tiêu hủy'],
  serve: ['Loại bỏ', 'Tiêu hủy'],
};

const check = (key, label, extra = {}) => ({ key, label, type: 'check', checkedValue: extra.checkedValue || 'YES', ...extra });

export const INSPECTION_COLUMNS = {
  fresh: [
    { key: 'name', label: 'Tên thực phẩm', type: 'text', readOnly: true, wide: true },
    { key: 'receivedAt', label: 'Giờ nhập', type: 'time' },
    { key: 'quantity', label: 'Khối lượng (kg/lít...)', type: 'number', unitKey: 'unit' },
    { key: 'supplierName', label: 'Tên cơ sở', type: 'text', wide: true, group: 'Nơi cung cấp' },
    { key: 'supplierContact', label: 'Địa chỉ, điện thoại', type: 'text', wide: true, group: 'Nơi cung cấp' },
    { key: 'deliveryPerson', label: 'Tên người giao hàng', type: 'text', group: 'Nơi cung cấp' },
    check('invoice', 'Chứng từ, hóa đơn', { checkLabel: 'Có' }),
    check('vetCert', 'Giấy ĐK VS thú y', { checkLabel: 'Có' }),
    check('quarantineCert', 'Giấy kiểm dịch', { checkLabel: 'Có' }),
    { key: 'sensory', label: 'Kiểm tra cảm quan (màu, mùi vị, trạng thái, bảo quản...)', type: 'passfail' },
    { key: 'rapidTest', label: 'Xét nghiệm nhanh (nếu có) (vi sinh, vật lý)', type: 'passfail' },
    { key: 'note', label: 'Biện pháp xử lý / ghi chú', type: 'text', wide: true },
  ],
  dry: [
    { key: 'name', label: 'Tên thực phẩm', type: 'text', readOnly: true, wide: true },
    { key: 'manufacturer', label: 'Tên cơ sở sản xuất', type: 'text', wide: true },
    { key: 'manufacturerAddress', label: 'Địa chỉ sản xuất', type: 'text', wide: true },
    { key: 'receivedAt', label: 'Ngày nhập', type: 'date' },
    { key: 'quantity', label: 'Khối lượng (kg/lít...)', type: 'number', unitKey: 'unit' },
    { key: 'supplierName', label: 'Tên cơ sở', type: 'text', wide: true, group: 'Nơi cung cấp' },
    { key: 'deliveryPerson', label: 'Tên chủ giao hàng', type: 'text', group: 'Nơi cung cấp' },
    { key: 'supplierContact', label: 'Địa chỉ, điện thoại', type: 'text', wide: true, group: 'Nơi cung cấp' },
    { key: 'expiryDate', label: 'Hạn sử dụng', type: 'date' },
    { key: 'storageCondition', label: 'Điều kiện bảo quản', type: 'select', options: STORAGE_OPTIONS },
    check('invoice', 'Chứng từ, hóa đơn', { checkLabel: 'Có' }),
    { key: 'sensory', label: 'Kiểm tra cảm quan (nhãn, bao bì, bảo quản, hạn sử dụng...)', type: 'passfail' },
    { key: 'note', label: 'Biện pháp xử lý / ghi chú', type: 'text', wide: true },
  ],
  process: [
    { key: 'sessionLabel', label: 'Ca/bữa ăn', type: 'text', readOnly: true },
    { key: 'dishName', label: 'Tên món ăn', type: 'text', readOnly: true, wide: true },
    { key: 'mainIngredients', label: 'Nguyên liệu chính để chế biến (tên, số lượng...)', type: 'text', wide: true },
    { key: 'servings', label: 'Số lượng / số suất ăn', type: 'number', readOnly: true },
    { key: 'prepDoneAt', label: 'Thời gian sơ chế xong', type: 'time' },
    { key: 'cookDoneAt', label: 'Thời gian chế biến xong', type: 'time' },
    check('hygienePeople', 'Người tham gia chế biến', { checkedValue: 'OK', checkLabel: 'Đảm bảo', group: 'Kiểm tra điều kiện vệ sinh' }),
    check('hygieneEquipment', 'Trang thiết bị, dụng cụ', {
      checkedValue: 'OK',
      checkLabel: 'Đảm bảo',
      group: 'Kiểm tra điều kiện vệ sinh',
    }),
    check('hygieneArea', 'Khu vực chế biến và phụ trợ', { checkedValue: 'OK', checkLabel: 'Đảm bảo', group: 'Kiểm tra điều kiện vệ sinh' }),
    { key: 'sensory', label: 'Kiểm tra cảm quan (màu, mùi, vị, trạng thái, bảo quản)', type: 'passfail' },
    { key: 'note', label: 'Biện pháp xử lý / ghi chú', type: 'text', wide: true },
  ],
  serve: [
    { key: 'sessionLabel', label: 'Ca/bữa ăn', type: 'text', readOnly: true },
    { key: 'dishName', label: 'Tên món ăn', type: 'text', readOnly: true, wide: true },
    { key: 'servings', label: 'Số lượng suất ăn', type: 'number', readOnly: true },
    { key: 'servedAt', label: 'Thời gian chia món ăn xong', type: 'time' },
    { key: 'eatStartAt', label: 'Thời gian bắt đầu ăn', type: 'time' },
    check('utensils', 'Dụng cụ chia, chứa đựng, che đậy, bảo quản thức ăn', { checkedValue: 'OK', checkLabel: 'Đảm bảo' }),
    { key: 'sensory', label: 'Kiểm tra cảm quan (màu, mùi, vị, trạng thái, bảo quản)', type: 'passfail' },
    { key: 'note', label: 'Biện pháp xử lý / ghi chú', type: 'text', wide: true },
  ],
};

const SAMPLE_COLUMNS = [
  { key: 'sessionLabel', label: 'Bữa ăn (giờ ăn...)', type: 'text', readOnly: true },
  { key: 'dishName', label: 'Tên mẫu thức ăn', type: 'text', readOnly: true, wide: true },
  { key: 'servings', label: 'Số lượng suất ăn', type: 'number', readOnly: true },
  { key: 'weight', label: 'Khối lượng / thể tích mẫu (gam/ml)', type: 'text', readOnly: true },
  { key: 'container', label: 'Dụng cụ chứa mẫu thức ăn lưu', type: 'text', readOnly: true, wide: true },
  { key: 'temperature', label: 'Nhiệt độ bảo quản mẫu', type: 'text', readOnly: true },
  { key: 'takenAt', label: 'Thời gian lấy mẫu (giờ, ngày, tháng, năm)', type: 'timestamp', readOnly: true },
  { key: 'destroyedAt', label: 'Thời gian hủy mẫu (giờ, ngày, tháng, năm)', type: 'timestamp', readOnly: true },
];
const QUALITY_NOTE = { key: 'qualityNote', label: 'Ghi chú (chất lượng mẫu thức ăn lưu)', type: 'text', wide: true };
INSPECTION_COLUMNS.sample = [...SAMPLE_COLUMNS, QUALITY_NOTE];
/** M3 gộp: các cột M3 rồi các cột lưu mẫu (bỏ ba cột trùng bữa, món, suất). */
export const INSPECTION_COMBINED_COLUMNS = [...INSPECTION_COLUMNS.serve, ...SAMPLE_COLUMNS.slice(3), QUALITY_NOTE];

export const INSPECTION_STATUS = { DRAFT: 'DRAFT', SIGNED: 'SIGNED' };
export const INSPECTION_STATUS_LABELS = { DRAFT: 'Chưa ký', SIGNED: 'Đã ký' };

/** Ô ký tay (ký sau khi in) cạnh ô "Người kiểm tra" do PHT ký ảnh. */
export const INSPECTION_HAND_SIGN_LABELS = {
  fresh: ['Người trực tiếp nấu ăn', 'NV Y tế hoặc thanh tra'],
  dry: ['Người trực tiếp nấu ăn', 'NV Y tế hoặc thanh tra'],
  process: ['Người trực tiếp nấu ăn', 'NV Y tế hoặc thanh tra'],
  serve: ['Người trực tiếp nấu ăn', 'NV Y tế hoặc thanh tra'],
  sample: ['Người thực hiện lưu mẫu', 'Người thực hiện hủy mẫu'],
};
