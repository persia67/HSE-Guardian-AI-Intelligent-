import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Lock, Fingerprint, ShieldCheck, AlertCircle } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
}

const INACTIVITY_TIMEOUT = 300000; // 5 minutes in ms
const MOCK_PIN = "1234"; // In production, verify against hashed storage

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [isBiometricScanning, setIsBiometricScanning] = useState(false);
  const [lockedReason, setLockedReason] = useState<'initial' | 'timeout'>('initial');

  // Inactivity Timer Ref
  // Fix: Added initial value undefined to useRef to satisfy TypeScript requirements (Expected 1 argument)
  const inactivityTimerRef = useRef<number | undefined>(undefined);

  const lock = useCallback((reason: 'initial' | 'timeout' = 'timeout') => {
    setIsAuthenticated(false);
    setLockedReason(reason);
  }, []);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current !== undefined) {
      window.clearTimeout(inactivityTimerRef.current);
    }
    if (isAuthenticated) {
      inactivityTimerRef.current = window.setTimeout(() => lock('timeout'), INACTIVITY_TIMEOUT);
    }
  }, [isAuthenticated, lock]);

  // Handle PIN Entry
  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === MOCK_PIN) {
      unlock();
    } else {
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

  // Biometric Simulation
  const handleBiometricScan = () => {
    setIsBiometricScanning(true);
    setTimeout(() => {
      setIsBiometricScanning(false);
      unlock();
    }, 1500);
  };

  useEffect(() => {
    // Monitor user activity
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    const handleActivity = () => resetInactivityTimer();

    if (isAuthenticated) {
      events.forEach(event => window.addEventListener(event, handleActivity));
      resetInactivityTimer();
    }

    return () => {
      events.forEach(event => window.removeEventListener(event, handleActivity));
      if (inactivityTimerRef.current !== undefined) {
        window.clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [isAuthenticated, resetInactivityTimer]);

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8 text-center relative overflow-hidden">
        {/* Decorative Grid Background */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'radial-gradient(#3b82f6 1px, transparent 1px)',
          backgroundSize: '20px 20px'
        }}></div>

        <div className="relative z-10">
          <div className="mx-auto bg-slate-800 w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-inner border border-slate-700">
            {lockedReason === 'timeout' ? (
              <Lock className="w-10 h-10 text-amber-500" />
            ) : (
              <ShieldCheck className="w-10 h-10 text-blue-500" />
            )}
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">HSE Guardian Enterprise</h2>
          <p className="text-slate-400 text-sm mb-8">
            {lockedReason === 'timeout' 
              ? "Session timed out due to inactivity. Please re-authenticate." 
              : "Secure Terminal Access. Authorization Required."}
          </p>

          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="ENTER SECURITY PIN"
                className={`w-full bg-slate-950 border-2 ${error ? 'border-rose-500 animate-shake' : 'border-slate-700 focus:border-blue-500'} rounded-lg px-4 py-3 text-center text-2xl tracking-[0.5em] font-mono text-white placeholder-slate-700 focus:outline-none transition-all`}
                autoFocus
              />
              {error && (
                <p className="text-rose-500 text-xs mt-2 flex items-center justify-center gap-1">
                  <AlertCircle className="w-3 h-3" /> INVALID CREDENTIALS
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition-colors shadow-lg shadow-blue-900/20"
            >
              UNLOCK TERMINAL
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-800">
            <button
              onClick={handleBiometricScan}
              disabled={isBiometricScanning}
              className={`group flex items-center justify-center gap-2 w-full text-slate-400 hover:text-white transition-colors ${isBiometricScanning ? 'cursor-wait' : ''}`}
            >
              <div className={`p-2 rounded-full ${isBiometricScanning ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 group-hover:bg-slate-700'}`}>
                <Fingerprint className={`w-6 h-6 ${isBiometricScanning ? 'animate-pulse' : ''}`} />
              </div>
              <span className="text-sm font-medium">
                {isBiometricScanning ? 'SCANNING BIOMETRICS...' : 'USE BIOMETRIC AUTH'}
              </span>
            </button>
          </div>
        </div>
      </div>
      
      <div className="mt-8 text-xs text-slate-600 font-mono">
        SYSTEM ID: HSE-AI-8842 • SECURE CONNECTION: TLS 1.3
      </div>
    </div>
  );
};