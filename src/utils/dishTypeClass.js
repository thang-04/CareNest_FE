// Mỗi loại món một màu (lớp td-dt--<loại>, đặt biến --dt) để danh sách món có vạch / viền màu phân biệt nhanh
export const dishTypeClass = (type) => `td-dt--${String(type || 'other').toLowerCase()}`;
