import React from 'react';

const Progress = ({
  value = 0,
  circular = false,
  size = 'md',
  strokeWidth = 8,
  showText = false,
  className = '',
  color = 'stroke-primary-500',
  trackColor = 'stroke-border-card/65',
  ...props
}) => {
  const clampedValue = Math.min(Math.max(value, 0), 100);

  if (circular) {
    const sizeMap = {
      sm: { diameter: 48, radius: 20, fontSize: 'text-[9px]' },
      md: { diameter: 72, radius: 30, fontSize: 'text-xs' },
      lg: { diameter: 96, radius: 40, fontSize: 'text-sm' },
      xl: { diameter: 144, radius: 60, fontSize: 'text-xl' },
    };

    const config = sizeMap[size] || sizeMap.md;
    const circumference = 2 * Math.PI * config.radius;
    const strokeDashoffset = circumference - (clampedValue / 100) * circumference;

    return (
      <div className={`relative flex items-center justify-center ${className}`} {...props}>
        <svg
          width={config.diameter}
          height={config.diameter}
          className="transform -rotate-90"
        >
          {/* Track ring */}
          <circle
            cx={config.diameter / 2}
            cy={config.diameter / 2}
            r={config.radius}
            className={`fill-transparent ${trackColor}`}
            strokeWidth={strokeWidth}
          />
          {/* Progress ring */}
          <circle
            cx={config.diameter / 2}
            cy={config.diameter / 2}
            r={config.radius}
            className={`fill-transparent transition-all duration-300 ${color}`}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        {showText && (
          <div className="absolute flex flex-col items-center justify-center select-none">
            <span className={`font-black text-text-main leading-none ${config.fontSize}`}>
              {clampedValue}%
            </span>
          </div>
        )}
      </div>
    );
  }

  // Linear bar progress
  const sizeMap = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  };

  const heightClass = sizeMap[size] || sizeMap.md;

  return (
    <div className={`w-full ${className}`} {...props}>
      <div className="flex justify-between items-center text-xs font-semibold text-text-muted mb-1.5 select-none">
        {showText && <span>{clampedValue}%</span>}
      </div>
      <div className={`w-full bg-border-card/65 dark:bg-border-card/35 rounded-full overflow-hidden ${heightClass}`}>
        <div
          className="h-full bg-primary-500 rounded-full transition-all duration-300"
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    </div>
  );
};

Progress.displayName = 'Progress';

export default Progress;
