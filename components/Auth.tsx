
import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Loader } from 'lucide-react';

const Auth: React.FC = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
        // --- SIGN IN LOGIC (unchanged) ---
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        // The onAuthStateChange listener in App.tsx will handle the redirect.
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
            <input 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-bg-primary border border-border-primary rounded-md p-3 text-text-primary focus:ring-2 focus:ring-accent-primary outline-none"
              placeholder="••••••••"
            />
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
