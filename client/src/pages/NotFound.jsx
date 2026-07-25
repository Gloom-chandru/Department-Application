import React from 'react';
import { Link } from 'react-router-dom';
import { HelpCircle, Home } from 'lucide-react';

const NotFound = () => {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center px-4 py-12">
      <div className="relative mb-6">
        <div className="absolute -top-10 -left-10 h-32 w-32 rounded-full bg-blue-500/10 blur-2xl pointer-events-none"></div>
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-600/10 border border-blue-500/20">
          <HelpCircle className="h-10 w-10 text-blue-500" />
        </div>
      </div>
      <h1 className="text-6xl font-black text-white tracking-tight">404</h1>
      <h2 className="text-xl font-bold text-slate-200 mt-2 mb-4">Page Not Found</h2>
      <p className="max-w-md text-sm text-slate-400 mb-8">
        The page you are trying to access might have been removed, had its name changed, or is temporarily unavailable.
      </p>
      <Link
        to="/"
        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors shadow-lg shadow-blue-600/10"
      >
        <Home className="h-4 w-4" />
        <span>Return to Dashboard</span>
      </Link>
    </div>
  );
};

export default NotFound;
