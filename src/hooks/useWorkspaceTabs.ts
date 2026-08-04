import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { safeLocalStorage } from '../config/crmConfig';
import axios from 'axios';

export type WorkspaceTabKind = 'dashboard' | 'brand' | 'view';

export interface WorkspaceTabSnapshot {
  brandSubTab?: 'leads' | 'sequences' | 'tasks';
  searchQuery?: string;
  selectedStageFilter?: string;
  selectedSegmentFilter?: string;
  selectedCityFilter?: string;
  selectedDateWindow?: string;
  leadWorkspaceView?: 'table' | 'kanban';
  scrollTop?: number;
  dirty?: boolean;
  /** Lightweight form drafts so switching tabs doesn't lose typed input */
  drafts?: {
    addLeadName?: string;
    addLeadEmail?: string;
    addLeadPhone?: string;
    addLeadNotes?: string;
    noteDraft?: string;
    custom?: Record<string, string>;
  };
  customTitle?: string;
}

export interface WorkspaceTab {
  id: string;
  kind: WorkspaceTabKind;
  /** Matches AppCore activeTab values (dashboard, brand id, communications, …) */
  routeKey: string;
  brandId?: string;
  title: string;
  color?: string;
  icon?: string;
  pinned?: boolean;
  snapshot: WorkspaceTabSnapshot;
  openedAt: number;
  lastActiveAt: number;
}

const STORAGE_KEY = 'crm_workspace_tabs_v1';
const CLOSED_STACK_KEY = 'crm_workspace_closed_tabs_v1';
const MAX_TABS = 12;
const MAX_CLOSED = 15;

const VIEW_META: Record<string, { title: string; icon: string; color?: string }> = {
  dashboard: { title: 'Dashboard', icon: 'fa-th-large', color: '#0f766e' },
  communications: { title: 'Communications', icon: 'fa-tower-broadcast', color: '#155e75' },
  calls: { title: 'Calls', icon: 'fa-phone', color: '#0ea5e9' },
  'email-tracking': { title: 'Email', icon: 'fa-envelope', color: '#6366f1' },
  'whatsapp-tracking': { title: 'WhatsApp', icon: 'fab fa-whatsapp', color: '#25D366' },
  intelligence: { title: 'Intelligence', icon: 'fa-wand-magic-sparkles', color: '#8b5cf6' },
  'team-chat': { title: 'Team Chat', icon: 'fa-comments', color: '#f59e0b' },
  'social-hub': { title: 'Social Hub', icon: 'fa-share-nodes', color: '#ec4899' },
  integrations: { title: 'Integrations', icon: 'fa-plug', color: '#64748b' },
  users: { title: 'Users', icon: 'fa-users', color: '#0f766e' },
  workspace: { title: 'Workspace', icon: 'fa-building-user', color: '#0f766e' },
  'platform-admin': { title: 'Platform Admin', icon: 'fa-crown', color: '#7c3aed' },
};

function makeId(routeKey: string) {
  return `tab_${routeKey}_${Math.random().toString(36).slice(2, 7)}`;
}

function createDashboardTab(): WorkspaceTab {
  const now = Date.now();
  return {
    id: makeId('dashboard'),
    kind: 'dashboard',
    routeKey: 'dashboard',
    title: 'Dashboard',
    icon: 'fa-th-large',
    color: '#0f766e',
    pinned: true,
    snapshot: {},
    openedAt: now,
    lastActiveAt: now,
  };
}

function loadTabs(): { tabs: WorkspaceTab[]; activeId: string } {
  try {
    const raw = safeLocalStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const dash = createDashboardTab();
      return { tabs: [dash], activeId: dash.id };
    }
    const parsed = JSON.parse(raw);
    const tabs: WorkspaceTab[] = Array.isArray(parsed.tabs) ? parsed.tabs : [];
    if (tabs.length === 0) {
      const dash = createDashboardTab();
      return { tabs: [dash], activeId: dash.id };
    }
    return {
      tabs,
      activeId: tabs.some(t => t.id === parsed.activeId) ? parsed.activeId : tabs[0].id,
    };
  } catch {
    const dash = createDashboardTab();
    return { tabs: [dash], activeId: dash.id };
  }
}

function loadClosedStack(): WorkspaceTab[] {
  try {
    const raw = safeLocalStorage.getItem(CLOSED_STACK_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_CLOSED) : [];
  } catch {
    return [];
  }
}

export function getViewMeta(routeKey: string) {
  return VIEW_META[routeKey] || { title: routeKey, icon: 'fa-folder', color: '#64748b' };
}

