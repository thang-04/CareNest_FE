import { IMPORT_COLUMNS } from '@/models/children/childrenConstants';

/** Hàng tiêu đề + dòng mẫu của file nhập tiếp nhận (mỗi giá trị ứng 1 cột IMPORT_COLUMNS, đúng thứ tự). */
export const importTemplateRows = () => [
  IMPORT_COLUMNS.map((c) => c.label),
  // Dòng mẫu: hành chính và tiền sử bắt buộc trừ CCCD trẻ, nhóm máu (user chốt 2026-10-22; tuần thai từ 2026-11-04).
  [
    ...['Nguyễn Minh An', '15/04/2022', 'Nam', 'Nguyễn Văn Bình', 'Bố', '0912 000 111', '9999 1200 0111'],
    // Báo ăn: Có (CHD-13), đứng trước Dị ứng.
    ...['phuhuynh.mau@example.com', 'Có', 'Không', ''],
    ...['', 'Không', '39', 'Kinh', 'Trẻ em dưới 6 tuổi', '', 'Hải Phòng', 'Phường Thượng Hồng', 'Số 1 đường mẫu'],
    ...['Không', 'Không', 'Không', ''],
    ...['', '', '', '', '', '', '', '', '', '', ''],
  ],
];
