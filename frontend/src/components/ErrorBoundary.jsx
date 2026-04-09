import { Component } from 'react';
import { FaExclamationTriangle } from 'react-icons/fa';

/**
 * Global error boundary — catches unhandled React rendering errors
 * and shows a branded fallback UI instead of a white screen.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <FaExclamationTriangle className="error-boundary-icon" />
            <h1>Something went wrong</h1>
            <p className="error-boundary-message">
              An unexpected error occurred. This has been logged and we'll look into it.
            </p>
            {this.state.error && (
              <details className="error-boundary-details">
                <summary>Error details</summary>
                <pre>{this.state.error.toString()}</pre>
              </details>
            )}
            <div className="error-boundary-actions">
              <button onClick={this.handleReload} className="error-boundary-btn primary">
                Reload Page
              </button>
              <button onClick={this.handleGoHome} className="error-boundary-btn">
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
