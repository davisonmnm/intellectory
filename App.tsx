
import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Session } from '@supabase/supabase-js';
import Welcome from './components/Welcome';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import SetupTeamModal from './components/SetupTeamModal';
import Logo from './components/Logo';

const FullPageLoader: React.FC = () => (
  <div className="flex items-center justify-center h-screen bg-bg-primary">
    <div className="flex flex-col items-center gap-4">
      <Logo className="w-12 h-12" />
      <p className="text-text-secondary">Initializing Intellectory...</p>
    </div>
  </div>
);

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authView, setAuthView] = useState<'welcome' | 'auth'>('welcome');
  const [hasTeam, setHasTeam] = useState<boolean | null>(null);

  const checkTeam = async (user_id: string) => {
    const { data, error } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', user_id)
      .limit(1);
    
    if (error) {
      console.error("Error checking for team:", error);
      return false;
    }
    
    return data && data.length > 0;
  };

  useEffect(() => {
    // setLoading is true by default. We wait for the initial session check.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Always set the session. This handles token refreshes gracefully.
      setSession(session);

      if (event === 'INITIAL_SESSION') {
        if (session) {
          const teamExists = await checkTeam(session.user.id);
          setHasTeam(teamExists);
        } else {
          setHasTeam(false);
        }
        setLoading(false);
      } else if (event === 'SIGNED_IN') {
        // After a sign-in, we need to check for a team. The view will update automatically.
        if (session) {
          const teamExists = await checkTeam(session.user.id);
          setHasTeam(teamExists);
        }
      } else if (event === 'SIGNED_OUT') {
        // On sign-out, clear the team status.
        setHasTeam(false);
      }
      // For TOKEN_REFRESHED events, only `setSession(session)` runs,
      // which is what we want. This prevents re-rendering the whole page.
    });

    return () => subscription.unsubscribe();
  }, []);


  console.log('App render - loading:', loading, 'session:', !!session, 'hasTeam:', hasTeam);

  if (loading) {
    console.log('Showing loading screen');
    return <FullPageLoader />;
  }

  if (!session) {
    console.log('No session, showing auth');
    if (authView === 'welcome') {
        return <Welcome onGetStarted={() => setAuthView('auth')} />;
    }
    return <Auth />;
  }
  
  if (hasTeam === false) {
    console.log('No team, showing setup modal');
    return <SetupTeamModal session={session} onTeamCreated={() => setHasTeam(true)} />;
  }

  if (hasTeam === true) {
    console.log('Has team, showing dashboard');
    return <Dashboard key={session.user.id} session={session} />;
  }
  
  console.log('Fallback to loading screen');
  return <FullPageLoader />;
};

export default App;