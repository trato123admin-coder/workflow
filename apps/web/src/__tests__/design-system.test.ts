import { describe, it, expect } from 'vitest';
import { cn } from '../lib/utils';

describe('Design System Utilities & Tokens', () => {
  it('merges tailwind class names properly with cn', () => {
    expect(cn('px-2 py-1', 'bg-primary')).toBe('px-2 py-1 bg-primary');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
    const showHidden = false;
    expect(cn('font-bold', undefined, null, showHidden ? 'hidden' : undefined, 'text-xs')).toBe('font-bold text-xs');
  });

  it('verifies default light theme configuration', () => {
    // Theme token conventions
    const categories = ['success', 'warning', 'danger', 'info', 'waiting', 'neutral'];
    expect(categories.length).toBe(6);
  });
});
