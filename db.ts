import { supabase, supabaseAvailable } from './supabaseClient';

type SupaResponse<T> = { data: T | null; error: any };

async function runWithRetry<T>(fn: () => Promise<SupaResponse<T>>, attempts = 3, baseDelay = 300): Promise<SupaResponse<T>> {
  let lastErr: any = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fn();
      // Supabase returns { data, error }
      if (!res.error) return res;
      lastErr = res.error;
      // For certain auth/connection errors, don't retry.
      const msg = String(res.error?.message || res.error);
      if (/invalid|unauthorized|forbidden|not found/i.test(msg)) break;
    } catch (e) {
      lastErr = e;
    }
    // exponential backoff
    await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, i)));
  }
  return { data: null, error: lastErr };
}

export async function safeSelect<T = any>(table: string, columns = '*', opts?: { eq?: Record<string, any>; limit?: number }): Promise<SupaResponse<T>> {
  if (!supabaseAvailable) return { data: null, error: new Error('Supabase client unavailable') };
  return runWithRetry(async () => {
    let q: any = supabase.from(table).select(columns);
    if (opts?.eq) {
      for (const k of Object.keys(opts.eq)) q = q.eq(k, opts.eq[k]);
    }
    if (opts?.limit) q = q.limit(opts.limit);
    const { data, error } = await q;
    return { data, error };
  });
}

export async function safeInsert<T = any>(table: string, payload: any, opts?: { returning?: 'minimal' | 'representation' | 'none' | '*' }): Promise<SupaResponse<T>> {
  if (!supabaseAvailable) return { data: null, error: new Error('Supabase client unavailable') };
  return runWithRetry(async () => {
    let q: any = supabase.from(table).insert(payload);
    if (opts?.returning) q = q.select(opts.returning === '*' ? '*' : undefined);
    const { data, error } = await q;
    return { data, error };
  });
}

export async function safeUpdate<T = any>(table: string, updates: any, match: Record<string, any>): Promise<SupaResponse<T>> {
  if (!supabaseAvailable) return { data: null, error: new Error('Supabase client unavailable') };
  return runWithRetry(async () => {
    let q: any = supabase.from(table).update(updates);
    for (const k of Object.keys(match)) q = q.eq(k, match[k]);
    const { data, error } = await q;
    return { data, error };
  });
}

// Small sanity test used by dev UI: select one row and insert a lightweight activity_log row (if table exists).
export async function runDevDbTest() {
  if (!supabaseAvailable) return { ok: false, message: 'Supabase client unavailable' };
  // Try a harmless select
  const sel = await safeSelect('stock_items', '*', { limit: 1 });
  if (sel.error) return { ok: false, stage: 'select', error: String(sel.error?.message ?? sel.error) };

  // Try an insert into activity_log if that table exists
  const now = new Date().toISOString();
  const insertPayload = { message: 'dev-db-test', timestamp: now };
  const ins = await safeInsert('activity_log', insertPayload);
  if (ins.error) return { ok: false, stage: 'insert', error: String(ins.error?.message ?? ins.error) };

  return { ok: true, select: sel.data, insert: ins.data };
}

export default {
  safeSelect,
  safeInsert,
  safeUpdate,
  runDevDbTest,
};
