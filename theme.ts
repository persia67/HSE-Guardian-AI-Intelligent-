
export const theme = {
  colors: {
    bg: '#020617',      // slate-950
    panel: '#0f172a',   // slate-900
    border: '#1e293b',  // slate-800
    text: '#f1f5f9',    // slate-100
    textMuted: '#94a3b8', // slate-400
    
    primary: '#2563eb',   // blue-600
    primaryDark: '#1d4ed8',
    primaryLight: '#3b82f6',
    
    danger: '#e11d48',    // rose-600
    dangerBg: 'rgba(225, 29, 72, 0.2)',
    
    success: '#10b981',   // emerald-500
    successBg: 'rgba(16, 185, 129, 0.2)',
    
    warning: '#f59e0b',   // amber-500
    warningBg: 'rgba(245, 158, 11, 0.2)',
    
    info: '#6366f1',      // indigo-500
  },
  fonts: {
    // Robust system font stack including support for various OSs (Windows, Mac, Android, Linux)
    sans: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
    // Monospace stack for code, logs, and technical data
    mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", "Courier New", monospace',
  },
  layout: {
    flexCenter: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    flexBetween: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    col: {
      display: 'flex',
      flexDirection: 'column' as const,
    }
  },
  borders: {
    base: '1px solid #1e293b',
  }
};
