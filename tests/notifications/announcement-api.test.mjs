import assert from 'node:assert/strict';
import { test } from 'node:test';
import { axiosClient } from '../../src/services/http/axiosClient.js';
import { announcementApi } from '../../src/services/announcement/api/announcementApi.js';

test('lịch gửi dùng form data như soạn thông báo, bật/tắt chỉ gửi ids đã tick', async () => {
  const old = axiosClient.defaults.adapter;
  const requests = [];
  axiosClient.defaults.adapter = async (config) => {
    requests.push(config);
    return { config, status: 200, statusText: 'OK', headers: {}, data: { code: 200, data: {} } };
  };
  try {
    const data = {
      templateId: null,
      title: 'Tin riêng',
      body: 'Nội dung',
      frequency: 'WEEKLY',
      dayOfWeek: 1,
      sendTime: '08:00',
      active: true,
    };
    const files = [new File(['PDF'], 'demo.pdf', { type: 'application/pdf' })];
    await announcementApi.createSchedule(data, files);
    await announcementApi.updateSchedule(7, { ...data, keepAttachmentIds: [9] }, []);
    await announcementApi.schedule(7);
    await announcementApi.activateSchedules([7, 8], false);
    await announcementApi.deleteSchedules([7, 8]);
    assert.equal(requests[0].url, '/announcement-schedules');
    assert.deepEqual(JSON.parse(await requests[0].data.get('data').text()), data);
    assert.equal(requests[0].data.getAll('files').length, 1);
    assert.deepEqual(JSON.parse(await requests[1].data.get('data').text()).keepAttachmentIds, [9]);
    assert.equal(requests[2].url, '/announcement-schedules/7');
    assert.equal(requests[3].url, '/announcement-schedules/activation');
    assert.deepEqual(JSON.parse(requests[3].data), { ids: [7, 8], active: false });
    assert.equal(requests[4].url, '/announcement-schedules/delete-selection');
    assert.deepEqual(JSON.parse(requests[4].data), { ids: [7, 8] });
  } finally {
    axiosClient.defaults.adapter = old;
  }
});

test('lọc và xóa giữ nguyên q/status, bulk không bị giới hạn trang', async () => {
  const old = axiosClient.defaults.adapter;
  const requests = [];
  axiosClient.defaults.adapter = async (config) => {
    requests.push(config);
    return { config, status: 200, statusText: 'OK', headers: {}, data: { code: 200, data: 25 } };
  };
  try {
    const filter = { q: 'Họp', status: 'CANCELLED' };
    await announcementApi.list({ ...filter, page: 1, size: 20 });
    await announcementApi.delete(7);
    assert.equal(await announcementApi.deleteCancelled(filter), 25);
    assert.deepEqual(requests[0].params, { ...filter, page: 1, size: 20 });
    assert.equal(requests[1].url, '/announcements/7');
    assert.equal(requests[1].method, 'delete');
    assert.equal(requests[2].url, '/announcements/cancelled');
    assert.deepEqual(requests[2].params, filter);
    const selection = { allMatching: true, ids: [], excludedIds: [8], ...filter };
    assert.equal(await announcementApi.deleteSelection(selection), 25);
    assert.equal(requests[3].url, '/announcements/delete-selection');
    assert.equal(requests[3].method, 'post');
    assert.deepEqual(JSON.parse(requests[3].data), selection);
  } finally {
    axiosClient.defaults.adapter = old;
  }
});

