'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '../../lib/utils';
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Building2,
  FileText,
  FileCheck,
  Scale,
  Sparkles,
  BarChart3,
  Coins,
  ShieldCheck,
  Settings,
  Activity,
} from 'lucide-react';

import type { FeatureFlagKey } from '@workflow/shared';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  permission?: string[];
  featureFlag?: FeatureFlagKey;
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Inicio',
    href: '/dashboard',
    icon: <LayoutDashboard className="w-5 h-5 shrink-0" />,
  },
  {
    label: 'Casos',
    href: '/cases',
    icon: <Briefcase className="w-5 h-5 shrink-0" />,
    permission: ['cases.read.all', 'cases.read.assigned'],
  },
  {
    label: 'Personas',
    href: '/persons',
    icon: <Users className="w-5 h-5 shrink-0" />,
    permission: ['parties.read', 'clients.read'],
  },
  {
    label: 'Entidades',
    href: '/entities',
    icon: <Building2 className="w-5 h-5 shrink-0" />,
    permission: ['entities.read'],
  },
  {
    label: 'Documentos',
    href: '/documents',
    icon: <FileText className="w-5 h-5 shrink-0" />,
    permission: ['documents.read'],
  },
  {
    label: 'Plantillas',
    href: '/templates',
    icon: <FileCheck className="w-5 h-5 shrink-0" />,
    permission: ['templates.manage'],
  },
  {
    label: 'Reglas documentales',
    href: '/rules',
    icon: <Scale className="w-5 h-5 shrink-0" />,
    permission: ['rules.manage'],
  },
  {
    label: 'Asistente',
    href: '/assistant',
    icon: <Sparkles className="w-5 h-5 shrink-0" />,
    permission: ['documents.generate'],
    featureFlag: 'module.ai',
  },
  {
    label: 'Reportes',
    href: '/reports',
    icon: <BarChart3 className="w-5 h-5 shrink-0" />,
    permission: ['reports.read'],
    featureFlag: 'module.reports_export',
  },
  {
    label: 'Caja Chica',
    href: '/cash',
    icon: <Coins className="w-5 h-5 shrink-0" />,
    permission: ['cash.read'],
    featureFlag: 'module.cash',
  },
  {
    label: 'Usuarios y roles',
    href: '/users',
    icon: <ShieldCheck className="w-5 h-5 shrink-0" />,
    permission: ['users.manage', 'roles.manage'],
  },
  {
    label: 'Configuración',
    href: '/settings',
    icon: <Settings className="w-5 h-5 shrink-0" />,
    permission: ['settings.manage'],
  },
  {
    label: 'Monitoreo',
    href: '/monitoring',
    icon: <Activity className="w-5 h-5 shrink-0" />,
    permission: ['monitoring.read'],
    featureFlag: 'module.monitoring',
  },
];

interface SidebarProps {
  userPermissions?: string[];
  isSuperuser?: boolean;
  disabledFeatureFlags?: string[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  userPermissions = [],
  isSuperuser = false,
  disabledFeatureFlags = ['module.ai'], // module.ai apagado por defecto
}) => {
  const pathname = usePathname();

  const visibleItems = NAV_ITEMS.filter((item) => {
    // 1. Filtrar si la función o módulo está desactivado por feature flag
    if (item.featureFlag && disabledFeatureFlags.includes(item.featureFlag)) {
      return false;
    }

    // 2. Filtrar por permisos
    if (!item.permission || item.permission.length === 0) return true;
    if (isSuperuser) return true;
    return item.permission.some((p) => userPermissions.includes(p));
  });

  return (
    <aside
      className="hidden md:flex flex-col w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-200 shrink-0 select-none"
      aria-label="Barra de navegación principal"
    >
      {/* Brand header */}
      <div className="h-16 flex items-center px-6 gap-3 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-base shadow-sm">
          W
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-sm tracking-tight text-white">WorkFlow</span>
          <span className="text-[10px] text-sidebar-foreground/60 tracking-wider uppercase font-medium">
            Gestión Sucesoria
          </span>
        </div>
      </div>

      {/* Nav items list */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 scrollbar-none">
        {visibleItems.map((item) => {
          const isActive = pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all group focus:outline-none focus:ring-2 focus:ring-sidebar-ring',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm font-semibold'
                  : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              )}
            >
              <span
                className={cn(
                  'transition-transform duration-150 group-hover:scale-105',
                  isActive
                    ? 'text-primary-foreground'
                    : 'text-sidebar-foreground/60 group-hover:text-sidebar-foreground',
                )}
              >
                {item.icon}
              </span>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer / system status */}
      <div className="p-4 border-t border-sidebar-border text-[11px] text-sidebar-foreground/50">
        <div className="flex items-center justify-between">
          <span className="font-medium">WorkFlow v0.1</span>
          <span
            className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"
            title="Sistema en línea"
          />
        </div>
      </div>
    </aside>
  );
};
