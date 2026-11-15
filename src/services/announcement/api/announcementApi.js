import { axiosClient } from '@/services/http/axiosClient';
import { normalizeApiError } from '@/services/http/apiError';

const multipart = (data, files = []) => {
  const form = new FormData();
  form.append('data', new Blob([JSON.stringify(data)], { type: 'application/json' }));
  files.forEach((file) => form.append('files', file));
  return form;
};
const multipartConfig = { headers: { 'Content-Type': undefined } };
const attachment = async (id) => {
  try {
    return await axiosClient.get(`/announcement-attachments/${id}/content`, { responseType: 'blob' });
  } catch (error) {
    if (error.blobErrorBody) {
      try {
        const data = JSON.parse(await error.blobErrorBody.text());
        throw normalizeApiError({ response: { status: error.status, data } });
      } catch (decoded) {
        if (decoded.isApiError) throw decoded;
      }
    }
    throw error;
  }
};

export const announcementApi = {
  list: (params = {}) => axiosClient.get('/announcements', { params }),
  detail: (id) => axiosClient.get(`/announcements/${id}`),
  preview: (target, options = {}) => axiosClient.post('/announcements/recipient-preview', target, options),
  create: (data, files) => axiosClient.post('/announcements', multipart(data, files), multipartConfig),
  update: (id, data, files) => axiosClient.put(`/announcements/${id}`, multipart(data, files), multipartConfig),
  cancel: (id) => axiosClient.post(`/announcements/${id}/cancel`),
  myAnnouncement: (id) => axiosClient.get(`/me/announcements/${id}`),
  attachment,
  templates: () => axiosClient.get('/announcement-templates'),
  createTemplate: (data) => axiosClient.post('/announcement-templates', data),
  updateTemplate: (id, data) => axiosClient.put(`/announcement-templates/${id}`, data),
  deleteTemplate: (id) => axiosClient.delete(`/announcement-templates/${id}`),
  rules: () => axiosClient.get('/notification-rules'),
  updateRule: (type, data) => axiosClient.put(`/notification-rules/${encodeURIComponent(type)}`, data),
  schedules: () => axiosClient.get('/announcement-schedules'),
  createSchedule: (data) => axiosClient.post('/announcement-schedules', data),
  updateSchedule: (id, data) => axiosClient.put(`/announcement-schedules/${id}`, data),
  deleteSchedule: (id) => axiosClient.delete(`/announcement-schedules/${id}`),
  campuses: () => axiosClient.get('/campuses'),
  ageGroups: () => axiosClient.get('/age-groups'),
  schoolStructure: (params = {}) => axiosClient.get('/school-structure', { params }),
};
