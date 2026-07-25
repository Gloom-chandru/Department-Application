import React, { Component } from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught a runtime error", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center p-6 mx-auto max-w-lg">
          <div className="p-4 bg-red-950/20 border border-red-500/30 rounded-2xl mb-6">
            <AlertOctagon className="h-12 w-12 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Application Crash Detected</h2>
          <p className="text-slate-400 text-sm mb-6">
            A runtime script exception occurred in this interface view. Let's try reloading the dashboard.
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-sm transition-all"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Reload Portal</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
