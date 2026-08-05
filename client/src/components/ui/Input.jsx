import React, { useState } from 'react';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';

const Input = React.forwardRef((
  {
    label,
    error,
    hint,
    leftIcon,
    rightIcon,
    floating = false,
    showStrength = false,
    className = '',
    id,
    type = 'text',
    ...props
  },
  ref
) => {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
  const errorId = error ? `${inputId}-error` : undefined;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  const [showPassword, setShowPassword] = useState(false);
  const [value, setValue] = useState(props.defaultValue || props.value || '');

  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  const handleChange = (e) => {
    setValue(e.target.value);
    if (props.onChange) {
      props.onChange(e);
    }
  };

  // Sync value when props.value changes
  React.useEffect(() => {
    if (props.value !== undefined) {
      setValue(props.value);
    }
  }, [props.value]);

  // Password strength calculation
  const getPasswordStrength = (val) => {
    if (!val) return { score: 0, text: '', color: 'bg-border-card' };
    const len = val.length;
    if (len < 6) return { score: 1, text: 'Weak', color: 'bg-red-500' };
    
    let score = 2;
    const hasUpperCase = /[A-Z]/.test(val);
    const hasNumbers = /\d/.test(val);
    const hasNonalphas = /\W/.test(val);
    
    if (len >= 8 && hasUpperCase && hasNumbers && hasNonalphas) {
      score = 3;
    }
    
    return {
      score,
      text: score === 3 ? 'Strong' : 'Medium',
      color: score === 3 ? 'bg-emerald-500' : 'bg-amber-500'
    };
  };

  const strength = getPasswordStrength(value);

  const baseInputStyles = `
    peer w-full px-4 py-2.5 rounded-lg
    bg-bg-input border text-text-main placeholder-text-muted/50
    transition-all duration-200
    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-app focus:ring-primary-500 focus:border-primary-500
    disabled:bg-bg-sidebar disabled:text-text-muted disabled:cursor-not-allowed
  `;

  const inputStyles = error
    ? `${baseInputStyles} border-red-500/50 focus:ring-red-500/20 focus:border-red-500`
    : `${baseInputStyles} border-border-card focus:border-primary-500`;

  const iconWrapperStyles = `
    absolute inset-y-0 flex items-center text-text-muted/65
  `;

  return (
    <div className={`w-full text-left ${className}`}>
      {label && !floating && (
        <label htmlFor={inputId} className="block text-sm font-semibold text-text-main mb-2">
          {label}
          {props.required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
        </label>
      )}
      
      <div className="relative">
        {leftIcon && (
          <div className={`${iconWrapperStyles} left-0 pl-3.5`} aria-hidden="true">
            {leftIcon}
          </div>
        )}
        
        <input
          ref={ref}
          id={inputId}
          type={inputType}
          onChange={handleChange}
          value={props.value !== undefined ? props.value : value}
          placeholder={floating ? ' ' : props.placeholder}
          className={`
            ${inputStyles}
            ${leftIcon ? 'pl-11' : 'pl-4'}
            ${rightIcon || isPassword ? 'pr-11' : 'pr-4'}
          `}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          {...props}
        />

        {/* Floating Label overlay */}
        {label && floating && (
          <label
            htmlFor={inputId}
            className={`
              absolute left-3.5 top-0 text-xs scale-85 -translate-y-1/2 bg-bg-card px-1 text-text-muted transition-all duration-200 pointer-events-none origin-[0]
              peer-placeholder-shown:top-1/2 peer-placeholder-shown:scale-100 peer-placeholder-shown:text-sm peer-placeholder-shown:-translate-y-1/2
              peer-focus:top-0 peer-focus:scale-85 peer-focus:-translate-y-1/2 peer-focus:text-primary-500 peer-focus:bg-bg-card peer-focus:px-1
              ${leftIcon ? 'peer-placeholder-shown:left-11' : 'peer-placeholder-shown:left-3.5'}
            `}
          >
            {label}
            {props.required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
          </label>
        )}

        {/* Toggle Password Visibility button */}
        {isPassword && !rightIcon && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className={`${iconWrapperStyles} right-0 pr-3.5 cursor-pointer text-text-muted hover:text-text-main`}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}

        {rightIcon && !isPassword && (
          <div className={`${iconWrapperStyles} right-0 pr-3.5`} aria-hidden="true">
            {rightIcon}
          </div>
        )}
      </div>

      {/* Password Strength Meter */}
      {isPassword && showStrength && value && (
        <div className="mt-2 space-y-1.5 animate-fade-in">
          <div className="flex justify-between items-center text-[11px] font-semibold text-text-muted">
            <span>Password strength: <strong className="text-text-main">{strength.text}</strong></span>
          </div>
          <div className="h-1 w-full bg-border-card rounded-full overflow-hidden flex gap-1">
            <div className={`h-full rounded-full transition-all duration-300 ${strength.color} ${strength.score >= 1 ? 'w-1/3' : 'w-0'}`} />
            <div className={`h-full rounded-full transition-all duration-300 ${strength.color} ${strength.score >= 2 ? 'w-1/3' : 'w-0'}`} />
            <div className={`h-full rounded-full transition-all duration-300 ${strength.color} ${strength.score >= 3 ? 'w-1/3' : 'w-0'}`} />
          </div>
        </div>
      )}

      {error && (
        <p id={errorId} className="mt-1.5 text-xs text-red-500 flex items-center gap-1.5 font-medium animate-fade-in" role="alert">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
      
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-xs text-text-muted font-medium">
          {hint}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;