export function useWorkspaceTabs(userId?: string) {
  const initial = useMemo(() => loadTabs(), []);
  const [tabs, setTabs] = useState<WorkspaceTab[]>(initial.tabs);
  const [activeTabId, setActiveTabId] = useState(initial.activeId);
  const [closedStack, setClosedStack] = useState<WorkspaceTab[]>(() => loadClosedStack());
  const [cloudHydrationVersion, setCloudHydrationVersion] = useState(0);
  const cloudReadyRef = useRef(false);
  const cloudSaveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!userId) {
      cloudReadyRef.current = false;
      return;
    }
    let cancelled = false;
    cloudReadyRef.current = false;
    axios.get('/api/auth/me').then(response => {
      if (cancelled) return;
      const remote = response.data?.workspace_state;
      const remoteTabs: WorkspaceTab[] = Array.isArray(remote?.tabs) ? remote.tabs.slice(0, MAX_TABS) : [];
      if (remoteTabs.length > 0) {
        setTabs(remoteTabs);
        setActiveTabId(remoteTabs.some(tab => tab.id === remote.activeId) ? remote.activeId : remoteTabs[0].id);
        setClosedStack(Array.isArray(remote.closedStack) ? remote.closedStack.slice(0, MAX_CLOSED) : []);
        setCloudHydrationVersion(version => version + 1);
      }
      cloudReadyRef.current = true;
    }).catch(() => {
      if (!cancelled) cloudReadyRef.current = true;
    });
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    try {
      safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify({ tabs, activeId: activeTabId }));
    } catch {
      /* ignore */
    }
  }, [tabs, activeTabId]);

  useEffect(() => {
    try {
      safeLocalStorage.setItem(CLOSED_STACK_KEY, JSON.stringify(closedStack.slice(0, MAX_CLOSED)));
    } catch {
      /* ignore */
    }
  }, [closedStack]);

  useEffect(() => {
    if (!userId || !cloudReadyRef.current) return;
    if (cloudSaveTimerRef.current) window.clearTimeout(cloudSaveTimerRef.current);
    cloudSaveTimerRef.current = window.setTimeout(() => {
      axios.put('/api/auth/me/workspace-state', { tabs, activeId: activeTabId, closedStack }).catch(() => undefined);
    }, 650);
    return () => {
      if (cloudSaveTimerRef.current) window.clearTimeout(cloudSaveTimerRef.current);
    };
  }, [userId, tabs, activeTabId, closedStack]);

  const activeWorkspaceTab = tabs.find(t => t.id === activeTabId) || tabs[0] || null;

  const saveSnapshot = useCallback((tabId: string, snapshot: Partial<WorkspaceTabSnapshot>) => {
    setTabs(prev =>
      prev.map(t =>
        t.id === tabId
          ? {
              ...t,
              snapshot: {
                ...t.snapshot,
                ...snapshot,
                drafts: snapshot.drafts
                  ? { ...(t.snapshot.drafts || {}), ...snapshot.drafts }
                  : t.snapshot.drafts,
              },
              lastActiveAt: Date.now(),
            }
          : t,
      ),
    );
  }, []);

  const openOrFocus = useCallback(
    (input: {
      kind: WorkspaceTabKind;
      routeKey: string;
      brandId?: string;
      title: string;
      color?: string;
      icon?: string;
      snapshot?: WorkspaceTabSnapshot;
      forceNew?: boolean;
    }) => {
      let focusedId = '';
      setTabs(prev => {
        const existing = !input.forceNew
          ? prev.find(t => t.routeKey === input.routeKey && t.brandId === input.brandId)
          : undefined;
        if (existing) {
          focusedId = existing.id;
          return prev.map(t =>
            t.id === existing.id
              ? {
                  ...t,
                  title: input.title || t.title,
                  color: input.color || t.color,
                  lastActiveAt: Date.now(),
                  snapshot: { ...t.snapshot, ...(input.snapshot || {}) },
                }
              : t,
          );
        }

        const meta = getViewMeta(input.routeKey);
        const next: WorkspaceTab = {
          id: makeId(input.routeKey),
          kind: input.kind,
          routeKey: input.routeKey,
          brandId: input.brandId,
          title: input.title || meta.title,
          color: input.color || meta.color,
          icon: input.icon || meta.icon,
          pinned: input.routeKey === 'dashboard',
          snapshot: input.snapshot || {},
          openedAt: Date.now(),
          lastActiveAt: Date.now(),
        };
        focusedId = next.id;
        let list = [...prev, next];
        while (list.filter(t => !t.pinned).length > MAX_TABS) {
          const oldest = [...list]
            .filter(t => !t.pinned)
            .sort((a, b) => a.lastActiveAt - b.lastActiveAt)[0];
          if (!oldest) break;
          list = list.filter(t => t.id !== oldest.id);
          setClosedStack(stack => [oldest, ...stack].slice(0, MAX_CLOSED));
        }
        return list;
      });
      if (focusedId) setActiveTabId(focusedId);
      return focusedId;
    },
    [],
  );

  const activateTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
    setTabs(prev =>
      prev.map(t => (t.id === tabId ? { ...t, lastActiveAt: Date.now() } : t)),
    );
  }, []);

  const closeTab = useCallback((tabId: string) => {
    setTabs(prev => {
      const target = prev.find(t => t.id === tabId);
      if (!target || target.pinned) return prev;
      setClosedStack(stack => [target, ...stack.filter(t => t.id !== target.id)].slice(0, MAX_CLOSED));
      const next = prev.filter(t => t.id !== tabId);
      if (next.length === 0) {
        const dash = createDashboardTab();
        setActiveTabId(dash.id);
        return [dash];
      }
      setActiveTabId(current => {
        if (current !== tabId) return current;
        const idx = prev.findIndex(t => t.id === tabId);
        const neighbor = prev[idx - 1] || prev[idx + 1] || next[0];
        return neighbor.id;
      });
      return next;
    });
  }, []);

  const closeOthers = useCallback((tabId: string) => {
    setTabs(prev => {
      const kept = prev.filter(t => t.id === tabId || t.pinned);
      const closed = prev.filter(t => !(t.id === tabId || t.pinned));
      if (closed.length) setClosedStack(stack => [...closed, ...stack].slice(0, MAX_CLOSED));
      return kept;
    });
    setActiveTabId(tabId);
  }, []);

  const closeToRight = useCallback((tabId: string) => {
    setTabs(prev => {
      const idx = prev.findIndex(t => t.id === tabId);
      if (idx < 0) return prev;
      const kept = prev.filter((t, i) => i <= idx || t.pinned);
      const closed = prev.filter((t, i) => i > idx && !t.pinned);
      if (closed.length) setClosedStack(stack => [...closed, ...stack].slice(0, MAX_CLOSED));
      return kept;
    });
    setActiveTabId(tabId);
  }, []);

  const togglePin = useCallback((tabId: string) => {
    setTabs(prev =>
      prev.map(t => (t.id === tabId ? { ...t, pinned: !t.pinned } : t)),
    );
  }, []);

  const renameTab = useCallback((tabId: string, title: string) => {
    const clean = String(title || '').trim().slice(0, 40);
    if (!clean) return;
    setTabs(prev =>
      prev.map(t =>
        t.id === tabId
          ? { ...t, title: clean, snapshot: { ...t.snapshot, customTitle: clean } }
          : t,
      ),
    );
  }, []);

  const duplicateTab = useCallback((tabId: string) => {
    setTabs(prev => {
      const source = prev.find(t => t.id === tabId);
      if (!source) return prev;
      const copy: WorkspaceTab = {
        ...source,
        id: makeId(source.routeKey),
        title: `${source.title} copy`,
        pinned: false,
        openedAt: Date.now(),
        lastActiveAt: Date.now(),
        snapshot: { ...source.snapshot, drafts: source.snapshot.drafts ? { ...source.snapshot.drafts } : undefined },
      };
      setActiveTabId(copy.id);
      return [...prev, copy];
    });
  }, []);

  const reopenClosedTab = useCallback(() => {
    setClosedStack(stack => {
      if (!stack.length) return stack;
      const [first, ...rest] = stack;
      const restored: WorkspaceTab = {
        ...first,
        id: makeId(first.routeKey),
        lastActiveAt: Date.now(),
      };
      setTabs(prev => {
        // Avoid duplicate route if already open — still allow force reopen as new
        return [...prev, restored];
      });
      setActiveTabId(restored.id);
      return rest;
    });
  }, []);

  const reorderTabs = useCallback((fromId: string, toId: string) => {
    setTabs(prev => {
      const from = prev.findIndex(t => t.id === fromId);
      const to = prev.findIndex(t => t.id === toId);
      if (from < 0 || to < 0 || from === to) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }, []);

  const activateByIndex = useCallback((index: number) => {
    setTabs(prev => {
      if (index < 0 || index >= prev.length) return prev;
      const tab = prev[index];
      setActiveTabId(tab.id);
      return prev.map(t => (t.id === tab.id ? { ...t, lastActiveAt: Date.now() } : t));
    });
  }, []);

  const cycleTab = useCallback((direction: 1 | -1) => {
    setTabs(prev => {
      if (prev.length < 2) return prev;
      const idx = prev.findIndex(t => t.id === activeTabId);
      const nextIdx = (idx + direction + prev.length) % prev.length;
      setActiveTabId(prev[nextIdx].id);
      return prev.map((t, i) => (i === nextIdx ? { ...t, lastActiveAt: Date.now() } : t));
    });
  }, [activeTabId]);

  return {
    tabs,
    activeTabId,
    activeWorkspaceTab,
    closedStack,
    openOrFocus,
    activateTab,
    closeTab,
    closeOthers,
    closeToRight,
    togglePin,
    renameTab,
    duplicateTab,
    reopenClosedTab,
    saveSnapshot,
    reorderTabs,
    activateByIndex,
    cycleTab,
    MAX_TABS,
    cloudHydrationVersion,
  };
}
