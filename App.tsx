
import React, { useState, useEffect } from 'react';
import { supabase, supabaseAvailable } from './supabaseClient';
import { Session } from '@supabase/supabase-js';
import Welcome from './components/Welcome';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import SetupTeamModal from './components/SetupTeamModal';
import Logo from './components/Logo';
import DebugOverlay from './components/DebugOverlay';

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

  // Development helper: unregister any active service workers to avoid stale
  // cached index.html or assets causing the app to appear stuck on an
  // outdated loader. This runs once on mount in the browser.
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(reg => {
          console.debug('[App] unregistering service worker', reg);
          reg.unregister().catch(() => {});
        });
      }).catch(() => {});
    }
  }, []);

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
    // If Supabase client couldn't be created (missing envs), short-circuit
    // and stop showing the persistent loader. This avoids waiting for
    // an INITIAL_SESSION event that will never arrive.
    if (!supabaseAvailable) {
      console.error('[App] Supabase client not available; skipping auth listener.');
      setLoading(false);
      setSession(null);
      setHasTeam(false);
      return;
    }

    // setLoading is true by default. We wait for the initial session check.
    // First, try a direct session check (fast) so we don't hang waiting for
    // an INITIAL_SESSION event that might not fire in some environments.
    let subscription: any = null;
    // Safety timeout: don't let the app stay stuck on the loader forever.
    const initTimeout = setTimeout(() => {
      console.warn('[App] auth initialization timeout after 5s, proceeding without auth.');
      setLoading(false);
    }, 5000);

    (async () => {
      try {
        console.debug('[App] supabaseAvailable=', supabaseAvailable);

        if (!supabaseAvailable) {
          console.warn('[App] Supabase client not available; skipping auth init.');
          setSession(null);
          setHasTeam(false);
          return;
        }

        // Quick direct session fetch to determine initial state.
        console.debug('[App] calling supabase.auth.getSession()');
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.error('[App] supabase.auth.getSession error:', sessionError?.message || sessionError);
        }

        const sessionObj = sessionData?.session ?? null;
        console.debug('[App] getSession result hasSession=', !!sessionObj);
        setSession(sessionObj);

        if (sessionObj) {
          try {
            console.debug('[App] checking team for user.id=', sessionObj.user?.id ? '[redacted]' : 'missing');
            const teamExists = await checkTeam(sessionObj.user.id);
            setHasTeam(teamExists);
          } catch (e) {
            console.error('[App] error checking team:', e);
            setHasTeam(false);
          }
        } else {
          setHasTeam(false);
        }

        // Now subscribe to auth state changes for runtime updates.
        subscription = supabase.auth.onAuthStateChange(async (event: string, session: Session | null) => {
          console.debug('[App] auth event', event);
          setSession(session);
          if (event === 'SIGNED_IN' && session) {
            try {
              const teamExists = await checkTeam(session.user.id);
              setHasTeam(teamExists);
            } catch (e) {
              console.error('[App] error checking team on SIGNED_IN:', e);
            }
          } else if (event === 'SIGNED_OUT') {
            setHasTeam(false);
          }
        });
      } catch (e) {
        console.error('[App] error during auth initialization:', e);
        setLoading(false);
      } finally {
        clearTimeout(initTimeout);
        setLoading(false);
      }
    })();

    return () => {
      clearTimeout(initTimeout);
      try {
        subscription?.data?.subscription?.unsubscribe?.();
      } catch {}
      try { subscription?.unsubscribe?.(); } catch {}
    };
  }, []);


  if (loading) {
    return <FullPageLoader />;
  }

  if (!session) {
    if (authView === 'welcome') {
        return <Welcome onGetStarted={() => setAuthView('auth')} />;
    }
    return <Auth />;
  }
  
  if (hasTeam === false) {
    return <SetupTeamModal session={session} onTeamCreated={() => setHasTeam(true)} />;
  }

  if (hasTeam === true) {
    return <Dashboard key={session.user.id} session={session} />;
  }
  
  return (
    <>
      <FullPageLoader />
      {/* Dev-only overlay to surface quick runtime diagnostics without DevTools */}
      <DebugOverlay />
    </>
  );
};

export default App;