// FIX: Add a triple-slash directive to include Node.js types, which are needed for 'process.cwd()' to be recognized by TypeScript.
/// <reference types="node" />

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  // Resolve env values; loadEnv returns values as strings.
  // Use process.env fallback for environments where loadEnv may not populate values.
  const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  const geminiKey = env.VITE_GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
  const geminiModel = env.VITE_GEMINI_MODEL || process.env.VITE_GEMINI_MODEL || '';

  return {
    plugins: [react()],
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('react-dom')) return 'vendor.react';
              if (id.includes('@supabase')) return 'vendor.supabase';
              if (id.includes('@google/genai')) return 'vendor.genai';
              if (id.includes('lucide-react')) return 'vendor.icons';
              return 'vendor';
            }
          }
        }
      }
    },
    // Define environment variables at build time so imports like `import.meta.env.VITE_*`
    // and any runtime checks receive concrete values in the bundle. This helps
    // prevent issues where the build runs without the env loaded and results in
    // undefined values (which can cause a blank app when the client is created
    // with missing config).
    define: {
      'process.env.API_KEY': JSON.stringify(geminiKey),
      'process.env.SUPABASE_URL': JSON.stringify(supabaseUrl),
      'process.env.SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
      // Also explicitly replace common Vite-style import.meta.env keys so that
      // the Supabase client and other code that reads `import.meta.env.VITE_*`
      // are inlined during the build. Provide empty-string fallbacks to avoid
      // injecting undefined into the bundle.
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl || ''),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey || ''),
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(geminiKey || ''),
      'import.meta.env.VITE_GEMINI_MODEL': JSON.stringify(geminiModel || ''),
    }
  }
});