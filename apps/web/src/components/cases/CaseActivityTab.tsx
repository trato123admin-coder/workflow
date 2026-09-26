'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Send, Loader2, Clock } from 'lucide-react';
import { createClient } from '../../lib/supabase/client';
import { ActivityTimelineItem, type TimelineEntry } from './ActivityTimelineItem';

interface CommentItem {
  id: string;
  case_id: string;
  user_id: string;
  comment_text: string;
  mentions: string[];
  created_at: string;
  user?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
  };
}

interface EventItem {
  id: string;
  event_type: string;
  actor_id?: string | null;
  title: string;
  description?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  actor?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
  };
}

interface CaseActivityTabProps {
  caseId: string;
}

export const CaseActivityTab: React.FC<CaseActivityTabProps> = ({ caseId }) => {
  const [filter, setFilter] = useState<'all' | 'comments' | 'events'>('all');
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const fetchActivity = useCallback(async () => {
    setIsLoading(true);
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);

    const { data: commentsData } = await supabase
      .from('case_comments')
      .select('id, case_id, user_id, comment_text, mentions, created_at, user:profiles(first_name, last_name, email)')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false });

    const { data: eventsData } = await supabase
      .from('case_events')
      .select('id, event_type, actor_id, title, description, metadata, created_at, actor:profiles(first_name, last_name, email)')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false });

    if (commentsData) setComments(commentsData as unknown as CommentItem[]);
    if (eventsData) setEvents(eventsData as unknown as EventItem[]);

    setIsLoading(false);
  }, [caseId]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setIsSubmitting(false);
      return;
    }

    const { error } = await supabase.from('case_comments').insert({
      case_id: caseId,
      user_id: user.id,
      comment_text: newComment.trim(),
      mentions: [],
    });

    if (!error) {
      setNewComment('');
      await fetchActivity();
    }
    setIsSubmitting(false);
  };

  const handleDeleteComment = async (commentId: string) => {
    const supabase = createClient();
    const { error } = await supabase.from('case_comments').delete().eq('id', commentId);
    if (!error) {
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    }
  };

  const formatAuthor = (userObj?: { first_name?: string | null; last_name?: string | null; email?: string | null }) => {
    if (!userObj) return 'Sistema';
    const fullName = `${userObj.first_name || ''} ${userObj.last_name || ''}`.trim();
    return fullName || userObj.email || 'Usuario';
  };

  const combinedTimeline: TimelineEntry[] = [
    ...comments.map((c) => ({
      id: c.id,
      isComment: true,
      author: formatAuthor(c.user),
      userId: c.user_id,
      text: c.comment_text,
      title: 'Comentario de ' + formatAuthor(c.user),
      created_at: c.created_at,
    })),
    ...events.map((e) => ({
      id: e.id,
      isComment: false,
      author: formatAuthor(e.actor),
      userId: e.actor_id,
      text: e.description || '',
      title: e.title,
      type: e.event_type,
      created_at: e.created_at,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="space-y-6">
      <form onSubmit={handleAddComment} className="p-4 rounded-2xl border border-border bg-card shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <MessageSquare className="w-4 h-4 text-primary" />
          <span>Agregar nota o comentario al expediente</span>
        </div>
        <textarea
          rows={3}
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Escribe un comentario sobre el caso, avances o coordinaciones con notaría..."
          className="w-full p-3 text-xs rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">
            Los comentarios quedan auditados automáticamente en la línea de tiempo.
          </p>
          <button
            type="submit"
            disabled={isSubmitting || !newComment.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 transition-all"
          >
            {isSubmitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>Publicar</span>
          </button>
        </div>
      </form>

      <div className="flex items-center justify-between border-b border-border pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
              filter === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            Toda la actividad ({combinedTimeline.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('comments')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
              filter === 'comments'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            Solo comentarios ({comments.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('events')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
              filter === 'events'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            Eventos de sistema ({events.length})
          </button>
        </div>

        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          <span>Orden cronológico inverso</span>
        </span>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span>Cargando actividad del expediente...</span>
        </div>
      ) : combinedTimeline.length === 0 ? (
        <div className="py-12 text-center text-xs text-muted-foreground">
          No hay actividad registrada aún en este caso.
        </div>
      ) : (
        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
          {combinedTimeline
            .filter((item) => {
              if (filter === 'comments') return item.isComment;
              if (filter === 'events') return !item.isComment;
              return true;
            })
            .map((item) => (
              <ActivityTimelineItem
                key={item.id}
                item={item}
                currentUserId={currentUserId}
                onDeleteComment={handleDeleteComment}
              />
            ))}
        </div>
      )}
    </div>
  );
};
