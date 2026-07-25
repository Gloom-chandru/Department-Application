import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GraduationCap, Lock, Mail, AlertCircle, Loader2 } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { login, user } = useAuth();
  const navigate = useNavigate();

  // Redirect if user is already logged in
  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
      // AuthContext triggers state update, useEffect will handle redirection
    } catch (err) {
      setError(err || 'Failed to connect to the server');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="relative w-full max-w-md space-y-8">
        
        {/* Glow Effects in Background */}
        <div className="absolute -top-10 -left-10 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-10 -right-10 h-72 w-72 rounded-full bg-purple-500/10 blur-3xl pointer-events-none"></div>

        {/* Brand Header */}
        <div className="flex flex-col items-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600/15 border border-blue-500/25 shadow-lg shadow-blue-500/5">
            <GraduationCap className="h-8 w-8 text-blue-500" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold tracking-tight text-white">
            VIT Student Portal
          </h2>
          <p className="mt-2 text-center text-sm text-slate-400">
            Velammal Institute of Technology
          </p>
        </div>

        {/* Glassmorphic Login Form */}
        <div className="backdrop-blur-md bg-slate-900/40 border border-slate-800 p-8 rounded-2xl shadow-xl">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-950/20 p-3 text-sm text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-2">
              <label htmlFor="email" className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-xl border border-slate-800 bg-slate-950/60 py-3 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:bg-slate-950 focus:outline-none transition-colors"
                  placeholder="e.g. name@velammal.edu.in"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label htmlFor="password" className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
                  Password
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-xl border border-slate-800 bg-slate-950/60 py-3 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:bg-slate-950 focus:outline-none transition-colors"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="relative flex w-full justify-center rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-500 focus:outline-none disabled:opacity-50 transition-colors shadow-lg shadow-blue-600/20"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Authenticating...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Quick Login Assist for Evaluators */}
          <div className="mt-8 border-t border-slate-800 pt-6">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Demo Accounts</h4>
            <div className="space-y-2 text-xs text-slate-400">
              <div className="flex justify-between items-center bg-slate-950/40 p-2 rounded border border-slate-900">
                <span>Student: <code className="text-blue-400">abishek.r@student.velammal.edu.in</code></span>
                <span className="bg-slate-800 px-1 py-0.5 rounded text-[10px]">password123</span>
              </div>
              <div className="flex justify-between items-center bg-slate-950/40 p-2 rounded border border-slate-900">
                <span>Faculty: <code className="text-amber-400">ramesh.kumar@velammal.edu.in</code></span>
                <span className="bg-slate-800 px-1 py-0.5 rounded text-[10px]">password123</span>
              </div>
              <div className="flex justify-between items-center bg-slate-950/40 p-2 rounded border border-slate-900">
                <span>Admin: <code className="text-red-400">admin@velammal.edu.in</code></span>
                <span className="bg-slate-800 px-1 py-0.5 rounded text-[10px]">password123</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Login;
