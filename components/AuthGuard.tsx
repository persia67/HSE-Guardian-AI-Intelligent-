import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Lock, Fingerprint, ShieldCheck, AlertCircle } from './Icons';
import { theme } from '../theme';

interface AuthGuardProps {
  children: React.ReactNode;
}

const INACTIVITY_TIMEOUT = 300000;
const MOCK_PIN = "1234";

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [isBiometricScanning, setIsBiometricScanning] = useState(false);
  const [lockedReason, setLockedReason] = useState<'initial' | 'timeout'>('initial');
  const inactivityTimerRef = useRef<number | undefined>(undefined);

  const lock = useCallback((reason: 'initial' | 'timeout' = 'timeout') => {
    setIsAuthenticated(false);
    setLockedReason(reason);
  }, []);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current !== undefined) window.clearTimeout(inactivityTimerRef.current);
    if (isAuthenticated) inactivityTimerRef.current = window.setTimeout(() => lock('timeout'), INACTIVITY_TIMEOUT);
  }, [isAuthenticated, lock]);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === MOCK_PIN) unlock();
    else {
      setError(true);
      setPin("");
      setTimeout(() => setError(false), 2000);
    }
  };

  const unlock = useCallback(() => {
    setIsAuthenticated(true);
    setPin("");
    setError(false);
    resetInactivityTimer();
  }, [resetInactivityTimer]);

  const handleBiometricScan = () => {
    setIsBiometricScanning(true);
    setTimeout(() => { setIsBiometricScanning(false); unlock(); }, 1500);
  };

  useEffect(() => {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    const handleActivity = () => resetInactivityTimer();
    if (isAuthenticated) {
      events.forEach(event => window.addEventListener(event, handleActivity));
      resetInactivityTimer();
    }
    return () => {
      events.forEach(event => window.removeEventListener(event, handleActivity));
      if (inactivityTimerRef.current !== undefined) window.clearTimeout(inactivityTimerRef.current);
    };
  }, [isAuthenticated, resetInactivityTimer]);

  if (isAuthenticated) return <>{children}</>;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      backgroundColor: theme.colors.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
      padding: 16
    }}>
      <div style={{
        width: '100%', maxWidth: 400,
        backgroundColor: theme.colors.panel,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: 16,
        padding: 32,
        textAlign: 'center',
        position: 'relative',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      }}>
        <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'center' }}>
          <div style={{ backgroundColor: theme.colors.border, width: 80, height: 80, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {lockedReason === 'timeout' ? <Lock size={40} color={theme.colors.warning} /> : <ShieldCheck size={40} color={theme.colors.primary} />}
          </div>
        </div>

        <h2 style={{ fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 8 }}>HSE Guardian Enterprise</h2>
        <p style={{ fontSize: 14, color: theme.colors.textMuted, marginBottom: 32 }}>
          {lockedReason === 'timeout' ? "Session timed out. Re-authenticate." : "Secure Terminal Access. Authorization Required."}
        </p>

        <form onSubmit={handlePinSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <input
              type="password" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value)}
              placeholder="ENTER PIN" autoFocus
              style={{
                width: '100%', backgroundColor: theme.colors.bg,
                border: error ? `2px solid ${theme.colors.danger}` : `2px solid ${theme.colors.border}`,
                borderRadius: 8, padding: '12px 16px',
                textAlign: 'center', fontSize: 24, letterSpacing: '0.5em', fontFamily: theme.fonts.mono,
                color: '#fff', outline: 'none'
              }}
            />
            {error && <p style={{ color: theme.colors.danger, fontSize: 12, marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><AlertCircle size={12} /> INVALID CREDENTIALS</p>}
          </div>

          <button type="submit" style={{ width: '100%', backgroundColor: theme.colors.primary, color: '#fff', padding: 12, borderRadius: 8, border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>
            UNLOCK TERMINAL
          </button>
        </form>

        <div style={{ marginTop: 32, paddingTop: 24, borderTop: `1px solid ${theme.colors.border}` }}>
          <button onClick={handleBiometricScan} disabled={isBiometricScanning} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'none', border: 'none', color: theme.colors.textMuted, cursor: 'pointer' }}>
            <div style={{ padding: 8, borderRadius: '50%', backgroundColor: isBiometricScanning ? theme.colors.successBg : theme.colors.border, color: isBiometricScanning ? theme.colors.success : 'inherit' }}>
              <Fingerprint size={24} className={isBiometricScanning ? 'animate-pulse' : ''} />
            </div>
            <span style={{ fontSize: 14, fontWeight: 500 }}>{isBiometricScanning ? 'SCANNING...' : 'USE BIOMETRIC AUTH'}</span>
          </button>
        </div>
      </div>
      <div style={{ marginTop: 32, fontSize: 12, fontFamily: theme.fonts.mono, color: theme.colors.textMuted }}>SYSTEM ID: HSE-AI-8842 • TLS 1.3</div>
    </div>
  );
};
