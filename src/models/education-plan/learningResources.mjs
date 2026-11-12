// BE:EDU-81 — học liệu gắn một mục hoạt động của một ngày trong kế hoạch giáo dục ngày: activityKey = "yyyy-MM-dd#mục".
export const sectionKey = (date, section) => `${date}#${section}`;

/** Học liệu đang gắn đúng mục của ngày (BE trả `active` = mục còn hợp lệ trong tuần). */
export const resourcesOf = (items, date, section) =>
  items.filter((r) => r.active && r.activityKey === sectionKey(date, section));

export const MEDIA_ACCEPT = '.jpg,.jpeg,.png,.gif,.webp,.mp4,.webm,.pdf,.pptx,.docx,.xlsx,.txt,.csv';
export const mediaKind = (type = '') =>
  type.startsWith('image/') ? 'image' : type.startsWith('video/') ? 'video' : type === 'application/pdf' ? 'pdf' : 'file';
export const formatBytes = (n) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`);
