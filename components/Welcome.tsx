import React from 'react';
import { BarChart, Zap, Archive } from 'lucide-react';
import Logo from './Logo';

interface WelcomeProps {
  onGetStarted: () => void;
}

const FeatureCard: React.FC<{ icon: React.ReactNode, title: string, children: React.ReactNode }> = ({ icon, title, children }) => (
    <div className="bg-bg-secondary/50 border border-border-primary p-6 rounded-lg backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-2">
            {icon}
            <h3 className="text-lg font-bold text-white">{title}</h3>
        </div>
        <p className="text-text-secondary">{children}</p>
    </div>
);

const Welcome: React.FC<WelcomeProps> = ({ onGetStarted }) => {
  return (
    <div className="min-h-screen bg-bg-primary text-white flex flex-col items-stretch justify-center p-4 overflow-hidden relative">
      <div className="absolute inset-0 bg-grid-pattern opacity-8 pointer-events-none"></div>
      <div className="container-centered relative z-10 max-w-6xl mx-auto py-12">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Logo className="w-12 h-12" />
            <div>
              <div className="text-sm text-text-secondary">Intellectory</div>
              <div className="text-xs text-text-secondary">AI Inventory Manager</div>
            </div>
          </div>
          {/* Get started kept in top-right */}
          <div className="hidden md:block">
            <button
              onClick={onGetStarted}
              className="px-6 py-2 bg-success text-white font-semibold rounded-full hover:bg-green-700 transition duration-200 shadow-md"
              aria-label="Get started"
            >
              Get Started
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold leading-tight">A smarter way to manage inventory</h1>
            <p className="mt-4 text-text-secondary max-w-xl">Centralize stock, automate reporting, and use an AI assistant to reduce manual work. Fast onboarding, secure syncing with Supabase, and purpose-built bin management.</p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={onGetStarted} className="md:hidden px-5 py-2 bg-success text-white font-semibold rounded-full hover:bg-green-700 transition duration-200 shadow-md">Get Started</button>
              <a href="#features" className="px-4 py-2 border border-border-primary rounded-full text-text-secondary text-sm hover:bg-bg-secondary/40">Learn more</a>
            </div>

            <div id="features" className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FeatureCard icon={<BarChart className="text-accent-primary" />} title="Smart Tracking">Accurate stock counts and real-time adjustments across teams.</FeatureCard>
              <FeatureCard icon={<Zap className="text-accent-secondary" />} title="AI Assistant">Natural language commands to update stock, query inventory, and generate reports.</FeatureCard>
              <FeatureCard icon={<Archive className="text-yellow-400" />} title="Bin Management">Track returnable containers with supplier balances and history.</FeatureCard>
              <FeatureCard icon={<Zap className="text-white" />} title="Secure Sync">End-to-end encrypted sync with Supabase and role-based access.</FeatureCard>
            </div>
          </div>

          <div className="flex items-center justify-center">
            {/* Placeholder for a product illustration or screenshot; keep layout intact */}
            <div className="w-full max-w-md bg-bg-secondary/40 border border-border-primary rounded-lg p-6">
              <div className="h-56 bg-gradient-to-br from-black/10 to-white/3 rounded-md flex items-center justify-center text-text-secondary">App Preview</div>
              <p className="mt-4 text-sm text-text-secondary">Preview of the dashboard and inventory table — full functionality available after sign up.</p>
            </div>
          </div>
        </div>
        
        <footer className="mt-10 text-text-secondary text-sm text-center md:text-left">&copy; {new Date().getFullYear()} Intellectory. All rights reserved.</footer>
      </div>
    </div>
  );
};

export default Welcome;