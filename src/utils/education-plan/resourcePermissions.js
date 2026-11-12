import { ROLES } from '@/models/User';

// Chỉ ẩn/hiện (BE:EDU-84 kiểm ở server): tổ trưởng và PHT thấy tab "Chờ duyệt"; PHT đưa thẳng lên kho trường.
export const canReviewResources = (user) => user?.role === ROLES.TEAM_LEADER || user?.role === ROLES.VICE_PRINCIPAL;
export const canPublishSchool = (user) => user?.role === ROLES.VICE_PRINCIPAL;
