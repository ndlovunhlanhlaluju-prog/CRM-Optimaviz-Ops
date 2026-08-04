export type TeamCallDockLayout = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export const TEAM_CALL_DOCK_MIN_W = 300;
export const TEAM_CALL_DOCK_MIN_H = 200;
export const TEAM_CALL_DOCK_MAX_W = 720;
export const TEAM_CALL_DOCK_MAX_H = 560;

const storageKey = (userId?: string | null) =>
  `crm_team_call_dock_v1_${userId || 'guest'}`;

export function defaultTeamCallDockLayout(): TeamCallDockLayout {
  if (typeof window === 'undefined') {
    return { x: 16, y: 16, w: 400, h: 280 };
  }
  const w = Math.min(400, Math.max(TEAM_CALL_DOCK_MIN_W, window.innerWidth - 32));
  const h = Math.min(280, Math.max(TEAM_CALL_DOCK_MIN_H, Math.round(window.innerHeight * 0.38)));
  return {
    w,
    h,
    x: Math.max(8, window.innerWidth - w - 16),
    y: Math.max(8, window.innerHeight - h - 16),
  };
}

export function clampTeamCallDockLayout(layout: Partial<TeamCallDockLayout> | null | undefined): TeamCallDockLayout {
  const base = defaultTeamCallDockLayout();
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const w = Math.min(
    TEAM_CALL_DOCK_MAX_W,
    Math.max(TEAM_CALL_DOCK_MIN_W, Number(layout?.w) || base.w),
    Math.max(TEAM_CALL_DOCK_MIN_W, vw - 16),
  );
  const h = Math.min(
    TEAM_CALL_DOCK_MAX_H,
    Math.max(TEAM_CALL_DOCK_MIN_H, Number(layout?.h) || base.h),
    Math.max(TEAM_CALL_DOCK_MIN_H, vh - 16),
  );
  const x = Math.min(Math.max(0, Number.isFinite(Number(layout?.x)) ? Number(layout?.x) : base.x), Math.max(0, vw - w));
  const y = Math.min(Math.max(0, Number.isFinite(Number(layout?.y)) ? Number(layout?.y) : base.y), Math.max(0, vh - h));
  return { x, y, w, h };
}

export function loadTeamCallDockLayout(userId?: string | null): TeamCallDockLayout {
  try {
    if (typeof window === 'undefined') return defaultTeamCallDockLayout();
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return defaultTeamCallDockLayout();
    return clampTeamCallDockLayout(JSON.parse(raw));
  } catch {
    return defaultTeamCallDockLayout();
  }
}

export function saveTeamCallDockLayout(userId: string | null | undefined, layout: TeamCallDockLayout) {
  try {
    if (typeof window === 'undefined') return;
    const next = clampTeamCallDockLayout(layout);
    window.localStorage.setItem(storageKey(userId), JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
}
