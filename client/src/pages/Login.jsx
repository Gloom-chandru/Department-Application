import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GraduationCap, Lock, Mail, AlertCircle, Loader2 } from 'lucide-react';
import Toast from '../components/Toast';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Inline error fields
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  
  // Toast notifications
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('error');
  
  const [isLoading, setIsLoading] = useState(false);
  
  const { login, user } = useAuth();
  const navigate = useNavigate();

  // Redirect if user is already logged in
  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const validate = () => {
    let isValid = true;
    setEmailError('');
    setPasswordError('');

    // Email check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      setEmailError('Email address is required.');
      isValid = false;
    } else if (!emailRegex.test(email)) {
      setEmailError('Please enter a valid email address.');
      isValid = false;
    }

    // Password check
    if (!password) {
      setPasswordError('Password is required.');
      isValid = false;
    } else if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters long.');
      isValid = false;
    }

    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validate()) return;
    
    setIsLoading(true);

    try {
      await login(email, password);
    } catch (err) {
      setToastType('error');
      setToastMessage(err || 'Failed to connect to the server. Please check your network.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8 bg-bg-app">
      <div className="relative w-full max-w-md space-y-8">
        
        {/* Glow Effects in Background */}
        <div className="absolute -top-10 -left-10 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-10 -right-10 h-72 w-72 rounded-full bg-purple-500/10 blur-3xl pointer-events-none"></div>

        {/* Brand Header */}
        <div className="flex flex-col items-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600/15 border border-blue-500/25 shadow-lg shadow-blue-500/5">
            <GraduationCap className="h-8 w-8 text-blue-500" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold tracking-tight text-text-main">
            VIT Student Portal
          </h2>
          <p className="mt-2 text-center text-sm text-text-muted">
            Velammal Institute of Technology
          </p>
        </div>

        {/* Glassmorphic Login Form */}
        <div className="backdrop-blur-md bg-bg-card/40 border border-border-app p-8 rounded-2xl shadow-xl">
          <form className="space-y-6" onSubmit={handleSubmit} noValidate>
            
            {/* Email Field */}
            <div className="space-y-2">
              <label htmlFor="email" className="text-xs font-semibold tracking-wide text-text-muted uppercase">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-text-muted">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  aria-invalid={!!emailError}
                  aria-describedby={emailError ? "email-error" : undefined}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError('');
                  }}
                  className={`block w-full rounded-xl border bg-bg-app/60 py-3 pl-10 pr-4 text-sm text-text-main placeholder-slate-500 focus:border-blue-500 focus:bg-bg-app focus:outline-none transition-colors ${
                    emailError ? 'border-red-500/55' : 'border-border-app'
                  }`}
                  placeholder="e.g. name@velammal.edu.in"
                />
              </div>
              {emailError && (
                <p id="email-error" className="text-xs text-red-400 flex items-center gap-1 mt-1 font-medium">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  <span>{emailError}</span>
                </p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label htmlFor="password" className="text-xs font-semibold tracking-wide text-text-muted uppercase">
                  Password
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-text-muted">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  aria-invalid={!!passwordError}
                  aria-describedby={passwordError ? "password-error" : undefined}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) setPasswordError('');
                  }}
                  className={`block w-full rounded-xl border bg-bg-app/60 py-3 pl-10 pr-4 text-sm text-text-main placeholder-slate-500 focus:border-blue-500 focus:bg-bg-app focus:outline-none transition-colors ${
                    passwordError ? 'border-red-500/55' : 'border-border-app'
                  }`}
                  placeholder="••••••••"
                />
              </div>
              {passwordError && (
                <p id="password-error" className="text-xs text-red-400 flex items-center gap-1 mt-1 font-medium">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  <span>{passwordError}</span>
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="relative flex w-full justify-center rounded-xl bg-blue-600 py-3 text-sm font-semibold text-text-main hover:bg-blue-500 focus:outline-none disabled:opacity-50 transition-colors shadow-lg shadow-blue-600/20"
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
          <div className="mt-8 border-t border-border-app pt-6">
            <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Demo Accounts</h4>
            <div className="space-y-2 text-xs text-text-muted">
              <div className="flex justify-between items-center bg-bg-app/40 p-2 rounded border border-border-card/50">
                <span>Student: <code className="text-blue-400">abishek.r@student.velammal.edu.in</code></span>
                <span className="bg-bg-sidebar px-1 py-0.5 rounded text-[10px]">password123</span>
              </div>
              <div className="flex justify-between items-center bg-bg-app/40 p-2 rounded border border-border-card/50">
                <span>Faculty: <code className="text-amber-400">ramesh.kumar@velammal.edu.in</code></span>
                <span className="bg-bg-sidebar px-1 py-0.5 rounded text-[10px]">password123</span>
              </div>
              <div className="flex justify-between items-center bg-bg-app/40 p-2 rounded border border-border-card/50">
                <span>Admin: <code className="text-red-400">admin@velammal.edu.in</code></span>
                <span className="bg-bg-sidebar px-1 py-0.5 rounded text-[10px]">password123</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Visual Toast Notification */}
      <Toast 
        message={toastMessage} 
        type={toastType} 
        onClose={() => setToastMessage('')} 
      />
    </div>
  );
};

export default Login;
