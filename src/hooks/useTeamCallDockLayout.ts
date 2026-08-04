import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type TouchEvent as ReactTouchEvent } from 'react';
import {
  clampTeamCallDockLayout,
  defaultTeamCallDockLayout,
  loadTeamCallDockLayout,
  saveTeamCallDockLayout,
  type TeamCallDockLayout,
} from '../utils/teamCallDock';

type DragMode = 'move' | 'resize' | null;

/**
 * Dock layout for the floating team-call panel: drag, resize, and persist per user.
 */
export function useTeamCallDockLayout(userId?: string | null) {
  const [layout, setLayout] = useState<TeamCallDockLayout>(() => loadTeamCallDockLayout(userId));
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const dragModeRef = useRef<DragMode>(null);
  const dragOriginRef = useRef({ pointerX: 0, pointerY: 0, start: layout });

  useEffect(() => {
    setLayout(loadTeamCallDockLayout(userId));
  }, [userId]);

  useEffect(() => {
    const onResize = () => {
      setLayout(prev => clampTeamCallDockLayout(prev));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const persist = useCallback((next: TeamCallDockLayout) => {
    const clamped = clampTeamCallDockLayout(next);
    setLayout(clamped);
    layoutRef.current = clamped;
    saveTeamCallDockLayout(userId, clamped);
    return clamped;
  }, [userId]);

  const resetToDefaultCorner = useCallback(() => {
    persist(defaultTeamCallDockLayout());
  }, [persist]);

  const beginDrag = useCallback((event: ReactMouseEvent | ReactTouchEvent, mode: 'move' | 'resize') => {
    // Don't start drag from interactive controls inside the header.
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, a, input, select, textarea, label')) return;
    event.preventDefault();
    const point = 'touches' in event ? event.touches[0] : event;
    if (!point) return;
    dragModeRef.current = mode;
    dragOriginRef.current = {
      pointerX: point.clientX,
      pointerY: point.clientY,
      start: { ...layoutRef.current },
    };

    const onMove = (ev: MouseEvent | TouchEvent) => {
      const modeNow = dragModeRef.current;
      if (!modeNow) return;
      if ('touches' in ev) ev.preventDefault();
      const p = 'touches' in ev ? ev.touches[0] : ev;
      if (!p) return;
      const dx = p.clientX - dragOriginRef.current.pointerX;
      const dy = p.clientY - dragOriginRef.current.pointerY;
      const start = dragOriginRef.current.start;
      if (modeNow === 'move') {
        const next = clampTeamCallDockLayout({
          ...start,
          x: start.x + dx,
          y: start.y + dy,
        });
        layoutRef.current = next;
        setLayout(next);
      } else {
        const next = clampTeamCallDockLayout({
          ...start,
          w: start.w + dx,
          h: start.h + dy,
        });
        layoutRef.current = next;
        setLayout(next);
      }
    };

    const onUp = () => {
      dragModeRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
      persist(layoutRef.current);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
  }, [persist]);

  const dockStyle: CSSProperties = {
    left: layout.x,
    top: layout.y,
    width: layout.w,
    height: layout.h,
    right: 'auto',
    bottom: 'auto',
  };

  const beginMove = useCallback((e: ReactMouseEvent | ReactTouchEvent) => beginDrag(e, 'move'), [beginDrag]);
  const beginResize = useCallback((e: ReactMouseEvent | ReactTouchEvent) => beginDrag(e, 'resize'), [beginDrag]);

  return {
    layout,
    dockStyle,
    beginMove,
    beginResize,
    resetToDefaultCorner,
    persist,
  };
}
