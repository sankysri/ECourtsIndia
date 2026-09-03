import React, { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './Button.jsx';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('UI ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6 bg-slate-50">
          <div className="max-w-md w-full bg-white rounded-xl border border-rose-200 p-6 sm:p-8 shadow-card text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Something went wrong</h3>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              An unexpected error occurred in this view. The error has been logged for diagnosis.
            </p>
            {this.state.error?.message && (
              <div className="p-3 bg-slate-100 rounded-lg text-xs font-mono text-slate-700 text-left mb-6 overflow-auto max-h-32">
                {this.state.error.message}
              </div>
            )}
            <Button
              variant="primary"
              onClick={this.handleReset}
              leftIcon={<RefreshCw className="w-4 h-4" />}
              className="w-full"
            >
              Reload Application
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
