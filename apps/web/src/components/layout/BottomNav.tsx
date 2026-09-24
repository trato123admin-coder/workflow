'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '../../lib/utils';
import { LayoutDashboard, Briefcase, FileText, MoreHorizontal } from 'lucide-react';

interface BottomNavProps {
  onMoreClick?: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ onMoreClick }) => {
  const pathname = usePathname();

  const links = [
    { label: 'Inicio', href: '/dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { label: 'Casos', href: '/cases', icon: <Briefcase className="w-5 h-5" /> },
    { label: 'Documentos', href: '/documents', icon: <FileText className="w-5 h-5" /> },
    { label: 'Más', href: '/users', icon: <MoreHorizontal className="w-5 h-5" />, onClick: onMoreClick },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border z-40 flex items-center justify-around px-2 shadow-lg"
      aria-label="Navegación inferior móvil"
    >
      {links.map((link) => {
        const isActive = pathname.startsWith(link.href);

        return (
          <Link
            key={link.label}
            href={link.href}
            onClick={link.onClick}
            className={cn(
              'flex flex-col items-center justify-center flex-1 h-full min-h-[44px] min-w-[44px] text-[11px] font-medium transition-colors focus:outline-none',
              isActive
                ? 'text-primary font-bold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {link.icon}
            <span className="mt-1">{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};