test('gửi thông báo dùng JSON part data và các part files', async () => {
  const old = axiosClient.defaults.adapter;
  let request;
  axiosClient.defaults.adapter = async (config) => {
    request = config;
    return { config, status: 201, statusText: 'Created', headers: {}, data: { code: 201, data: { id: 5 } } };
  };
  try {
    const result = await announcementApi.create(
      { title: 'Lịch họp', body: 'Nội dung', target: { scopeType: 'SCHOOL', roles: ['PARENT'] } },
      [new File(['test'], 'demo.pdf', { type: 'application/pdf' })],
    );
    assert.equal(result.id, 5);
    assert.equal(request.url, '/announcements');
    assert.equal(request.data.get('data').type, 'application/json');
    assert.equal(JSON.parse(await request.data.get('data').text()).title, 'Lịch họp');
    assert.equal(request.data.getAll('files').length, 1);
    assert.equal(request.data.getAll('files[]').length, 0);
  } finally {
    axiosClient.defaults.adapter = old;
  }
});

test('cập nhật lịch và quy tắc giữ nguyên request đầy đủ', async () => {
  const old = axiosClient.defaults.adapter;
  const requests = [];
  axiosClient.defaults.adapter = async (config) => {
    requests.push(config);
    return { config, status: 200, statusText: 'OK', headers: {}, data: { code: 200, data: {} } };
  };
  try {
    const rule = { enabled: false, titleTemplate: 'Tiêu đề', bodyTemplate: 'Nội dung' };
    const schedule = {
      templateId: 4,
      target: { scopeType: 'SCHOOL', roles: ['PARENT'] },
      frequency: 'WEEKLY',
      dayOfWeek: 1,
      sendTime: '08:00',
      active: false,
    };
    await announcementApi.updateRule('MENU_PUBLISHED', rule);
    await announcementApi.updateSchedule(7, schedule);
    assert.deepEqual(JSON.parse(requests[0].data), rule);
    assert.deepEqual(JSON.parse(requests[1].data), schedule);
  } finally {
    axiosClient.defaults.adapter = old;
  }
});

test('danh sách giữ phân trang máy chủ và xem trước gửi đúng target', async () => {
  const old = axiosClient.defaults.adapter;
  const requests = [];
  axiosClient.defaults.adapter = async (config) => {
    requests.push(config);
    return { config, status: 200, statusText: 'OK', headers: {}, data: { code: 200, data: { total: 3, byRole: { PARENT: 3 } } } };
  };
  try {
    const target = { scopeType: 'CLASSROOM', classroomId: 12, roles: ['PARENT'] };
    await announcementApi.list({ page: 1, size: 20 });
    assert.equal((await announcementApi.preview(target)).total, 3);
    assert.deepEqual(requests[0].params, { page: 1, size: 20 });
    assert.equal(requests[1].url, '/announcements/recipient-preview');
    assert.deepEqual(JSON.parse(requests[1].data), target);
  } finally {
    axiosClient.defaults.adapter = old;
  }
});

test('API tệp giữ binary và giải mã lỗi JSON trong Blob', async () => {
  const old = axiosClient.defaults.adapter;
  try {
    axiosClient.defaults.adapter = async (config) => ({
      config,
      status: 200,
      statusText: 'OK',
      headers: {},
      data: new Blob(['PDF'], { type: 'application/pdf' }),
    });
    assert.equal(await (await announcementApi.attachment(5)).text(), 'PDF');
    axiosClient.defaults.adapter = async (config) => {
      throw {
        config,
        response: {
          status: 403,
          data: new Blob([JSON.stringify({ desc: 'Không có quyền', errorCode: 1203 })], { type: 'application/json' }),
        },
      };
    };
    await assert.rejects(announcementApi.attachment(5), (e) => e.status === 403 && e.errorCode === 1203 && e.message === 'Không có quyền');
  } finally {
    axiosClient.defaults.adapter = old;
  }
});

test('lỗi timeout tạo thông báo không tự gửi lại', async () => {
  const old = axiosClient.defaults.adapter;
  let calls = 0;
  try {
    axiosClient.defaults.adapter = async (config) => {
      calls += 1;
      throw { config, message: 'timeout', code: 'ECONNABORTED' };
    };
    await assert.rejects(announcementApi.create({ title: 'Tin', body: 'Nội dung' }, []));
    assert.equal(calls, 1);
  } finally {
    axiosClient.defaults.adapter = old;
  }
});
