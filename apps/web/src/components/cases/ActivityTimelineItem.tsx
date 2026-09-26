'use client';

import React from 'react';
import { MessageSquare, Trash2, Copy, Users, CheckCircle2, History } from 'lucide-react';

export interface TimelineEntry {
  id: string;
  isComment: boolean;
  author: string;
  userId?: string | null;
  text: string;
  title: string;
  type?: string;
  created_at: string;
}

interface ActivityTimelineItemProps {
  item: TimelineEntry;
  currentUserId: string | null;
  onDeleteComment: (id: string) => void;
}

const formatDate = (isoString: string) => {
  return new Date(isoString).toLocaleString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getEventIcon = (type: string) => {
  switch (type) {
    case 'COMMENT_ADDED':
      return <MessageSquare className="w-3.5 h-3.5 text-blue-500" />;
    case 'CASE_DUPLICATED':
      return <Copy className="w-3.5 h-3.5 text-purple-500" />;
    case 'PARTY_ADDED':
      return <Users className="w-3.5 h-3.5 text-emerald-500" />;
    case 'STATUS_CHANGED':
      return <CheckCircle2 className="w-3.5 h-3.5 text-amber-500" />;
    default:
      return <History className="w-3.5 h-3.5 text-muted-foreground" />;
  }
};

export const ActivityTimelineItem: React.FC<ActivityTimelineItemProps> = ({
  item,
  currentUserId,
  onDeleteComment,
}) => {
  return (
    <div className="relative group">
      <div className="absolute -left-6 top-1 w-5 h-5 rounded-full border border-border bg-card flex items-center justify-center shadow-sm">
        {item.isComment ? (
          <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
        ) : (
          getEventIcon(item.type || '')
        )}
      </div>

      <div
        className={`p-4 rounded-2xl border transition-all ${
          item.isComment ? 'border-blue-500/20 bg-blue-500/5' : 'border-border bg-card'
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-foreground">{item.author}</span>
            <span className="text-[11px] text-muted-foreground">· {item.title}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground font-mono">
              {formatDate(item.created_at)}
            </span>
            {item.isComment && item.userId === currentUserId && (
              <button
                type="button"
                onClick={() => onDeleteComment(item.id)}
                title="Eliminar mi comentario"
                className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
          {item.text}
        </p>
      </div>
    </div>
  );
};
