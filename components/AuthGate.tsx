import React, { useState, useEffect } from 'react';
import { getCurrentUser, onAuthStateChange, signIn, signUp, signOut, signInWithGoogle } from '../services/supabaseClient';
import { useWorkflow } from '../contexts/WorkflowContext';
import { Mail, Lock, User, ArrowRight, ArrowLeft, Loader2, KeyRound } from 'lucide-react';

const ACCESS_STORAGE_KEY = 'coursecorrect_access_verified';

interface AuthGateProps {
  children: React.ReactNode;
  onBack?: () => void;
}

const AuthGate: React.FC<AuthGateProps> = ({ children, onBack }) => {
  const { user, setUser } = useWorkflow();
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Access code gate
  const [accessVerified, setAccessVerified] = useState(() => {
    return localStorage.getItem(ACCESS_STORAGE_KEY) === 'true';
  });
  const [accessCode, setAccessCode] = useState('');
  const [accessError, setAccessError] = useState('');

  useEffect(() => {
    getCurrentUser().then((u) => {
      if (u) {
        setUser({ id: u.id, email: u.email || '' });
      }
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });

    const { data: { subscription } } = onAuthStateChange((u) => {
      if (u) {
        setUser({ id: u.id, email: u.email || '' });
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [setUser]);

  const handleAccessCode = (e: React.FormEvent) => {
    e.preventDefault();
    const validCode = import.meta.env.VITE_ACCESS_CODE || '';
    if (validCode && accessCode.trim().toUpperCase() === validCode.toUpperCase()) {
      localStorage.setItem(ACCESS_STORAGE_KEY, 'true');
      setAccessVerified(true);
      setAccessError('');
    } else {
      setAccessError('Invalid access code. Please try again.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      if (mode === 'signup') {
        const data = await signUp(email, password, fullName || undefined);
        // If no session returned, email confirmation is required
        if (!data.session) {
          setSuccess('Account created! Check your email to confirm, then sign in.');
          setMode('signin');
          return;
        }
      } else {
        await signIn(email, password);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-accent animate-spin" />
          <p className="text-text-muted text-sm font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  // Already authenticated — pass through
  if (user) {
    return <>{children}</>;
  }

  // Access code gate — shown before login form
  if (!accessVerified) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 text-sm text-text-muted hover:text-accent transition-colors mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to home
            </button>
          )}

          <div className="text-center mb-8">
            <div className="w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <img src="/logo-cropped.png" alt="Course Correction" width={56} height={56} style={{ objectFit: 'contain' }} />
            </div>
            <h1 className="text-2xl font-bold text-text-primary tracking-tight">Course Correction</h1>
            <p className="text-text-muted text-sm mt-2 max-w-xs mx-auto">
              Enter your access code to continue. If you're a hackathon judge, check your welcome email for the code.
            </p>
          </div>

          <form onSubmit={handleAccessCode} className="bg-card border border-surface-border rounded-2xl p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Access Code</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  type="text"
                  value={accessCode}
                  onChange={(e) => { setAccessCode(e.target.value); setAccessError(''); }}
                  placeholder="Enter your access code"
                  autoFocus
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-background border border-surface-border rounded-lg text-text-primary placeholder-text-muted text-sm focus:ring-2 focus:ring-accent focus:border-accent outline-none transition-all"
                />
              </div>
            </div>

            {accessError && (
              <div className="text-sm text-warning bg-warning/10 border border-warning/20 rounded-lg px-3 py-2">
                {accessError}
              </div>
            )}

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold text-background text-sm bg-accent hover:bg-accent/90 shadow-lg shadow-accent/20 transition-all"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>

            <p className="text-xs text-text-muted text-center pt-1">
              Don't have a code? <button type="button" onClick={onBack} className="text-accent hover:underline">Try the free demo</button> instead.
            </p>
          </form>
        </div>
      </div>
    );
  }

  // Login form — shown after access code is verified
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Back button */}
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-text-muted hover:text-accent transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </button>
        )}

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <img src="/logo-cropped.png" alt="Course Correction" width={56} height={56} style={{ objectFit: 'contain' }} />
          </div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">Course Correction</h1>
          <p className="text-text-muted text-sm mt-1">
            {mode === 'signin' ? 'Sign in to your account' : 'Create a new account'}
          </p>
        </div>

        {/* Google Sign In */}
        <div className="bg-card border border-surface-border rounded-2xl p-6">
          <button
            type="button"
            onClick={async () => {
              setError('');
              try {
                await signInWithGoogle();
              } catch (err: any) {
                setError(err.message || 'Google sign-in failed.');
              }
            }}
            className="w-full flex items-center justify-center gap-3 py-2.5 rounded-lg font-bold text-sm border border-surface-border bg-background hover:bg-surface text-text-primary transition-all"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-surface-border" />
          <span className="text-xs text-text-muted">or continue with email</span>
          <div className="flex-1 h-px bg-surface-border" />
        </div>

        {/* Email Form */}
        <form onSubmit={handleSubmit} className="bg-card border border-surface-border rounded-2xl p-6 space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Doe"
                  className="w-full pl-10 pr-4 py-2.5 bg-background border border-surface-border rounded-lg text-text-primary placeholder-text-muted text-sm focus:ring-2 focus:ring-accent focus:border-accent outline-none transition-all"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                className="w-full pl-10 pr-4 py-2.5 bg-background border border-surface-border rounded-lg text-text-primary placeholder-text-muted text-sm focus:ring-2 focus:ring-accent focus:border-accent outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full pl-10 pr-4 py-2.5 bg-background border border-surface-border rounded-lg text-text-primary placeholder-text-muted text-sm focus:ring-2 focus:ring-accent focus:border-accent outline-none transition-all"
              />
            </div>
          </div>

          {success && (
            <div className="text-sm text-success bg-success/10 border border-success/20 rounded-lg px-3 py-2">
              {success}
            </div>
          )}

          {error && (
            <div className="text-sm text-warning bg-warning/10 border border-warning/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold text-background text-sm transition-all ${
              submitting
                ? 'bg-text-muted cursor-not-allowed'
                : 'bg-accent hover:bg-accent/90 shadow-lg shadow-accent/20'
            }`}
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                {mode === 'signin' ? 'Sign In' : 'Create Account'}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setSuccess(''); }}
              className="text-sm text-text-muted hover:text-accent transition-colors"
            >
              {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AuthGate;
