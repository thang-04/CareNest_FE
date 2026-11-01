const root = [{ label: 'Trang chủ', to: '/' }, { label: 'Cơ sở vật chất' }];
const tail = (last) => (last ? [{ label: last }] : []);

export const assetCrumbs = (last) => [...root, { label: 'Danh sách tài sản', to: '/facility/assets' }, ...tail(last)];
export const myReportCrumbs = (last) => [...root, { label: 'Lịch sử báo cáo & đề nghị', to: '/facility/my-reports' }, ...tail(last)];
export const issueCrumbs = (last) => [...root, { label: 'Báo cáo sự cố', to: '/facility/issues' }, ...tail(last)];
export const requestCrumbs = (last) => [...root, { label: 'Đề nghị bổ sung', to: '/facility/requests' }, ...tail(last)];
export const proposalCrumbs = (last) => [...root, { label: 'Đề xuất mua sắm, sửa chữa', to: '/facility/proposals' }, ...tail(last)];
