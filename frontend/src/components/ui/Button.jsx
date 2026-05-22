import React from 'react';

const variantStyles = {
  primary: {
    background: '#4F7FFF',
    color: '#fff',
    border: 'none',
  },
  primaryHover: {
    background: '#3D6FEF',
  },
  secondary: {
    background: 'transparent',
    color: '#8B92A5',
    border: '1px solid #252B3B',
  },
  secondaryHover: {
    color: '#F1F3F9',
    borderColor: '#4F7FFF',
  },
  danger: {
    background: '#EF4444',
    color: '#fff',
    border: 'none',
  },
  dangerHover: {
    background: '#DC2626',
  },
  ghost: {
    background: 'transparent',
    color: '#8B92A5',
    border: 'none',
  },
  ghostHover: {
    color: '#F1F3F9',
    background: '#252B3B',
  },
};

const sizeStyles = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  onClick,
  type = 'button',
  className = '',
  style = {},
}) {
  const [hovered, setHovered] = React.useState(false);
  const baseStyle = variantStyles[variant] || variantStyles.primary;
  const hoverStyle = hovered && !disabled ? (variantStyles[`${variant}Hover`] || {}) : {};

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 ${sizeStyles[size]} ${className} ${
        disabled || loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      }`}
      style={{ ...baseStyle, ...hoverStyle, ...style }}
    >
      {loading && (
        <svg
          className="animate-spin w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
      )}
      {children}
    </button>
  );
}
