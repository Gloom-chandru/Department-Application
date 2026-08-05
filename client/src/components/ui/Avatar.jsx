import React, { useState } from 'react';

const Avatar = ({
  src,
  alt = 'User avatar',
  fallback,
  size = 'md',
  className = '',
  ...props
}) => {
  const [hasError, setHasError] = useState(false);

  const sizeStyles = {
    xs: 'h-6 w-6 text-[10px]',
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
    xl: 'h-16 w-16 text-lg',
    '2xl': 'h-20 w-20 text-xl',
  };

  const currentSize = sizeStyles[size] || sizeStyles.md;

  return (
    <div
      className={`
        relative inline-flex shrink-0 items-center justify-center rounded-full bg-bg-sidebar border border-border-card text-text-muted font-bold overflow-hidden select-none
        ${currentSize}
        ${className}
      `}
      {...props}
    >
      {src && !hasError ? (
        <img
          src={src}
          alt={alt}
          onError={() => setHasError(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="uppercase">{fallback || alt.slice(0, 2)}</span>
      )}
    </div>
  );
};

Avatar.displayName = 'Avatar';

export default Avatar;
