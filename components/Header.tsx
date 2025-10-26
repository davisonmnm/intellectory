import React, { useState } from 'react';
import { LayoutDashboard, Calendar, Plus, Zap, Sunrise, History, BarChart, Truck, Upload, User, Settings, LogOut, Archive, Menu, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { User as SupabaseUser } from '@supabase/supabase-js';
import Logo from './Logo';


type View = 'dashboard' | 'binStock' | 'history' | 'settings';

interface HeaderProps {
  teamName: string;
  onNewDayClick: () => void;
  onCommandInputClick: () => void;
  onAddItemClick: () => void;
  onSuppliersClick: () => void;
  onExportClick: () => void;
  onNavigate: (view: View) => void;
  currentView: View;
  selectedDate: string;
  onDateChange: (date: string) => void;
  user: SupabaseUser | null;
}

const Header: React.FC<HeaderProps> = ({ teamName, onNewDayClick, onCommandInputClick, onAddItemClick, onSuppliersClick, onExportClick, onNavigate, currentView, selectedDate, onDateChange, user }) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleNavClick = (view: View) => {
    onNavigate(view);
    setIsDrawerOpen(false);
  };
  
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const NavLink: React.FC<{view: View, label: string, icon: React.ReactNode}> = ({ view, label, icon }) => (
    <button 
        onClick={() => handleNavClick(view)} 
        className={`w-full flex items-center gap-4 px-4 py-3 text-base rounded-lg transition-colors ${currentView === view ? 'bg-accent-primary text-white font-semibold' : 'text-text-primary hover:bg-bg-secondary'}`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <>
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        {/* Left Side */}
        <div className="flex items-center justify-between w-full md:w-auto">
          <div 
            className="flex items-center gap-2 group cursor-pointer"
            onClick={() => onNavigate('dashboard')}
          >
            <Logo className="w-7 h-7 flex-shrink-0" />
            <div>
              <h1 className="text-xl font-bold text-white transition-colors group-hover:text-accent-primary">
                Intellectory
              </h1>
              <p className="text-sm text-text-secondary">{teamName}</p>
            </div>
          </div>
          <div className="md:hidden">
              <button onClick={() => setIsDrawerOpen(true)} className="p-2 text-text-secondary hover:text-white">
                  <Menu size={24} />
              </button>
          </div>
        </div>

        {/* Middle Actions */}
        <div className="flex-grow w-full md:w-auto flex flex-wrap items-center justify-start md:justify-center gap-2">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="bg-bg-secondary border border-border-primary rounded-md pl-9 pr-2 py-1.5 text-white w-full md:w-auto text-sm"
            />
          </div>
          <button onClick={onAddItemClick} className="flex items-center gap-2 bg-success hover:bg-green-700 text-white font-semibold px-3 py-1.5 rounded-md transition-colors text-sm">
            <Plus size={16} /> Add Item
          </button>
          <button onClick={onCommandInputClick} className="flex items-center gap-2 bg-accent-secondary hover:bg-cyan-700 text-white font-semibold px-3 py-1.5 rounded-md transition-colors text-sm">
            <Zap size={16} /> Quick Input
          </button>
          <button onClick={onNewDayClick} className="flex items-center gap-2 bg-accent-primary hover:bg-purple-700 text-white font-semibold px-3 py-1.5 rounded-md transition-colors text-sm">
            <Sunrise size={16} /> New Day
          </button>
        </div>
        
        {/* Right Side (Desktop) */}
        <div className="hidden md:flex items-center gap-2">
          <div className="flex items-center gap-3 text-text-secondary">
              <button onClick={() => onNavigate('dashboard')} className={`p-1 rounded-full transition-colors ${currentView === 'dashboard' ? 'text-accent-primary bg-accent-primary/20' : 'hover:text-white'}`} title="Dashboard">
                <LayoutDashboard size={18}/>
              </button>
               <button onClick={() => onNavigate('binStock')} className={`p-1 rounded-full transition-colors ${currentView === 'binStock' ? 'text-accent-primary bg-accent-primary/20' : 'hover:text-white'}`} title="Bin Stock">
                <Archive size={18}/>
              </button>
              <button onClick={() => onNavigate('history')} className={`p-1 rounded-full transition-colors ${currentView === 'history' ? 'text-accent-primary bg-accent-primary/20' : 'hover:text-white'}`} title="History">
                <History size={18}/>
              </button>
              <button onClick={onSuppliersClick} className="hover:text-white p-1" title="Suppliers"><Truck size={18}/></button>
              <button onClick={onExportClick} className="hover:text-white p-1" title="Export"><Upload size={18}/></button>
          </div>
           <div className="w-px h-6 bg-border-primary mx-1"></div>
           <div className="flex items-center gap-2">
               <div className="text-right">
                   <p className="font-semibold text-white text-sm truncate max-w-28">{user?.email}</p>
                   <p className="text-xs text-text-secondary">User</p>
               </div>
               <User className="h-7 w-7 text-text-secondary"/>
           </div>
           <div className="w-px h-6 bg-border-primary mx-1"></div>
           <div className="flex items-center gap-3 text-text-secondary">
               <button onClick={() => onNavigate('settings')} className={`p-1 rounded-full transition-colors ${currentView === 'settings' ? 'text-accent-primary bg-accent-primary/20' : 'hover:text-white'}`} title="Settings"><Settings size={18}/></button>
               <button onClick={handleLogout} className="hover:text-white p-1" title="Logout"><LogOut size={18}/></button>
           </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      <div className={`fixed inset-0 z-50 md:hidden transition-opacity duration-300 ${isDrawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black bg-opacity-60" onClick={() => setIsDrawerOpen(false)}></div>
          
          {/* Drawer Content */}
          <div className={`absolute top-0 right-0 h-full w-4/5 max-w-sm bg-bg-primary shadow-2xl p-4 flex flex-col transition-transform duration-300 ease-in-out ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>
              <div className="flex items-center justify-between pb-4 border-b border-border-primary">
                  <h2 className="font-bold text-lg text-white">Menu</h2>
                  <button onClick={() => setIsDrawerOpen(false)} className="p-1 text-text-secondary hover:text-white">
                      <X size={22}/>
                  </button>
              </div>

              <nav className="flex-grow mt-4 space-y-1">
                <NavLink view="dashboard" label="Stock Dashboard" icon={<LayoutDashboard size={20}/>} />
                <NavLink view="binStock" label="Bin Stock" icon={<Archive size={20}/>} />
                <NavLink view="history" label="History" icon={<History size={20}/>} />
                <NavLink view="settings" label="Settings" icon={<Settings size={20}/>} />
              </nav>

              <div className="mt-auto pt-4 border-t border-border-primary space-y-2">
                <button onClick={() => { onSuppliersClick(); setIsDrawerOpen(false); }} className="w-full flex items-center gap-4 px-4 py-3 text-base rounded-lg text-text-primary hover:bg-bg-secondary">
                  <Truck size={20} /> Suppliers
                </button>
                <button onClick={() => { onExportClick(); setIsDrawerOpen(false); }} className="w-full flex items-center gap-4 px-4 py-3 text-base rounded-lg text-text-primary hover:bg-bg-secondary">
                  <Upload size={20} /> Export Data
                </button>
                <div className="flex items-center gap-3 p-2">
                    <User className="h-8 w-8 text-text-secondary"/>
                    <div className="text-left">
                        <p className="font-semibold text-white text-sm truncate max-w-36">{user?.email}</p>
                        <p className="text-xs text-text-secondary">User</p>
                    </div>
                </div>
                 <button onClick={handleLogout} className="w-full flex items-center gap-4 px-4 py-3 text-base rounded-lg text-text-primary hover:bg-bg-secondary">
                  <LogOut size={20} /> Logout
                </button>
              </div>
          </div>
      </div>
    </>
  );
};

export default Header;