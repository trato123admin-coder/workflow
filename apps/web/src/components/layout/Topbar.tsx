'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Bell, Sun, Moon, LogOut, User } from 'lucide-react';
import { createClient } from '../../lib/supabase/client';
import { GlobalSearchDialog } from './GlobalSearchDialog';

interface TopbarProps {
  userEmail?: string;
  userName?: string;
  userRole?: string;
}

export const Topbar: React.FC<TopbarProps> = ({
  userEmail = 'usuario@workflow.pe',
  userName = 'Usuario',
  userRole = 'Administrador',
}) => {
  const router = useRouter();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    setTheme(currentTheme as 'light' | 'dark');
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('theme', nextTheme);
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="h-16 border-b border-border bg-card px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30">
      {/* Global Search Bar (DocuAI mockup style) */}
      <div
        onClick={() => setIsSearchOpen(true)}
        className="relative flex-1 max-w-md hidden sm:block cursor-pointer group"
      >
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-hover:text-primary transition-colors" />
        <input
          type="text"
          readOnly
          placeholder="Buscar expedientes, personas, documentos... (Ctrl + K)"
          className="w-full pl-9 pr-12 py-2 text-xs rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded border border-border font-mono">
          ⌘K
        </kbd>
      </div>

      <GlobalSearchDialog isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      {/* Right Controls */}
      <div className="flex items-center gap-2 ml-auto">
        {/* Theme Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
        >
          {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>

        {/* Notifications */}
        <button
          type="button"
          aria-label="Notificaciones"
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary transition-colors relative"
        >
          <Bell className="w-4 h-4" />
          <span className="w-2 h-2 rounded-full bg-primary absolute top-2 right-2 ring-2 ring-card" />
        </button>

        {/* User Profile Menu */}
        <div className="relative ml-2">
          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-expanded={isMenuOpen}
            aria-haspopup="true"
            className="flex items-center gap-3 p-1 rounded-xl hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center border border-primary/20">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="hidden lg:flex flex-col text-left">
              <span className="text-xs font-semibold text-foreground leading-tight">
                {userName}
              </span>
              <span className="text-[11px] text-muted-foreground leading-tight">{userRole}</span>
            </div>
          </button>

          {/* Profile Dropdown */}
          {isMenuOpen && (
            <div
              className="absolute right-0 mt-2 w-56 rounded-xl border border-border bg-card p-2 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150"
              role="menu"
            >
              <div className="px-3 py-2 border-b border-border mb-1">
                <p className="text-xs font-semibold text-foreground truncate">{userName}</p>
                <p className="text-[11px] text-muted-foreground truncate">{userEmail}</p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  router.push('/users');
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg text-foreground hover:bg-muted transition-colors text-left"
                role="menuitem"
              >
                <User className="w-4 h-4 text-muted-foreground" />
                <span>Mi perfil</span>
              </button>

              <button
                type="button"
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg text-destructive hover:bg-destructive/10 transition-colors text-left"
                role="menuitem"
              >
                <LogOut className="w-4 h-4" />
                <span>Cerrar sesión</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
