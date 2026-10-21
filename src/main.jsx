import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import '@/styles/index.css';

// Lớp ngoài cùng: lỗi ở provider/router/trang đăng nhập vẫn hiện trang lỗi thay vì màn trắng
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary wrap>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
