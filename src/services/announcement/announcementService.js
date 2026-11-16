import { sourceOf } from '@/services/demoSource';
import { announcementApi } from './api/announcementApi';
import { announcementMockRepository } from './mock/announcementMockRepository';

export const announcements = sourceOf('announcements', announcementMockRepository, announcementApi);
