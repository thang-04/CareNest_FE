export async function activitySignature(text) {
  const bytes = new TextEncoder().encode(String(text || '').replaceAll('\r\n', '\n'));
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (b) => b.toString(16).padStart(2, '0')).join('');
}

export const resourceMatches = (resource, activity, signature) =>
  !!resource.active && !activity.stale && resource.activityKey === activity.id && resource.activitySignature === signature;

export function matchDayActivities(current, picks) {
  const seen = new Set();
  return picks
    .filter((p) => {
      const key = `${p.id}/${p.goalId}/${p.text}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((p) => {
      const match = current.find((a) => a.id === p.id && String(a.goalId) === String(p.goalId) && a.text === p.text);
      return match ? { ...match, stale: false } : { ...p, stale: true };
    });
}

export const fileLimit = (type) => (type.startsWith('image/') ? 5 : type.startsWith('video/') ? 100 : 20) * 1024 * 1024;
export const MEDIA_ACCEPT = '.jpg,.jpeg,.png,.gif,.webp,.mp4,.webm,.pdf,.pptx,.docx,.xlsx,.txt,.csv';
export const mediaKind = (type = '') =>
  type.startsWith('image/') ? 'image' : type.startsWith('video/') ? 'video' : type === 'application/pdf' ? 'pdf' : 'file';
export const formatBytes = (n) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`);
