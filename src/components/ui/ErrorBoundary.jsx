import { Component } from 'react';
import { StatusPage } from '@/components/ui/StatusPage';
import { APP_NAME } from '@/config/app';

// Lỗi tải file JS của trang (thường do vừa deploy bản mới, file cũ không còn)
const CHUNK_ERROR =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError/i;

export const isChunkError = (error) => CHUNK_ERROR.test(`${error?.name || ''} ${error?.message || ''}`);

/**
 * Bắt lỗi render / lỗi tải trang để không ra màn trắng.
 * `resetKey` đổi (vd. đổi route) thì xóa lỗi và render lại nội dung.
 */
export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    // Tiêu đề tab theo usePageTitle; không thì tab giữ tên trang vừa lỗi
    document.title = `${isChunkError(error) ? 'Cần tải lại trang' : 'Lỗi hệ thống'} · ${APP_NAME}`;
    // Chỉ log khi dev; không gửi dữ liệu người dùng đi đâu
    if (import.meta.env.DEV) console.error('[ErrorBoundary]', error);
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const page = <StatusPage kind={isChunkError(error) ? 'chunk' : '500'} />;
    return this.props.wrap ? <div className="page">{page}</div> : page;
  }
}
