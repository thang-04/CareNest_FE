import { eduError } from './eduMockErrors';

// ponytail: bản demo chưa có giáo án ngày (BE:EDU-74, dayPlans rỗng) nên không có chỗ gắn học liệu (BE:EDU-81);
// học liệu chỉ chạy khi nối BE. Dựng mock đầy đủ cùng lúc với mock giáo án ngày.
export const learningResourceMockRepository = {
  async list() {
    return [];
  },
  async upload() {
    throw eduError('STORAGE_NOT_CONFIGURED');
  },
  async detach() {
    throw eduError('LEARNING_RESOURCE_NOT_FOUND');
  },
  async contentUrl() {
    throw eduError('LEARNING_RESOURCE_NOT_FOUND');
  },
};
