/**
 * 63 tỉnh/thành + quận/huyện Việt Nam (tình hình đến 2021, trước hợp nhất 2025), dùng cho gợi ý dropdown
 * ở ô Tỉnh/thành, Phường/xã khi tiếp nhận trẻ. Ô vẫn nhập tự do được; danh sách này chỉ gợi ý — BE là
 * nguồn sự thật cho việc lưu (GBR-CP).
 *
 * @typedef {{ code: string, name: string, districts: string[] }} VnProvince
 */
export const VN_PROVINCES = 
[
  {
    "code": "01",
    "name": "TP Hà Nội",
    "districts": [
      "Huyện Ba Vì",
      "Huyện Chương Mỹ",
      "Huyện Đan Phượng",
      "Huyện Đông Anh",
      "Huyện Gia Lâm",
      "Huyện Hoài Đức",
      "Huyện Mê Linh",
      "Huyện Mỹ Đức",
      "Huyện Phú Xuyên",
      "Huyện Phúc Thọ",
      "Huyện Quốc Oai",
      "Huyện Sóc Sơn",
      "Huyện Thạch Thất",
      "Huyện Thanh Oai",
      "Huyện Thanh Trì",
      "Huyện Thường Tín",
      "Huyện Ứng Hòa",
      "Quận Ba Đình",
      "Quận Bắc Từ Liêm",
      "Quận Cầu Giấy",
      "Quận Đống Đa",
      "Quận Hà Đông",
      "Quận Hai Bà Trưng",
      "Quận Hoàn Kiếm",
      "Quận Hoàng Mai",
      "Quận Long Biên",
      "Quận Nam Từ Liêm",
      "Quận Tây Hồ",
      "Quận Thanh Xuân",
      "Thị xã Sơn Tây"
    ]
  },
  {
    "code": "02",
    "name": "Tỉnh Hà Giang",
    "districts": [
      "Huyện Bắc Mê",
      "Huyện Bắc Quang",
      "Huyện Đồng Văn",
      "Huyện Hoàng Su Phì",
      "Huyện Mèo Vạc",
      "Huyện Quản Bạ",
      "Huyện Quang Bình",
      "Huyện Vị Xuyên",
      "Huyện Xín Mần",
      "Huyện Yên Minh",
      "Thành phố Hà Giang"
    ]
  },
  {
    "code": "04",
    "name": "Tỉnh Cao Bằng",
    "districts": [
      "Huyện Bảo Lạc",
      "Huyện Bảo Lâm",
      "Huyện Hạ Lang",
      "Huyện Hà Quảng",
      "Huyện Hoà An",
      "Huyện Nguyên Bình",
      "Huyện Quảng Hòa",
      "Huyện Thạch An",
      "Huyện Trùng Khánh",
      "Thành phố Cao Bằng"
    ]
  },
  {
    "code": "06",
    "name": "Tỉnh Bắc Kạn",
    "districts": [
      "Huyện Ba Bể",
      "Huyện Bạch Thông",
      "Huyện Chợ Đồn",
      "Huyện Chợ Mới",
      "Huyện Na Rì",
      "Huyện Ngân Sơn",
      "Huyện Pác Nặm",
      "Thành phố Thành Phố Bắc Kạn"
    ]
  },
  {
    "code": "08",
    "name": "Tỉnh Tuyên Quang",
    "districts": [
      "Huyện Chiêm Hóa",
      "Huyện Hàm Yên",
      "Huyện Lâm Bình",
      "Huyện Na Hang",
      "Huyện Sơn Dương",
      "Huyện Yên Sơn",
      "Thành phố Tuyên Quang"
    ]
  },
  {
    "code": "10",
    "name": "Tỉnh Lào Cai",
    "districts": [
      "Huyện Bảo Thắng",
      "Huyện Bảo Yên",
      "Huyện Bát Xát",
      "Huyện Bắc Hà",
      "Huyện Mường Khương",
      "Huyện Si Ma Cai",
      "Huyện Văn Bàn",
      "Thành phố Lào Cai",
      "Thị xã Sa Pa"
    ]
  },
  {
    "code": "11",
    "name": "Tỉnh Điện Biên",
    "districts": [
      "Huyện Điện Biên",
      "Huyện Điện Biên Đông",
      "Huyện Mường Ảng",
      "Huyện Mường Chà",
      "Huyện Mường Nhé",
      "Huyện Nậm Pồ",
      "Huyện Tủa Chùa",
      "Huyện Tuần Giáo",
      "Thành phố Điện Biên Phủ",
      "Thị xã Thị Xã Mường Lay"
    ]
  },
  {
    "code": "12",
    "name": "Tỉnh Lai Châu",
    "districts": [
      "Huyện Mường Tè",
      "Huyện Nậm Nhùn",
      "Huyện Phong Thổ",
      "Huyện Sìn Hồ",
      "Huyện Tam Đường",
      "Huyện Tân Uyên",
      "Huyện Than Uyên",
      "Thành phố Lai Châu"
    ]
  },
  {
    "code": "14",
    "name": "Tỉnh Sơn La",
    "districts": [
      "Huyện Bắc Yên",
      "Huyện Mai Sơn",
      "Huyện Mộc Châu",
      "Huyện Mường La",
      "Huyện Phù Yên",
      "Huyện Quỳnh Nhai",
      "Huyện Sông Mã",
      "Huyện Sốp Cộp",
      "Huyện Thuận Châu",
      "Huyện Vân Hồ",
      "Huyện Yên Châu",
      "Thành phố Sơn La"
    ]
  },
  {
    "code": "15",
    "name": "Tỉnh Yên Bái",
    "districts": [
      "Huyện Lục Yên",
      "Huyện Mù Căng Chải",
      "Huyện Trạm Tấu",
      "Huyện Trấn Yên",
      "Huyện Văn Chấn",
      "Huyện Văn Yên",
      "Huyện Yên Bình",
      "Thành phố Yên Bái",
      "Thị xã Nghĩa Lộ"
    ]
  },
  {
    "code": "17",
    "name": "Tỉnh Hoà Bình",
    "districts": [
      "Huyện Cao Phong",
      "Huyện Đà Bắc",
      "Huyện Kim Bôi",
      "Huyện Lạc Sơn",
      "Huyện Lạc Thủy",
      "Huyện Lương Sơn",
      "Huyện Mai Châu",
      "Huyện Tân Lạc",
      "Huyện Yên Thủy",
      "Thành phố Hòa Bình"
    ]
  },
  {
    "code": "19",
    "name": "Tỉnh Thái Nguyên",
    "districts": [
      "Huyện Đại Từ",
      "Huyện Định Hóa",
      "Huyện Đồng Hỷ",
      "Huyện Phú Bình",
      "Huyện Phú Lương",
      "Huyện Võ Nhai",
      "Thành phố Sông Công",
      "Thành phố Thái Nguyên",
      "Thị xã Phổ Yên"
    ]
  },
  {
    "code": "20",
    "name": "Tỉnh Lạng Sơn",
    "districts": [
      "Huyện Bắc Sơn",
      "Huyện Bình Gia",
      "Huyện Cao Lộc",
      "Huyện Chi Lăng",
      "Huyện Đình Lập",
      "Huyện Hữu Lũng",
      "Huyện Lộc Bình",
      "Huyện Tràng Định",
      "Huyện Văn Lãng",
      "Huyện Văn Quan",
      "Thành phố Lạng Sơn"
    ]
  },
  {
    "code": "22",
    "name": "Tỉnh Quảng Ninh",
    "districts": [
      "Huyện Ba Chẽ",
      "Huyện Bình Liêu",
      "Huyện Cô Tô",
      "Huyện Đầm Hà",
      "Huyện Hải Hà",
      "Huyện Tiên Yên",
      "Huyện Vân Đồn",
      "Thành phố Cẩm Phả",
      "Thành phố Hạ Long",
      "Thành phố Móng Cái",
      "Thành phố Uông Bí",
      "Thị xã Đông Triều",
      "Thị xã Quảng Yên"
    ]
  },
  {
    "code": "24",
    "name": "Tỉnh Bắc Giang",
    "districts": [
      "Huyện Hiệp Hòa",
      "Huyện Lạng Giang",
      "Huyện Lục Nam",
      "Huyện Lục Ngạn",
      "Huyện Sơn Động",
      "Huyện Tân Yên",
      "Huyện Việt Yên",
      "Huyện Yên Dũng",
      "Huyện Yên Thế",
      "Thành phố Bắc Giang"
    ]
  },
  {
    "code": "25",
    "name": "Tỉnh Phú Thọ",
    "districts": [
      "Huyện Cẩm Khê",
      "Huyện Đoan Hùng",
      "Huyện Hạ Hoà",
      "Huyện Lâm Thao",
      "Huyện Phù Ninh",
      "Huyện Tam Nông",
      "Huyện Tân Sơn",
      "Huyện Thanh Ba",
      "Huyện Thanh Sơn",
      "Huyện Thanh Thuỷ",
      "Huyện Yên Lập",
      "Thành phố Việt Trì",
      "Thị xã Phú Thọ"
    ]
  },
  {
    "code": "26",
    "name": "Tỉnh Vĩnh Phúc",
    "districts": [
      "Huyện Bình Xuyên",
      "Huyện Lập Thạch",
      "Huyện Sông Lô",
      "Huyện Tam Dương",
      "Huyện Tam Đảo",
      "Huyện Vĩnh Tường",
      "Huyện Yên Lạc",
      "Thành phố Phúc Yên",
      "Thành phố Vĩnh Yên"
    ]
  },
  {
    "code": "27",
    "name": "Tỉnh Bắc Ninh",
    "districts": [
      "Huyện Gia Bình",
      "Huyện Lương Tài",
      "Huyện Quế Võ",
      "Huyện Thuận Thành",
      "Huyện Tiên Du",
      "Huyện Yên Phong",
      "Thành phố Bắc Ninh",
      "Thị xã Từ Sơn"
    ]
  },
  {
    "code": "30",
    "name": "Tỉnh Hải Dương",
    "districts": [
      "Huyện Bình Giang",
      "Huyện Cẩm Giàng",
      "Huyện Gia Lộc",
      "Huyện Kim Thành",
      "Huyện Nam Sách",
      "Huyện Ninh Giang",
      "Huyện Thanh Hà",
      "Huyện Thanh Miện",
      "Huyện Tứ Kỳ",
      "Thành phố Chí Linh",
      "Thành phố Hải Dương",
      "Thị xã Kinh Môn"
    ]
  },
  {
    "code": "31",
    "name": "TP Hải Phòng",
    "districts": [
      "Huyện An Dương",
      "Huyện An Lão",
      "Huyện Bạch Long Vĩ",
      "Huyện Cát Hải",
      "Huyện Kiến Thuỵ",
      "Huyện Thuỷ Nguyên",
      "Huyện Tiên Lãng",
      "Huyện Vĩnh Bảo",
      "Quận Dương Kinh",
      "Quận Đồ Sơn",
      "Quận Hải An",
      "Quận Hồng Bàng",
      "Quận Kiến An",
      "Quận Lê Chân",
      "Quận Ngô Quyền"
    ]
  },
  {
    "code": "33",
    "name": "Tỉnh Hưng Yên",
    "districts": [
      "Huyện Ân Thi",
      "Huyện Khoái Châu",
      "Huyện Kim Động",
      "Huyện Phù Cừ",
      "Huyện Tiên Lữ",
      "Huyện Văn Giang",
      "Huyện Văn Lâm",
      "Huyện Yên Mỹ",
      "Thành phố Hưng Yên",
      "Thị xã Mỹ Hào"
    ]
  },
  {
    "code": "34",
    "name": "Tỉnh Thái Bình",
    "districts": [
      "Huyện Đông Hưng",
      "Huyện Hưng Hà",
      "Huyện Kiến Xương",
      "Huyện Quỳnh Phụ",
      "Huyện Thái Thụy",
      "Huyện Tiền Hải",
      "Huyện Vũ Thư",
      "Thành phố Thái Bình"
    ]
  },
  {
    "code": "35",
    "name": "Tỉnh Hà Nam",
    "districts": [
      "Huyện Bình Lục",
      "Huyện Kim Bảng",
      "Huyện Lý Nhân",
      "Huyện Thanh Liêm",
      "Thành phố Phủ Lý",
      "Thị xã Duy Tiên"
    ]
  },
  {
    "code": "36",
    "name": "Tỉnh Nam Định",
    "districts": [
      "Huyện Giao Thủy",
      "Huyện Hải Hậu",
      "Huyện Mỹ Lộc",
      "Huyện Nam Trực",
      "Huyện Nghĩa Hưng",
      "Huyện Trực Ninh",
      "Huyện Vụ Bản",
      "Huyện Xuân Trường",
      "Huyện Ý Yên",
      "Thành phố Nam Định"
    ]
  },
  {
    "code": "37",
    "name": "Tỉnh Ninh Bình",
    "districts": [
      "Huyện Gia Viễn",
      "Huyện Hoa Lư",
      "Huyện Kim Sơn",
      "Huyện Nho Quan",
      "Huyện Yên Khánh",
      "Huyện Yên Mô",
      "Thành phố Ninh Bình",
      "Thành phố Tam Điệp"
    ]
  },
  {
    "code": "38",
    "name": "Tỉnh Thanh Hóa",
    "districts": [
      "Huyện Bá Thước",
      "Huyện Cẩm Thủy",
      "Huyện Đông Sơn",
      "Huyện Hà Trung",
      "Huyện Hậu Lộc",
      "Huyện Hoằng Hóa",
      "Huyện Lang Chánh",
      "Huyện Mường Lát",
      "Huyện Nga Sơn",
      "Huyện Ngọc Lặc",
      "Huyện Như Thanh",
      "Huyện Như Xuân",
      "Huyện Nông Cống",
      "Huyện Quan Hóa",
      "Huyện Quan Sơn",
      "Huyện Quảng Xương",
      "Huyện Thạch Thành",
      "Huyện Thiệu Hóa",
      "Huyện Thọ Xuân",
      "Huyện Thường Xuân",
      "Huyện Triệu Sơn",
      "Huyện Vĩnh Lộc",
      "Huyện Yên Định",
      "Thành phố Sầm Sơn",
      "Thành phố Thanh Hóa",
      "Thị xã Bỉm Sơn",
      "Thị xã Nghi Sơn"
    ]
  },
  {
    "code": "40",
    "name": "Tỉnh Nghệ An",
    "districts": [
      "Huyện Anh Sơn",
      "Huyện Con Cuông",
      "Huyện Diễn Châu",
      "Huyện Đô Lương",
      "Huyện Hưng Nguyên",
      "Huyện Kỳ Sơn",
      "Huyện Nam Đàn",
      "Huyện Nghi Lộc",
      "Huyện Nghĩa Đàn",
      "Huyện Quế Phong",
      "Huyện Quỳ Châu",
      "Huyện Quỳ Hợp",
      "Huyện Quỳnh Lưu",
      "Huyện Tân Kỳ",
      "Huyện Thanh Chương",
      "Huyện Tương Dương",
      "Huyện Yên Thành",
      "Thành phố Vinh",
      "Thị xã Cửa Lò",
      "Thị xã Hoàng Mai",
      "Thị xã Thái Hoà"
    ]
  },
  {
    "code": "42",
    "name": "Tỉnh Hà Tĩnh",
    "districts": [
      "Huyện Can Lộc",
      "Huyện Cẩm Xuyên",
      "Huyện Đức Thọ",
      "Huyện Hương Khê",
      "Huyện Hương Sơn",
      "Huyện Kỳ Anh",
      "Huyện Lộc Hà",
      "Huyện Nghi Xuân",
      "Huyện Thạch Hà",
      "Huyện Vũ Quang",
      "Thành phố Hà Tĩnh",
      "Thị xã Hồng Lĩnh",
      "Thị xã Kỳ Anh"
    ]
  },
  {
    "code": "44",
    "name": "Tỉnh Quảng Bình",
    "districts": [
      "Huyện Bố Trạch",
      "Huyện Lệ Thủy",
      "Huyện Minh Hóa",
      "Huyện Quảng Ninh",
      "Huyện Quảng Trạch",
      "Huyện Tuyên Hóa",
      "Thành phố Thành Phố Đồng Hới",
      "Thị xã Ba Đồn"
    ]
  },
  {
    "code": "45",
    "name": "Tỉnh Quảng Trị",
    "districts": [
      "Huyện Cam Lộ",
      "Huyện Cồn Cỏ",
      "Huyện Đa Krông",
      "Huyện Gio Linh",
      "Huyện Hải Lăng",
      "Huyện Hướng Hóa",
      "Huyện Triệu Phong",
      "Huyện Vĩnh Linh",
      "Thành phố Đông Hà",
      "Thị xã Quảng Trị"
    ]
  },
  {
    "code": "46",
    "name": "Tỉnh Thừa Thiên Huế",
    "districts": [
      "Huyện A Lưới",
      "Huyện Nam Đông",
      "Huyện Phong Điền",
      "Huyện Phú Lộc",
      "Huyện Phú Vang",
      "Huyện Quảng Điền",
      "Thành phố Huế",
      "Thị xã Hương Thủy",
      "Thị xã Hương Trà"
    ]
  },
  {
    "code": "48",
    "name": "TP Đà Nẵng",
    "districts": [
      "Huyện Hòa Vang",
      "Huyện Hoàng Sa",
      "Quận Cẩm Lệ",
      "Quận Hải Châu",
      "Quận Liên Chiểu",
      "Quận Ngũ Hành Sơn",
      "Quận Sơn Trà",
      "Quận Thanh Khê"
    ]
  },
  {
    "code": "49",
    "name": "Tỉnh Quảng Nam",
    "districts": [
      "Huyện Bắc Trà My",
      "Huyện Duy Xuyên",
      "Huyện Đại Lộc",
      "Huyện Đông Giang",
      "Huyện Hiệp Đức",
      "Huyện Nam Giang",
      "Huyện Nam Trà My",
      "Huyện Nông Sơn",
      "Huyện Núi Thành",
      "Huyện Phú Ninh",
      "Huyện Phước Sơn",
      "Huyện Quế Sơn",
      "Huyện Tây Giang",
      "Huyện Thăng Bình",
      "Huyện Tiên Phước",
      "Thành phố Hội An",
      "Thành phố Tam Kỳ",
      "Thị xã Điện Bàn"
    ]
  },
  {
    "code": "51",
    "name": "Tỉnh Quảng Ngãi",
    "districts": [
      "Huyện Ba Tơ",
      "Huyện Bình Sơn",
      "Huyện Lý Sơn",
      "Huyện Minh Long",
      "Huyện Mộ Đức",
      "Huyện Nghĩa Hành",
      "Huyện Sơn Hà",
      "Huyện Sơn Tây",
      "Huyện Sơn Tịnh",
      "Huyện Trà Bồng",
      "Huyện Tư Nghĩa",
      "Thành phố Quảng Ngãi",
      "Thị xã Đức Phổ"
    ]
  },
  {
    "code": "52",
    "name": "Tỉnh Bình Định",
    "districts": [
      "Huyện An Lão",
      "Huyện Hoài Ân",
      "Huyện Phù Cát",
      "Huyện Phù Mỹ",
      "Huyện Tây Sơn",
      "Huyện Tuy Phước",
      "Huyện Vân Canh",
      "Huyện Vĩnh Thạnh",
      "Thành phố Quy Nhơn",
      "Thị xã An Nhơn",
      "Thị xã Hoài Nhơn"
    ]
  },
  {
    "code": "54",
    "name": "Tỉnh Phú Yên",
    "districts": [
      "Huyện Đồng Xuân",
      "Huyện Phú Hoà",
      "Huyện Sông Hinh",
      "Huyện Sơn Hòa",
      "Huyện Tây Hoà",
      "Huyện Tuy An",
      "Thành phố Tuy Hoà",
      "Thị xã Đông Hòa",
      "Thị xã Sông Cầu"
    ]
  },
  {
    "code": "56",
    "name": "Tỉnh Khánh Hòa",
    "districts": [
      "Huyện Cam Lâm",
      "Huyện Diên Khánh",
      "Huyện Khánh Sơn",
      "Huyện Khánh Vĩnh",
      "Huyện Trường Sa",
      "Huyện Vạn Ninh",
      "Thành phố Cam Ranh",
      "Thành phố Nha Trang",
      "Thị xã Ninh Hòa"
    ]
  },
  {
    "code": "58",
    "name": "Tỉnh Ninh Thuận",
    "districts": [
      "Huyện Bác Ái",
      "Huyện Ninh Hải",
      "Huyện Ninh Phước",
      "Huyện Ninh Sơn",
      "Huyện Thuận Bắc",
      "Huyện Thuận Nam",
      "Thành phố Phan Rang-Tháp Chàm"
    ]
  },
  {
    "code": "60",
    "name": "Tỉnh Bình Thuận",
    "districts": [
      "Huyện Bắc Bình",
      "Huyện Đức Linh",
      "Huyện Hàm Tân",
      "Huyện Hàm Thuận Bắc",
      "Huyện Hàm Thuận Nam",
      "Huyện Phú Quí",
      "Huyện Tánh Linh",
      "Huyện Tuy Phong",
      "Thành phố Phan Thiết",
      "Thị xã La Gi"
    ]
  },
  {
    "code": "62",
    "name": "Tỉnh Kon Tum",
    "districts": [
      "Huyện Đắk Glei",
      "Huyện Đắk Hà",
      "Huyện Đắk Tô",
      "Huyện Ia H' Drai",
      "Huyện Kon Plông",
      "Huyện Kon Rẫy",
      "Huyện Ngọc Hồi",
      "Huyện Sa Thầy",
      "Huyện Tu Mơ Rông",
      "Thành phố Kon Tum"
    ]
  },
  {
    "code": "64",
    "name": "Tỉnh Gia Lai",
    "districts": [
      "Huyện Chư Păh",
      "Huyện Chư Prông",
      "Huyện Chư Pưh",
      "Huyện Chư Sê",
      "Huyện Đăk Đoa",
      "Huyện Đăk Pơ",
      "Huyện Đức Cơ",
      "Huyện Ia Grai",
      "Huyện Ia Pa",
      "Huyện KBang",
      "Huyện Kông Chro",
      "Huyện Krông Pa",
      "Huyện Mang Yang",
      "Huyện Phú Thiện",
      "Thành phố Pleiku",
      "Thị xã An Khê",
      "Thị xã Ayun Pa"
    ]
  },
  {
    "code": "66",
    "name": "Tỉnh Đắk Lắk",
    "districts": [
      "Huyện Buôn Đôn",
      "Huyện Cư Kuin",
      "Huyện Cư M'gar",
      "Huyện Ea H'leo",
      "Huyện Ea Kar",
      "Huyện Ea Súp",
      "Huyện Krông A Na",
      "Huyện Krông Bông",
      "Huyện Krông Búk",
      "Huyện Krông Năng",
      "Huyện Krông Pắc",
      "Huyện Lắk",
      "Huyện M'Đrắk",
      "Thành phố Buôn Ma Thuột",
      "Thị xã Thị Xã Buôn Hồ"
    ]
  },
  {
    "code": "67",
    "name": "Tỉnh Đắk Nông",
    "districts": [
      "Huyện Cư Jút",
      "Huyện Đăk Glong",
      "Huyện Đắk Mil",
      "Huyện Đắk R'Lấp",
      "Huyện Đắk Song",
      "Huyện Krông Nô",
      "Huyện Tuy Đức",
      "Thành phố Gia Nghĩa"
    ]
  },
  {
    "code": "68",
    "name": "Tỉnh Lâm Đồng",
    "districts": [
      "Huyện Bảo Lâm",
      "Huyện Cát Tiên",
      "Huyện Di Linh",
      "Huyện Đạ Huoai",
      "Huyện Đạ Tẻh",
      "Huyện Đam Rông",
      "Huyện Đơn Dương",
      "Huyện Đức Trọng",
      "Huyện Lạc Dương",
      "Huyện Lâm Hà",
      "Thành phố Bảo Lộc",
      "Thành phố Đà Lạt"
    ]
  },
  {
    "code": "70",
    "name": "Tỉnh Bình Phước",
    "districts": [
      "Huyện Bù Đăng",
      "Huyện Bù Đốp",
      "Huyện Bù Gia Mập",
      "Huyện Chơn Thành",
      "Huyện Đồng Phú",
      "Huyện Hớn Quản",
      "Huyện Lộc Ninh",
      "Huyện Phú Riềng",
      "Thành phố Đồng Xoài",
      "Thị xã Bình Long",
      "Thị xã Phước Long"
    ]
  },
  {
    "code": "72",
    "name": "Tỉnh Tây Ninh",
    "districts": [
      "Huyện Bến Cầu",
      "Huyện Châu Thành",
      "Huyện Dương Minh Châu",
      "Huyện Gò Dầu",
      "Huyện Tân Biên",
      "Huyện Tân Châu",
      "Thành phố Tây Ninh",
      "Thị xã Hòa Thành",
      "Thị xã Trảng Bàng"
    ]
  },
  {
    "code": "74",
    "name": "Tỉnh Bình Dương",
    "districts": [
      "Huyện Bàu Bàng",
      "Huyện Bắc Tân Uyên",
      "Huyện Dầu Tiếng",
      "Huyện Phú Giáo",
      "Thành phố Dĩ An",
      "Thành phố Thủ Dầu Một",
      "Thành phố Thuận An",
      "Thị xã Bến Cát",
      "Thị xã Tân Uyên"
    ]
  },
  {
    "code": "75",
    "name": "Tỉnh Đồng Nai",
    "districts": [
      "Huyện Cẩm Mỹ",
      "Huyện Định Quán",
      "Huyện Long Thành",
      "Huyện Nhơn Trạch",
      "Huyện Tân Phú",
      "Huyện Thống Nhất",
      "Huyện Trảng Bom",
      "Huyện Vĩnh Cửu",
      "Huyện Xuân Lộc",
      "Thành phố Biên Hòa",
      "Thành phố Long Khánh"
    ]
  },
  {
    "code": "77",
    "name": "Tỉnh Bà Rịa - Vũng Tàu",
    "districts": [
      "Huyện Châu Đức",
      "Huyện Côn Đảo",
      "Huyện Đất Đỏ",
      "Huyện Long Điền",
      "Huyện Xuyên Mộc",
      "Thành phố Bà Rịa",
      "Thành phố Vũng Tàu",
      "Thị xã Phú Mỹ"
    ]
  },
  {
    "code": "79",
    "name": "TP Hồ Chí Minh",
    "districts": [
      "Huyện Bình Chánh",
      "Huyện Cần Giờ",
      "Huyện Củ Chi",
      "Huyện Hóc Môn",
      "Huyện Nhà Bè",
      "Quận 1",
      "Quận 10",
      "Quận 11",
      "Quận 12",
      "Quận 3",
      "Quận 4",
      "Quận 5",
      "Quận 6",
      "Quận 7",
      "Quận 8",
      "Quận Bình Tân",
      "Quận Bình Thạnh",
      "Quận Gò Vấp",
      "Quận Phú Nhuận",
      "Quận Tân Bình",
      "Quận Tân Phú",
      "Thành phố Thủ Đức"
    ]
  },
  {
    "code": "80",
    "name": "Tỉnh Long An",
    "districts": [
      "Huyện Bến Lức",
      "Huyện Cần Đước",
      "Huyện Cần Giuộc",
      "Huyện Châu Thành",
      "Huyện Đức Hòa",
      "Huyện Đức Huệ",
      "Huyện Mộc Hóa",
      "Huyện Tân Hưng",
      "Huyện Tân Thạnh",
      "Huyện Tân Trụ",
      "Huyện Thạnh Hóa",
      "Huyện Thủ Thừa",
      "Huyện Vĩnh Hưng",
      "Thành phố Tân An",
      "Thị xã Kiến Tường"
    ]
  },
  {
    "code": "82",
    "name": "Tỉnh Tiền Giang",
    "districts": [
      "Huyện Cái Bè",
      "Huyện Cai Lậy",
      "Huyện Châu Thành",
      "Huyện Chợ Gạo",
      "Huyện Gò Công Đông",
      "Huyện Gò Công Tây",
      "Huyện Tân Phú Đông",
      "Huyện Tân Phước",
      "Thành phố Mỹ Tho",
      "Thị xã Cai Lậy",
      "Thị xã Gò Công"
    ]
  },
  {
    "code": "83",
    "name": "Tỉnh Bến Tre",
    "districts": [
      "Huyện Ba Tri",
      "Huyện Bình Đại",
      "Huyện Châu Thành",
      "Huyện Chợ Lách",
      "Huyện Giồng Trôm",
      "Huyện Mỏ Cày Bắc",
      "Huyện Mỏ Cày Nam",
      "Huyện Thạnh Phú",
      "Thành phố Bến Tre"
    ]
  },
  {
    "code": "84",
    "name": "Tỉnh Trà Vinh",
    "districts": [
      "Huyện Càng Long",
      "Huyện Cầu Kè",
      "Huyện Cầu Ngang",
      "Huyện Châu Thành",
      "Huyện Duyên Hải",
      "Huyện Tiểu Cần",
      "Huyện Trà Cú",
      "Thành phố Trà Vinh",
      "Thị xã Duyên Hải"
    ]
  },
  {
    "code": "86",
    "name": "Tỉnh Vĩnh Long",
    "districts": [
      "Huyện Bình Tân",
      "Huyện Long Hồ",
      "Huyện Mang Thít",
      "Huyện Tam Bình",
      "Huyện Trà Ôn",
      "Huyện Vũng Liêm",
      "Thành phố Vĩnh Long",
      "Thị xã Bình Minh"
    ]
  },
  {
    "code": "87",
    "name": "Tỉnh Đồng Tháp",
    "districts": [
      "Huyện Cao Lãnh",
      "Huyện Châu Thành",
      "Huyện Hồng Ngự",
      "Huyện Lai Vung",
      "Huyện Lấp Vò",
      "Huyện Tam Nông",
      "Huyện Tân Hồng",
      "Huyện Thanh Bình",
      "Huyện Tháp Mười",
      "Thành phố Cao Lãnh",
      "Thành phố Hồng Ngự",
      "Thành phố Sa Đéc"
    ]
  },
  {
    "code": "89",
    "name": "Tỉnh An Giang",
    "districts": [
      "Huyện An Phú",
      "Huyện Châu Phú",
      "Huyện Châu Thành",
      "Huyện Chợ Mới",
      "Huyện Phú Tân",
      "Huyện Thoại Sơn",
      "Huyện Tịnh Biên",
      "Huyện Tri Tôn",
      "Thành phố Châu Đốc",
      "Thành phố Long Xuyên",
      "Thị xã Tân Châu"
    ]
  },
  {
    "code": "91",
    "name": "Tỉnh Kiên Giang",
    "districts": [
      "Huyện An Biên",
      "Huyện An Minh",
      "Huyện Châu Thành",
      "Huyện Giang Thành",
      "Huyện Giồng Riềng",
      "Huyện Gò Quao",
      "Huyện Hòn Đất",
      "Huyện Kiên Hải",
      "Huyện Kiên Lương",
      "Huyện Tân Hiệp",
      "Huyện U Minh Thượng",
      "Huyện Vĩnh Thuận",
      "Thành phố Hà Tiên",
      "Thành phố Phú Quốc",
      "Thành phố Rạch Giá"
    ]
  },
  {
    "code": "92",
    "name": "TP Cần Thơ",
    "districts": [
      "Huyện Cờ Đỏ",
      "Huyện Phong Điền",
      "Huyện Thới Lai",
      "Huyện Vĩnh Thạnh",
      "Quận Bình Thuỷ",
      "Quận Cái Răng",
      "Quận Ninh Kiều",
      "Quận Ô Môn",
      "Quận Thốt Nốt"
    ]
  },
  {
    "code": "93",
    "name": "Tỉnh Hậu Giang",
    "districts": [
      "Huyện Châu Thành",
      "Huyện Châu Thành A",
      "Huyện Long Mỹ",
      "Huyện Phụng Hiệp",
      "Huyện Vị Thuỷ",
      "Thành phố Ngã Bảy",
      "Thành phố Vị Thanh",
      "Thị xã Long Mỹ"
    ]
  },
  {
    "code": "94",
    "name": "Tỉnh Sóc Trăng",
    "districts": [
      "Huyện Châu Thành",
      "Huyện Cù Lao Dung",
      "Huyện Kế Sách",
      "Huyện Long Phú",
      "Huyện Mỹ Tú",
      "Huyện Mỹ Xuyên",
      "Huyện Thạnh Trị",
      "Huyện Trần Đề",
      "Thành phố Sóc Trăng",
      "Thị xã Ngã Năm",
      "Thị xã Vĩnh Châu"
    ]
  },
  {
    "code": "95",
    "name": "Tỉnh Bạc Liêu",
    "districts": [
      "Huyện Đông Hải",
      "Huyện Hoà Bình",
      "Huyện Hồng Dân",
      "Huyện Phước Long",
      "Huyện Vĩnh Lợi",
      "Thành phố Bạc Liêu",
      "Thị xã Giá Rai"
    ]
  },
  {
    "code": "96",
    "name": "Tỉnh Cà Mau",
    "districts": [
      "Huyện Cái Nước",
      "Huyện Đầm Dơi",
      "Huyện Năm Căn",
      "Huyện Ngọc Hiển",
      "Huyện Phú Tân",
      "Huyện Thới Bình",
      "Huyện Trần Văn Thời",
      "Huyện U Minh",
      "Thành phố Cà Mau"
    ]
  }
]
;
const stripAccents = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');

/**
 * Lọc 63 tỉnh/thành theo từ khóa (bỏ dấu, không phân biệt hoa thường): 'ha' khớp 'Hà Nội', 'Hải Phòng'.
 * Gợi ý theo tên tỉnh hoặc tên quận/huyện con. Trả danh sách VnProvince (không copy).
 * @param {string} query
 * @returns {VnProvince[]}
 */
export const filterVnProvinces = (query) => {
  const q = stripAccents(query).trim();
  if (!q) return VN_PROVINCES;
  return VN_PROVINCES.filter((p) => stripAccents(p.name).includes(q) || p.districts.some((d) => stripAccents(d).includes(q)));
};

/** Lọc các quận/huyện gợi ý của 1 tỉnh (theo tên, bỏ dấu); rỗng nếu không có tỉnh nào khớp.
 * @param {string} provinceName
 * @returns {string[]}
 */
export const districtsOfVnProvince = (provinceName) => {
  const p = VN_PROVINCES.find((x) => x.name === provinceName || stripAccents(x.name) === stripAccents(provinceName));
  return p ? p.districts : [];
};
