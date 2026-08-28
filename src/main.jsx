import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App Crash caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    try {
      localStorage.clear();
    } catch (e) {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#fdfbf7',
          padding: '24px',
          fontFamily: 'Plus Jakarta Sans, sans-serif'
        }}>
          <div style={{
            maxWidth: '500px',
            width: '100%',
            backgroundColor: '#ffffff',
            borderRadius: '24px',
            padding: '32px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
            border: '2px solid #f59e0b',
            textAlign: 'center'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              backgroundColor: '#fef3c7',
              color: '#d97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              fontWeight: 'bold',
              margin: '0 auto 16px auto'
            }}>
              ⚠️
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: '900', color: '#0f172a', margin: '0 0 8px 0' }}>
              Application Recovery
            </h2>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 20px 0', lineHeight: 1.5 }}>
              The application encountered an unexpected state. Click the button below to reload and restore clean data.
            </p>
            {this.state.error && (
              <div style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '12px',
                fontSize: '11px',
                fontFamily: 'monospace',
                color: '#dc2626',
                textAlign: 'left',
                marginBottom: '20px',
                maxHeight: '120px',
                overflowY: 'auto'
              }}>
                {this.state.error.toString()}
              </div>
            )}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: '12px 24px',
                  borderRadius: '9999px',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  fontWeight: 'bold',
                  fontSize: '13px',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Reload Page
              </button>
              <button
                onClick={this.handleReset}
                style={{
                  padding: '12px 24px',
                  borderRadius: '9999px',
                  backgroundColor: '#f59e0b',
                  color: '#0f172a',
                  fontWeight: 'bold',
                  fontSize: '13px',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Reset Session &amp; Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
