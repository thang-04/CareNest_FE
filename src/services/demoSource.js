import { USE_MOCK } from '@/config/env';
import { INTEGRATION_MODULES } from '@/config/integrationModules';
import { readDb } from '@/mocks/mockDatabase';

// User đăng nhập qua BE (authProfile.normalizeAccountProfile) có userId + roles; user mock thì không
const isBackendUser = (value) => value != null && typeof value === 'object' && value.userId != null && Array.isArray(value.roles);

/** Factory để test được cả build mock lẫn build nối BE. */
export const createDemoSource = ({ useMock, modules, loadUsers }) => {
  const isDemoModule = (key) => useMock || modules[key]?.source !== 'api';
  /** Build nối BE mà module còn demo ⇒ chỗ dùng phải hiện nhãn "Dữ liệu demo". */
  const needsDemoLabel = (key) => !useMock && isDemoModule(key);
  // User BE không có trong dữ liệu mẫu ⇒ module demo dùng tài khoản mẫu cùng vai trò (cùng role thì mock mới cho xem/sửa)
  const demoActorOf = (user) =>
    useMock || !isBackendUser(user) ? user : loadUsers().find((row) => row.role === user.role && row.status !== 'INACTIVE') || user;
  const withDemoActor = (repo) =>
    new Proxy(repo, {
      get(target, name) {
        const value = target[name];
        return typeof value === 'function' ? (...args) => value.apply(target, args.map(demoActorOf)) : value;
      },
    });
  /** Repo của module: mock khi build mock; build nối BE ⇒ `api`, hoặc mock + tài khoản mẫu nếu module còn demo. */
  const sourceOf = (key, mock, api) => {
    if (!modules[key]) throw new Error(`Module ${key} chưa khai trong INTEGRATION_MODULES`);
    if (useMock) return mock;
    return isDemoModule(key) ? withDemoActor(mock) : api;
  };
  /** Module demo của màn đang mở (khớp tiền tố route dài nhất) — null nếu màn dùng BE hoặc cả app đang mock. */
  const demoModuleOfPath = (pathname) => {
    if (useMock) return null;
    const match = Object.entries(modules)
      .flatMap(([key, mod]) => (mod.routes || []).map((route) => ({ key, route })))
      .filter(({ route }) => pathname === route || pathname.startsWith(`${route}/`))
      .sort((a, b) => b.route.length - a.route.length)[0];
    return match && isDemoModule(match.key) ? match.key : null;
  };
  return { isDemoModule, needsDemoLabel, demoActorOf, sourceOf, demoModuleOfPath };
};

export const { isDemoModule, needsDemoLabel, demoActorOf, sourceOf, demoModuleOfPath } = createDemoSource({
  useMock: USE_MOCK,
  modules: INTEGRATION_MODULES,
  loadUsers: () => readDb().users || [],
});
