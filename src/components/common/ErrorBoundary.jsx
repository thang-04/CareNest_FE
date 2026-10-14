import React from 'react';
import { ErrorScreen } from '@/components/ui/ErrorScreen';

/**
 * Error Boundary cấp độ React Component bắt các unhandled exceptions trong quá trình render.
 * Tránh lỗi "White Screen of Death" và hiển thị màn hình lỗi thân thiện theo chuẩn CareNest Design System v3.1.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('CareNest ErrorBoundary bắt được lỗi:', error, errorInfo);
    this.setState({ errorInfo });
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  resetError = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback({
          error: this.state.error,
          errorInfo: this.state.errorInfo,
          resetError: this.resetError,
        });
      }

      return (
        <ErrorScreen
          type="500"
          standalone={this.props.standalone}
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onRetry={this.resetError}
        />
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
