'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '../components/layout/AppShell';
import { AdminDashboard } from '../components/dashboard/AdminDashboard';
import { GestorDashboard } from '../components/dashboard/GestorDashboard';
import { createClient } from '../lib/supabase/client';
import { Shield, UserCheck, Loader2 } from 'lucide-react';

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeView, setActiveView] = useState<'admin' | 'gestor'>('gestor');
  const [userProfile, setUserProfile] = useState<{
    email?: string;
    name?: string;
    role?: string;
    isSuperuser?: boolean;
    permissions?: string[];
  }>({});

  useEffect(() => {
    async function checkUserRole() {
      setIsLoading(true);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsLoading(false);
        return;
      }

      // Consultar perfil y roles del usuario
      const [profileRes, rolesRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('first_name, last_name, email, is_active')
          .eq('id', user.id)
          .single(),
        supabase
          .from('user_roles')
          .select('role:roles(code, name, is_superuser)')
          .eq('user_id', user.id),
      ]);

      const fullName = profileRes.data
        ? `${profileRes.data.first_name || ''} ${profileRes.data.last_name || ''}`.trim() ||
          profileRes.data.email
        : user.email || 'Usuario';

      interface UserRoleItem {
        code?: string;
        name?: string;
        is_superuser?: boolean;
      }
      const userRoles = (rolesRes.data?.map((r) => r.role) || []) as (UserRoleItem | null)[];
      const hasSuperuserRole = userRoles.some((r) => r?.is_superuser || r?.code === 'ADMIN');

      setIsAdmin(hasSuperuserRole);
      setActiveView(hasSuperuserRole ? 'admin' : 'gestor');

      setUserProfile({
        email: user.email,
        name: fullName,
        role: hasSuperuserRole ? 'Administrador' : 'Gestor',
        isSuperuser: hasSuperuserRole,
      });

      setIsLoading(false);
    }

    checkUserRole();
  }, []);

  return (
    <AppShell
      breadcrumbs={[{ label: 'Inicio', href: '/' }, { label: 'Tablero' }]}
      userEmail={userProfile.email}
      userName={userProfile.name}
      userRole={userProfile.role}
      isSuperuser={userProfile.isSuperuser}
    >
      <div className="space-y-6">
        {/* Toggle para administradores entre Vista de Estudio y Vista de Gestor */}
        {isAdmin && (
          <div className="flex items-center justify-between p-2 px-3 rounded-2xl border border-border bg-card/60 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="w-3.5 h-3.5 text-primary" />
              <span>Modo Administrador activo</span>
            </div>

            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setActiveView('admin')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  activeView === 'admin'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Shield className="w-3 h-3 text-primary" />
                <span>Vista Estudio (Admin)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveView('gestor')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  activeView === 'gestor'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <UserCheck className="w-3 h-3 text-emerald-500" />
                <span>Mi Bandeja (Gestor)</span>
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-muted-foreground text-xs">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span>Cargando tablero...</span>
          </div>
        ) : activeView === 'admin' ? (
          <AdminDashboard />
        ) : (
          <GestorDashboard />
        )}
      </div>
    </AppShell>
  );
}
