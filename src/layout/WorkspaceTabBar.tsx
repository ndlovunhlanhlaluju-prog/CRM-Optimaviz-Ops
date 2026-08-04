import React, { useEffect, useRef, useState } from 'react';
import type { WorkspaceTab } from '../hooks/useWorkspaceTabs';

interface WorkspaceTabBarProps {
  tabs: WorkspaceTab[];
  activeTabId: string;
  /** App route key (brand id / dashboard / etc.) — keeps highlight in sync if ids drift */
  activeRouteKey?: string;
  closedCount?: number;
  onActivate: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onCloseOthers: (tabId: string) => void;
  onCloseToRight?: (tabId: string) => void;
  onTogglePin: (tabId: string) => void;
  onDuplicate?: (tabId: string) => void;
  onRename?: (tabId: string, title: string) => void;
  onReorder: (fromId: string, toId: string) => void;
  onNewDashboard: () => void;
  onReopenClosed?: () => void;
}

export default function WorkspaceTabBar({
  tabs,
  activeTabId,
  activeRouteKey,
  closedCount = 0,
  onActivate,
  onClose,
  onCloseOthers,
  onCloseToRight,
  onTogglePin,
  onDuplicate,
  onRename,
  onReorder,
  onNewDashboard,
  onReopenClosed,
}: WorkspaceTabBarProps) {
  const dragId = useRef<string | null>(null);
  const [menuTabId, setMenuTabId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [overflowOpen, setOverflowOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) {
        setMenuTabId(null);
        setOverflowOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const commitRename = (tabId: string) => {
    if (onRename && renameValue.trim()) onRename(tabId, renameValue.trim());
    setRenamingId(null);
  };

  return (
    <div className="workspace-tabbar" role="tablist" aria-label="Workspace tabs" ref={menuRef}>
      <div className="workspace-tabbar__scroll">
        {tabs.map((tab, index) => {
          // Only one solid "active" tab: id match, with route fallback if ids desync
          const isActive = tabs.some(t => t.id === activeTabId)
            ? tab.id === activeTabId
            : (!!activeRouteKey && tab.routeKey === activeRouteKey);
          const iconClass = tab.icon?.startsWith('fab')
            ? tab.icon
            : `fas ${tab.icon || 'fa-folder'}`;
          return (
            <div
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              tabIndex={0}
              className={`workspace-tab ${isActive ? 'is-active' : ''} ${tab.pinned ? 'is-pinned' : ''} ${tab.snapshot.dirty ? 'is-dirty' : ''}`}
              style={{ ['--tab-accent' as string]: tab.color || 'var(--accent)' }}
              draggable={renamingId !== tab.id}
              onDragStart={() => {
                dragId.current = tab.id;
              }}
              onDragOver={e => e.preventDefault()}
              onDrop={() => {
                if (dragId.current && dragId.current !== tab.id) onReorder(dragId.current, tab.id);
                dragId.current = null;
              }}
              onClick={() => {
                if (renamingId !== tab.id) onActivate(tab.id);
              }}
              onDoubleClick={e => {
                e.stopPropagation();
                // Mobile double-tap often triggers rename + keyboard by accident.
                if (!onRename) return;
                if (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) return;
                if (typeof window !== 'undefined' && window.innerWidth <= 768) return;
                setRenamingId(tab.id);
                setRenameValue(tab.title);
              }}
              onMouseDown={e => {
                // Middle-click close
                if (e.button === 1 && !tab.pinned) {
                  e.preventDefault();
                  onClose(tab.id);
                }
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && renamingId === tab.id) {
                  e.preventDefault();
                  commitRename(tab.id);
                  return;
                }
                if (e.key === 'Escape' && renamingId === tab.id) {
                  setRenamingId(null);
                  return;
                }
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onActivate(tab.id);
                }
              }}
              onContextMenu={e => {
                e.preventDefault();
                setMenuTabId(tab.id === menuTabId ? null : tab.id);
                setOverflowOpen(false);
              }}
              title={`${tab.title}${index < 9 ? ` (Ctrl+${index + 1})` : ''}`}
            >
              <i className={`workspace-tab__icon ${iconClass}`} aria-hidden="true" />
              {renamingId === tab.id ? (
                <input
                  className="workspace-tab__rename"
                  value={renameValue}
                  autoFocus
                  onClick={e => e.stopPropagation()}
                  onChange={e => setRenameValue(e.target.value)}
                  onBlur={() => commitRename(tab.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitRename(tab.id);
                    }
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                />
              ) : (
                <span className="workspace-tab__title">{tab.title}</span>
              )}
              {tab.snapshot.dirty && <span className="workspace-tab__dot" title="Unsaved draft in this tab" />}
              {tab.pinned ? (
                <button
                  type="button"
                  className="workspace-tab__pin"
                  title="Unpin tab"
                  onClick={e => {
                    e.stopPropagation();
                    onTogglePin(tab.id);
                  }}
                >
                  <i className="fas fa-thumbtack" />
                </button>
              ) : (
                <button
                  type="button"
                  className="workspace-tab__close"
                  title="Close tab"
                  aria-label={`Close ${tab.title}`}
                  onClick={e => {
                    e.stopPropagation();
                    onClose(tab.id);
                  }}
                >
                  <i className="fas fa-xmark" />
                </button>
              )}

              {menuTabId === tab.id && (
                <div className="workspace-tab__menu" onClick={e => e.stopPropagation()}>
                  <button type="button" onClick={() => { onTogglePin(tab.id); setMenuTabId(null); }}>
                    <i className="fas fa-thumbtack" /> {tab.pinned ? 'Unpin' : 'Pin tab'}
                  </button>
                  {onDuplicate && (
                    <button type="button" onClick={() => { onDuplicate(tab.id); setMenuTabId(null); }}>
                      <i className="fas fa-clone" /> Duplicate tab
                    </button>
                  )}
                  {onRename && (
                    <button type="button" onClick={() => { setRenamingId(tab.id); setRenameValue(tab.title); setMenuTabId(null); }}>
                      <i className="fas fa-i-cursor" /> Rename
                    </button>
                  )}
                  <button type="button" onClick={() => { onCloseOthers(tab.id); setMenuTabId(null); }}>
                    <i className="fas fa-times" /> Close others
                  </button>
                  {onCloseToRight && (
                    <button type="button" onClick={() => { onCloseToRight(tab.id); setMenuTabId(null); }}>
                      <i className="fas fa-arrow-right" /> Close to the right
                    </button>
                  )}
                  {!tab.pinned && (
                    <button type="button" onClick={() => { onClose(tab.id); setMenuTabId(null); }}>
                      <i className="fas fa-xmark" /> Close
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="workspace-tabbar__actions">
        {closedCount > 0 && onReopenClosed && (
          <button
            type="button"
            className="workspace-tabbar__reopen"
            title={`Reopen closed tab (${closedCount}) — Ctrl+Shift+T`}
            onClick={onReopenClosed}
          >
            <i className="fas fa-rotate-left" />
            <span className="workspace-tabbar__reopen-count">{closedCount > 9 ? '9+' : closedCount}</span>
          </button>
        )}
        <button
          type="button"
          className="workspace-tabbar__overflow"
          title="Tab shortcuts"
          aria-label="Tab shortcuts"
          onClick={() => { setOverflowOpen(v => !v); setMenuTabId(null); }}
        >
          <i className="fas fa-ellipsis" />
        </button>
        {overflowOpen && (
          <div className="workspace-tab__menu workspace-tab__menu--overflow">
            <div className="workspace-tab__menu-hint">Shortcuts</div>
            <div className="workspace-tab__menu-kbd"><span>Ctrl+Tab</span> Next tab</div>
            <div className="workspace-tab__menu-kbd"><span>Ctrl+Shift+Tab</span> Previous</div>
            <div className="workspace-tab__menu-kbd"><span>Ctrl+1…9</span> Jump to tab</div>
            <div className="workspace-tab__menu-kbd"><span>Ctrl+W</span> Close tab</div>
            <div className="workspace-tab__menu-kbd"><span>Ctrl+Shift+T</span> Reopen closed</div>
            <div className="workspace-tab__menu-kbd"><span>Double-click</span> Rename</div>
            <div className="workspace-tab__menu-kbd"><span>Middle-click</span> Close</div>
          </div>
        )}
        <button
          type="button"
          className="workspace-tabbar__add"
          title="Open Dashboard tab"
          aria-label="Open dashboard tab"
          onClick={onNewDashboard}
        >
          <i className="fas fa-plus" />
        </button>
      </div>
    </div>
  );
}
