'use client';

import React from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { BottomNav } from './BottomNav';

interface AppShellProps {
  children: React.ReactNode;
  userEmail?: string;
  userName?: string;
  userRole?: string;
  userPermissions?: string[];
  isSuperuser?: boolean;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  userEmail,
  userName,
  userRole,
  userPermissions = [],
  isSuperuser = false,
}) => {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Sidebar for Desktop & Tablet */}
      <Sidebar userPermissions={userPermissions} isSuperuser={isSuperuser} />

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <Topbar userEmail={userEmail} userName={userName} userRole={userRole} />

        {/* Scrollable Page Body */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-20 md:pb-8">
          <div className="max-w-7xl mx-auto w-full">{children}</div>
        </main>

        {/* Bottom Navigation for Mobile (< 768px) */}
        <BottomNav />
      </div>
    </div>
  );
};
