// Bộ thẻ hiển thị tương ứng hợp đồng bodyHtml của BE (PAR-05); BE vẫn lọc và quyết định nội dung được lưu.
export const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'a'];
export const ALLOWED_ATTR = ['href', 'target', 'rel'];
export const ALLOWED_URI = /^(?:https:|mailto:|tel:)/i;
