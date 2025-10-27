import { createClient } from '@supabase/supabase-js';

// Read envs both from Vite's import.meta.env and process.env as a fallback.
const supabaseUrl = (import.meta.env as any).VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta.env as any).VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

// Helper to create a chainable stub that resolves to a Supabase-style error response.
function createUnavailableClient(message: string) {
	const missingResponse = { data: null, error: new Error(message) };

	// A chainable object that returns itself for any property access or call.
	const chain: any = new Proxy(function () {}, {
		apply() {
			return chain;
		},
		get() {
			return chain;
		}
	});

	// Make it awaitable: then resolves with the missingResponse to match Supabase result shape.
	chain.then = (resolve: any) => {
		const p = Promise.resolve(missingResponse).then(resolve);
		return p;
	};
	chain.catch = () => chain;
	chain.finally = () => chain;

	return chain;
}

// Initialize the real Supabase client only when we have both required values.
let supabase: any;
if (supabaseUrl && supabaseAnonKey) {
	try {
		supabase = createClient(supabaseUrl, supabaseAnonKey);
		// Non-sensitive debug: indicate presence without printing secrets.
		console.debug('[supabaseClient] initialized', {
			supabaseUrlPresent: !!supabaseUrl,
			anonKeyLength: supabaseAnonKey?.length ?? 0
		});
	} catch (e) {
		console.error('[supabaseClient] failed to initialize Supabase client', e);
			supabase = createUnavailableClient('Supabase client failed to initialize. See console for details.');
	}
} else {
	console.error('[supabaseClient] missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY; Supabase client will be unavailable.');
		supabase = createUnavailableClient('Supabase client is not configured (missing env).');
}

	// Export a small boolean so the app can detect whether the client is available
	const supabaseAvailable = !!(supabase && typeof (supabase as any).auth?.onAuthStateChange === 'function');

	export { supabase, supabaseAvailable };