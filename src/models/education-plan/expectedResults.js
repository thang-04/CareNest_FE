/*
 * Danh mục "kết quả mong đợi" theo Chương trình GDMN, dùng làm gợi ý ở cột Nhóm kết quả mong đợi khi lập kế hoạch năm.
 * Khối 3–4 tuổi lấy nguyên các câu trong kế hoạch năm thật của MN Thái Dương (chỉ nội dung chương trình, không có tên người).
 * Sau này BE trả về danh mục này thay cho hằng số ở FE.
 */

/** Theo nhóm tuổi → lĩnh vực → danh sách { sub: lĩnh vực con, text: câu kết quả mong đợi }. */
export const EXPECTED_RESULTS = {
  'ag-3': {
    'Phát triển thể chất': [
      { sub: 'Phát triển vận động', text: 'Thực hiện được các động tác phát triển các nhóm cơ và hô hấp' },
      { sub: 'Phát triển vận động', text: 'Thể hiện kỹ năng vận động cơ bản và các tố chất trong vận động' },
      { sub: 'Phát triển vận động', text: 'Thực hiện và phối hợp được các cử động của bàn tay, ngón tay, phối hợp tay- mắt' },
      { sub: 'Giáo dục dinh dưỡng và sức khỏe', text: 'Trẻ khỏe mạnh, cân nặng chiều cao phát triển bình thường theo độ tuổi' },
      { sub: 'Giáo dục dinh dưỡng và sức khỏe', text: 'Biết một số món ăn, thực phẩm thông thường và ích lợi của chúng đối với sức khỏe' },
      { sub: 'Giáo dục dinh dưỡng và sức khỏe', text: 'Thực hiện được một số việc tự phục vụ trong sinh hoạt' },
      { sub: 'Giáo dục dinh dưỡng và sức khỏe', text: 'Có một số hành vi và thói quen tốt trong sinh hoạt và giữ gìn sức khỏe' },
      { sub: 'Giáo dục dinh dưỡng và sức khỏe', text: 'Biết một số nguy cơ không an toàn và phòng tránh' },
    ],
    'Phát triển nhận thức': [
      { sub: 'KPKH', text: 'Xem xét và tìm hiểu đặc điểm của các sự vật, hiện tượng' },
      { sub: 'KPKH', text: 'Nhận biết mối quan hệ đơn giản của sự vật hiện tượng và giải quyết vấn đề đơn giản' },
      { sub: 'KPKH', text: 'Thể hiện sự hiểu biết đối tượng bằng các cách khác nhau' },
      { sub: 'LQVT', text: 'Nhận biết số đếm và số lượng' },
      { sub: 'LQVT', text: 'Sắp xếp theo qui tắc' },
      { sub: 'LQVT', text: 'So sánh 2 đối tượng' },
      { sub: 'LQVT', text: 'Nhận biết hình dạng' },
      { sub: 'LQVT', text: 'Nhận biết vị trí trong không gian và định hướng thời gian' },
      { sub: 'KPXH', text: 'Nhận biết bản thân, gia đình, trường lớp mầm non và cộng đồng' },
      { sub: 'KPXH', text: 'Nhận biết một số nghề phổ biến và nghề truyền thống của địa phương' },
      { sub: 'KPXH', text: 'Nhận biết một số lễ hội và danh lam thắng cảnh' },
    ],
    'Phát triển ngôn ngữ': [
      { sub: null, text: 'Nghe và hiểu lời nói' },
      { sub: null, text: 'Sử dụng lời nói trong cuộc sống hàng ngày' },
      { sub: null, text: 'Làm quen với việc đọc - viết' },
    ],
    'Phát triển tình cảm và kỹ năng xã hội': [
      { sub: null, text: 'Thể hiện ý thức về bản thân' },
      { sub: null, text: 'Trẻ thể hiện sự tự tin, tự lực' },
      { sub: null, text: 'Nhận biết và thể hiện cảm xúc, tình cảm với con người, sự vật, hiện tượng xung quanh' },
      { sub: null, text: 'Hành vi và qui tắc ứng xử xã hội' },
      { sub: null, text: 'Quan tâm đến môi trường' },
    ],
    'Phát triển thẩm mỹ': [
      { sub: null, text: 'Cảm nhận và thể hiện cảm xúc trước vẻ đẹp của thiên nhiên, cuộc sống và các tác phẩm nghệ thuật' },
      { sub: null, text: 'Một số kĩ năng trong hoạt động âm nhạc và hoạt động tạo hình' },
      { sub: null, text: 'Thể hiện sự sáng tạo khi tham gia các hoạt động nghệ thuật (âm nhạc, tạo hình)' },
    ],
  },
  // TODO(Tiền): bổ sung nhà trẻ (ag-2), mẫu giáo nhỡ (ag-4), mẫu giáo lớn (ag-5) từ văn bản Chương trình GDMN.
  'ag-2': {},
  'ag-4': {},
  'ag-5': {},
};

/** Gợi ý cho một ô: đúng nhóm tuổi và lĩnh vực; câu cùng lĩnh vực con xếp trước. */
export const expectedResultsFor = (ageGroupId, domain, sub) => {
  const list = EXPECTED_RESULTS[ageGroupId]?.[domain] || [];
  const key = (sub || '').trim().toLowerCase();
  const same = (x) => !!key && (x.sub || '').toLowerCase() === key;
  return [...list.filter(same), ...list.filter((x) => !same(x))];
};
