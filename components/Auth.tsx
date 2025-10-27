
import React, { useState } from 'react';
import { supabase, supabaseAvailable } from '../supabaseClient';
import { Loader } from 'lucide-react';

const Auth: React.FC = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      if (!supabaseAvailable) {
        const msg = 'Authentication not configured. Supabase client unavailable.';
        console.error('[Auth] ', msg);
        setError(msg);
        return;
      }

      if (isSignUp) {
        // --- SIGN UP LOGIC ---
        // 1. Sign up the user in the auth schema
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (signUpError) throw signUpError;
        if (!authData.user) throw new Error("Sign up successful, but no user data returned.");

        // 2. Insert the user profile into the public.users table
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            id: authData.user.id,
            full_name: fullName,
            email: email,
          });

        if (profileError) {
          // This is a critical error. In a real app, you might want to delete the auth user
          // or have a cleanup process. For now, we'll just report it.
          console.error("Error creating user profile:", profileError);
          throw new Error("Could not create user profile. Please contact support.");
        }

        setMessage('Success! Please check your email for a confirmation link to log in.');
      } else {
        // --- SIGN IN LOGIC (with diagnostics and timeout) ---
        console.debug('[Auth] attempting sign-in for email:', email ? '[redacted]' : '');

        // Helper: wrap the sign-in call with a timeout so we don't hang indefinitely.
        let timer: any = null;
        const signInPromise = supabase.auth.signInWithPassword({ email, password });
        const timeoutPromise = new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Sign-in request timed out after 15s')), 15000);
        });

        let signInResult: any;
        try {
          signInResult = await Promise.race([signInPromise, timeoutPromise]);
        } catch (innerErr: any) {
          console.error('[Auth] signInWithPassword failed or timed out:', innerErr);
          // Surface a user-friendly message
          throw new Error(innerErr?.message || 'Sign-in failed or timed out.');
        } finally {
          if (timer) clearTimeout(timer);
        }

        console.debug('[Auth] signIn result:', signInResult && typeof signInResult === 'object' ? { hasData: !!signInResult.data, hasError: !!signInResult.error } : signInResult);

        const signInError = signInResult?.error ?? null;
        if (signInError) {
          console.error('[Auth] signInWithPassword returned error:', signInError);
          // Normalize Supabase error shape
          throw new Error(signInError.message || signInError.error_description || 'Sign-in failed');
        }

        // Successful sign-in: ensure session exists and navigate to root/dashboard
        const session = signInResult?.data?.session ?? null;
        console.debug('[Auth] signIn session present=', !!session);
        // If session is present, navigate to app root so `App` can pick up the session and render Dashboard
        if (session) {
          try {
            // Give the auth state a tick and then reload/redirect
            window.location.replace('/');
            return;
          } catch (navErr) {
            console.error('[Auth] navigation after sign-in failed:', navErr);
          }
        }
      }
    } catch (err: any) {
      setError(err.error_description || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      <div className="w-full max-w-md mx-auto bg-bg-secondary p-8 rounded-2xl shadow-2xl border border-border-primary animate-fade-in-up">
        <h2 className="text-3xl font-bold text-center text-white mb-2">
          {isSignUp ? 'Create Account' : 'Welcome Back'}
        </h2>
        <p className="text-center text-text-secondary mb-8">
          {isSignUp ? 'Start managing your inventory in seconds.' : 'Sign in to access your dashboard.'}
        </p>

        {message && <div className="bg-success/20 border border-success text-success text-sm p-3 rounded-md mb-4">{message}</div>}
        {error && <div className="bg-danger/20 border border-danger text-danger text-sm p-3 rounded-md mb-4">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {isSignUp && (
             <div>
                <label className="text-sm font-medium text-text-secondary block mb-2">Full Name</label>
                <input 
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="w-full bg-bg-primary border border-border-primary rounded-md p-3 text-text-primary focus:ring-2 focus:ring-accent-primary outline-none"
                  placeholder="John Doe"
                />
              </div>
          )}
          <div>
            <label className="text-sm font-medium text-text-secondary block mb-2">Email Address</label>
            <input 
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-bg-primary border border-border-primary rounded-md p-3 text-text-primary focus:ring-2 focus:ring-accent-primary outline-none"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-text-secondary block mb-2">Password</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full bg-bg-primary border border-border-primary rounded-md p-3 text-text-primary focus:ring-2 focus:ring-accent-primary outline-none"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-white transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          <button 
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center py-3 px-4 bg-accent-primary text-white font-semibold rounded-md hover:bg-purple-700 transition-colors disabled:bg-border-primary disabled:cursor-not-allowed"
          >
            {loading ? <Loader className="animate-spin" /> : (isSignUp ? 'Sign Up' : 'Sign In')}
          </button>
        </form>

        <p className="text-center text-sm text-text-secondary mt-8">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}
          <button onClick={() => { setIsSignUp(!isSignUp); setMessage(''); setError(''); }} className="font-semibold text-accent-primary hover:underline ml-1">
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </p>
      </div>
    </div>
  );
};

export default Auth;
