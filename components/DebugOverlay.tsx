import React, { useEffect, useState } from 'react';
import { supabase, supabaseAvailable } from '../supabaseClient';
import { runDevDbTest } from '../db';

const DebugOverlay: React.FC = () => {
  const [sessionInfo, setSessionInfo] = useState<string>('unknown');
  const [anonKeyLen, setAnonKeyLen] = useState<number | null>(null);

  useEffect(() => {
    // Show a non-sensitive indicator for the anon key (length only)
    try {
      const len = ((import.meta.env as any).VITE_SUPABASE_ANON_KEY || '').length;
      setAnonKeyLen(len || null);
    } catch {
      setAnonKeyLen(null);
    }

    (async () => {
      if (!supabaseAvailable) {
        setSessionInfo('supabase unavailable');
        return;
      }
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          setSessionInfo('getSession error: ' + (error.message || String(error)));
          return;
        }
        setSessionInfo(data?.session ? 'signed-in' : 'no-session');
      } catch (e: any) {
        setSessionInfo('exception: ' + (e?.message ?? String(e)));
      }
    })();
  }, []);

  if (!(import.meta.env as any).DEV) return null;

  const [dbResult, setDbResult] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const onRunDbTest = async () => {
    setRunning(true);
    setDbResult(null);
    try {
      const res = await runDevDbTest();
      setDbResult(JSON.stringify(res, null, 2));
    } catch (e: any) {
      setDbResult(String(e?.message ?? e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div style={{position: 'fixed', right: 12, bottom: 12, zIndex: 9999}}>
      <div style={{background: 'rgba(0,0,0,0.75)', color: 'white', padding: 10, borderRadius: 8, fontSize: 12, minWidth: 260}}>
        <div style={{fontWeight: 700, marginBottom: 6}}>Dev Debug</div>
        <div>supabaseAvailable: {String(supabaseAvailable)}</div>
        <div>anonKeyLen: {anonKeyLen ?? 'none'}</div>
        <div>session: {sessionInfo}</div>
        <div style={{marginTop:8}}>
          <button onClick={onRunDbTest} disabled={running} style={{padding: '6px 8px', borderRadius:6, border:'none', background:'#2563eb', color:'white', cursor:'pointer'}}>
            {running ? 'Running DB test...' : 'Run DB test'}
          </button>
        </div>
        {dbResult && (
          <pre style={{marginTop:8, maxHeight:160, overflow:'auto', whiteSpace:'pre-wrap', fontSize:11}}>{dbResult}</pre>
        )}
        <div style={{marginTop:6, opacity:0.8, fontSize:11}}>Visible only in dev. No secrets shown.</div>
      </div>
    </div>
  );
};

export default DebugOverlay;
