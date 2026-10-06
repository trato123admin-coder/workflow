'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck, AlertTriangle, AlertCircle, Info, ExternalLink } from 'lucide-react';
import { createClient } from '../../lib/supabase/client';

export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  is_read: boolean;
  action_url: string | null;
  created_at: string;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return 'Hace un momento';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Hace ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} d`;
  return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
}

function SeverityBadge({ severity }: { severity: NotificationItem['severity'] }) {
  switch (severity) {
    case 'critical':
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-destructive/10 text-destructive border border-destructive/20">
          <AlertCircle className="w-3 h-3" />
          Crítica
        </span>
      );
    case 'warning':
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          <AlertTriangle className="w-3 h-3" />
          Advertencia
        </span>
      );
    case 'info':
    default:
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
          <Info className="w-3 h-3" />
          Info
        </span>
      );
  }
}

export const NotificationsBell: React.FC = () => {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('ALL');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const supabase = createClient();
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false);

      if (error) {
        setFeedbackError(`Error al consultar conteo: ${error.message}`);
        return;
      }

      if (count !== null) {
        setUnreadCount(count);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error de conexión al consultar conteo';
      setFeedbackError(msg);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: userRes, error: userError } = await supabase.auth.getUser();
      if (userError) {
        setFeedbackError(`Error de autenticación: ${userError.message}`);
        return;
      }
      if (!userRes?.user) return;

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) {
        setFeedbackError(`Error al consultar notificaciones: ${error.message}`);
        return;
      }

      if (data) {
        setNotifications(data as NotificationItem[]);
      }
      await fetchUnreadCount();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado al cargar notificaciones';
      setFeedbackError(msg);
    } finally {
      setLoading(false);
    }
  }, [fetchUnreadCount]);

  useEffect(() => {
    fetchNotifications();

    const supabase = createClient();
    const channel = supabase
      .channel('realtime:notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          const newNotif = payload.new as NotificationItem;
          setNotifications((prev) => [newNotif, ...prev.slice(0, 29)]);
          fetchUnreadCount();
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications' },
        (payload) => {
          const updated = payload.new as NotificationItem;
          setNotifications((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
          fetchUnreadCount();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchNotifications, fetchUnreadCount]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleMarkAsRead = async (notif: NotificationItem) => {
    setFeedbackError(null);
    if (!notif.is_read) {
      const supabase = createClient();
      const { error } = await supabase.rpc('mark_notification_as_read', {
        p_notification_id: notif.id,
      });
      if (error) {
        setFeedbackError('No se pudo marcar la notificación como leída');
        return;
      }
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    if (notif.action_url) {
      setIsOpen(false);
      router.push(notif.action_url);
    }
  };

  const handleMarkAllRead = async () => {
    setFeedbackError(null);
    const supabase = createClient();
    const { error } = await supabase.rpc('mark_all_notifications_as_read');
    if (error) {
      setFeedbackError('No se pudieron marcar todas las notificaciones como leídas');
      return;
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const filteredNotifications = notifications.filter((n) =>
    filter === 'UNREAD' ? !n.is_read : true,
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Notificaciones ${unreadCount > 0 ? `(${unreadCount} no leídas)` : ''}`}
        aria-expanded={isOpen}
        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary transition-colors relative"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="min-w-4 h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center absolute -top-0.5 -right-0.5 ring-2 ring-card animate-in zoom-in-75">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-border bg-card shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-3.5 border-b border-border flex items-center justify-between gap-2 bg-muted/30">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-foreground">Notificaciones</h3>
              {unreadCount > 0 && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  {unreadCount} nuevas
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                title="Marcar todas como leídas"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Marcar todo leído</span>
              </button>
            )}
          </div>

          {feedbackError && (
            <div className="px-3 py-1.5 bg-destructive/10 border-b border-destructive/20 text-destructive text-[11px] flex items-center justify-between">
              <span>{feedbackError}</span>
              <button
                type="button"
                onClick={() => setFeedbackError(null)}
                className="text-xs font-bold ml-2 text-destructive hover:opacity-70"
                aria-label="Cerrar mensaje"
              >
                ✕
              </button>
            </div>
          )}

          {/* Filter Tabs */}
          <div className="flex border-b border-border bg-card px-3 pt-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => setFilter('ALL')}
              className={`pb-2 px-1 font-medium transition-colors border-b-2 ${
                filter === 'ALL'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Todas ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('UNREAD')}
              className={`pb-2 px-1 font-medium transition-colors border-b-2 ${
                filter === 'UNREAD'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              No leídas ({unreadCount})
            </button>
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-border">
            {loading ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                Cargando notificaciones...
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                  <Bell className="w-5 h-5 opacity-40" />
                </div>
                <p className="text-xs font-medium text-foreground">
                  {filter === 'UNREAD'
                    ? 'Sin notificaciones no leídas'
                    : 'No tienes notificaciones'}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Te avisaremos cuando haya novedades en tus casos.
                </p>
              </div>
            ) : (
              filteredNotifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleMarkAsRead(notif)}
                  className={`p-3.5 hover:bg-muted/50 cursor-pointer transition-colors flex gap-3 text-left relative ${
                    !notif.is_read ? 'bg-primary/5' : ''
                  }`}
                >
                  {!notif.is_read && (
                    <span className="w-1.5 h-1.5 rounded-full bg-primary absolute top-4 left-2" />
                  )}
                  <div className="flex-1 min-w-0 pl-1">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <SeverityBadge severity={notif.severity} />
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {formatRelativeTime(notif.created_at)}
                      </span>
                    </div>
                    <h4
                      className={`text-xs font-medium text-foreground leading-snug line-clamp-1 ${!notif.is_read ? 'font-semibold' : ''}`}
                    >
                      {notif.title}
                    </h4>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
                      {notif.body}
                    </p>
                    {notif.action_url && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-primary mt-1.5 font-medium">
                        Ver detalle <ExternalLink className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
