// Màn demo giữ guard Principal hiện tại, không đọc hoặc ghi catalog quyền mới vào phiên.
export const canManagePermissions = (user) => user?.role === 'PRINCIPAL';
