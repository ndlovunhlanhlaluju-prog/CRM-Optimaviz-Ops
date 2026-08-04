import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import * as ScrollArea from '@radix-ui/react-scroll-area';
import axios from 'axios';
import { setSessionToken, clearSessionToken, API_BASE_URL } from './services/api';
import { User, Brand, BrandFunnel, CustomField, Lead, Note, CallLog, EmailLog, TeamMessage, TeamNote, WhatsAppLog, WhatsAppTemplate, MessageTemplate, BrandIntegration, EmailConnection, LeadSource, LeadSourceLog, WebsiteAnalyticsSite, WebsiteAnalyticsSummary, Sequence, SequenceStep, Task } from './types';
import CommandPalette, { type CommandNavTab, type PowerActionId } from './components/CommandPalette';
import FollowUpQueue from './components/FollowUpQueue';
import PremiumSelectOverlay from './components/PremiumSelectOverlay';
import SocialHubPage from './components/SocialHubPage';
import ConfirmModal, { type ConfirmModalConfig } from './components/ConfirmModal';
import { parseDateOnly, isFollowUpDue, getFollowUpLabel, isDoNotContact, isFinalStage } from './utils/workflow';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NOTIFICATION_CATEGORY_META,
  getNotificationCategory,
  isFollowUpDueWithinDays,
  normalizeNotificationPreferences,
  type NotificationPreferences,
} from './utils/notificationPrefs';
import { useTeamCallDockLayout } from './hooks/useTeamCallDockLayout';
import { toUserFacingError } from './utils/userFacingError';
import QuickCallLog, { QuickCallPayload } from './components/QuickCallLog';
import AppSidebar from './layout/AppSidebar';
import AppTopBar from './layout/AppTopBar';
import MobileBottomNav from './layout/MobileBottomNav';
import WorkspaceTabBar from './layout/WorkspaceTabBar';
import { useWorkspaceTabs, getViewMeta } from './hooks/useWorkspaceTabs';
import { LoginPage } from './pages/LoginPage';
import { CommunicationsHubPage } from './pages/CommunicationsHubPage';
import { DashboardPage } from './pages/DashboardPage';
import { IntelligencePage } from './pages/IntelligencePage';
import { EmailTrackingPage } from './pages/EmailTrackingPage';
import { CallsPage } from './pages/CallsPage';
import { WhatsAppPage } from './pages/WhatsAppPage';
import { TeamChatPage } from './pages/TeamChatPage';
import IntegrationsPage from './pages/IntegrationsPage';
import UsersPage from './pages/UsersPage';
import {
  getStandardColumns,
  isProtectedColumn,
  mergeVisibleColumns,
  resolveVisibleColumns,
  BRAND_REQUIRED_CUSTOM_FIELDS,
  hiddenOptionalStorageKey,
  columnVersionStorageKey,
  clearLegacyColumnPrefs,
  CURRENT_COL_VERSION,
  getColumnFullLabel,
  buildLeadTableColumns,
} from './utils/brandColumns';
import LeadDataTable from './components/LeadsTable';
import {
  applyExcelSheetToImporter,
  pickBestSheetIndex,
  type ExcelSheetMeta,
  type ExcelSheetRaw,
} from './utils/excelImport';
import { buildAutoMapping as buildImportAutoMapping } from './utils/importMapping';
import { importIdentityKeys, normalizeImportEmail, normalizeImportPhone } from './utils/importIdentity';
import {
  loadLeadBadgeSettings,
  resolveLeadBadges,
  type BrandLeadBadgeSettings,
} from './utils/leadBadges';
import LeadBadgePills, { LeadBadgeDetailBanners } from './components/LeadBadgePills';
import LeadBadgesSettingsModal from './components/LeadBadgesSettingsModal';
import {
  buildAudienceTerms,
  scoreLeadAudienceMatch,
  type AudienceMatchLevel,
} from './utils/audienceMatch';

const prepareProfilePicture = (file: File): Promise<string> => new Promise((resolve, reject) => {
  if (!file.type.startsWith('image/')) {
    reject(new Error('Choose an image file.'));
    return;
  }
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Could not read this image.'));
  reader.onload = () => {
    const image = new Image();
    image.onerror = () => reject(new Error('Could not open this image.'));
    image.onload = () => {
      const maxSize = 320;
      const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Could not prepare this image.'));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', .82));
    };
    image.src = String(reader.result || '');
  };
  reader.readAsDataURL(file);
});

type ImportColumnPickerProps = {
  value: string;
  options: string[];
  placeholder: string;
  onChange: (value: string) => void;
};

function ImportColumnPicker({ value, options, placeholder, onChange }: ImportColumnPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const filteredOptions = options.filter(option => option.toLowerCase().includes(query.trim().toLowerCase()));
  const selectedLabel = value || placeholder;

  return (
    <div className="import-column-picker" onMouseDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
      <button
        type="button"
        className={`import-column-picker__button${isOpen ? ' is-open' : ''}${value ? ' has-value' : ''}`}
        onClick={() => setIsOpen(prev => !prev)}
      >
        <span>{selectedLabel}</span>
        <i className={`fas fa-chevron-${isOpen ? 'up' : 'down'}`}></i>
      </button>
      {isOpen && (
        <div className="import-column-picker__panel">
          <input
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search columns..."
            className="import-column-picker__search"
            autoFocus
          />
          <div className="import-column-picker__list">
            <button
              type="button"
              className={`import-column-picker__option${!value ? ' is-selected' : ''}`}
              onClick={() => {
                onChange('');
                setQuery('');
                setIsOpen(false);
              }}
            >
              {placeholder}
            </button>
            {filteredOptions.map(option => (
              <button
                type="button"
                key={option}
                className={`import-column-picker__option${value === option ? ' is-selected' : ''}`}
                onClick={() => {
                  onChange(option);
                  setQuery('');
                  setIsOpen(false);
                }}
              >
                {option}
              </button>
            ))}
            {filteredOptions.length === 0 && (
              <div className="import-column-picker__empty">No matching columns</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Define static brands list matching original bundle
import {
  BRANDS,
  BRAND_COLOR_PRESETS,
  NESTWISE_DASHBOARD_VERSION,
  readViteEnv,
  TEAM_CALL_DOMAIN,
  TEAM_CALL_JAAS_APP_ID,
  TEAM_CALL_BRAND_NAME,
  TEAM_CALL_IS_JAAS,
  getTeamCallScriptSrc,
  sanitizeTeamCallRoom,
  getTeamCallRoomName,
  getTeamCallExternalUrl,
  BRAND_SEGMENTS,
  DEFAULT_STAGES,
  IDAO_STAGES,
  TASKGO_STAGES,
  NESTWISE_STAGES,
  BRAND_STAGE_MAP,
  OPTIMAVIZ_SEGMENT_STAGES,
  OPTIMAVIZ_NEXT_ACTIONS,
  OPTIMAVIZ_FOLLOW_UP_RULES,
  IDAO_SEGMENT_STAGES,
  IDAO_SERVICE_TYPES,
  IDAO_NEXT_ACTIONS,
  IDAO_FOLLOW_UP_RULES,
  getBrandStages,
  IDAO_QUOTE_FOLLOW_UP_DAYS,
  IDAO_PAYMENT_FOLLOW_UP_DAYS,
  OPTIMAVIZ_TRIAL_DAYS,
  OPTIMAVIZ_REMOVED_TABLE_FIELDS,
  IDAO_REMOVED_TABLE_FIELDS,
  OPTIMAVIZ_TRIAL_TABLE_FIELDS,
  OPTIMAVIZ_USAGE_FIELDS,
  OPTIMAVIZ_USAGE_LABELS,
  LEAD_DATE_FIELD_KEYS,
  DATE_WINDOW_OPTIONS,
  normalizeDateHeader,
  findLeadDateHeader,
  parseLeadDateValue,
  getLeadTimelineDate,
  getLeadTimelineTime,
  getLeadDateLabel,
  startOfDay,
  startOfWeek,
  isLeadInDateWindow,
  parseDateInputBoundary,
  isLeadInCustomDateRange,
  COMMAND_METRIC_OPTIONS,
  DEFAULT_COMMAND_METRICS,
  DEFAULT_WIDGETS,
  DEFAULT_SNAPSHOT_CARDS,
  DEFAULT_NESTWISE_CARDS,
  DEFAULT_SPOTLIGHTS,
  EMAIL_TEMPLATES,
  OptimaLogo,
  safeLocalStorage
} from './config/crmConfig';
import type {
  DateWindowFilter,
  CustomWidget,
  CommandMetricKind,
  CommandMetricConfig,
  SpotlightConfig,
  SnapshotCardConfig,
  NestwiseCardItem,
  NestwiseDashboardCard,
  SavedLeadView,
  BrandWorkspaceSnapshot,
  BrandWorkspaceProfile
} from './config/crmConfig';

// Credentials + optional VITE_API_BASE_URL are configured in ./services/api
axios.defaults.withCredentials = true;

export default function App() {
  const localStorage = safeLocalStorage;

  const [toastMessage, setToastMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const showToast = (text: string, isError = false) => {
    setToastMessage({ text, isError });
  };

  // Typed toast: pass severity explicitly so callers are clear about intent.
  // Use alert('message', 'error') for errors, alert('message', 'success') for success, etc.
  const alert = (msg: string, level: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const isError = level === 'error' || level === 'warning';
    showToast(msg, isError);
  };

  const getApiErrorMessage = (err: any, fallback: string) => toUserFacingError(err, fallback);

  const showApiError = (err: any, fallback: string) => {
    showToast(toUserFacingError(err, fallback), true);
  };

  const importModalBodyRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (toastMessage) {
      // Errors stay longer so users have time to read them; success/info dismiss quickly
      const delay = toastMessage.isError ? 12000 : 4500;
      const timer = setTimeout(() => setToastMessage(null), delay);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const leadTableScrollRef = React.useRef<HTMLDivElement>(null);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [globalSearchResults, setGlobalSearchResults] = useState<Lead[]>([]);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);

  const [confirmModalConfig, setConfirmModalConfig] = useState<ConfirmModalConfig | null>(null);
  const showConfirm = (config: ConfirmModalConfig) => setConfirmModalConfig(config);

  const [sidebarBrandSearch, setSidebarBrandSearch] = useState('');

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('crm_dark_mode');
    if (saved !== null) return saved === 'true';
    return false;
  });

  useEffect(() => {
    const theme = isDarkMode ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.documentElement.style.backgroundColor = isDarkMode ? '#0b1020' : '#f7f8fb';
    localStorage.setItem('crm_dark_mode', String(isDarkMode));
  }, [isDarkMode]);

  const [sidebarStyle, setSidebarStyle] = useState<string>(() => safeLocalStorage.getItem('crm_sidebar_style') || 'frosted');

  useEffect(() => {
    document.documentElement.dataset.sidebarStyle = sidebarStyle;
    safeLocalStorage.setItem('crm_sidebar_style', sidebarStyle);
  }, [sidebarStyle]);

  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      response => response,
      error => {
        if (error?.response?.status === 401) {
          setUser(null);
          safeLocalStorage.removeItem('optima_user');
          clearSessionToken();
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, []);

  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = safeLocalStorage.getItem('optima_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      safeLocalStorage.removeItem('optima_user');
      return null;
    }
  });

  // Synchronize user to localStorage (bearer token is managed via setSessionToken)
  useEffect(() => {
    if (user && user.id) {
      const { session_token: _drop, ...safe } = user as User & { session_token?: string };
      safeLocalStorage.setItem('optima_user', JSON.stringify(safe));
    } else {
      safeLocalStorage.removeItem('optima_user');
      clearSessionToken();
    }
  }, [user]);

  const handleLoginSuccess = (payload: any) => {
    if (payload?.session_token) setSessionToken(payload.session_token);
    const { session_token: _t, ...safeUser } = payload || {};
    setUser(safeUser);
  };

  const getAttachmentDownloadName = (disposition: string | undefined, fallback: string) => {
    const header = disposition || '';
    const utfMatch = header.match(/filename\*=UTF-8''([^;]+)/i);
    if (utfMatch?.[1]) return decodeURIComponent(utfMatch[1].replace(/"/g, ''));
    const basicMatch = header.match(/filename="?([^"]+)"?/i);
    return basicMatch?.[1] || fallback || 'attachment';
  };

  const [openingAttachmentKey, setOpeningAttachmentKey] = useState('');

  const handleEmailAttachment = async (emailId: string, file: any, mode: 'open' | 'download') => {
    const attachmentKey = file?.id || file?.name || '';
    if (!attachmentKey) {
      showToast('This attachment is missing its mailbox file reference. Refresh the mailbox and try again.', true);
      return;
    }
    const requestKey = `${emailId}:${attachmentKey}:${mode}`;
    if (openingAttachmentKey === requestKey) return;

    setOpeningAttachmentKey(requestKey);
    try {
      const res = await axios.get(
        `/api/emails/${encodeURIComponent(emailId)}/attachments/${encodeURIComponent(attachmentKey)}${mode === 'open' ? '?inline=1' : ''}`,
        { responseType: 'blob' }
      );
      const blob = new Blob([res.data], { type: res.headers['content-type'] || file?.mime_type || 'application/octet-stream' });
      const objectUrl = URL.createObjectURL(blob);
      if (mode === 'open') {
        window.open(objectUrl, '_blank', 'noopener,noreferrer');
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
      } else {
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = getAttachmentDownloadName(res.headers['content-disposition'], file?.name || 'attachment');
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      }
    } catch (err: any) {
      let message = 'Could not fetch this attachment from the connected mailbox.';
      const errorBlob = err?.response?.data;
      if (errorBlob instanceof Blob) {
        try {
          const parsed = JSON.parse(await errorBlob.text());
          message = toUserFacingError({ response: { data: parsed, status: err?.response?.status } }, message);
        } catch {
          // Keep the friendly fallback.
        }
      } else {
        message = toUserFacingError(err, message);
      }
      showToast(message, true);
    } finally {
      setOpeningAttachmentKey('');
    }
  };
  const [loading, setLoading] = useState(true);

  // Autonomy features states
  const [selectedSegmentFilter, setSelectedSegmentFilter] = useState<string>('all');
  const [selectedCityFilter, setSelectedCityFilter] = useState<string>('all');
  const [selectedServiceFilter, setSelectedServiceFilter] = useState<string>('all');
  const [selectedAbnFilter, setSelectedAbnFilter] = useState<'all' | 'has_abn' | 'no_abn'>('all');
  const [selectedDateWindow, setSelectedDateWindow] = useState<DateWindowFilter>('all');
  const [selectedDateFrom, setSelectedDateFrom] = useState('');
  const [selectedDateTo, setSelectedDateTo] = useState('');
  const [editingCell, setEditingCell] = useState<{ leadId: string; field: string } | null>(null);
  const [editingCellValue, setEditingCellValue] = useState<string>('');
  const [colsDropdownOpen, setColsDropdownOpen] = useState(false);
  const [isAddingColInline, setIsAddingColInline] = useState(false);
  const [inlineColName, setInlineColName] = useState('');
  const [inlineColType, setInlineColType] = useState<'text' | 'number' | 'date'>('text');

  // Navigation State
  const [activeTab, setActiveTab] = useState<'dashboard' | string>('dashboard');
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  /** Tracks which brand's custom-field fetch last completed (avoids column-hydration races). */
  const customFieldsReadyBrandRef = useRef<string | null>(null);
  const selectedBrandRef = useRef<Brand | null>(null);
  selectedBrandRef.current = selectedBrand;
  const {
    tabs: workspaceTabs,
    activeTabId: workspaceActiveTabId,
    activeWorkspaceTab,
    closedStack,
    openOrFocus: openWorkspaceTab,
    activateTab: activateWorkspaceTab,
    closeTab: closeWorkspaceTab,
    closeOthers: closeOtherWorkspaceTabs,
    closeToRight: closeWorkspaceTabsToRight,
    togglePin: toggleWorkspaceTabPin,
    renameTab: renameWorkspaceTab,
    duplicateTab: duplicateWorkspaceTab,
    reopenClosedTab,
    saveSnapshot: saveWorkspaceTabSnapshot,
    reorderTabs: reorderWorkspaceTabs,
    cloudHydrationVersion,
  } = useWorkspaceTabs(user?.id);
  const viewContentRef = useRef<HTMLDivElement>(null);
  const workspaceSwitchLock = useRef(false);
  const cloudRestoreVersionRef = useRef(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedTab = params.get('tab');
    if (requestedTab === 'social-hub') {
      setSelectedBrand(null);
      setActiveTab('social-hub');
    }
    // OAuth bounce-back from Render API callback (Gmail / Outlook / Social).
    if (params.get('gmail') === 'success') {
      showToast('Gmail connected. Opening mailbox and syncing…');
      setActiveTab('email-tracking');
      setEmailProviderMode('gmail');
      // Integrations + first sync after connect (brand list loads async).
      window.setTimeout(() => {
        fetchBrandIntegrations?.();
        fetchAllSentEmails?.();
      }, 400);
    } else if (params.get('gmail') === 'error') {
      showToast('Gmail connection failed. Try Connect Gmail again and approve all permissions.', true);
      setActiveTab('integrations');
    } else if (params.get('outlook') === 'success') {
      showToast('Outlook / Microsoft connected. Opening mailbox…');
      setActiveTab('email-tracking');
      setEmailProviderMode('outlook');
      window.setTimeout(() => {
        fetchBrandIntegrations?.();
        fetchAllSentEmails?.();
      }, 400);
    } else if (params.get('outlook') === 'error') {
      showToast('Outlook / Microsoft connection failed. Try connecting again and approve offline access.', true);
      setActiveTab('integrations');
    } else if (params.get('social_status') === 'success') {
      const socialProvider = params.get('social') || 'social';
      showToast(`${socialProvider === 'meta' ? 'Meta' : socialProvider === 'linkedin' ? 'LinkedIn' : 'Social'} connected.`);
      setSelectedBrand(null);
      setActiveTab('social-hub');
    } else if (params.get('social_status') === 'error') {
      showToast('Social connection failed. Try connecting again from Social Hub.', true);
      setSelectedBrand(null);
      setActiveTab('social-hub');
    }
    if (requestedTab === 'social-hub' || params.get('gmail') || params.get('outlook') || params.get('social') || params.get('social_status')) {
      const next = new URL(window.location.href);
      next.searchParams.delete('tab');
      next.searchParams.delete('gmail');
      next.searchParams.delete('outlook');
      next.searchParams.delete('social');
      next.searchParams.delete('social_status');
      window.history.replaceState({}, '', next.pathname + (next.search || '') + next.hash);
    }
  }, []);

  const [showDataCleanupStudio, setShowDataCleanupStudio] = useState(false);
  const [dataCleanupSearch, setDataCleanupSearch] = useState('');
  const [brandSubTab, setBrandSubTabState] = useState<'leads' | 'sequences' | 'tasks'>('leads');
  const setBrandSubTab = (value: 'leads' | 'sequences' | 'tasks') => {
    setBrandSubTabState(value);
    if (activeWorkspaceTab) {
      saveWorkspaceTabSnapshot(activeWorkspaceTab.id, { brandSubTab: value });
    }
  };
  const [leadClassificationTab, setLeadClassificationTab] = useState<'verified' | 'prospect'>('verified');
  type CustomLeadTab = {
    id: string;
    name: string;
    icon: string;
    color: string;
    filters: {
      stage: string;
      search: string;
      segment: string;
      city: string;
      service: string;
      abn: string;
      dateWindow: string;
      dateFrom: string;
      dateTo: string;
    };
  };
  const [customLeadTabs, setCustomLeadTabs] = useState<Record<string, CustomLeadTab[]>>(() => {
    try { return JSON.parse(safeLocalStorage.getItem('crm_custom_lead_tabs') || '{}'); } catch { return {}; }
  });
  const [activeCustomTabId, setActiveCustomTabId] = useState<string | null>(null);
  const [showCustomTabModal, setShowCustomTabModal] = useState(false);
  const [editingCustomTabId, setEditingCustomTabId] = useState<string | null>(null);
  const [customTabName, setCustomTabName] = useState('');
  const [customTabIcon, setCustomTabIcon] = useState('fa-fire');
  const [customTabColor, setCustomTabColor] = useState('#f59e0b');
  const [useCurrentFiltersForTab, setUseCurrentFiltersForTab] = useState(true);
  const [leadWorkspaceView, setLeadWorkspaceView] = useState<'table' | 'kanban'>('table');
  const [kanbanSearchQuery, setKanbanSearchQuery] = useState('');
  const [kanbanColumnLimits, setKanbanColumnLimits] = useState<Record<string, number>>({});
  /** Dashboard/metric chip label currently focusing the lead list (visual only; filters carry the real constraint). */
  const [leadFocusFilter, setLeadFocusFilter] = useState<string | null>(null);
  type LeadWorkbenchFocus = {
    label?: string;
    segment?: string;
    stage?: string;
    abn?: 'has_abn' | 'no_abn';
    customField?: { field: string; value: string };
    search?: string;
    /** Dashboard metrics open the verified pool by default. */
    classification?: 'prospect' | 'verified';
  };

  type ManagedBrand = Brand & {
    archived?: boolean;
    market_scope?: 'global' | 'country_specific' | string;
    market_countries?: string[];
    target_audience?: string;
    audience_keywords?: string[];
    cross_sell_notes?: string;
  };
  const [managedBrands, setManagedBrands] = useState<ManagedBrand[]>(() => {
    try {
      const stored = safeLocalStorage.getItem('crm_managed_brands');
      return stored ? JSON.parse(stored) : BRANDS;
    } catch {
      return BRANDS;
    }
  });
  const activeBrands = useMemo(() => managedBrands.filter(b => !b.archived), [managedBrands]);

  const [newBrandName, setNewBrandName] = useState('');
  const [newBrandLogo, setNewBrandLogo] = useState('/logos/optima_crm_logo.png');
  const [newBrandColor, setNewBrandColor] = useState('#8B5CF6');
  const [newBrandLogoFileName, setNewBrandLogoFileName] = useState('');
  const [newBrandSegments, setNewBrandSegments] = useState('New Enquiries\nFollow-Up Leads\nActive Customers');
  const [newBrandStages, setNewBrandStages] = useState('New Lead\nContacted\nFollow-Up Due\nProposal Sent\nWon\nLost');
  const [newBrandDescription, setNewBrandDescription] = useState('');
  const [newBrandTargetAudience, setNewBrandTargetAudience] = useState('');
  const [newBrandAudienceKeywords, setNewBrandAudienceKeywords] = useState('');
  const [newBrandCrossSellNotes, setNewBrandCrossSellNotes] = useState('');
  const [newBrandMarketScope, setNewBrandMarketScope] = useState<'global' | 'country_specific'>('global');
  const [newBrandMarketCountries, setNewBrandMarketCountries] = useState('');
  const [newBrandSetupMode, setNewBrandSetupMode] = useState<'starter' | 'duplicate'>('starter');
  const [newBrandSourceBrandId, setNewBrandSourceBrandId] = useState('taskgo');
  const [expandedBrandProfileId, setExpandedBrandProfileId] = useState('');
  const [brandMarketCountryDrafts, setBrandMarketCountryDrafts] = useState<Record<string, string>>({});
  const [brandLibrarySearch, setBrandLibrarySearch] = useState('');
  const [brandLibraryStatus, setBrandLibraryStatus] = useState<'all' | 'active' | 'archived'>('all');
  const filteredManagedBrands = useMemo(() => {
    const query = brandLibrarySearch.trim().toLowerCase();
    return managedBrands.filter(brand => {
      const matchesStatus =
        brandLibraryStatus === 'all' ||
        (brandLibraryStatus === 'archived' ? Boolean(brand.archived) : !brand.archived);
      const searchable = [
        brand.name,
        brand.id,
        brand.description,
        brand.target_audience,
        Array.isArray(brand.audience_keywords) ? brand.audience_keywords.join(' ') : brand.audience_keywords,
        Array.isArray(brand.market_countries) ? brand.market_countries.join(' ') : brand.market_countries,
      ].filter(Boolean).join(' ').toLowerCase();
      return matchesStatus && (!query || searchable.includes(query));
    });
  }, [brandLibrarySearch, brandLibraryStatus, managedBrands]);
  const [customBrandSegments, setCustomBrandSegments] = useState<Record<string, { label: string; value: string; color: string; icon: string }[]>>(() => {
    try {
      const stored = safeLocalStorage.getItem('crm_custom_brand_segments');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  const [brandStageOverrides, setBrandStageOverrides] = useState<Record<string, string[]>>(() => {
    try {
      const stored = safeLocalStorage.getItem('crm_brand_stage_overrides');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  const [brandSegmentStageOverrides, setBrandSegmentStageOverrides] = useState<Record<string, Record<string, string[]>>>(() => {
    try {
      const stored = safeLocalStorage.getItem('crm_brand_segment_stage_overrides');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  const [brandFollowUpPlaybooks, setBrandFollowUpPlaybooks] = useState<Record<string, Record<string, string[]>>>(() => {
    try {
      const stored = safeLocalStorage.getItem('crm_brand_follow_up_playbooks');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    safeLocalStorage.setItem('crm_custom_brand_segments', JSON.stringify(customBrandSegments));
  }, [customBrandSegments]);

  useEffect(() => {
    safeLocalStorage.setItem('crm_brand_stage_overrides', JSON.stringify(brandStageOverrides));
  }, [brandStageOverrides]);

  useEffect(() => {
    safeLocalStorage.setItem('crm_brand_segment_stage_overrides', JSON.stringify(brandSegmentStageOverrides));
  }, [brandSegmentStageOverrides]);

  useEffect(() => {
    safeLocalStorage.setItem('crm_brand_follow_up_playbooks', JSON.stringify(brandFollowUpPlaybooks));
  }, [brandFollowUpPlaybooks]);
  const [snapshotCards, setSnapshotCards] = useState<Record<string, SnapshotCardConfig[]>>(() => {
    try {
      const stored = safeLocalStorage.getItem('crm_snapshot_cards');
      return stored ? JSON.parse(stored) : DEFAULT_SNAPSHOT_CARDS;
    } catch {
      return DEFAULT_SNAPSHOT_CARDS;
    }
  });
  const [snapshotForm, setSnapshotForm] = useState({ label: '', fieldKey: 'segment', matchValue: '', target: '', unit: 'Leads', icon: 'fa-bullseye', color: '#8B5CF6' });
  const [editingSnapshotCardId, setEditingSnapshotCardId] = useState('');
  const [brandWorkspaceProfiles, setBrandWorkspaceProfiles] = useState<Record<string, BrandWorkspaceProfile[]>>(() => {
    try {
      const stored = safeLocalStorage.getItem('crm_brand_workspace_profiles');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  const [workspaceProfileName, setWorkspaceProfileName] = useState('');
  const [selectedWorkspaceProfileId, setSelectedWorkspaceProfileId] = useState('');
  const [workspaceProfileBrandId, setWorkspaceProfileBrandId] = useState(BRANDS[0].id);
  const [workflowDesignerBrandId, setWorkflowDesignerBrandId] = useState(BRANDS[0].id);
  const [workflowSegmentsDraft, setWorkflowSegmentsDraft] = useState('');
  const [workflowStagesDraft, setWorkflowStagesDraft] = useState('');
  const [workflowSegmentStageDrafts, setWorkflowSegmentStageDrafts] = useState<Record<string, string>>({});
  const [workflowFollowUpDrafts, setWorkflowFollowUpDrafts] = useState<Record<string, string>>({});
  const [workflowPreviewCollapsed, setWorkflowPreviewCollapsed] = useState<Record<string, boolean>>({});

  // Multi-select states
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());

  // Bulk email blast
  const [bulkEmailModalOpen, setBulkEmailModalOpen] = useState(false);
  const [bulkEmailSubject, setBulkEmailSubject] = useState('');
  const [bulkEmailBody, setBulkEmailBody] = useState('');
  const [bulkEmailSending, setBulkEmailSending] = useState(false);
  const [bulkEmailProgress, setBulkEmailProgress] = useState<{ sent: number; failed: number; total: number; errors: string[] } | null>(null);
  const [bulkWhatsAppModalOpen, setBulkWhatsAppModalOpen] = useState(false);
  const [bulkWhatsAppMessage, setBulkWhatsAppMessage] = useState('');
  const [bulkWhatsAppSending, setBulkWhatsAppSending] = useState(false);
  const [bulkWhatsAppProgress, setBulkWhatsAppProgress] = useState<{ sent: number; failed: number; total: number; errors: string[] } | null>(null);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkEditSaving, setBulkEditSaving] = useState(false);
  const [bulkEditForm, setBulkEditForm] = useState({
    stage: '',
    follow_up_date: '',
    follow_up_type: '',
    follow_up_status: '',
    next_action: ''
  });

  // Brand-Specific Collections
  const [leads, setLeads] = useState<Lead[]>([]);
  const [allCrmLeads, setAllCrmLeads] = useState<Lead[]>([]);
  const [funnels, setFunnels] = useState<Record<string, BrandFunnel>>({});
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [sequenceStats, setSequenceStats] = useState<Record<string, { total: number; active: number; completed: number; cancelled: number; next_due?: string }>>({});
  const [usageAnalytics, setUsageAnalytics] = useState<Record<string, { total_events: number; unique_sessions: number; last_seen_at?: string | null }>>({});

  useEffect(() => {
    safeLocalStorage.setItem('crm_managed_brands', JSON.stringify(managedBrands));
  }, [managedBrands]);

  useEffect(() => {
    safeLocalStorage.setItem('crm_snapshot_cards', JSON.stringify(snapshotCards));
  }, [snapshotCards]);

  useEffect(() => {
    safeLocalStorage.setItem('crm_brand_workspace_profiles', JSON.stringify(brandWorkspaceProfiles));
  }, [brandWorkspaceProfiles]);

  const normalizeMetricKey = (value: unknown) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  const METRIC_FIELD_ALIASES: Record<string, string[]> = {
    abn: ['abn', 'abnnumber', 'abnno', 'abnnum', 'australianbusinessnumber', 'businessnumber'],
    organisation: ['organisation', 'organization', 'company', 'companyname', 'business', 'businessname', 'employer'],
    city: ['city', 'suburb', 'town', 'location', 'area'],
    country: ['country', 'countryserved', 'market', 'region'],
    source: ['source', 'leadsource', 'traffic_source', 'campaign', 'origin'],
    segment: ['segment', 'leadtype', 'lead_type', 'service', 'servicetype', 'service_type'],
    stage: ['stage', 'funnelstage', 'funnel_stage', 'pipelinestage', 'pipeline_stage', 'status'],
    phone: ['phone', 'mobile', 'mobilenumber', 'phonenumber', 'contactnumber'],
    email: ['email', 'emailaddress', 'mail']
  };

  const getMetricAliasSet = (fieldKey: string) => {
    const normalized = normalizeMetricKey(fieldKey);
    const aliases = new Set<string>([normalized]);
    Object.values(METRIC_FIELD_ALIASES).forEach(group => {
      const normalizedGroup = group.map(normalizeMetricKey);
      if (normalizedGroup.includes(normalized)) normalizedGroup.forEach(alias => aliases.add(alias));
    });
    return aliases;
  };

  const isMeaningfulMetricValue = (value: unknown) => {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (!normalized) return false;
    return ![
      '-', '--', '—', 'n/a', 'na', 'none', 'null', 'undefined', 'blank', 'empty',
      'not filled', 'notfilled', 'has not filled/blank', 'no data', 'not provided',
      'no abn', 'no abn supplied'
    ].includes(normalized);
  };

  const getLeadMetricRawValue = (lead: Lead, fieldKey: string) => {
    const candidates: Array<{ key: string; value: unknown }> = [];
    Object.entries(lead.custom_fields || {}).forEach(([key, value]) => candidates.push({ key, value }));
    [
      ['name', lead.name],
      ['email', lead.email],
      ['phone', lead.phone],
      ['funnel_stage', lead.funnel_stage],
      ['stage', lead.funnel_stage],
      ['source', (lead as any).source || lead.custom_fields?.source],
      ['organisation', (lead as any).organisation || (lead as any).organization || lead.custom_fields?.organisation || lead.custom_fields?.organization],
      ['organization', (lead as any).organization || (lead as any).organisation || lead.custom_fields?.organization || lead.custom_fields?.organisation],
      ['notes', lead.notes],
      ['created_at', lead.created_at],
      ['follow_up_date', lead.follow_up_date]
    ].forEach(([key, value]) => candidates.push({ key: String(key), value }));

    const aliases = getMetricAliasSet(fieldKey);
    const exact = candidates.find(candidate => aliases.has(normalizeMetricKey(candidate.key)));
    if (exact) return exact;

    const fuzzy = candidates.find(candidate => {
      const candidateKey = normalizeMetricKey(candidate.key);
      return Array.from(aliases).some(alias => alias.length > 2 && candidateKey.length > 2 && (candidateKey.includes(alias) || alias.includes(candidateKey)));
    });
    return fuzzy || { key: fieldKey, value: undefined };
  };

  const getSnapshotCardValue = (card: SnapshotCardConfig, brandLeads: Lead[]) => {
    if (card.fieldKey === '__total__') return countUniquePeopleForBrand(brandLeads);
    const matches = brandLeads.filter(l => {
      const val = card.fieldKey === 'funnel_stage' ? l.funnel_stage : getLeadMetricRawValue(l, card.fieldKey).value;
      if (!card.matchValue) return val !== undefined && val !== null && String(val).trim() !== '';
      return String(val || '').toLowerCase().trim() === String(card.matchValue || '').toLowerCase().trim();
    });
    if (String(card.fieldKey || '').toLowerCase().includes('abn')) {
      return new Set(matches.filter(l => String(getLeadMetricRawValue(l, card.fieldKey).value || '').replace(/\s+/g, '').length >= 9).map(l => String(l.email || l.id || '').toLowerCase().trim())).size;
    }
    return matches.length;
  };

  const cloneBrandSetupValue = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

  const slugifyValue = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || `item_${Date.now()}`;
  const parseLineList = (value: string, fallback: string[]) => value.split(/\r?\n|,/).map(v => v.trim()).filter(Boolean).length
    ? value.split(/\r?\n|,/).map(v => v.trim()).filter(Boolean)
    : fallback;
  const getBrandSegmentOptions = (brandId?: string) => {
    if (!brandId) return [];
    return customBrandSegments[brandId] || BRAND_SEGMENTS[brandId] || [];
  };
  const getBrandStageOptions = (brandId?: string) => {
    if (!brandId) return DEFAULT_STAGES;
    return brandStageOverrides[brandId] || getBrandStages(brandId);
  };

  const getDefaultSegmentStagesForBrand = (brandId: string, segmentValue: string) => {
    if (brandId === 'optimaviz') return OPTIMAVIZ_SEGMENT_STAGES[segmentValue] || OPTIMAVIZ_SEGMENT_STAGES.demo_leads;
    if (brandId === 'idao') return IDAO_SEGMENT_STAGES[segmentValue] || IDAO_SEGMENT_STAGES.training_leads;
    return getBrandStageOptions(brandId);
  };

  const getSegmentStagesForBrand = (brandId: string, segmentValue: string) =>
    brandSegmentStageOverrides[brandId]?.[segmentValue] || getDefaultSegmentStagesForBrand(brandId, segmentValue);

  const getDefaultFollowUpPlaybookForSegment = (brandId: string, segmentValue: string) => {
    const source = brandId === 'optimaviz'
      ? OPTIMAVIZ_FOLLOW_UP_RULES[segmentValue]
      : brandId === 'idao'
        ? IDAO_FOLLOW_UP_RULES[segmentValue]
        : undefined;
    if (source?.length) return source.map(rule => `${rule.stage}: ${rule.description}`);
    return [
      'First follow-up: email if there is no response',
      'Second follow-up: call and record interested / not interested',
      'Final follow-up: close, pause, or move to the next stage'
    ];
  };

  const getFollowUpPlaybookForSegment = (brandId: string, segmentValue: string) =>
    brandFollowUpPlaybooks[brandId]?.[segmentValue] || getDefaultFollowUpPlaybookForSegment(brandId, segmentValue);

  const buildSegmentsDraftForBrand = (brandId: string) => (getBrandSegmentOptions(brandId) || []).map(seg => seg.label).join('\n');
  const buildStagesDraftForBrand = (brandId: string) => getBrandStageOptions(brandId).join('\n');

  const buildWorkflowCardDraftsForBrand = (brandId: string) => {
    const segments = getBrandSegmentOptions(brandId) || [];
    return {
      stages: Object.fromEntries(segments.map(seg => [seg.value, getSegmentStagesForBrand(brandId, seg.value).join('\n')])),
      playbooks: Object.fromEntries(segments.map(seg => [seg.value, getFollowUpPlaybookForSegment(brandId, seg.value).join('\n')])),
    };
  };

  const syncWorkflowDesignerDrafts = (brandId: string) => {
    setWorkflowDesignerBrandId(brandId);
    setWorkflowSegmentsDraft(buildSegmentsDraftForBrand(brandId));
    setWorkflowStagesDraft(buildStagesDraftForBrand(brandId));
    const drafts = buildWorkflowCardDraftsForBrand(brandId);
    setWorkflowSegmentStageDrafts(drafts.stages);
    setWorkflowFollowUpDrafts(drafts.playbooks);
  };

  const handleSaveWorkflowDesigner = () => {
    const brand = managedBrands.find(b => b.id === workflowDesignerBrandId);
    if (!brand) return;
    const segmentNames = parseLineList(workflowSegmentsDraft, ['New Enquiries', 'Follow-Up Leads', 'Active Customers']);
    const stageNames = parseLineList(workflowStagesDraft, DEFAULT_STAGES);
    const segmentColors = [brand.color || '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#0EA5E9'];
    const existingSegments = getBrandSegmentOptions(brand.id);
    const segments = segmentNames.map((label, index) => ({
      label,
      value: existingSegments.find(seg => seg.label.toLowerCase() === label.toLowerCase() || seg.value === label)?.value || slugifyValue(label),
      color: existingSegments.find(seg => seg.label.toLowerCase() === label.toLowerCase() || seg.value === label)?.color || segmentColors[index % segmentColors.length],
      icon: existingSegments.find(seg => seg.label.toLowerCase() === label.toLowerCase() || seg.value === label)?.icon || (index === 0 ? 'fas fa-bullseye' : index === 1 ? 'fas fa-phone-volume' : index === 2 ? 'fas fa-users' : 'fas fa-layer-group')
    }));
    const segmentStageMap = Object.fromEntries(segments.map(seg => [
      seg.value,
      parseLineList(workflowSegmentStageDrafts[seg.value] || '', getDefaultSegmentStagesForBrand(brand.id, seg.value))
    ]));
    const followUpMap = Object.fromEntries(segments.map(seg => [
      seg.value,
      parseLineList(workflowFollowUpDrafts[seg.value] || '', getDefaultFollowUpPlaybookForSegment(brand.id, seg.value))
    ]));
    setCustomBrandSegments(prev => ({ ...prev, [brand.id]: segments }));
    setBrandStageOverrides(prev => ({ ...prev, [brand.id]: stageNames }));
    setBrandSegmentStageOverrides(prev => ({ ...prev, [brand.id]: segmentStageMap }));
    setBrandFollowUpPlaybooks(prev => ({ ...prev, [brand.id]: followUpMap }));
    setSnapshotCards(prev => ({
      ...prev,
      [brand.id]: segments.slice(0, 4).map((seg, index) => ({
        id: `${brand.id}-snapshot-${seg.value}-${index}`,
        label: seg.label,
        fieldKey: 'segment',
        matchValue: seg.value,
        target: 10,
        unit: 'Leads',
        icon: seg.icon.replace('fas ', ''),
        color: seg.color,
        active: true
      }))
    }));
    showToast(`${brand.name} workflow setup updated.`);
  };

  const getBrandWorkflowPreviewStages = (brandId?: string) => getBrandStageOptions(brandId).slice(0, 7);

  const getBrandFollowUpHints = (brandId?: string) => {
    if (brandId === 'optimaviz') return [
      'Demo requested: follow up in 1 day',
      'Demo attended: follow up within 1 day',
      'Trial started: onboarding follow-up in 1 day',
      'Trial ending soon: follow up 3 days before end'
    ];
    if (brandId === 'idao') return [
      'Training enquiry: send email today',
      'Email sent: follow up in 2 days',
      'Quote sent: follow up in 3 days',
      'Follow-up due: call after 7 days'
    ];
    if (brandId === 'taskgo') return [
      'New intake: first contact today',
      'ABN missing: follow up in 2 days',
      'Documents needed: follow up in 3 days',
      'Approved contractor: onboarding check-in in 7 days'
    ];
    if (brandId === 'nestwise') return [
      'New enquiry: discovery follow-up today',
      'Quote/package sent: follow up in 3 days',
      'Owner approved: onboarding check-in in 2 days',
      'Active service: monthly status check'
    ];
    if (brandId === 'optimaclean') return [
      'New cleaning lead: first contact today',
      'Proposal sent: follow up in 3 days',
      'Client account: check-in in 7 days',
      'Support issue: follow up today'
    ];
    return ['New lead: first contact today', 'Contacted: follow up in 2 days', 'Proposal sent: follow up in 3 days', 'Won: onboarding check-in in 7 days'];
  };

  const handleDownloadBrandImportTemplate = (brand: Brand) => {
    const headers = ['Lead Name', 'Organisation', 'Email', 'Phone', 'Segment', 'Stage', 'Next Action', 'Follow-Up Date', 'Assigned To', 'Tags', 'Notes'];
    if (brand.id === 'idao') headers.splice(6, 0, 'Service Type');
    if (brand.id === 'optimaviz') headers.push('Trial Start Date', 'Trial End Date', 'Trial Status', 'Trial Activity Status');
    const exampleSegment = getBrandSegmentOptions(brand.id)[0]?.label || 'New Enquiries';
    const exampleStage = getBrandStageOptions(brand.id)[0] || 'New Lead';
    const row = ['Example Lead', 'Example Organisation', 'example@email.com', '+27000000000', exampleSegment, exampleStage, 'Follow up', '', 'Admin', 'Import; '+brand.name, 'Imported template row'];
    if (brand.id === 'idao') row.splice(6, 0, getBrandSegmentOptions(brand.id)[0]?.label || 'General');
    if (brand.id === 'optimaviz') row.push('', '', '', '');
    const csv = [headers, row].map(cols => cols.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${brand.id}-import-template.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    const brand = managedBrands.find(b => b.id === workflowDesignerBrandId) || managedBrands[0];
    if (brand && !workflowSegmentsDraft && !workflowStagesDraft) syncWorkflowDesignerDrafts(brand.id);
  }, [managedBrands.length]);

  const handleAddBrand = () => {
    const name = newBrandName.trim();
    if (!name) { showToast('Brand name is required.', true); return; }
    const id = slugifyValue(name);
    if (managedBrands.some(b => b.id === id)) { showToast('A brand with this name already exists.', true); return; }
    const sourceBrandId = newBrandSourceBrandId || activeBrands[0]?.id || 'taskgo';
    const sourceBrand = managedBrands.find(b => b.id === sourceBrandId);
    const duplicateSetup = newBrandSetupMode === 'duplicate' && sourceBrand;
    const sourceSegments = duplicateSetup ? cloneBrandSetupValue(getBrandSegmentOptions(sourceBrandId)) : [];
    const sourceStages = duplicateSetup ? cloneBrandSetupValue(getBrandStageOptions(sourceBrandId)) : [];
    const segmentNames = duplicateSetup && sourceSegments.length
      ? sourceSegments.map(seg => seg.label)
      : parseLineList(newBrandSegments, ['New Enquiries', 'Follow-Up Leads', 'Active Customers']);
    const stageNames = duplicateSetup && sourceStages.length
      ? sourceStages
      : parseLineList(newBrandStages, ['New Lead', 'Contacted', 'Follow-Up Due', 'Proposal Sent', 'Won', 'Lost']);
    const segmentColors = [newBrandColor || '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444'];
    const segments = duplicateSetup && sourceSegments.length
      ? sourceSegments.map((seg, index) => ({
          ...seg,
          color: index === 0 ? (newBrandColor || seg.color || '#8B5CF6') : seg.color,
          icon: seg.icon || 'fas fa-layer-group'
        }))
      : segmentNames.map((label, index) => ({
          label,
          value: slugifyValue(label),
          color: segmentColors[index % segmentColors.length],
          icon: index === 0 ? 'fas fa-bullseye' : index === 1 ? 'fas fa-phone-volume' : index === 2 ? 'fas fa-users' : 'fas fa-layer-group'
        }));
    const segmentStageMap = duplicateSetup
      ? Object.fromEntries(segments.map(seg => [
          seg.value,
          cloneBrandSetupValue(brandSegmentStageOverrides[sourceBrandId]?.[seg.value] || getSegmentStagesForBrand(sourceBrandId, seg.value) || stageNames)
        ]))
      : Object.fromEntries(segments.map(seg => [seg.value, stageNames]));
    const followUpMap = duplicateSetup
      ? Object.fromEntries(segments.map(seg => [
          seg.value,
          cloneBrandSetupValue(brandFollowUpPlaybooks[sourceBrandId]?.[seg.value] || getFollowUpPlaybookForSegment(sourceBrandId, seg.value))
        ]))
      : Object.fromEntries(segments.map(seg => [seg.value, [
      'First follow-up: email if there is no response',
      'Second follow-up: call and record interested / not interested',
      'Final follow-up: close, pause, or move to the next stage'
    ]]));
    const sourceSnapshotCards = cloneBrandSetupValue(snapshotCards[sourceBrandId] || DEFAULT_SNAPSHOT_CARDS[sourceBrandId] || []);
    const snapshotDefaults: SnapshotCardConfig[] = duplicateSetup && sourceSnapshotCards.length
      ? sourceSnapshotCards.map((card, index) => ({ ...card, id: `${id}-snapshot-copy-${index}-${slugifyValue(card.label)}` }))
      : segments.slice(0, 3).map((seg, index) => ({
      id: `${id}-snapshot-${seg.value}`,
      label: seg.label,
      fieldKey: 'segment',
      matchValue: seg.value,
      target: 10,
      unit: 'Leads',
      icon: seg.icon.replace('fas ', ''),
      color: seg.color,
      active: true
    }));
    const sourceWidgets = cloneBrandSetupValue(customWidgets[sourceBrandId] || DEFAULT_WIDGETS[sourceBrandId] || []);
    const widgetDefaults: CustomWidget[] = duplicateSetup && sourceWidgets.length
      ? sourceWidgets.map((widget, index) => ({ ...widget, id: `${id}_widget_copy_${index}_${slugifyValue(widget.title)}` }))
      : segments.slice(0, 3).map((seg, index) => ({
          id: `${id}_widget_${seg.value}`,
          title: seg.label,
          criteriaType: 'segment' as const,
          criteriaValue: seg.value,
          goal: 10,
          icon: seg.icon.replace('fas ', ''),
          color: seg.color,
          countMode: 'records' as const
        }));
    setManagedBrands(prev => [...prev, {
      id,
      name,
      logo: newBrandLogo || '/logos/optima_crm_logo.png',
      color: newBrandColor || '#8B5CF6',
      description: newBrandDescription.trim(),
      target_audience: newBrandTargetAudience.trim(),
      audience_keywords: parseLineList(newBrandAudienceKeywords, []),
      cross_sell_notes: newBrandCrossSellNotes.trim(),
      market_scope: newBrandMarketScope,
      market_countries: parseLineList(newBrandMarketCountries, []),
    }]);
    setCustomBrandSegments(prev => ({ ...prev, [id]: segments }));
    setBrandStageOverrides(prev => ({ ...prev, [id]: stageNames }));
    setBrandSegmentStageOverrides(prev => ({ ...prev, [id]: segmentStageMap }));
    setBrandFollowUpPlaybooks(prev => ({ ...prev, [id]: followUpMap }));
    setSnapshotCards(prev => ({ ...prev, [id]: snapshotDefaults }));
    setCustomWidgets(prev => ({ ...prev, [id]: widgetDefaults }));
    if (duplicateSetup) {
      setSavedViews(prev => ({ ...prev, [id]: cloneBrandSetupValue(savedViews[sourceBrandId] || []) }));
      setBrandSpotlights(prev => ({ ...prev, [id]: cloneBrandSetupValue(brandSpotlights[sourceBrandId] || DEFAULT_SPOTLIGHTS[sourceBrandId] || []) }));
      setDashboardSectionVisibility(prev => ({ ...prev, [id]: cloneBrandSetupValue(dashboardSectionVisibility[sourceBrandId] || {}) }));
      setDashboardSectionTitles(prev => ({ ...prev, [id]: cloneBrandSetupValue(dashboardSectionTitles[sourceBrandId] || {}) }));
      const sourceColumns = safeLocalStorage.getItem(`crm_cols_${sourceBrandId}`);
      if (sourceColumns) safeLocalStorage.setItem(`crm_cols_${id}`, sourceColumns);
    }
    setNewBrandName('');
    setNewBrandLogo('/logos/optima_crm_logo.png');
    setNewBrandLogoFileName('');
    setNewBrandColor('#8B5CF6');
    setNewBrandSegments('New Enquiries\nFollow-Up Leads\nActive Customers');
    setNewBrandStages('New Lead\nContacted\nFollow-Up Due\nProposal Sent\nWon\nLost');
    setNewBrandDescription('');
    setNewBrandTargetAudience('');
    setNewBrandAudienceKeywords('');
    setNewBrandCrossSellNotes('');
    setNewBrandMarketScope('global');
    setNewBrandMarketCountries('');
    showToast(duplicateSetup ? `Brand ${name} duplicated from ${sourceBrand?.name} with editable dashboards and lead views.` : `Brand ${name} added with editable segments, stages, and dashboard cards.`);
  };

  const handleNewBrandLogoUpload = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please choose an image logo file.', true);
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast('Logo image must be under 2 MB.', true);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setNewBrandLogo(String(reader.result || '/logos/optima_crm_logo.png'));
      setNewBrandLogoFileName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const updateManagedBrandProfile = (brandId: string, patch: Partial<ManagedBrand>) => {
    setManagedBrands(prev => prev.map(brand => brand.id === brandId ? { ...brand, ...patch } : brand));
  };

  const saveBrandIntelligenceProfile = async (brandId: string) => {
    const brand = managedBrands.find(item => item.id === brandId);
    if (!brand) return;
    const payload = {
      description: String(brand.description || ''),
      target_audience: String(brand.target_audience || ''),
      audience_keywords: Array.isArray(brand.audience_keywords)
        ? brand.audience_keywords
        : parseLineList(String(brand.audience_keywords || ''), []),
      cross_sell_notes: String(brand.cross_sell_notes || ''),
      market_scope: brand.market_scope === 'country_specific' ? 'country_specific' : 'global',
      market_countries: Array.isArray(brand.market_countries)
        ? brand.market_countries
        : parseLineList(String(brand.market_countries || ''), []),
    };
    try {
      const res = await axios.patch(`/api/brand-funnels/${encodeURIComponent(brandId)}/profile`, payload);
      updateManagedBrandProfile(brandId, {
        description: res.data.description || '',
        target_audience: res.data.target_audience || '',
        audience_keywords: res.data.audience_keywords || [],
        cross_sell_notes: res.data.cross_sell_notes || '',
        market_scope: res.data.market_scope || 'global',
        market_countries: res.data.market_countries || [],
      });
      setBrandMarketCountryDrafts(prev => ({
        ...prev,
        [brandId]: Array.isArray(res.data.market_countries) ? res.data.market_countries.join(', ') : '',
      }));
      showToast('Brand intelligence profile saved.');
      fetchPortfolioOpportunities();
    } catch (err) {
      showApiError(err, 'Could not save this brand profile to the server.');
    }
  };

  const handleArchiveBrand = (brandId: string) => {
    setManagedBrands(prev => prev.map(b => b.id === brandId ? { ...b, archived: true } : b));
    if (selectedBrand?.id === brandId) handleSelectDashboard();
    showToast('Brand archived. Existing leads are kept.');
  };

  const handleRestoreBrand = (brandId: string) => {
    setManagedBrands(prev => prev.map(b => b.id === brandId ? { ...b, archived: false } : b));
    showToast('Brand restored.');
  };

  const handleDeleteManagedBrand = (brandId: string) => {
    if (!confirm('Delete this brand from the sidebar/settings? Existing leads are not deleted.')) return;
    setManagedBrands(prev => prev.filter(b => b.id !== brandId));
    if (selectedBrand?.id === brandId) handleSelectDashboard();
    showToast('Brand removed from brand list. Existing leads are kept.');
  };

  const handleAddSnapshotCard = async (brandId: string) => {
    const sourceKey = snapshotForm.fieldKey || 'segment';
    if (sourceKey !== '__total__' && !snapshotForm.matchValue.trim()) { showToast('Choose a segment or stage to track.', true); return; }
    const segmentMeta = sourceKey === 'segment'
      ? getBrandSegmentOptions(brandId).find(seg => seg.value === snapshotForm.matchValue || seg.label === snapshotForm.matchValue)
      : undefined;
    const cardLabel = snapshotForm.label.trim()
      || (sourceKey === '__total__' ? 'Total Leads' : segmentMeta?.label || snapshotForm.matchValue.trim());
    const card: SnapshotCardConfig = {
      id: editingSnapshotCardId || `snapshot-${Date.now()}`,
      brand_id: brandId,
      label: cardLabel,
      fieldKey: sourceKey,
      matchValue: sourceKey === '__total__' ? undefined : snapshotForm.matchValue.trim(),
      target: snapshotForm.target.trim() ? Number(snapshotForm.target) || undefined : undefined,
      unit: snapshotForm.unit.trim() || 'Leads',
      icon: sourceKey === 'funnel_stage' ? 'fa-table-columns' : (segmentMeta?.icon || snapshotForm.icon || 'fa-bullseye').replace('fas ', ''),
      color: snapshotForm.color || segmentMeta?.color || '#8B5CF6',
      active: true
    };
    setSnapshotCards(prev => {
      const existing = (prev[brandId] || []).find(c => c.id === card.id);
      if (existing) {
        return { ...prev, [brandId]: (prev[brandId] || []).map(c => c.id === card.id ? card : c) };
      }
      return { ...prev, [brandId]: [...(prev[brandId] || []), card] };
    });
    setSnapshotForm({ label: '', fieldKey: 'segment', matchValue: '', target: '', unit: 'Leads', icon: 'fa-bullseye', color: '#8B5CF6' });
    setEditingSnapshotCardId('');
    showToast(editingSnapshotCardId ? 'Metric updated.' : 'Snapshot item added.');
    try {
      if (editingSnapshotCardId) {
        await axios.patch(`/api/snapshot-cards/${card.id}`, {
          label: card.label,
          fieldKey: card.fieldKey,
          matchValue: card.matchValue,
          target: card.target,
          unit: card.unit,
          icon: card.icon,
          color: card.color,
          active: card.active,
        });
      } else {
        await axios.post(`/api/brands/${brandId}/snapshot-cards`, card);
      }
    } catch {
      showToast('Saved locally, but could not sync to server.', true);
    }
  };

  const handleEditSnapshotCard = (brandId: string, card: SnapshotCardConfig) => {
    setEditingSnapshotCardId(card.id);
    setSnapshotForm({
      label: card.label,
      fieldKey: card.fieldKey,
      matchValue: card.matchValue || '',
      target: String(card.target ?? ''),
      unit: card.unit || 'Leads',
      icon: card.icon || 'fa-bullseye',
      color: card.color || '#8B5CF6',
    });
  };

  const handleDeleteSnapshotCard = async (brandId: string, cardId: string) => {
    const card = (snapshotCards[brandId] || []).find(c => c.id === cardId);
    const label = card?.label || cardId;
    if (!window.confirm(`Are you sure you want to remove the "${label}" metric card from this dashboard?`)) {
      return;
    }
    setSnapshotCards(prev => ({ ...prev, [brandId]: (prev[brandId] || []).filter(c => c.id !== cardId) }));
    if (editingSnapshotCardId === cardId) {
      setEditingSnapshotCardId('');
      setSnapshotForm({ label: '', fieldKey: 'segment', matchValue: '', target: '', unit: 'Leads', icon: 'fa-bullseye', color: '#8B5CF6' });
    }
    try {
      await axios.delete(`/api/snapshot-cards/${cardId}`);
    } catch {
      showToast('Removed locally, but could not delete from server.', true);
    }
  };

  // Customizable Spotlights state and active filters
  const [brandSpotlights, setBrandSpotlights] = useState<Record<string, SpotlightConfig[]>>(() => {
    try {
      const stored = safeLocalStorage.getItem('crm_brand_spotlights');
      return stored ? JSON.parse(stored) : DEFAULT_SPOTLIGHTS;
    } catch {
      return DEFAULT_SPOTLIGHTS;
    }
  });

  const [activeSpotlightFilters, setActiveSpotlightFilters] = useState<Record<string, string>>({});

  const [spotlightModalOpen, setSpotlightModalOpen] = useState(false);
  const [editingSpotlight, setEditingSpotlight] = useState<SpotlightConfig | null>(null);
  const [spotlightFormTitle, setSpotlightFormTitle] = useState('');
  const [spotlightFormIcon, setSpotlightFormIcon] = useState('fas fa-chart-pie');
  const [spotlightFormType, setSpotlightFormType] = useState<'groupby' | 'binary' | 'trial'>('groupby');
  const [spotlightFormKey, setSpotlightFormKey] = useState('');
  const [spotlightFormBinaryTrue, setSpotlightFormBinaryTrue] = useState('Compliant');
  const [spotlightFormBinaryFalse, setSpotlightFormBinaryFalse] = useState('Non-compliant');
  const [spotlightFormSegmentScope, setSpotlightFormSegmentScope] = useState<string[]>([]);
  type IntelligenceBreakdownConfig = { id: string; title: string; keys: string[]; type: string };

  /** Smart default breakdowns per brand — always include useful field distributions (e.g. city). */
  const getDefaultIntelligenceBreakdowns = (brandId?: string): IntelligenceBreakdownConfig[] => {
    const shared: IntelligenceBreakdownConfig[] = [
      { id: 'segments', title: 'By segment', keys: ['segment', 'lead_type'], type: 'segment' },
      { id: 'stages', title: 'By stage', keys: ['funnel_stage', 'stage'], type: 'stage' },
    ];
    const byBrand: Record<string, IntelligenceBreakdownConfig[]> = {
      taskgo: [
        { id: 'city', title: 'By city', keys: ['city', 'suburb', 'location', 'state'], type: 'custom' },
        { id: 'services', title: 'By service category', keys: ['service_category_name', 'service_offered', 'service_type'], type: 'custom' },
        { id: 'provider', title: 'By provider status', keys: ['provider_status', 'verification_status'], type: 'custom' },
        ...shared,
      ],
      optimaviz: [
        { id: 'city', title: 'By city', keys: ['city', 'suburb', 'location'], type: 'custom' },
        { id: 'country', title: 'By country', keys: ['country'], type: 'custom' },
        { id: 'plan', title: 'By plan / category', keys: ['subscription_plan', 'lead_category'], type: 'custom' },
        ...shared,
      ],
      idao: [
        { id: 'city', title: 'By city', keys: ['city', 'suburb'], type: 'custom' },
        { id: 'country', title: 'By country', keys: ['country'], type: 'custom' },
        { id: 'service', title: 'By service type', keys: ['service_type', 'service_focus'], type: 'custom' },
        { id: 'mine', title: 'By mine type', keys: ['mine_type'], type: 'custom' },
        ...shared,
      ],
      nestwise: [
        { id: 'city', title: 'By city', keys: ['city', 'suburb'], type: 'custom' },
        { id: 'property', title: 'By property location', keys: ['property_location', 'owner_location'], type: 'custom' },
        { id: 'property_type', title: 'By property type', keys: ['property_type', 'property_use'], type: 'custom' },
        { id: 'package', title: 'By service package', keys: ['service_package', 'service_interest', 'segment'], type: 'custom' },
        ...shared,
      ],
      optimaclean: [
        { id: 'city', title: 'By city', keys: ['city', 'suburb', 'service_area'], type: 'custom' },
        { id: 'area', title: 'By service area', keys: ['service_area', 'location'], type: 'custom' },
        ...shared,
      ],
    };
    return byBrand[brandId || ''] || [
      { id: 'city', title: 'By city', keys: ['city', 'suburb', 'location'], type: 'custom' },
      ...shared,
      { id: 'services', title: 'By source / service', keys: ['service_category_name', 'source', 'lead_source'], type: 'custom' },
    ];
  };

  const DEFAULT_INTELLIGENCE_BREAKDOWNS = getDefaultIntelligenceBreakdowns();

  const [brandIntelligenceBreakdowns, setBrandIntelligenceBreakdowns] = useState<Record<string, IntelligenceBreakdownConfig[]>>(() => {
    try {
      const stored = safeLocalStorage.getItem('crm_brand_intelligence_breakdowns');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  /** Default insight cards the user explicitly removed — never auto-merge these back. */
  const [deletedIntelligenceIds, setDeletedIntelligenceIds] = useState<Record<string, string[]>>(() => {
    try {
      const stored = safeLocalStorage.getItem('crm_brand_intelligence_deleted_breakdowns');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  const [intelligenceBuilderOpen, setIntelligenceBuilderOpen] = useState(false);
  const [intelligenceForm, setIntelligenceForm] = useState({ title: '', keys: 'city', type: 'custom' });
  const [editingIntelligenceId, setEditingIntelligenceId] = useState('');
  const [insightsExpandedId, setInsightsExpandedId] = useState<string | null>(null);

  useEffect(() => {
    safeLocalStorage.setItem('crm_brand_intelligence_breakdowns', JSON.stringify(brandIntelligenceBreakdowns));
  }, [brandIntelligenceBreakdowns]);

  useEffect(() => {
    safeLocalStorage.setItem('crm_brand_intelligence_deleted_breakdowns', JSON.stringify(deletedIntelligenceIds));
  }, [deletedIntelligenceIds]);

  useEffect(() => {
    safeLocalStorage.setItem('crm_snapshot_cards', JSON.stringify(snapshotCards));
  }, [snapshotCards]);

  const normalizeFieldValue = (val: any): string => {
    if (val === undefined || val === null) return 'Has not filled/blank';
    const s = String(val).trim();
    if (!s || s.toLowerCase() === 'general platform' || s.toLowerCase() === 'general support' || s.toLowerCase() === 'no abn supplied') {
      return 'Has not filled/blank';
    }
    return s;
  };

  const formatColumnLabel = (key: string): string => getColumnFullLabel(key);

  const getBrandBreakdownList = (brandId: string): IntelligenceBreakdownConfig[] => {
    if (Object.prototype.hasOwnProperty.call(brandIntelligenceBreakdowns, brandId)) {
      return brandIntelligenceBreakdowns[brandId] || [];
    }
    return getDefaultIntelligenceBreakdowns(brandId);
  };

  const handleDeleteBreakdown = (id: string) => {
    if (!selectedBrand?.id) return;
    const brandId = selectedBrand.id;
    const current = getBrandBreakdownList(brandId);
    const target = current.find(b => b.id === id);
    if (!target) return;
    if (!window.confirm(`Delete insight "${target.title}"? It will stay removed until you add it again.`)) return;

    setBrandIntelligenceBreakdowns(prev => {
      const next = { ...prev, [brandId]: current.filter(item => item.id !== id) };
      try {
        safeLocalStorage.setItem('crm_brand_intelligence_breakdowns', JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
    setDeletedIntelligenceIds(prev => {
      const next = { ...prev, [brandId]: Array.from(new Set([...(prev[brandId] || []), id])) };
      try {
        safeLocalStorage.setItem('crm_brand_intelligence_deleted_breakdowns', JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
    if (insightsExpandedId === id) setInsightsExpandedId(null);
    showToast(`Removed insight: ${target.title}`);
  };

  const normalizeOptimavizSegmentValue = (value?: any) => {
    const raw = String(value || '').trim();
    const normalized = raw.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const map: Record<string, string> = {
      demo: 'demo_leads',
      demo_lead: 'demo_leads',
      demo_leads: 'demo_leads',
      optimaviz_demo: 'demo_leads',
      optimaviz_demo_lead: 'demo_leads',
      demo_request: 'demo_leads',
      demo_requested: 'demo_leads',
      demo_request_leads: 'demo_leads',
      demo_attended: 'demo_leads',
      trial: 'trial_leads',
      trial_lead: 'trial_leads',
      trial_leads: 'trial_leads',
      free_trial: 'trial_leads',
      active_trial: 'trial_leads',
      trial_expired: 'trial_leads',
      platform_trial: 'trial_leads',
      subscriber: 'subscribed_platform_users',
      subscribers: 'subscribed_platform_users',
      subscribed: 'subscribed_platform_users',
      subscribed_leads: 'subscribed_platform_users',
      subscribed_platform_user: 'subscribed_platform_users',
      subscribed_platform_users: 'subscribed_platform_users',
      platform_user: 'subscribed_platform_users',
      platform_users: 'subscribed_platform_users',
      monthly_subscriber: 'subscribed_platform_users',
      annual_subscriber: 'subscribed_platform_users',
      paid_user: 'subscribed_platform_users',
      customer: 'subscribed_platform_users',
      training: 'training_leads',
      training_lead: 'training_leads',
      training_leads: 'training_leads',
      three_day_training: 'training_leads',
      day_training: 'training_leads',
      day_3_training: 'training_leads',
      three_day_training_leads: 'training_leads',
      training_participant: 'training_leads',
      annual_training: 'training_leads'
    };
    return map[normalized] || (OPTIMAVIZ_SEGMENT_STAGES[normalized] ? normalized : raw);
  };

  const getOptimavizSegmentConfig = (segmentValue?: any) => {
    const normalized = normalizeOptimavizSegmentValue(segmentValue) || 'demo_leads';
    return (BRAND_SEGMENTS.optimaviz || []).find(s => s.value === normalized) || (BRAND_SEGMENTS.optimaviz || [])[0];
  };

  const inferOptimavizSegmentFromStage = (stage?: string) => {
    const normalizedStage = String(stage || '').trim().toLowerCase();
    for (const [segment, stages] of Object.entries(OPTIMAVIZ_SEGMENT_STAGES)) {
      if (stages.some(s => String(s || '').toLowerCase() === normalizedStage)) return segment;
    }
    const stageMap: Record<string, string> = {
      'demo request': 'demo_leads',
      'demo requested': 'demo_leads',
      'demo attended': 'demo_leads',
      'demo scheduled': 'demo_leads',
      'no show': 'demo_leads',
      'trial started': 'trial_leads',
      'active trial': 'trial_leads',
      'trial expired': 'trial_leads',
      'subscriber': 'subscribed_platform_users',
      'monthly subscriber': 'subscribed_platform_users',
      'annual subscriber': 'subscribed_platform_users',
      'training participant': 'training_leads',
      'quote sent': 'training_leads'
    };
    return stageMap[normalizedStage] || 'demo_leads';
  };

  const normalizeOptimavizStageValue = (stage?: string, segmentValue?: any) => {
    const segment = normalizeOptimavizSegmentValue(segmentValue) || inferOptimavizSegmentFromStage(stage);
    const stages = OPTIMAVIZ_SEGMENT_STAGES[segment] || OPTIMAVIZ_SEGMENT_STAGES.demo_leads;
    const raw = String(stage || '').trim();
    const normalized = raw.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const stageMap: Record<string, string> = {
      demo_request: 'Demo Requested',
      demo_requested: 'Demo Requested',
      requested_demo: 'Demo Requested',
      scheduled: 'Demo Scheduled',
      demo_scheduled: 'Demo Scheduled',
      booked_demo: 'Demo Scheduled',
      attended: 'Demo Attended',
      demo_done: 'Demo Attended',
      demo_completed: 'Demo Attended',
      demo_attended: 'Demo Attended',
      no_show: 'No Show / Did Not Attend',
      missed_demo: 'No Show / Did Not Attend',
      did_not_attend: 'No Show / Did Not Attend',
      follow_up: 'Follow-Up Due',
      follow_up_due: 'Follow-Up Due',
      trial: 'Trial Started',
      trial_started: 'Trial Started',
      closed: 'Closed / Not Interested',
      not_interested: 'Closed / Not Interested',
      started: 'Trial Started',
      onboarding: 'Onboarding Sent',
      onboarding_sent: 'Onboarding Sent',
      active: 'Active Trial User',
      active_trial: 'Active Trial User',
      active_trial_user: 'Active Trial User',
      low_activity: 'Low Activity / Needs Follow-Up',
      inactive: 'Low Activity / Needs Follow-Up',
      needs_follow_up: 'Low Activity / Needs Follow-Up',
      ending_soon: 'Trial Ending Soon',
      trial_ending: 'Trial Ending Soon',
      converted: 'Converted to Subscriber',
      converted_to_subscriber: 'Converted to Subscriber',
      paid: 'Converted to Subscriber',
      expired: 'Trial Expired',
      trial_expired: 'Trial Expired',
      subscriber: 'Subscribed',
      customer: 'Subscribed',
      subscribed: 'Subscribed',
      onboarding_progress: 'Onboarding in Progress',
      onboarding_in_progress: 'Onboarding in Progress',
      active_user: 'Active Platform User',
      active_platform_user: 'Active Platform User',
      support: 'Needs Support / Check-In',
      check_in: 'Needs Support / Check-In',
      needs_support: 'Needs Support / Check-In',
      at_risk: 'At Risk',
      risk: 'At Risk',
      renewed: 'Renewed / Expanded',
      expanded: 'Renewed / Expanded',
      upsell: 'Renewed / Expanded',
      cancelled: 'Cancelled',
      canceled: 'Cancelled',
      enquiry: 'Training Enquiry',
      inquiry: 'Training Enquiry',
      training_enquiry: 'Training Enquiry',
      email: 'Email Sent',
      email_sent: 'Email Sent',
      quote: 'Quote Sent',
      quote_sent: 'Quote Sent',
      registered: 'Registered',
      registration_confirmed: 'Registered',
      training_attended: 'Attended',
      post_training: 'Post-Training Follow-Up',
      post_training_follow_up: 'Post-Training Follow-Up'
    };
    const mapped = stageMap[normalized] || raw;
    return stages.find(s => String(s || '').toLowerCase() === mapped.toLowerCase()) || stages[0] || mapped;
  };

  const normalizeIdaoSegmentValue = (value?: any) => {
    const raw = String(value || '').trim();
    const normalized = raw.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const map: Record<string, string> = {
      training: 'training_leads', training_lead: 'training_leads', training_leads: 'training_leads', three_day_training: 'training_leads', day_training: 'training_leads', day_3_training: 'training_leads', annual_training: 'training_leads', early_bird: 'training_leads', training_participant: 'training_leads',
      optimaviz: 'optimaviz_referrals', optimaviz_referral: 'optimaviz_referrals', optimaviz_referrals: 'optimaviz_referrals', optimaviz_demo: 'optimaviz_referrals', demo_referral: 'optimaviz_referrals', platform_referral: 'optimaviz_referrals', trial_interest: 'optimaviz_referrals',
      other: 'other_services', other_services: 'other_services', corporate_training: 'other_services', flotation: 'other_services', flotation_optimisation: 'other_services', flotation_optimization: 'other_services', consulting: 'other_services', advisory: 'other_services'
    };
    return map[normalized] || (IDAO_SEGMENT_STAGES[normalized] ? normalized : raw);
  };

  const inferIdaoSegmentFromStage = (stage?: string) => {
    const normalizedStage = String(stage || '').trim().toLowerCase();
    for (const [segment, stages] of Object.entries(IDAO_SEGMENT_STAGES)) {
      if (stages.some(s => String(s || '').toLowerCase() === normalizedStage)) return segment;
    }
    const stageMap: Record<string, string> = {
      'early bird': 'training_leads', 'quote sent': 'training_leads', 'email sent': 'training_leads', 'training participant': 'training_leads', 'registration confirmed': 'training_leads', 'paid': 'training_leads',
      'demo requested': 'optimaviz_referrals', 'optimaviz referral': 'optimaviz_referrals', 'referred to optimaviz': 'optimaviz_referrals', 'passed to optimaviz': 'optimaviz_referrals',
      'corporate training': 'other_services', 'flotation': 'other_services', 'flotation optimisation': 'other_services', 'flotation optimization': 'other_services'
    };
    return stageMap[normalizedStage] || 'training_leads';
  };

  const normalizeIdaoStageValue = (stage?: string, segmentValue?: any) => {
    const segment = normalizeIdaoSegmentValue(segmentValue) || inferIdaoSegmentFromStage(stage);
    const stages = IDAO_SEGMENT_STAGES[segment] || IDAO_SEGMENT_STAGES.training_leads;
    const raw = String(stage || '').trim();
    const normalized = raw.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const stageMap: Record<string, string> = {
      enquiry: 'Training Enquiry', inquiry: 'Training Enquiry', training_enquiry: 'Training Enquiry', early_bird: 'Quote Sent',
      email: 'Email Sent', email_sent: 'Email Sent', quote_request: 'Quote Requested', quote_requested: 'Quote Requested', quote: 'Quote Sent', quote_sent: 'Quote Sent',
      follow_up: 'Follow-Up Due', follow_up_due: 'Follow-Up Due', called: 'Call Follow-Up', call: 'Call Follow-Up', call_follow_up: 'Call Follow-Up',
      paid: 'Registered', registration_confirmed: 'Registered', registered: 'Registered', confirmed: 'Registered', attended: 'Attended', post_training: 'Post-Training Follow-Up', post_training_follow_up: 'Post-Training Follow-Up',
      interested: 'Interested in Optimaviz', interested_in_optimaviz: 'Interested in Optimaviz', demo_request: 'Demo Requested', demo_requested: 'Demo Requested', optimaviz_demo_requested: 'Demo Requested',
      scheduled: 'Demo Scheduled', demo_scheduled: 'Demo Scheduled', demo_attended: 'Demo Attended', no_show: 'No Show / Did Not Attend', missed_demo: 'No Show / Did Not Attend', did_not_attend: 'No Show / Did Not Attend',
      passed: 'Passed to Optimaviz', referred_to_optimaviz: 'Passed to Optimaviz', passed_to_optimaviz: 'Passed to Optimaviz', trial: 'Trial Started', trial_started: 'Trial Started', closed: 'Closed / Not Interested', not_interested: 'Closed / Not Interested',
      service_enquiry: 'Service Enquiry', needs_discussion: 'Needs Discussion', discussion: 'Needs Discussion', won: 'Won', lost: 'Lost / Not Interested', lost_not_interested: 'Lost / Not Interested'
    };
    const mapped = stageMap[normalized] || raw;
    return stages.find(s => String(s || '').toLowerCase() === mapped.toLowerCase()) || stages[0] || mapped;
  };

  const getIdaoLeadSegment = (lead: Lead) => normalizeIdaoSegmentValue(lead.custom_fields?.segment || lead.custom_fields?.service_type || lead.custom_fields?.service_focus || inferIdaoSegmentFromStage(lead.funnel_stage));
  const getIdaoLeadStage = (lead: Lead) => normalizeIdaoStageValue(lead.funnel_stage, getIdaoLeadSegment(lead));
  const getIdaoStageOptionsForSegment = (segmentValue?: any) => IDAO_SEGMENT_STAGES[normalizeIdaoSegmentValue(segmentValue) || 'training_leads'] || IDAO_SEGMENT_STAGES.training_leads;
  const getIdaoStageOptionsForLead = (lead?: Lead | null) => getIdaoStageOptionsForSegment(lead ? getIdaoLeadSegment(lead) : selectedSegmentFilter !== 'all' ? selectedSegmentFilter : 'training_leads');
  const getIdaoDefaultNextAction = (segmentValue?: any, stage?: string) => {
    const segment = normalizeIdaoSegmentValue(segmentValue) || 'training_leads';
    const normalizedStage = normalizeIdaoStageValue(stage, segment);
    const actionsByStage: Record<string, string> = {
      'Training Enquiry': 'Send Intro Email', 'Email Sent': 'Follow Up Quote', 'Quote Requested': 'Send Quote', 'Quote Sent': 'Follow Up Quote', 'Follow-Up Due': 'Call Lead', 'Call Follow-Up': 'Call Lead', 'Registered': 'Send Training Reminder', 'Attended': 'Post-Training Follow-Up',
      'Interested in Optimaviz': 'Qualify Interest', 'Demo Requested': 'Book Demo', 'Demo Scheduled': 'Send Demo Reminder', 'Demo Attended': 'Pass to Optimaviz', 'No Show / Did Not Attend': 'Rebook Demo', 'Passed to Optimaviz': 'Follow Up After Demo', 'Trial Started': 'Mark Trial Started',
      'Service Enquiry': 'Send Intro Email', 'Needs Discussion': 'Book Discovery Call', 'Won': 'Mark Won', 'Lost / Not Interested': 'Mark Lost'
    };
    return actionsByStage[normalizedStage] || (IDAO_NEXT_ACTIONS[segment] || [])[0] || 'Follow Up';
  };
  const getIdaoFollowUpDateForStage = (segmentValue?: any, stage?: string) => {
    const segment = normalizeIdaoSegmentValue(segmentValue) || 'training_leads';
    const normalizedStage = normalizeIdaoStageValue(stage, segment);
    const rule = (IDAO_FOLLOW_UP_RULES[segment] || []).find(r => r.stage === normalizedStage);
    if (!rule) return '';
    const date = new Date();
    date.setDate(date.getDate() + rule.days);
    return date.toISOString().split('T')[0];
  };

  const getOptimavizLeadSegment = (lead: Lead) => normalizeOptimavizSegmentValue(lead.custom_fields?.segment || inferOptimavizSegmentFromStage(lead.funnel_stage));
  const getOptimavizLeadStage = (lead: Lead) => normalizeOptimavizStageValue(lead.funnel_stage, getOptimavizLeadSegment(lead));
  const getOptimavizStageOptionsForSegment = (segmentValue?: any) => OPTIMAVIZ_SEGMENT_STAGES[normalizeOptimavizSegmentValue(segmentValue) || 'demo_leads'] || OPTIMAVIZ_SEGMENT_STAGES.demo_leads;
  const getOptimavizStageOptionsForLead = (lead?: Lead | null) => getOptimavizStageOptionsForSegment(lead ? getOptimavizLeadSegment(lead) : selectedSegmentFilter !== 'all' ? selectedSegmentFilter : 'demo_leads');
  const getStageOptionsForLead = (lead?: Lead | null) => selectedBrand?.id === 'optimaviz' ? getOptimavizStageOptionsForLead(lead) : selectedBrand?.id === 'idao' ? getIdaoStageOptionsForLead(lead) : getBrandStageOptions(selectedBrand?.id);
  const getStageFilterOptions = () => selectedBrand?.id === 'optimaviz'
    ? (selectedSegmentFilter !== 'all' ? getOptimavizStageOptionsForSegment(selectedSegmentFilter) : Array.from(new Set(Object.values(OPTIMAVIZ_SEGMENT_STAGES).flat())))
    : selectedBrand?.id === 'idao'
      ? (selectedSegmentFilter !== 'all' ? getIdaoStageOptionsForSegment(selectedSegmentFilter) : Array.from(new Set(Object.values(IDAO_SEGMENT_STAGES).flat())))
      : getBrandStageOptions(selectedBrand?.id);

  const getOptimavizDefaultNextAction = (segmentValue?: any, stage?: string) => {
    const segment = normalizeOptimavizSegmentValue(segmentValue) || 'demo_leads';
    const normalizedStage = normalizeOptimavizStageValue(stage, segment);
    const actionsByStage: Record<string, string> = {
      'Demo Requested': 'Schedule Demo',
      'Demo Scheduled': 'Send Demo Reminder',
      'Demo Attended': 'Follow Up After Demo',
      'No Show / Did Not Attend': 'Rebook Demo',
      'Follow-Up Due': 'Call Lead',
      'Trial Started': 'Send Onboarding Email',
      'Onboarding Sent': 'Check Usage',
      'Active Trial User': 'Check Usage',
      'Low Activity / Needs Follow-Up': 'Call Trial User',
      'Trial Ending Soon': 'Push Subscription',
      'Trial Expired': 'Mark Expired',
      'Subscribed': 'Start Onboarding',
      'Onboarding in Progress': 'Schedule Check-In',
      'Active Platform User': 'Schedule Check-In',
      'Needs Support / Check-In': 'Resolve Support Issue',
      'At Risk': 'Schedule Check-In',
      'Training Enquiry': 'Send Email',
      'Email Sent': 'Send Quote',
      'Quote Sent': 'Follow Up Quote',
      'Registered': 'Confirm Registration',
      'Attended': 'Post-Training Follow-Up'
    };
    return actionsByStage[normalizedStage] || (OPTIMAVIZ_NEXT_ACTIONS[segment] || [])[0] || 'Follow Up';
  };

  const getOptimavizFollowUpDateForStage = (segmentValue?: any, stage?: string) => {
    const segment = normalizeOptimavizSegmentValue(segmentValue) || 'demo_leads';
    const normalizedStage = normalizeOptimavizStageValue(stage, segment);
    const rule = (OPTIMAVIZ_FOLLOW_UP_RULES[segment] || []).find(r => r.stage === normalizedStage);
    if (!rule) return '';
    const date = new Date();
    date.setDate(date.getDate() + rule.days);
    return date.toISOString().split('T')[0];
  };

  const getOptimavizTrialInfo = (lead: Lead) => {
    const segment = getOptimavizLeadSegment(lead);
    const stage = getOptimavizLeadStage(lead);
    const explicitStatus = lead.custom_fields?.trial_status;
    const hasTrialData = segment === 'trial_leads' || Boolean(lead.custom_fields?.trial_start_date || lead.custom_fields?.trial_end_date || explicitStatus);
    if (!hasTrialData) {
      return { startStr: '', endStr: '', daysRemaining: 0, status: '', color: 'var(--text-muted)', isExpired: false, isTrialLead: false, progress: 0 };
    }
    const startStr = lead.custom_fields?.trial_start_date || lead.created_at?.split('T')[0] || '';
    const startDate = startStr ? new Date(startStr) : null;
    const endStr = lead.custom_fields?.trial_end_date;
    const endDate = endStr ? new Date(endStr) : (startDate ? new Date(startDate.getTime() + OPTIMAVIZ_TRIAL_DAYS * 24 * 3600 * 1000) : null);
    const today = new Date();
    const rawDays = endDate ? Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 3600 * 24)) : 0;
    const daysRemaining = Math.max(0, rawDays);
    const isExpired = stage === 'Trial Expired' || rawDays < 0 || String(explicitStatus || '').toLowerCase().includes('expired');
    const status = explicitStatus || (isExpired ? 'Trial Expired' : stage === 'Trial Ending Soon' || daysRemaining <= 3 ? 'Trial Ending Soon' : 'Active Trial');
    const color = isExpired ? '#6b7280' : daysRemaining < 3 ? '#ef4444' : daysRemaining <= 6 ? '#f59e0b' : '#10b981';
    const progress = Math.max(0, Math.min(100, ((OPTIMAVIZ_TRIAL_DAYS - daysRemaining) / OPTIMAVIZ_TRIAL_DAYS) * 100));
    return { startStr, endStr: endDate ? endDate.toISOString().split('T')[0] : '', daysRemaining, status, color, isExpired, isTrialLead: true, progress };
  };

  const isOptimavizSubscriber = (lead: Lead) => getOptimavizLeadSegment(lead) === 'subscribed_platform_users' || !!lead.custom_fields?.subscription_plan;
  const isOptimavizDemoAttended = (lead: Lead) => getOptimavizLeadSegment(lead) === 'demo_leads' && getOptimavizLeadStage(lead) === 'Demo Attended';
  const OPTIMAVIZ_STANDARD_CUSTOM_FIELD_COLUMNS = new Set(['segment', 'organisation', 'organization', 'company', 'next_action', 'last_activity', 'assigned_to', 'trial_status', 'days_remaining']);
  const IDAO_STANDARD_CUSTOM_FIELD_COLUMNS = new Set(['segment', 'organisation', 'organization', 'company', 'service_type', 'service_focus', 'next_action', 'last_activity', 'assigned_to']);

  const getTableCustomFields = () => {
    if (selectedBrand?.id === 'optimaviz') {
      return customFields.filter(f => {
        const key = String(f.field_name || '').toLowerCase();
        return !OPTIMAVIZ_REMOVED_TABLE_FIELDS.has(key) && !OPTIMAVIZ_TRIAL_TABLE_FIELDS.has(key) && !OPTIMAVIZ_STANDARD_CUSTOM_FIELD_COLUMNS.has(key);
      });
    }
    if (selectedBrand?.id === 'idao') {
      return customFields.filter(f => {
        const key = String(f.field_name || '').toLowerCase();
        return !IDAO_REMOVED_TABLE_FIELDS.has(key) && !IDAO_STANDARD_CUSTOM_FIELD_COLUMNS.has(key);
      });
    }
    return customFields;
  };

  const getStageColor = (stage?: string) => {
    const value = String(stage || '').toLowerCase();
    if (value.includes('won') || value.includes('registered') || value.includes('subscribed') || value.includes('converted') || value.includes('active')) return '#10b981';
    if (value.includes('lost') || value.includes('cancel') || value.includes('expired') || value.includes('closed') || value.includes('no show')) return '#ef4444';
    if (value.includes('follow') || value.includes('ending') || value.includes('risk') || value.includes('low')) return '#f59e0b';
    if (value.includes('quote') || value.includes('trial') || value.includes('demo')) return '#0f766e';
    return '#155e75';
  };

  // Sync spotlights to localstorage
  useEffect(() => {
    try {
      safeLocalStorage.setItem('crm_brand_spotlights', JSON.stringify(brandSpotlights));
    } catch (e) {
      console.error(e);
    }
  }, [brandSpotlights]);

  useEffect(() => {
    setBrandSpotlights(prev => {
      const currentTaskGo = prev.taskgo || [];
      const taskGoDefaultIds = new Set(['tg-cities', 'tg-services', 'tg-abn', 'tg-coverage', 'tg-support-issues']);
      const hasCurrentDefaults = DEFAULT_SPOTLIGHTS.taskgo.every(s => currentTaskGo.some(existing => existing.id === s.id));
      if (hasCurrentDefaults) return prev;
      const userSpotlights = currentTaskGo.filter(s => !taskGoDefaultIds.has(s.id));
      return {
        ...prev,
        taskgo: [...DEFAULT_SPOTLIGHTS.taskgo, ...userSpotlights]
      };
    });
  }, []);

  // Custom Widgets State
  const [customWidgets, setCustomWidgets] = useState<Record<string, CustomWidget[]>>(() => {
    try {
      const stored = safeLocalStorage.getItem('crm_custom_widgets');
      return stored ? JSON.parse(stored) : DEFAULT_WIDGETS;
    } catch {
      return DEFAULT_WIDGETS;
    }
  });

  const [nestwiseCards, setNestwiseCards] = useState<NestwiseDashboardCard[]>(() => {
    try {
      const stored = safeLocalStorage.getItem('crm_nestwise_dashboard_cards');
      const version = safeLocalStorage.getItem('crm_nestwise_dashboard_version');
      return stored && version === NESTWISE_DASHBOARD_VERSION ? JSON.parse(stored) : DEFAULT_NESTWISE_CARDS;
    } catch {
      return DEFAULT_NESTWISE_CARDS;
    }
  });
  const [nestwiseCardsModalOpen, setNestwiseCardsModalOpen] = useState(false);

  useEffect(() => {
    const version = safeLocalStorage.getItem('crm_nestwise_dashboard_version');
    if (version === NESTWISE_DASHBOARD_VERSION) return;
    setNestwiseCards(DEFAULT_NESTWISE_CARDS);
    setCustomWidgets(prev => ({ ...prev, nestwise: DEFAULT_WIDGETS.nestwise }));
    setSnapshotCards(prev => ({ ...prev, nestwise: DEFAULT_SNAPSHOT_CARDS.nestwise }));
    setBrandSpotlights(prev => ({ ...prev, nestwise: DEFAULT_SPOTLIGHTS.nestwise }));
    safeLocalStorage.setItem('crm_nestwise_dashboard_cards', JSON.stringify(DEFAULT_NESTWISE_CARDS));
    safeLocalStorage.setItem('crm_nestwise_dashboard_version', NESTWISE_DASHBOARD_VERSION);
  }, []);

  // Dashboard section visibility (per-brand, persisted) — lets users hide/show hardcoded sections
  const [dashboardSectionVisibility, setDashboardSectionVisibility] = useState<Record<string, Record<string, boolean>>>(() => {
    try {
      const stored = safeLocalStorage.getItem('crm_dash_section_vis');
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });
  const [dashboardSectionTitles, setDashboardSectionTitles] = useState<Record<string, Record<string, string>>>(() => {
    try {
      const stored = safeLocalStorage.getItem('crm_dash_section_titles');
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });

  const isSectionVisible = (brandId: string, sectionId: string, defaultOn = true) => {
    const brandVis = dashboardSectionVisibility[brandId];
    if (!brandVis || brandVis[sectionId] === undefined) return defaultOn;
    return brandVis[sectionId];
  };

  const getSectionTitle = (brandId: string, sectionId: string, fallback: string) => {
    return dashboardSectionTitles[brandId]?.[sectionId] || fallback;
  };

  const handleRenameSection = (brandId: string, sectionId: string, currentTitle: string) => {
    const nextTitle = window.prompt('Rename this dashboard card', currentTitle);
    if (!nextTitle || !nextTitle.trim()) return;
    setDashboardSectionTitles(prev => ({
      ...prev,
      [brandId]: {
        ...(prev[brandId] || {}),
        [sectionId]: nextTitle.trim()
      }
    }));
    showToast('Card name updated.');
  };

  const toggleSection = (brandId: string, sectionId: string, defaultOn = true) => {
    setDashboardSectionVisibility(prev => {
      const brandVis = prev[brandId] || {};
      const current = brandVis[sectionId] !== undefined ? brandVis[sectionId] : defaultOn;
      return { ...prev, [brandId]: { ...brandVis, [sectionId]: !current } };
    });
  };

  const [widgetModalOpen, setWidgetModalOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState<CustomWidget | null>(null);
  const [widgetForm, setWidgetForm] = useState<{
    title: string;
    criteriaType: 'segment' | 'stage' | 'custom_field';
    criteriaValue: string;
    criteriaOp: 'present' | 'equals' | 'contains' | 'groupby';
    criteriaCompareValue: string;
    countMode: 'records' | 'unique_people' | 'valid_abn' | 'missing_abn';
    icon: string;
    color: string;
    goal: number | '';
  }>({
    title: '',
    criteriaType: 'segment',
    criteriaValue: '',
    criteriaOp: 'present',
    criteriaCompareValue: '',
    countMode: 'records',
    icon: 'fa-chart-pie',
    color: '#3B82F6',
    goal: ''
  });

  // Filtering & Column Visibility
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStageFilter, setSelectedStageFilter] = useState<string>('all');
  // Keep active workspace tab snapshot in sync with filters while working
  useEffect(() => {
    if (!activeWorkspaceTab || workspaceSwitchLock.current) return;
    saveWorkspaceTabSnapshot(activeWorkspaceTab.id, {
      brandSubTab,
      searchQuery,
      selectedStageFilter,
      selectedSegmentFilter,
      selectedCityFilter,
      selectedDateWindow,
    });
  }, [brandSubTab, searchQuery, selectedStageFilter, selectedSegmentFilter, selectedCityFilter, selectedDateWindow]);
  const [selectedCustomFieldFilter, setSelectedCustomFieldFilter] = useState<{ field: string; value: string } | null>(null);
  /** How CRM matches are handled on import: skip | merge into existing | create new record. */
  type DuplicateImportStrategy = 'skip' | 'merge' | 'create';
  const [duplicateImportStrategy, setDuplicateImportStrategy] = useState<DuplicateImportStrategy>('skip');
  /** Optional segment applied only when handling CRM matches (returning customer / new product). */
  const [duplicateCreateSegment, setDuplicateCreateSegment] = useState('');
  /** Per-row override for CRM/file duplicates (defaults to global strategy). */
  const [rowDuplicateActions, setRowDuplicateActions] = useState<Record<number, DuplicateImportStrategy>>({});
  /** Which cleanup card is expanded for review/compare. */
  const [importCleanupFocus, setImportCleanupFocus] = useState<'missingName' | 'missingEmail' | 'missingPhone' | 'fileDups' | 'crmDups' | 'taskgoAbn' | null>(null);
  const [confirmDuplicateImport, setConfirmDuplicateImport] = useState(false);
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  type ImportDupDetail = {
    rowIndex: number;
    kind: 'file' | 'crm';
    message: string;
    fileName: string;
    fileEmail: string;
    filePhone: string;
    fileDupOfRow?: number;
    matchLeadId?: string;
    matchLeadName?: string;
    matchBrand?: string;
    matchStage?: string;
    matchEmail?: string;
    matchPhone?: string;
    matchSegment?: string;
  };
  const [duplicatesAnalysis, setDuplicatesAnalysis] = useState<{
    fileDuplicates: Set<number>;
    crmDuplicates: Set<number>;
    duplicateCount: number;
    details: ImportDupDetail[];
  }>({ fileDuplicates: new Set(), crmDuplicates: new Set(), duplicateCount: 0, details: [] });
  const [selectedImportColumns, setSelectedImportColumns] = useState<Set<string>>(new Set());
  const [columnVisibility, setColumnVisibility] = useState<Set<string>>(new Set());
  const [columnOrderVersion, setColumnOrderVersion] = useState(0);
  const [sortConfig, setSortConfig] = useState<{ col: string | null; dir: 'asc' | 'desc' }>({ col: 'created_at', dir: 'desc' });
  const [savedViews, setSavedViews] = useState<Record<string, SavedLeadView[]>>(() => {
    try { return JSON.parse(safeLocalStorage.getItem('crm_saved_views') || '{}'); } catch { return {}; }
  });
  const [savedViewName, setSavedViewName] = useState('');
  const [mergeGroup, setMergeGroup] = useState<Lead[] | null>(null);
  const [mergePrimaryId, setMergePrimaryId] = useState('');

  // Filtering Duplicates and Delete Confirmations
  const [showOnlyDuplicates, setShowOnlyDuplicates] = useState(false);
  // New UI flags
  const [showBreakdowns, setShowBreakdowns] = useState(true);
  const [includeDuplicates, setIncludeDuplicates] = useState(false);
  const [deleteConfirmState, setDeleteConfirmState] = useState(false);
  const [confirmDeleteNoteId, setConfirmDeleteNoteId] = useState<string | null>(null);
  const [confirmDeleteEmailId, setConfirmDeleteEmailId] = useState<string | null>(null);
  const [confirmDeleteWaId, setConfirmDeleteWaId] = useState<string | null>(null);
  const [confirmDeleteCustomField, setConfirmDeleteCustomField] = useState<string | null>(null);
  const [confirmDeleteSequenceId, setConfirmDeleteSequenceId] = useState<string | null>(null);
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<string | null>(null);

  // Detail Side Panel for matching lead
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [leadDetailTab, setLeadDetailTab] = useState<'overview' | 'activity' | 'communication'>('overview');
  const [lastViewedLead, setLastViewedLead] = useState<Lead | null>(null);
  const [quickCallOpen, setQuickCallOpen] = useState(false);
  const [quickCallSaving, setQuickCallSaving] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [keyboardHelpOpen, setKeyboardHelpOpen] = useState(false);
  const [activeProductView, setActiveProductView] = useState<string | null>(null);
  const [leadAuditEvents, setLeadAuditEvents] = useState<Array<{ id: string; event_type: string; user_name?: string; created_at: string; metadata?: any }>>([]);
  const [setupGuideCollapsed, setSetupGuideCollapsed] = useState(() => safeLocalStorage.getItem('lujunal_operations_setup_guide_collapsed') === 'true');
  const [portfolioOpportunities, setPortfolioOpportunities] = useState<any[]>([]);
  const [portfolioRules, setPortfolioRules] = useState<any[]>([]);
  const [portfolioCounts, setPortfolioCounts] = useState({ pending: 0, accepted: 0, dismissed: 0 });
  const [portfolioForm, setPortfolioForm] = useState({
    name: '',
    source_brand_id: '',
    target_brand_id: '',
    trigger_field: 'funnel_stage',
    trigger_value: '',
    required_keywords: '',
    excluded_keywords: '',
    respect_market_scope: true,
    max_results_per_scan: 10,
    offer_label: '',
  });
  const [portfolioSaving, setPortfolioSaving] = useState(false);
  const [portfolioCollapsed, setPortfolioCollapsed] = useState(() => safeLocalStorage.getItem('lujunal_operations_portfolio_collapsed') === 'true');
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const [notificationDrawerSnapshot, setNotificationDrawerSnapshot] = useState<Array<{
    label: string;
    value: number;
    icon: string;
    tone?: string;
    color?: string;
    action: () => void;
  }>>([]);
  const [seenNotificationSignature, setSeenNotificationSignature] = useState(() => safeLocalStorage.getItem('crm_seen_notification_signature') || '');
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState<Set<string>>(() => {
    try {
      return new Set<string>((safeLocalStorage.getItem('crm_dismissed_notification_ids') || '').split(',').filter(Boolean));
    } catch {
      return new Set<string>();
    }
  });
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(() => {
    try {
      return normalizeNotificationPreferences(JSON.parse(safeLocalStorage.getItem('crm_notification_preferences') || 'null'));
    } catch {
      return DEFAULT_NOTIFICATION_PREFERENCES;
    }
  });
  const notificationPreferencesRef = useRef(notificationPreferences);
  notificationPreferencesRef.current = notificationPreferences;
  const [hoveredLeadId, setHoveredLeadId] = useState<string | null>(null);
  const getNotificationItemKey = (item: { label: string; value: number }) => `${encodeURIComponent(item.label)}:${Number(item.value || 0)}`;
  const getDismissedNotificationLimit = (item: { label: string; value: number }, dismissedIds = dismissedNotificationIds) => {
    let highestDismissed = 0;
    dismissedIds.forEach(key => {
      const separatorIndex = key.lastIndexOf(':');
      if (separatorIndex < 0) return;
      const rawLabel = key.slice(0, separatorIndex);
      const value = Number(key.slice(separatorIndex + 1) || 0);
      let decodedLabel = rawLabel;
      try {
        decodedLabel = decodeURIComponent(rawLabel);
      } catch {
        decodedLabel = rawLabel;
      }
      if ((decodedLabel === item.label || rawLabel === item.label) && Number.isFinite(value)) {
        highestDismissed = Math.max(highestDismissed, value);
      }
    });
    return highestDismissed;
  };
  const isNotificationItemDismissed = (item: { label: string; value: number }, dismissedIds = dismissedNotificationIds) => {
    const currentValue = Number(item.value || 0);
    return currentValue > 0 && getDismissedNotificationLimit(item, dismissedIds) >= currentValue;
  };
  const isNotificationCategoryEnabled = (label: string, prefs = notificationPreferences) => {
    const category = getNotificationCategory(label);
    if (!category) return true;
    return prefs.enabled[category] !== false;
  };
  const isNotificationCategoryCritical = (label: string, prefs = notificationPreferences) => {
    const category = getNotificationCategory(label);
    if (!category) return false;
    return prefs.critical[category] === true;
  };

  const applyRemoteNotificationState = (currentUser: User | null) => {
    const state = currentUser?.notification_state;
    if (!state) return;
    if (typeof state.seen_signature === 'string') {
      setSeenNotificationSignature(state.seen_signature);
      safeLocalStorage.setItem('crm_seen_notification_signature', state.seen_signature);
    }
    if (Array.isArray(state.dismissed_ids)) {
      const next = new Set<string>(state.dismissed_ids.filter(Boolean));
      setDismissedNotificationIds(next);
      safeLocalStorage.setItem('crm_dismissed_notification_ids', Array.from(next).join(','));
    }
    if (state.preferences) {
      const prefs = normalizeNotificationPreferences(state.preferences);
      setNotificationPreferences(prefs);
      safeLocalStorage.setItem('crm_notification_preferences', JSON.stringify(prefs));
    }
  };

  const persistNotificationState = async (
    seenSignature = seenNotificationSignature,
    dismissedIds = dismissedNotificationIds,
    preferences = notificationPreferencesRef.current,
  ) => {
    try {
      await axios.put('/api/auth/me/notification-state', {
        seen_signature: seenSignature,
        dismissed_ids: Array.from(dismissedIds),
        preferences,
      });
    } catch (err) {
      console.error('Failed to save notification state:', err);
    }
  };

  // notificationSignature / communicationHealthItems are declared later — use refs.
  const notificationSignatureRef = useRef('');
  const communicationHealthItemsRef = useRef<Array<{ label: string; value: number }>>([]);

  const markNotificationsSeen = useCallback((options?: { forceAll?: boolean; items?: Array<{ label: string; value: number }> }) => {
    const signature = notificationSignatureRef.current;
    const items = options?.items || communicationHealthItemsRef.current;
    const prefs = notificationPreferencesRef.current;
    setSeenNotificationSignature(signature);
    safeLocalStorage.setItem('crm_seen_notification_signature', signature);
    setDismissedNotificationIds(prev => {
      const next = new Set(prev);
      items.forEach((item) => {
        if (!item?.label || !(Number(item.value) > 0)) return;
        // Opening the drawer / "clear" silences normal alerts.
        // Critical categories keep alerting unless the user force-clears or manually dismisses.
        if (!options?.forceAll && isNotificationCategoryCritical(item.label, prefs)) return;
        next.add(getNotificationItemKey(item));
      });
      safeLocalStorage.setItem('crm_dismissed_notification_ids', Array.from(next).join(','));
      persistNotificationState(signature, next, prefs);
      return next;
    });
  }, []);

  const markAllNotificationsSeen = useCallback(() => {
    markNotificationsSeen({ forceAll: true });
  }, [markNotificationsSeen]);
  const markAllNotificationsSeenRef = useRef(markAllNotificationsSeen);
  markAllNotificationsSeenRef.current = markAllNotificationsSeen;
  const hasMarkedNotificationsSeenRef = useRef(false);

  const dismissNotificationItem = useCallback((label: string, value: number) => {
    const key = getNotificationItemKey({ label, value });
    setDismissedNotificationIds(prev => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      safeLocalStorage.setItem('crm_dismissed_notification_ids', Array.from(next).join(','));
      persistNotificationState(notificationSignatureRef.current, next, notificationPreferencesRef.current);
      return next;
    });
  }, []);

  const undismissNotificationItem = useCallback((label: string, value: number) => {
    const key = getNotificationItemKey({ label, value });
    setDismissedNotificationIds(prev => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      safeLocalStorage.setItem('crm_dismissed_notification_ids', Array.from(next).join(','));
      persistNotificationState(notificationSignatureRef.current, next, notificationPreferencesRef.current);
      return next;
    });
  }, []);

  const updateNotificationPreferences = useCallback((next: NotificationPreferences) => {
    const prefs = normalizeNotificationPreferences(next);
    setNotificationPreferences(prefs);
    notificationPreferencesRef.current = prefs;
    safeLocalStorage.setItem('crm_notification_preferences', JSON.stringify(prefs));
    persistNotificationState(notificationSignatureRef.current, dismissedNotificationIds, prefs);
  }, [dismissedNotificationIds]);
  const [leadNotes, setLeadNotes] = useState<Note[]>([]);
  const [leadCalls, setLeadCalls] = useState<CallLog[]>([]);
  const [allCallLogs, setAllCallLogs] = useState<CallLog[]>([]);
  const [leadEmails, setLeadEmails] = useState<EmailLog[]>([]);
  const [leadWhatsApp, setLeadWhatsApp] = useState<WhatsAppLog[]>([]);
  const [leadActivityFilter, setLeadActivityFilter] = useState<'all' | 'note' | 'call' | 'email' | 'whatsapp'>('all');
  const [newNoteText, setNewNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);

  // Communications Log Modal
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [directEmailOpen, setDirectEmailOpen] = useState(false);
  const [directEmailTo, setDirectEmailTo] = useState('');
  const [directEmailName, setDirectEmailName] = useState('');
  const emailAttachmentInputRef = useRef<HTMLInputElement | null>(null);
  const [emailAttachments, setEmailAttachments] = useState<File[]>([]);

  // whatsapp layout
  const [waModalOpen, setWaModalOpen] = useState(false);
  const [waMessage, setWaMessage] = useState('');
  const [waSending, setWaSending] = useState(false);

  const DEFAULT_WHATSAPP_NUMBERS: Record<string, string> = { optimaviz: '', taskgo: '', idao: '', optimaclean: '', nestwise: '' };
  const [selectedBrandForWhatsApp, setSelectedBrandForWhatsApp] = useState<Brand>(activeBrands[0] || BRANDS[0]);
  const [activeWhatsAppLead, setActiveWhatsAppLead] = useState<Lead | null>(null);
  const [allWhatsAppMessages, setAllWhatsAppMessages] = useState<WhatsAppLog[]>([]);
  const [whatsappNumbers, setWhatsappNumbers] = useState<Record<string, string>>(DEFAULT_WHATSAPP_NUMBERS);
  const [whatsappTemplates, setWhatsappTemplates] = useState<WhatsAppTemplate[]>([]);
  const [waDashboardMessage, setWaDashboardMessage] = useState('');
  const [directWhatsAppOpen, setDirectWhatsAppOpen] = useState(false);
  const [directWhatsAppNumber, setDirectWhatsAppNumber] = useState('');
  const [directWhatsAppName, setDirectWhatsAppName] = useState('');
  const [waContactSearch, setWaContactSearch] = useState('');
  const [waContactPickerOpen, setWaContactPickerOpen] = useState(false);
  const [waPickerSearch, setWaPickerSearch] = useState('');
  const [waPickerSelectedIds, setWaPickerSelectedIds] = useState<Set<string>>(new Set());
  const [waTemplateSel, setWaTemplateSel] = useState('');
  const [waSavingSettings, setWaSavingSettings] = useState(false);
  const [waTemplateEditingId, setWaTemplateEditingId] = useState<string | null>(null);
  const [waTemplateName, setWaTemplateName] = useState('');
  const [waTemplateMessage, setWaTemplateMessage] = useState('');

  // dialler logger
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [callOutcome, setCallOutcome] = useState('Connected');
  const [callNotes, setCallNotes] = useState('');
  const [callDuration, setCallDuration] = useState(60);
  const [callSaving, setCallSaving] = useState(false);

  // CRM Modals
  const [addLeadIsOpen, setAddLeadIsOpen] = useState(false);
  const [addLeadStep, setAddLeadStep] = useState<'segment' | 'form'>('segment');
  const [addLeadForm, setAddLeadForm] = useState({ name: '', email: '', phone: '', funnel_stage: '', notes: '', segment: '', owner_id: '', owner_name: '' });
  const [addLeadCustomFieldValues, setAddLeadCustomFieldValues] = useState<Record<string, string>>({});
  const [leadAdding, setLeadAdding] = useState(false);

  // Bulk Upload Modal
  const [uploadIsOpen, setUploadIsOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [csvPreview, setCsvPreview] = useState<{ headers: string[]; preview: Record<string, string>[]; totalRows: number } | null>(null);
  const [csvMapping, setCsvMapping] = useState<Record<string, string>>({ name: '', name_secondary: '', email: '', phone: '', created_at: '' });
  const [csvImportingStage, setCsvImportingStage] = useState('');
  const [csvImportingSegment, setCsvImportingSegment] = useState('');
  const [csvImporting, setCsvImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ value: number; label: string } | null>(null);
  const [fileName, setFileName] = useState('');
  const [suggestedCols, setSuggestedCols] = useState<string[]>([]);
  const [selectedSuggestedCols, setSelectedSuggestedCols] = useState<Set<string>>(new Set());
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);
  /** Multi-sheet Excel workbook kept in memory so users can switch sheets without re-uploading. */
  const [excelWorkbookSheets, setExcelWorkbookSheets] = useState<ExcelSheetRaw[] | null>(null);
  const [excelSheetMetas, setExcelSheetMetas] = useState<ExcelSheetMeta[]>([]);
  const [selectedExcelSheetIndex, setSelectedExcelSheetIndex] = useState(0);
  const [importLeadDestination, setImportLeadDestination] = useState<'verified' | 'prospect'>('prospect');
  /** Coalesce rapid axios upload progress events onto one rAF paint to avoid modal flicker. */
  const importProgressRafRef = useRef<number | null>(null);
  const pendingImportProgressRef = useRef<{ value: number; label: string } | null>(null);
  const lastImportProgressValueRef = useRef(-1);
  const lastImportProgressLabelRef = useRef('');
  const excelFileInputRef = useRef<HTMLInputElement | null>(null);

  const setImportProgressSmooth = useCallback((next: { value: number; label: string } | null) => {
    if (next == null) {
      if (importProgressRafRef.current != null) {
        cancelAnimationFrame(importProgressRafRef.current);
        importProgressRafRef.current = null;
      }
      pendingImportProgressRef.current = null;
      lastImportProgressValueRef.current = -1;
      lastImportProgressLabelRef.current = '';
      setImportProgress(null);
      return;
    }
    const rounded = Math.max(0, Math.min(100, Math.round(next.value)));
    if (
      rounded === lastImportProgressValueRef.current &&
      next.label === lastImportProgressLabelRef.current
    ) {
      return;
    }
    pendingImportProgressRef.current = { value: rounded, label: next.label };
    if (importProgressRafRef.current != null) return;
    importProgressRafRef.current = requestAnimationFrame(() => {
      importProgressRafRef.current = null;
      const pending = pendingImportProgressRef.current;
      if (!pending) return;
      lastImportProgressValueRef.current = pending.value;
      lastImportProgressLabelRef.current = pending.label;
      setImportProgress(pending);
    });
  }, []);

  const clearExcelFileInput = useCallback(() => {
    if (excelFileInputRef.current) {
      excelFileInputRef.current.value = '';
      return;
    }
    const input = document.getElementById('excel-file-input') as HTMLInputElement | null;
    if (input) input.value = '';
  }, []);

  /** Full clean slate for the import wizard (close, Done, Cancel, or reopen). */
  const resetImportModalState = useCallback(() => {
    if (importProgressRafRef.current != null) {
      cancelAnimationFrame(importProgressRafRef.current);
      importProgressRafRef.current = null;
    }
    pendingImportProgressRef.current = null;
    lastImportProgressValueRef.current = -1;
    lastImportProgressLabelRef.current = '';
    setFileName('');
    setCsvText('');
    setCsvPreview(null);
    setParsedRows([]);
    setExcelWorkbookSheets(null);
    setExcelSheetMetas([]);
    setSelectedExcelSheetIndex(0);
    setImportError(null);
    setImportSuccessMessage(null);
    setImportProgress(null);
    setCsvMapping({ name: '', name_secondary: '', email: '', phone: '', created_at: '' });
    setSelectedImportColumns(new Set());
    setSelectedSuggestedCols(new Set());
    setSuggestedCols([]);
    setRowDuplicateActions({});
    setImportCleanupFocus(null);
    setDuplicateCreateSegment('');
    setDuplicateImportStrategy('skip');
    setConfirmDuplicateImport(false);
    setCsvImporting(false);
    setCsvImportingStage('');
    setCsvImportingSegment('');
    setImportLeadDestination('prospect');
    setIsDragOver(false);
    clearExcelFileInput();
  }, [clearExcelFileInput]);

  const openImportModal = useCallback(() => {
    resetImportModalState();
    setUploadIsOpen(true);
  }, [resetImportModalState]);

  const closeImportModal = useCallback(() => {
    setUploadIsOpen(false);
    // Defer wipe so the close animation does not flash empty mid-frame.
    requestAnimationFrame(() => resetImportModalState());
  }, [resetImportModalState]);

  // Custom Columns Manager
  const [manageColsIsOpen, setManageColsIsOpen] = useState(false);
  const [leadBadgesSettingsOpen, setLeadBadgesSettingsOpen] = useState(false);
  const [leadBadgeSettings, setLeadBadgeSettings] = useState<BrandLeadBadgeSettings | null>(null);
  const [newColName, setNewColName] = useState('');
  const [newColType, setNewColType] = useState<'text' | 'number' | 'boolean' | 'date'>('text');
  const [newColRequired, setNewColRequired] = useState(false);
  const [colSaving, setColSaving] = useState(false);
  const [editingColumnId, setEditingColumnId] = useState('');
  const [editFormHighlight, setEditFormHighlight] = useState(false);
  const editFormRef = useRef<HTMLDivElement>(null);

  // Auto Sequences modal
  const [seqModalIsOpen, setSeqModalIsOpen] = useState(false);
  const [seqForm, setSeqForm] = useState<{ id?: string; name: string; description: string; trigger_stage: string; active: boolean; steps: Omit<SequenceStep, 'id'>[] }>({
    name: '',
    description: '',
    trigger_stage: 'New Lead',
    active: true,
    steps: []
  });
  const [seqSaving, setSeqSaving] = useState(false);

  // Bulk Enroll Modal
  const [enrollModalOpen, setEnrollModalOpen] = useState(false);
  const [enrollSequenceId, setEnrollSequenceId] = useState('');
  const [selectedLeadsEnroll, setSelectedLeadsEnroll] = useState<Set<string>>(new Set());
  const [enrollSaving, setEnrollSaving] = useState(false);

  // Call Center Page State
  const [diallerLead, setDiallerLead] = useState<Lead | null>(null);
  const [isCalling, setIsCalling] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);
  const [selectedBrandForCalls, setSelectedBrandForCalls] = useState<Brand>(activeBrands[0] || BRANDS[0]);
  const [callStageFilter, setCallStageFilter] = useState<string>('all');
  const [activeCallLead, setActiveCallLead] = useState<Lead | null>(null);
  const [callFollowUpDate, setCallFollowUpDate] = useState('');

  // User Management
  const [usersList, setUsersList] = useState<User[]>([]);
  const [selectedUserManagementId, setSelectedUserManagementId] = useState('');
  const [addUserIsOpen, setAddUserIsOpen] = useState(false);
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'user', allowed_brand_ids: [] as string[] });
  const [showAddUserPassword, setShowAddUserPassword] = useState(false);
  const [userSaving, setUserSaving] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [mobileBrandPickerOpen, setMobileBrandPickerOpen] = useState(false);
  const [profilePicture, setProfilePicture] = useState<string>(() => safeLocalStorage.getItem('crm_user_picture') || '');
  const [profileName, setProfileName] = useState<string>('');
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmNewPw, setConfirmNewPw] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmNewPw, setShowConfirmNewPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState('');

  useEffect(() => {
    if (!user?.id) return;
    const serverPicture = user.profile_picture_url || user.profile_picture || user.avatar_url || user.picture_url || '';
    const devicePicture = safeLocalStorage.getItem(`crm_user_picture_${user.id}`) || safeLocalStorage.getItem('crm_user_picture') || '';
    const nextPicture = serverPicture || devicePicture;
    setProfilePicture(nextPicture);
    if (nextPicture) safeLocalStorage.setItem(`crm_user_picture_${user.id}`, nextPicture);
  }, [user?.id, user?.profile_picture_url, user?.profile_picture, user?.avatar_url, user?.picture_url]);

  // Team Tasks & Dynamic Operational Log Stream
  const [tasks, setTasks] = useState<Task[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [taskContent, setTaskContent] = useState('');
  const [taskStatus, setTaskStatus] = useState<'In Progress' | 'Completed' | 'Pending' | 'Needs Help'>('In Progress');
  const [selectedTaskDate, setSelectedTaskDate] = useState<string>(''); // YYYY-MM-DD format
  const [taskPosting, setTaskPosting] = useState(false);
  const [teamMessages, setTeamMessages] = useState<TeamMessage[]>([]);
  const [teamNotes, setTeamNotes] = useState<TeamNote[]>([]);
  const [teamNoteOpen, setTeamNoteOpen] = useState(false);
  const [userNotesOpen, setUserNotesOpen] = useState(false);
  const [editingTeamNote, setEditingTeamNote] = useState<TeamNote | null>(null);
  const [teamNoteTitle, setTeamNoteTitle] = useState('');
  const [teamNoteContent, setTeamNoteContent] = useState('');
  const [teamNotePinned, setTeamNotePinned] = useState(false);
  const [teamNoteSaving, setTeamNoteSaving] = useState(false);
  const [teamMessageText, setTeamMessageText] = useState('');
  const [activeTeamDmId, setActiveTeamDmId] = useState('all');
  const [teamDmSearch, setTeamDmSearch] = useState('');
  const [teamUnreadOnly, setTeamUnreadOnly] = useState(false);
  const [teamPresenceStatus, setTeamPresenceStatus] = useState<'online' | 'away' | 'offline'>(() => (safeLocalStorage.getItem('crm_team_presence_status') as 'online' | 'away' | 'offline') || 'online');
  const [teamRecipientId, setTeamRecipientId] = useState('all');
  const [teamChatSubTab, setTeamChatSubTab] = useState<'messages' | 'files'>('messages');
  const [teamReadState, setTeamReadState] = useState<Record<string, string>>(() => {
    try { return JSON.parse(safeLocalStorage.getItem('crm_team_chat_read_state') || '{}'); } catch { return {}; }
  });
  const [teamFiles, setTeamFiles] = useState<File[]>([]);
  const [teamPosting, setTeamPosting] = useState(false);
  const [teamCallOpen, setTeamCallOpen] = useState(false);
  const [teamCallDocked, setTeamCallDocked] = useState(false);
  const [teamCallMovedToTab, setTeamCallMovedToTab] = useState(false);
  const [teamCallRoomSlug, setTeamCallRoomSlug] = useState('');
  const [teamCallTitle, setTeamCallTitle] = useState('Team call');
  const [teamCallLoading, setTeamCallLoading] = useState(false);
  const [teamCallError, setTeamCallError] = useState('');
  const [incomingTeamCall, setIncomingTeamCall] = useState<TeamMessage | null>(null);
  const teamCallExternalWindowRef = useRef<Window | null>(null);
  const {
    dockStyle: teamCallDockStyle,
    beginMove: beginTeamCallDockMove,
    beginResize: beginTeamCallDockResize,
    resetToDefaultCorner: resetTeamCallDockCorner,
  } = useTeamCallDockLayout(user?.id);
  const teamTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const teamStreamRef = useRef<HTMLDivElement | null>(null);
  const teamEndRef = useRef<HTMLDivElement | null>(null);
  const teamCallContainerRef = useRef<HTMLDivElement | null>(null);
  const teamCallApiRef = useRef<any>(null);
  const endedTeamCallRoomsRef = useRef<Set<string>>(new Set());
  const incomingCallAudioRef = useRef<HTMLAudioElement | null>(null);

  // Email Campaign Tracking & Softsender
  const [selectedBrandForEmail, setSelectedBrandForEmail] = useState<Brand>(activeBrands[0] || BRANDS[0]);
  const [emailStageFilter, setEmailStageFilter] = useState<string>('all');
  const [activeEmailLead, setActiveEmailLead] = useState<Lead | null>(null);
  const [allSentEmails, setAllSentEmails] = useState<EmailLog[]>([]);
  const [emailTemplateSel, setEmailTemplateSel] = useState('');
  const [emailContent, setEmailContent] = useState('');
  const [selectedEmailLogId, setSelectedEmailLogId] = useState('');
  const [selectedMailboxEmailIds, setSelectedMailboxEmailIds] = useState<Set<string>>(new Set());
  const [emailMailboxFilter, setEmailMailboxFilter] = useState<'all' | 'action' | 'today' | 'overdue' | 'inbox' | 'sent' | 'drafts' | 'spam' | 'trash' | 'failed'>('all');
  const [emailSearchQuery, setEmailSearchQuery] = useState('');
  const [emailPage, setEmailPage] = useState(1);
  const [emailReplyBody, setEmailReplyBody] = useState('');
  const [emailProviderMode, setEmailProviderMode] = useState<'internal' | 'gmail' | 'outlook' | 'yahoo' | 'smtp'>('gmail');
  const [emailProviderFilter, setEmailProviderFilter] = useState<'all' | 'gmail' | 'outlook' | 'yahoo' | 'smtp' | 'internal'>('all');
  const [selectedEmailAccountId, setSelectedEmailAccountId] = useState('');
  const [brandIntegrations, setBrandIntegrations] = useState<BrandIntegration[]>([]);
  const [emailConnections, setEmailConnections] = useState<EmailConnection[]>([]);
  const [disconnectedEmailAlerts, setDisconnectedEmailAlerts] = useState<Array<{ id: string; brandId: string; provider: string; email: string; brandName: string }>>([]);
  const [integrationBrandId, setIntegrationBrandId] = useState((activeBrands[0] || BRANDS[0]).id);
  const [integrationForm, setIntegrationForm] = useState<BrandIntegration>({
    brand_id: (activeBrands[0] || BRANDS[0]).id,
    email_provider: 'internal',
    email_sender_name: '',
    email_sender_address: '',
    email_reply_to: '',
    email_logo_url: '',
    email_signature: '',
    smtp_host: '',
    smtp_port: '',
    smtp_secure: false,
    smtp_username: '',
    smtp_password_env: '',
    email_accounts: [],
    whatsapp_provider: 'manual',
    whatsapp_number: '',
    whatsapp_phone_number_id: '',
    whatsapp_business_account_id: '',
    whatsapp_access_token_env: '',
    whatsapp_verify_token: '',
    call_provider: 'manual',
    call_number: '',
    automation_enabled: false
  });
  const [integrationSaving, setIntegrationSaving] = useState(false);
  const [integrationChecking, setIntegrationChecking] = useState(false);
  const [integrationStatus, setIntegrationStatus] = useState<any>(null);
  const [whatsappConnecting, setWhatsAppConnecting] = useState(false);
  const [whatsappDisconnectConfirm, setWhatsAppDisconnectConfirm] = useState(false);
  const [activeIntegrationChannel, setActiveIntegrationChannel] = useState<'email' | 'whatsapp' | 'call' | 'leads' | 'traffic'>('leads');
  const [leadSources, setLeadSources] = useState<LeadSource[]>([]);
  const [leadSourceLogs, setLeadSourceLogs] = useState<LeadSourceLog[]>([]);
  const [leadSourceSaving, setLeadSourceSaving] = useState(false);
  const [leadSourceForm, setLeadSourceForm] = useState({
    name: '',
    provider: 'website',
    default_stage: 'New Lead',
    duplicate_strategy: 'update_existing',
    unmapped_field_strategy: 'auto',
  });
  const [websiteAnalyticsSites, setWebsiteAnalyticsSites] = useState<WebsiteAnalyticsSite[]>([]);
  const [websiteAnalyticsSummary, setWebsiteAnalyticsSummary] = useState<WebsiteAnalyticsSummary | null>(null);
  const [websiteAnalyticsSaving, setWebsiteAnalyticsSaving] = useState(false);
  const [websiteAnalyticsForm, setWebsiteAnalyticsForm] = useState({ name: '', domain: '' });
  const [dashboardTrafficSiteId, setDashboardTrafficSiteId] = useState('all');
  const [gmailStatus, setGmailStatus] = useState<any>(null);
  const [outlookStatus, setOutlookStatus] = useState<any>(null);
  const [gmailConnecting, setGmailConnecting] = useState(false);
  const [gmailTesting, setGmailTesting] = useState(false);
  const [gmailSyncing, setGmailSyncing] = useState(false);
  const [outlookSyncing, setOutlookSyncing] = useState(false);
  const [customMailboxSyncing, setCustomMailboxSyncing] = useState(false);
  const [gmailTestRecipient, setGmailTestRecipient] = useState('');
  const [customMailboxOpen, setCustomMailboxOpen] = useState(false);
  const [customMailboxSaving, setCustomMailboxSaving] = useState(false);
  const [customMailboxForm, setCustomMailboxForm] = useState({
    provider_preset: 'cpanel',
    provider_email: '',
    display_name: '',
    smtp_host: '',
    smtp_port: '465',
    smtp_secure: true,
    smtp_username: '',
    smtp_password: '',
    imap_host: '',
    imap_port: '993',
    imap_secure: true,
    imap_username: '',
  });
  const [messageTemplates, setMessageTemplates] = useState<MessageTemplate[]>([]);
  const [templateForm, setTemplateForm] = useState<{ id?: string; brand_id: string; channel: 'email' | 'whatsapp' | 'call'; name: string; subject: string; body: string }>({
    brand_id: (activeBrands[0] || BRANDS[0]).id,
    channel: 'email',
    name: '',
    subject: '',
    body: ''
  });

  useEffect(() => {
    setSelectedMailboxEmailIds(new Set());
  }, [emailMailboxFilter, emailProviderFilter, emailSearchQuery, selectedBrandForEmail?.id]);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [dashboardDensity, setDashboardDensity] = useState<'comfortable' | 'compact'>(() => (safeLocalStorage.getItem('crm_table_density') as 'comfortable' | 'compact') || 'comfortable');
  const [commandMetrics, setCommandMetrics] = useState<CommandMetricConfig[]>(() => {
    try { return JSON.parse(safeLocalStorage.getItem('crm_command_metrics_v2') || 'null') || DEFAULT_COMMAND_METRICS; } catch { return DEFAULT_COMMAND_METRICS; }
  });
  const [commandMetricModalOpen, setCommandMetricModalOpen] = useState(false);
  const [editingCommandMetricId, setEditingCommandMetricId] = useState<string | null>(null);
  const [commandMetricForm, setCommandMetricForm] = useState<CommandMetricConfig>({
    id: '',
    label: '',
    kind: 'total_leads',
    icon: 'fa-chart-simple',
    color: '#155e75',
    brandId: 'all',
    stage: '',
    fieldKey: ''
  });

  const cloneProfileValue = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

  const getBrandWorkspaceProfiles = (brandId: string) => brandWorkspaceProfiles[brandId] || [];

  const captureBrandWorkspaceSnapshot = (brandId: string): BrandWorkspaceSnapshot => {
    return {
      snapshotCards: cloneProfileValue(snapshotCards[brandId] || []),
      customWidgets: cloneProfileValue(customWidgets[brandId] || DEFAULT_WIDGETS[brandId] || []),
      savedViews: cloneProfileValue(savedViews[brandId] || []),
      sectionVisibility: cloneProfileValue(dashboardSectionVisibility[brandId] || {}),
      sectionTitles: cloneProfileValue(dashboardSectionTitles[brandId] || {}),
      // Always snapshot the resolved visible set (standards + customs - optional hides).
      columnVisibility: Array.from(columnVisibility),
      commandMetrics: cloneProfileValue(commandMetrics),
      brandSpotlights: cloneProfileValue(brandSpotlights[brandId] || []),
      nestwiseCards: brandId === 'nestwise' ? cloneProfileValue(nestwiseCards) : undefined,
      brandSubTab,
      dashboardDensity
    };
  };

  const saveBrandWorkspaceProfile = (brand: Brand, nameOverride?: string, options?: { silent?: boolean; isBackup?: boolean }) => {
    const name = (nameOverride || workspaceProfileName || `${brand.name} workspace ${new Date().toLocaleDateString()}`).trim();
    if (!name) {
      showToast('Add a profile name first.', true);
      return null;
    }
    const now = new Date().toISOString();
    const profile: BrandWorkspaceProfile = {
      id: `profile_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      brandId: brand.id,
      name,
      createdAt: now,
      updatedAt: now,
      isDefault: getBrandWorkspaceProfiles(brand.id).length === 0 && !options?.isBackup,
      snapshot: captureBrandWorkspaceSnapshot(brand.id)
    };
    setBrandWorkspaceProfiles(prev => ({
      ...prev,
      [brand.id]: [...(prev[brand.id] || []), profile]
    }));
    setSelectedWorkspaceProfileId(profile.id);
    if (!options?.silent) {
      setWorkspaceProfileName('');
      showToast(`Saved ${brand.name} profile: ${name}`);
    }
    return profile;
  };

  const applyBrandWorkspaceProfile = (brand: Brand, profileId: string) => {
    const profile = getBrandWorkspaceProfiles(brand.id).find(item => item.id === profileId);
    if (!profile) {
      showToast('Choose a profile to apply.', true);
      return;
    }
    saveBrandWorkspaceProfile(brand, `Backup before applying ${profile.name}`, { silent: true, isBackup: true });
    const snapshot = profile.snapshot || {};
    if (snapshot.snapshotCards) setSnapshotCards(prev => ({ ...prev, [brand.id]: cloneProfileValue(snapshot.snapshotCards || []) }));
    if (snapshot.customWidgets) setCustomWidgets(prev => ({ ...prev, [brand.id]: cloneProfileValue(snapshot.customWidgets || []) }));
    if (snapshot.savedViews) setSavedViews(prev => ({ ...prev, [brand.id]: cloneProfileValue(snapshot.savedViews || []) }));
    if (snapshot.sectionVisibility) setDashboardSectionVisibility(prev => ({ ...prev, [brand.id]: cloneProfileValue(snapshot.sectionVisibility || {}) }));
    if (snapshot.sectionTitles) setDashboardSectionTitles(prev => ({ ...prev, [brand.id]: cloneProfileValue(snapshot.sectionTitles || {}) }));
    if (snapshot.brandSpotlights) setBrandSpotlights(prev => ({ ...prev, [brand.id]: cloneProfileValue(snapshot.brandSpotlights || []) }));
    if (brand.id === 'nestwise' && snapshot.nestwiseCards) setNestwiseCards(cloneProfileValue(snapshot.nestwiseCards));
    if (snapshot.commandMetrics) setCommandMetrics(cloneProfileValue(snapshot.commandMetrics));
    if (snapshot.dashboardDensity) setDashboardDensity(snapshot.dashboardDensity);
    if (snapshot.brandSubTab) setBrandSubTab(snapshot.brandSubTab);
    if (snapshot.columnVisibility) {
      const customNames = customFields
        .filter(cf => String(cf.brand_id || '') === String(brand.id))
        .map(cf => cf.field_name);
      // Profiles may store a legacy visible list — convert to optional hides only.
      const wanted = new Set(Array.isArray(snapshot.columnVisibility) ? snapshot.columnVisibility : []);
      const hiddenOptional = customNames.filter(
        name => wanted.size > 0 && !wanted.has(name) && !isProtectedColumn(name, brand.id, customNames),
      );
      safeLocalStorage.setItem(hiddenOptionalStorageKey(brand.id), hiddenOptional.join(','));
      safeLocalStorage.setItem(columnVersionStorageKey(brand.id), CURRENT_COL_VERSION);
      clearLegacyColumnPrefs(brand.id, safeLocalStorage);
      const merged = resolveVisibleColumns({
        brandId: brand.id,
        customFieldNames: customNames,
        hiddenOptional,
      });
      setColumnVisibility(new Set(merged));
    }
    setSelectedWorkspaceProfileId(profile.id);
    showToast(`Applied ${brand.name} profile: ${profile.name}`);
  };

  const duplicateBrandWorkspaceProfile = (brand: Brand, profileId: string) => {
    const profile = getBrandWorkspaceProfiles(brand.id).find(item => item.id === profileId);
    if (!profile) return;
    const now = new Date().toISOString();
    const copy: BrandWorkspaceProfile = {
      ...profile,
      id: `profile_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: `${profile.name} copy`,
      createdAt: now,
      updatedAt: now,
      isDefault: false,
      snapshot: cloneProfileValue(profile.snapshot)
    };
    setBrandWorkspaceProfiles(prev => ({ ...prev, [brand.id]: [...(prev[brand.id] || []), copy] }));
    setSelectedWorkspaceProfileId(copy.id);
    showToast('Profile duplicated.');
  };

  const deleteBrandWorkspaceProfile = (brand: Brand, profileId: string) => {
    const profile = getBrandWorkspaceProfiles(brand.id).find(item => item.id === profileId);
    if (!profile) return;
    if (!confirm(`Delete profile "${profile.name}"? This will not delete any CRM records.`)) return;
    setBrandWorkspaceProfiles(prev => ({
      ...prev,
      [brand.id]: (prev[brand.id] || []).filter(item => item.id !== profileId)
    }));
    if (selectedWorkspaceProfileId === profileId) setSelectedWorkspaceProfileId('');
    showToast('Profile deleted.');
  };

  const setDefaultBrandWorkspaceProfile = (brand: Brand, profileId: string) => {
    setBrandWorkspaceProfiles(prev => ({
      ...prev,
      [brand.id]: (prev[brand.id] || []).map(item => ({ ...item, isDefault: item.id === profileId }))
    }));
    setSelectedWorkspaceProfileId(profileId);
    showToast('Default profile updated.');
  };

  // Admin Change Password
  const [pwdUser, setPwdUser] = useState<User | null>(null);
  const [newPwdField, setNewPwdField] = useState('');
  const [showAdminPwd, setShowAdminPwd] = useState(false);

  // Dashboard Aggregations (for brands stats)
  const [dashboardStats, setDashboardStats] = useState<Record<string, { totalLeads: number; emailsSent: number; stages: Record<string, number> }>>({});

  // 1. Initial Session Loader Check
  useEffect(() => {
    checkCurrentUser();
  }, []);

  const checkCurrentUser = async () => {
    try {
      const res = await axios.get('/api/auth/me');
      setUser(res.data);
      applyRemoteNotificationState(res.data);
      if (res.data?.presence_status) setTeamPresenceStatus(res.data.presence_status);
      if (res.data?.role === 'admin') await axios.post('/api/admin/seed/nestwise').catch(() => null);
      fetchBrandFunnels();
      fetchUsersList();
      fetchAllSentEmails();
      fetchAllCallLogs();
      fetchAllWhatsAppMessages();
      fetchBrandIntegrations();
      fetchMessageTemplates();
      fetchTeamMessages();
      fetchTeamNotes();
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      hasMarkedNotificationsSeenRef.current = false;
      return;
    }
    // Do not auto-dismiss notifications on login. They are marked seen only when the drawer is opened,
    // then persisted to the user profile so another device does not show the same opened alerts.
  }, [user]);

  useEffect(() => {
    if (!activeLead) return;
    setLastViewedLead(activeLead);
    setLeadDetailTab('overview');
    // Access audit: who opened this lead
    axios.post(`/api/leads/${encodeURIComponent(activeLead.id)}/events`, { event_type: 'view' }).catch(() => {});
    axios
      .get(`/api/leads/${encodeURIComponent(activeLead.id)}/events`)
      .then(res => setLeadAuditEvents(Array.isArray(res.data) ? res.data : []))
      .catch(() => setLeadAuditEvents([]));
  }, [activeLead?.id]);

  // Power-user keyboard: Ctrl/Cmd+K palette, ? help, g+e email, Escape close lead, etc.
  useEffect(() => {
    let goChord: string | null = null;
    let goTimer: number | undefined;
    const clearGo = () => {
      goChord = null;
      if (goTimer) window.clearTimeout(goTimer);
    };
    const isTypingTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      const tag = (el.tagName || '').toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }
      if (isTypingTarget(event.target) || commandPaletteOpen) return;

      if (event.key === '?' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        setKeyboardHelpOpen(true);
        return;
      }
      if (event.key === 'Escape') {
        if (keyboardHelpOpen) { setKeyboardHelpOpen(false); return; }
        if (activeLead) { setActiveLead(null); return; }
        return;
      }
      // Chord: g then letter
      if (event.key.toLowerCase() === 'g' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        goChord = 'g';
        goTimer = window.setTimeout(clearGo, 900);
        return;
      }
      if (goChord === 'g') {
        const k = event.key.toLowerCase();
        clearGo();
        if (k === 'e') { event.preventDefault(); handleCommandNavigate('email-tracking'); return; }
        if (k === 'c') { event.preventDefault(); handleCommandNavigate('communications'); return; }
        if (k === 't') { event.preventDefault(); handleCommandNavigate('team-chat'); return; }
        if (k === 'd') { event.preventDefault(); handleCommandNavigate('dashboard'); return; }
        if (k === 'i') { event.preventDefault(); handleCommandNavigate('integrations'); return; }
        if (k === 'w') { event.preventDefault(); handleCommandNavigate('whatsapp-tracking'); return; }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearGo();
    };
  }, [activeLead, commandPaletteOpen, keyboardHelpOpen]);

  const captureCurrentWorkspaceSnapshot = () => {
    if (!activeWorkspaceTab) return;
    saveWorkspaceTabSnapshot(activeWorkspaceTab.id, {
      brandSubTab,
      searchQuery,
      selectedStageFilter,
      selectedSegmentFilter,
      selectedCityFilter,
      selectedDateWindow,
      scrollTop: viewContentRef.current?.scrollTop || 0,
    });
  };

  const applyBrandTheme = (brand: Brand | null, routeKey?: string) => {
    if (brand) {
      document.documentElement.style.setProperty('--brand-accent', brand.color);
      document.documentElement.style.setProperty('--accent', brand.color);
      document.documentElement.style.setProperty('--accent-hover', `oklch(from ${brand.color} l c h / 0.8)`);
      return;
    }
    const accent = routeKey === 'whatsapp-tracking' ? '#25D366' : '#0f766e';
    document.documentElement.style.setProperty('--accent', accent);
    document.documentElement.style.setProperty('--accent-hover', accent === '#25D366' ? '#1ebe57' : '#115e59');
    document.documentElement.style.setProperty('--brand-accent', accent);
  };

  const openViewTab = (
    routeKey: string,
    options?: { brand?: Brand | null; title?: string; kind?: 'dashboard' | 'brand' | 'view' },
  ) => {
    captureCurrentWorkspaceSnapshot();
    const brand = options?.brand || null;
    const meta = getViewMeta(routeKey);
    openWorkspaceTab({
      kind: options?.kind || (brand ? 'brand' : routeKey === 'dashboard' ? 'dashboard' : 'view'),
      routeKey,
      brandId: brand?.id,
      title: options?.title || brand?.name || meta.title,
      color: brand?.color || meta.color,
      icon: meta.icon,
    });
  };

  // Switch Selected Brand & Update Theme Variable
  const handleSelectBrand = (brand: Brand) => {
    captureCurrentWorkspaceSnapshot();
    const existing = workspaceTabs.find(t => t.routeKey === brand.id);
    setSelectedBrand(brand);
    setActiveTab(brand.id);
    setBrandSubTab(existing?.snapshot.brandSubTab || 'leads');
    setSearchQuery(existing?.snapshot.searchQuery || '');
    setSelectedStageFilter(existing?.snapshot.selectedStageFilter || 'all');
    setSelectedSegmentFilter(existing?.snapshot.selectedSegmentFilter || 'all');
    setSelectedCityFilter(existing?.snapshot.selectedCityFilter || 'all');
    setSelectedDateWindow((existing?.snapshot.selectedDateWindow as any) || 'all');
    setSelectedServiceFilter('all');
    setSelectedAbnFilter('all');
    setSelectedCustomFieldFilter(null);
    setLeadFocusFilter(null);
    setActiveLead(null);
    setSelectedLeadIds(new Set());
    applyBrandTheme(brand);
    openWorkspaceTab({
      kind: 'brand',
      routeKey: brand.id,
      brandId: brand.id,
      title: brand.name,
      color: brand.color,
      icon: 'fa-building',
      snapshot: existing?.snapshot,
    });
    requestAnimationFrame(() => {
      if (viewContentRef.current && existing?.snapshot.scrollTop != null) {
        viewContentRef.current.scrollTop = existing.snapshot.scrollTop;
      }
    });
  };

  const handleSelectDashboard = () => {
    captureCurrentWorkspaceSnapshot();
    setSelectedBrand(null);
    setActiveTab('dashboard');
    applyBrandTheme(null, 'dashboard');
    openViewTab('dashboard', { kind: 'dashboard', title: 'Dashboard' });
    fetchDashboardStats();
    fetchWebsiteAnalytics('');
  };

  const handleSelectCalls = () => {
    captureCurrentWorkspaceSnapshot();
    setSelectedBrand(null);
    setActiveTab('calls');
    setCallStageFilter('all');
    setActiveCallLead(null);
    applyBrandTheme(null, 'calls');
    openViewTab('calls', { title: 'Calls' });
    fetchDiallerLeads();
  };

  const handleSelectCommunications = () => {
    captureCurrentWorkspaceSnapshot();
    setSelectedBrand(null);
    setActiveTab('communications');
    applyBrandTheme(null, 'communications');
    openViewTab('communications', { title: 'Communications' });
    fetchAllSentEmails();
    fetchAllWhatsAppMessages();
    fetchAllCallLogs();
    fetchTeamMessages();
  };

  const openCommunicationTool = (tab: 'email-tracking' | 'whatsapp-tracking' | 'calls' | 'team-chat' | 'integrations', brandId?: string) => {
    captureCurrentWorkspaceSnapshot();
    setSelectedBrand(null);
    setActiveTab(tab);
    applyBrandTheme(null, tab);
    openViewTab(tab);
    if (tab === 'email-tracking') {
      const brand = brandId ? activeBrands.find(b => b.id === brandId) || activeBrands[0] || BRANDS[0] : activeBrands[0] || BRANDS[0];
      setSelectedBrandForEmail(brand);
      fetchAllSentEmails();
      if (brand) markBrandCommunicationSeen(brand.id);
    }
    if (tab === 'whatsapp-tracking') {
      const brand = brandId ? activeBrands.find(b => b.id === brandId) || activeBrands[0] || BRANDS[0] : activeBrands[0] || BRANDS[0];
      setSelectedBrandForWhatsApp(brand);
      fetchAllWhatsAppMessages(brand.id);
      fetchWhatsAppNumbers();
      fetchWhatsAppTemplates();
      if (brand) markBrandCommunicationSeen(brand.id);
    }
    if (tab === 'calls') handleSelectCalls();
    if (tab === 'team-chat') { fetchTeamMessages(); fetchTeamNotes(); }
    if (tab === 'integrations') {
      setIntegrationBrandId(brandId || activeBrands[0]?.id || BRANDS[0].id);
      fetchBrandIntegrations();
      fetchMessageTemplates();
    }
  };

  const handleSelectUsers = () => {
    captureCurrentWorkspaceSnapshot();
    setSelectedBrand(null);
    setActiveTab('users');
    applyBrandTheme(null, 'users');
    openViewTab('users', { title: 'Users' });
    fetchUsersList();
  };

  const activateWorkspaceTabById = (tabId: string, options?: { skipCapture?: boolean }) => {
    const tab = workspaceTabs.find(t => t.id === tabId);
    if (!tab || workspaceSwitchLock.current) return;
    if (!options?.skipCapture) captureCurrentWorkspaceSnapshot();
    workspaceSwitchLock.current = true;
    activateWorkspaceTab(tabId);

    if (tab.kind === 'brand' && tab.brandId) {
      const brand = activeBrands.find(b => b.id === tab.brandId) || managedBrands.find(b => b.id === tab.brandId) || null;
      if (brand) {
        setSelectedBrand(brand);
        setActiveTab(brand.id);
        setBrandSubTab(tab.snapshot.brandSubTab || 'leads');
        setSearchQuery(tab.snapshot.searchQuery || '');
        setSelectedStageFilter(tab.snapshot.selectedStageFilter || 'all');
        setSelectedSegmentFilter(tab.snapshot.selectedSegmentFilter || 'all');
        setSelectedCityFilter(tab.snapshot.selectedCityFilter || 'all');
        setSelectedDateWindow((tab.snapshot.selectedDateWindow as any) || 'all');
        applyBrandTheme(brand);
      }
    } else {
      setSelectedBrand(null);
      setActiveTab(tab.routeKey);
      applyBrandTheme(null, tab.routeKey);
      if (tab.routeKey === 'dashboard') {
        fetchDashboardStats();
        fetchWebsiteAnalytics('');
      } else if (tab.routeKey === 'communications') {
        fetchAllSentEmails();
        fetchAllWhatsAppMessages();
        fetchAllCallLogs();
        fetchTeamMessages();
      } else if (tab.routeKey === 'calls') {
        fetchDiallerLeads();
      } else if (tab.routeKey === 'team-chat') {
        fetchTeamMessages();
        fetchTeamNotes();
      } else if (tab.routeKey === 'users') {
        fetchUsersList();
      } else if (tab.routeKey === 'intelligence') {
        fetchPortfolioOpportunities();
        fetchAllTasks();
        fetchWebsiteAnalytics('');
      } else if (tab.routeKey === 'integrations') {
        if (user?.role === 'admin') fetchBrandIntegrations();
        fetchMessageTemplates();
      }
    }

    requestAnimationFrame(() => {
      if (viewContentRef.current && tab.snapshot.scrollTop != null) {
        viewContentRef.current.scrollTop = tab.snapshot.scrollTop;
      }
      workspaceSwitchLock.current = false;
    });
  };

  useEffect(() => {
    if (!cloudHydrationVersion || cloudRestoreVersionRef.current === cloudHydrationVersion) return;
    const tab = workspaceTabs.find(item => item.id === workspaceActiveTabId);
    if (!tab) return;
    if (tab.kind === 'brand' && tab.brandId && activeBrands.length === 0 && managedBrands.length === 0) return;
    cloudRestoreVersionRef.current = cloudHydrationVersion;
    activateWorkspaceTabById(tab.id, { skipCapture: true });
  }, [cloudHydrationVersion, workspaceActiveTabId, workspaceTabs, activeBrands, managedBrands]);

  // Workspace tab keyboard power-user shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (!e.ctrlKey && !e.metaKey) return;

      if (e.key === 'Tab' && workspaceTabs.length > 1) {
        e.preventDefault();
        const idx = workspaceTabs.findIndex(t => t.id === workspaceActiveTabId);
        const nextIdx = (idx + (e.shiftKey ? -1 : 1) + workspaceTabs.length) % workspaceTabs.length;
        activateWorkspaceTabById(workspaceTabs[nextIdx].id);
        return;
      }

      if (!typing && e.key >= '1' && e.key <= '9') {
        const idx = Number(e.key) - 1;
        if (workspaceTabs[idx]) {
          e.preventDefault();
          activateWorkspaceTabById(workspaceTabs[idx].id);
        }
        return;
      }

      if (!typing && (e.key === 'w' || e.key === 'W')) {
        const tab = workspaceTabs.find(t => t.id === workspaceActiveTabId);
        if (tab && !tab.pinned) {
          e.preventDefault();
          const idx = workspaceTabs.findIndex(t => t.id === tab.id);
          const neighbor = workspaceTabs[idx - 1] || workspaceTabs[idx + 1];
          closeWorkspaceTab(tab.id);
          if (neighbor) requestAnimationFrame(() => activateWorkspaceTabById(neighbor.id));
        }
        return;
      }

      if (!typing && e.shiftKey && (e.key === 't' || e.key === 'T')) {
        e.preventDefault();
        reopenClosedTab();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [workspaceTabs, workspaceActiveTabId]);

  // 2. Fetch Hooks
  const fetchBrandFunnels = async () => {
    try {
      const res = await axios.get('/api/brand-funnels');
      const map: Record<string, BrandFunnel> = {};
      res.data.forEach((item: BrandFunnel) => {
        map[item.brand_id] = item;
      });
      setFunnels(map);
      setManagedBrands(prev => prev.map(brand => {
        const funnel = map[brand.id];
        if (!funnel) return brand;
        return {
          ...brand,
          description: funnel.description ?? brand.description ?? '',
          target_audience: funnel.target_audience ?? brand.target_audience ?? '',
          audience_keywords: funnel.audience_keywords ?? brand.audience_keywords ?? [],
          cross_sell_notes: funnel.cross_sell_notes ?? brand.cross_sell_notes ?? '',
        };
      }));
    } catch (err) {
      console.error('Error loading funnel configurations:', err);
    }
  };

  const handleGlobalSearch = (q: string) => {
    setGlobalSearchQuery(q);
    if (!q.trim()) { setGlobalSearchResults([]); setShowGlobalSearch(false); return; }
    const ql = q.toLowerCase();
    const matches = (db_leads_ref_all: Lead[]) => db_leads_ref_all.filter(l =>
      l.name?.toLowerCase().includes(ql) ||
      l.email?.toLowerCase().includes(ql) ||
      l.phone?.toLowerCase().includes(ql)
    ).slice(0, 8);
    // Search across all leads loaded in memory
    const allLeads: Lead[] = Object.values(
      leads.reduce((acc: Record<string, Lead>, l) => { acc[l.id] = l; return acc; }, {})
    );
    setGlobalSearchResults(matches(allLeads));
    setShowGlobalSearch(true);
  };

  const jumpToLead = (lead: Lead) => {
    const brand = managedBrands.find(b => b.id === lead.brand_id);
    if (brand) {
      handleSelectBrand(brand);
      setTimeout(() => { setActiveLead(lead); loadLeadDetailsHistory(lead.id); }, 150);
    }
    setShowGlobalSearch(false);
    setGlobalSearchQuery('');
  };

  const openQuickCallForLead = (lead: Lead) => {
    setLastViewedLead(lead);
    setActiveCallLead(lead);
    setQuickCallOpen(true);
  };

  const handleCommandNavigate = (tab: CommandNavTab) => {
    if (tab === 'dashboard') { handleSelectDashboard(); return; }
    if (tab === 'communications') { handleSelectCommunications(); return; }
    if (tab === 'calls') { handleSelectCalls(); return; }
    if (tab === 'users') { handleSelectUsers(); return; }
    if (tab === 'intelligence') { setSelectedBrand(null); setActiveTab('intelligence'); return; }
    if (tab === 'social-hub') { setSelectedBrand(null); setActiveTab('social-hub'); return; }
    setSelectedBrand(null);
    setActiveTab(tab);
    if (tab === 'email-tracking') {
      setSelectedBrandForEmail(selectedBrandForEmail || activeBrands[0] || BRANDS[0]);
      fetchAllSentEmails();
      fetchMessageTemplates();
    }
    if (tab === 'whatsapp-tracking') {
      setSelectedBrandForWhatsApp(activeBrands[0] || BRANDS[0]);
      fetchAllWhatsAppMessages((activeBrands[0] || BRANDS[0]).id);
      fetchWhatsAppNumbers();
      fetchWhatsAppTemplates();
    }
    if (tab === 'integrations') {
      setIntegrationBrandId(activeBrands[0]?.id || BRANDS[0].id);
      fetchBrandIntegrations();
      fetchMessageTemplates();
    }
    if (tab === 'team-chat') { fetchTeamMessages(); fetchTeamNotes(); }
  };

  const [statsLoading, setStatsLoading] = useState(true);

  const fetchDashboardStats = async () => {
    setStatsLoading(true);
    try {
      if (user?.role === 'admin') {
        await axios.post('/api/admin/seed/nestwise').catch(() => null);
      }
      const leadsRes = await axios.get('/api/leads?limit=500');
      const rawLeads: Lead[] = Array.isArray(leadsRes.data) ? leadsRes.data : (leadsRes.data.items || []);
      const allLeads = normalizeBrandLeadsForDisplay(rawLeads);
      setAllCrmLeads(allLeads);
      
      const statsObj: Record<string, { totalLeads: number; emailsSent: number; stages: Record<string, number> }> = {};
      BRANDS.forEach(b => {
        const bl = allLeads.filter(x => x.brand_id === b.id);
        const deduped = dedupeLeads(bl);
        const stageDistribution: Record<string, number> = {};
        deduped.forEach(item => {
          stageDistribution[item.funnel_stage] = (stageDistribution[item.funnel_stage] || 0) + 1;
        });

        statsObj[b.id] = {
          totalLeads: deduped.length,
          emailsSent: 0,
          stages: stageDistribution
        };
      });
      setDashboardStats(statsObj);
    } catch (err) {
      console.error('Error fetching dashboard summaries:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  const leadsCacheRef = useRef<Record<string, { data: Lead[]; ts: number }>>({});
  const LEADS_CACHE_TTL = 30_000;

  const normalizeOptimavizLeadsForDisplay = (items: Lead[]) => items.map(lead => {
    if (lead.brand_id !== 'optimaviz') return lead;
    const segment = getOptimavizLeadSegment(lead);
    const stage = getOptimavizLeadStage({ ...lead, custom_fields: { ...(lead.custom_fields || {}), segment } });
    const custom_fields = {
      ...(lead.custom_fields || {}),
      segment,
      next_action: lead.custom_fields?.next_action || getOptimavizDefaultNextAction(segment, stage)
    };
    const follow_up_date = lead.follow_up_date || getOptimavizFollowUpDateForStage(segment, stage) || lead.follow_up_date;
    return { ...lead, funnel_stage: stage, follow_up_date, custom_fields };
  });


  const normalizeIdaoLeadsForDisplay = (items: Lead[]) => items.map(lead => {
    if (lead.brand_id !== 'idao') return lead;
    const segment = getIdaoLeadSegment(lead);
    const stage = getIdaoLeadStage({ ...lead, custom_fields: { ...(lead.custom_fields || {}), segment } });
    const serviceType = lead.custom_fields?.service_type || lead.custom_fields?.service_focus || (IDAO_SERVICE_TYPES[segment] || [])[0] || '';
    const custom_fields = {
      ...(lead.custom_fields || {}),
      segment,
      service_type: serviceType,
      service_focus: serviceType,
      next_action: lead.custom_fields?.next_action || getIdaoDefaultNextAction(segment, stage)
    };
    const follow_up_date = lead.follow_up_date || getIdaoFollowUpDateForStage(segment, stage) || lead.follow_up_date;
    return { ...lead, funnel_stage: stage, follow_up_date, custom_fields };
  });

  const normalizeBrandLeadsForDisplay = (items: Lead[]) => normalizeIdaoLeadsForDisplay(normalizeOptimavizLeadsForDisplay(items));

  const fetchLeadsForActiveBrand = async (opts?: { silent?: boolean; force?: boolean }) => {
    if (!selectedBrand) return;
    const brandId = selectedBrand.id;
    const silent = Boolean(opts?.silent);
    if (opts?.force) {
      delete leadsCacheRef.current[brandId];
    }
    const cached = leadsCacheRef.current[brandId];
    if (cached && Date.now() - cached.ts < LEADS_CACHE_TTL) {
      // Avoid a double paint (cached then fresh) during import — only apply the network result.
      if (!silent) setLeads(cached.data);
      axios.get(`/api/leads?brand_id=${brandId}&limit=500`).then(res => {
        const freshRaw = Array.isArray(res.data) ? res.data : (res.data.items || []);
        const fresh = normalizeBrandLeadsForDisplay(freshRaw);
        leadsCacheRef.current[brandId] = { data: fresh, ts: Date.now() };
        setLeads(fresh);
      }).catch(() => {
        if (silent) setLeads(cached.data);
      });
      return;
    }
    if (!silent) setLoading(true);
    try {
      const res = await axios.get(`/api/leads?brand_id=${brandId}&limit=500`);
      const rawLeadsData = Array.isArray(res.data) ? res.data : (res.data.items || []);
      const leadsData = normalizeBrandLeadsForDisplay(rawLeadsData);
      leadsCacheRef.current[brandId] = { data: leadsData, ts: Date.now() };
      setLeads(leadsData);
    } catch (err) {
      console.error('Error loading leads', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchCustomFieldsForBrand = async () => {
    if (!selectedBrand) return;
    const brandId = selectedBrand.id;
    try {
      const [res, deletedRes] = await Promise.all([
        axios.get(`/api/brands/${brandId}/custom-fields`),
        axios.get(`/api/brands/${brandId}/deleted-custom-fields`).catch(() => ({ data: [] })),
      ]);
      let fields: CustomField[] = Array.isArray(res.data) ? res.data : [];
      const serverDeleted = new Set(
        (Array.isArray(deletedRes.data) ? deletedRes.data : [])
          .map((n: unknown) => String(n || '').toLowerCase().trim())
          .filter(Boolean),
      );
      // Client tombstones (backup if older server builds lack the deleted endpoint)
      let localDeleted = new Set<string>();
      try {
        const raw = localStorage.getItem(`crm_deleted_custom_cols_${brandId}`);
        const parsed: string[] = raw ? JSON.parse(raw) : [];
        localDeleted = new Set(parsed.map(n => String(n || '').toLowerCase().trim()).filter(Boolean));
      } catch { /* ignore */ }
      const deletedNames = new Set([...serverDeleted, ...localDeleted]);

      // Seed recommended brand columns only when the user has NOT permanently deleted them.
      const baseRequired = BRAND_REQUIRED_CUSTOM_FIELDS[brandId] || [{ field_name: 'segment', field_type: 'text' as const }];
      const requiredFields = brandId === 'optimaviz'
        ? [
            ...baseRequired,
            ...OPTIMAVIZ_USAGE_FIELDS.map(field_name => ({ field_name, field_type: 'text' as const, required: false })),
          ]
        : baseRequired;

      const existingNames = new Set(fields.map(f => String(f.field_name || '').toLowerCase()));
      const missingFields = requiredFields.filter(f => {
        const name = String(f.field_name || '').toLowerCase();
        // Never auto-recreate protected search columns that somehow vanished as custom fields
        // if they are already represented as standard columns — and never resurrect user deletes.
        if (deletedNames.has(name)) return false;
        if (existingNames.has(name)) return false;
        return true;
      });
      if (missingFields.length > 0) {
        try {
          for (const field of missingFields) {
            await axios.post(`/api/brands/${brandId}/custom-fields`, field);
          }
          const res2 = await axios.get(`/api/brands/${brandId}/custom-fields`);
          fields = Array.isArray(res2.data) ? res2.data : fields;
        } catch (err) {
          console.error('Failed to auto create required custom fields:', err);
        }
      }
      // Ignore stale responses if the user switched brands mid-request.
      if (selectedBrandRef.current?.id === brandId || selectedBrand.id === brandId) {
        setCustomFields(fields);
        customFieldsReadyBrandRef.current = brandId;
      }
    } catch (err) {
      console.error('Error fetching custom fields', err);
      if (selectedBrand.id === brandId) {
        setCustomFields([]);
        customFieldsReadyBrandRef.current = brandId;
      }
    }
  };

  const fetchSequencesForBrand = async () => {
    if (!selectedBrand) return;
    try {
      const [res, statsRes] = await Promise.all([
        axios.get(`/api/sequences?brand_id=${selectedBrand.id}`),
        axios.get(`/api/sequences/stats?brand_id=${selectedBrand.id}`),
      ]);
      setSequences(res.data);
      setSequenceStats(statsRes.data || {});
    } catch (err) {
      console.error('Error fetching sequences', err);
    }
  };

  const fetchUsageAnalyticsForBrand = async (brandId: string) => {
    try {
      const res = await axios.get(`/api/usage/analytics?brand_id=${brandId}`);
      setUsageAnalytics(res.data?.by_feature || {});
    } catch (err) {
      console.error('Error fetching usage analytics', err);
      setUsageAnalytics({});
    }
  };

  const fetchUsersList = async () => {
    try {
      const res = await axios.get('/api/users');
      const users = Array.isArray(res.data) ? res.data : [];
      setUsersList(users);
      const currentUser = users.find((item: User) => item.id === user?.id);
      if (currentUser?.presence_status && currentUser.presence_status !== teamPresenceStatus) {
        setTeamPresenceStatus(currentUser.presence_status as 'online' | 'away' | 'offline');
      }
    } catch (err) {
      console.error('Error loading users list:', err);
    }
  };

  const fetchAllSentEmails = async () => {
    try {
      const res = await axios.get('/api/emails');
      const rows = Array.isArray(res.data) ? res.data : [];
      // Hide mailbox history for brands with no connected mailbox (gmail/outlook/smtp).
      // Prevents stale "past mailbox" emails after disconnect.
      const connectedBrandIds = new Set(
        (emailConnections || [])
          .filter((c: any) => {
            if (!c?.brand_id) return false;
            const status = String(c.connection_status || c.status || 'connected').toLowerCase();
            return status === 'connected' || (status !== 'disconnected' && status !== 'revoked' && status !== 'expired');
          })
          .map((c: any) => String(c.brand_id))
      );
      managedBrands.forEach(b => {
        try {
          const integ = getBrandIntegrationFor(b.id);
          if (!integ) return;
          const provider = String(integ.email_provider || '').toLowerCase();
          const gmailLive = Boolean(integ.gmail_refresh_token || integ.gmail_connected_email);
          const outlookLive = Boolean(integ.outlook_refresh_token || integ.outlook_connected_email);
          if (gmailLive || provider === 'gmail') connectedBrandIds.add(b.id);
          if (outlookLive || provider === 'outlook') connectedBrandIds.add(b.id);
          if (['yahoo', 'smtp', 'custom_smtp_imap'].includes(provider) && (integ.email_sender_address || (integ.email_accounts || []).length)) {
            connectedBrandIds.add(b.id);
          }
        } catch { /* ignore */ }
      });
      // If we cannot resolve connections yet, still show API rows (do not wipe mailbox).
      if (connectedBrandIds.size === 0) {
        setAllSentEmails(rows);
        return;
      }
      setAllSentEmails(rows.filter((e: any) => !e.brand_id || connectedBrandIds.has(String(e.brand_id))));
    } catch (err) {
      console.error('Failed to load sent emails statistics:', err);
    }
  };

  const fetchPortfolioOpportunities = async () => {
    try {
      const res = await axios.get('/api/intelligence/portfolio-opportunities');
      setPortfolioRules(res.data?.rules || []);
      setPortfolioOpportunities(res.data?.opportunities || []);
      setPortfolioCounts(res.data?.counts || { pending: 0, accepted: 0, dismissed: 0 });
    } catch (err) {
      console.error('Failed to load portfolio opportunities:', err);
    }
  };

  const savePortfolioRule = async () => {
    if (!portfolioForm.source_brand_id || !portfolioForm.target_brand_id || !portfolioForm.trigger_value.trim() || !portfolioForm.offer_label.trim()) {
      showToast('Choose source, target, match value, and recommendation first.', true);
      return;
    }
    setPortfolioSaving(true);
    try {
      await axios.post('/api/intelligence/portfolio-opportunities/rules', portfolioForm);
      setPortfolioForm(prev => ({ ...prev, name: '', trigger_value: '', offer_label: '' }));
      await fetchPortfolioOpportunities();
      showToast('Portfolio recommendation rule saved.');
    } catch (err: any) {
      showApiError(err, 'Could not save portfolio rule.');
    } finally {
      setPortfolioSaving(false);
    }
  };

  const scanPortfolioOpportunities = async () => {
    setPortfolioSaving(true);
    try {
      const res = await axios.post('/api/intelligence/portfolio-opportunities/scan');
      await fetchPortfolioOpportunities();
      showToast(res.data?.created ? `Found ${res.data.created} new portfolio opportunit${res.data.created === 1 ? 'y' : 'ies'}.` : 'Portfolio scan complete. No new opportunities found.');
    } catch (err: any) {
      showApiError(err, 'Could not scan portfolio opportunities.');
    } finally {
      setPortfolioSaving(false);
    }
  };

  const dismissPendingPortfolioOpportunities = async () => {
    if (!portfolioCounts.pending) return;
    if (!confirm('Clear all pending portfolio recommendations? This only removes them from the review queue. It does not delete leads.')) return;
    setPortfolioSaving(true);
    try {
      const res = await axios.post('/api/intelligence/portfolio-opportunities/dismiss-pending', {});
      await fetchPortfolioOpportunities();
      showToast(`Cleared ${res.data?.count || 0} pending recommendation${res.data?.count === 1 ? '' : 's'}.`);
    } catch (err: any) {
      showApiError(err, 'Could not clear pending recommendations.');
    } finally {
      setPortfolioSaving(false);
    }
  };

  const reviewPortfolioOpportunity = async (opportunityId: string, action: 'accept' | 'dismiss') => {
    try {
      await axios.post(`/api/intelligence/portfolio-opportunities/${encodeURIComponent(opportunityId)}/${action}`);
      await Promise.all([fetchPortfolioOpportunities(), fetchDashboardStats()]);
      showToast(action === 'accept' ? 'Opportunity accepted and lead created or linked.' : 'Opportunity dismissed.');
    } catch (err: any) {
      showApiError(err, 'Could not update portfolio opportunity.');
    }
  };

  const markEmailReadInCrm = async (message: EmailLog) => {
    const isInbound = message.status === 'received' || message.direction === 'inbound';
    if (!message.id || !isInbound || message.read_at) return;
    const optimisticRead = {
      read_at: new Date().toISOString(),
      read_by: user?.id || '',
      read_by_name: user?.name || 'You',
    };
    setAllSentEmails(prev => prev.map(email => email.id === message.id ? { ...email, ...optimisticRead } : email));
    try {
      const res = await axios.post(`/api/emails/${encodeURIComponent(message.id)}/read`);
      setAllSentEmails(prev => prev.map(email => email.id === message.id ? { ...email, ...res.data } : email));
    } catch (err) {
      console.error('Failed to mark email as read:', err);
    }
  };

  const getEmailActionStatus = (email: EmailLog) => String(email.action_status || '').toLowerCase();

  const isInboundCrmEmail = (email: EmailLog) => (
    email.status === 'received' ||
    email.direction === 'inbound' ||
    email.mailbox_folder === 'inbox'
  );

  const isAutoNoiseEmail = (email: EmailLog) => {
    const haystack = [
      email.from_email,
      email.subject,
      email.body,
      email.html_content,
      email.template_name,
    ].map(v => String(v || '').toLowerCase()).join(' ');
    return [
      'unsubscribe',
      'newsletter',
      'promotion',
      'marketing',
      'no-reply',
      'noreply',
      'donotreply',
      'do-not-reply',
      'mailer-daemon',
      'delivery status notification',
      'automatic reply',
      'out of office',
    ].some(pattern => haystack.includes(pattern));
  };

  const getEmailActionBucket = (email: EmailLog): 'needs_reply' | 'handled' | 'ignored' | 'marketing' | 'follow_up' | 'sent' => {
    if (!isInboundCrmEmail(email)) return 'sent';
    const savedStatus = getEmailActionStatus(email);
    if (['needs_reply', 'handled', 'ignored', 'marketing', 'follow_up'].includes(savedStatus)) {
      return savedStatus as any;
    }
    if (isAutoNoiseEmail(email) || ['spam', 'trash'].includes(String(email.mailbox_folder || '').toLowerCase())) {
      return 'marketing';
    }
    return 'needs_reply';
  };

  const isEmailActionable = (email: EmailLog) => ['needs_reply', 'follow_up'].includes(getEmailActionBucket(email));

  const getEmailActionSummary = (emails: EmailLog[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdueCutoff = Date.now() - (24 * 60 * 60 * 1000);
    const inbound = emails.filter(isInboundCrmEmail);
    const actionable = inbound.filter(isEmailActionable);
    return {
      actionInbox: actionable.length,
      newToday: actionable.filter(email => {
        const created = email.created_at ? new Date(email.created_at).getTime() : 0;
        return created >= today.getTime();
      }).length,
      overdue: actionable.filter(email => {
        const created = email.created_at ? new Date(email.created_at).getTime() : Date.now();
        return created < overdueCutoff;
      }).length,
      ignored: inbound.filter(email => ['ignored', 'marketing', 'handled'].includes(getEmailActionBucket(email))).length,
    };
  };

  const fetchTeamMessages = async () => {
    try {
      const res = await axios.get('/api/team-chat');
      setTeamMessages(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load team chat:', err);
      setTeamMessages([]);
    }
  };

  const fetchTeamNotes = async () => {
    try {
      const res = await axios.get('/api/team-notes');
      setTeamNotes(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load team notes:', err);
      setTeamNotes([]);
    }
  };

  const readTeamFile = (file: File) => new Promise<{ name: string; mime_type: string; data_base64: string }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || '');
      resolve({
        name: file.name,
        mime_type: file.type || 'application/octet-stream',
        data_base64: value.includes(',') ? value.split(',').pop() || '' : value,
      });
    };
    reader.onerror = () => reject(reader.error || new Error('Could not read file.'));
    reader.readAsDataURL(file);
  });

  const MAX_TEAM_ATTACHMENT_FILES = 5;
  const MAX_TEAM_ATTACHMENT_TOTAL_BYTES = 20 * 1024 * 1024;
  const addTeamFiles = (files: FileList | File[]) => {
    const incoming = Array.from(files || []);
    if (!incoming.length) return;
    setTeamFiles(current => {
      const next = [...current, ...incoming].slice(0, MAX_TEAM_ATTACHMENT_FILES);
      const totalBytes = next.reduce((total, file) => total + file.size, 0);
      if (totalBytes > MAX_TEAM_ATTACHMENT_TOTAL_BYTES) {
        showToast('Team chat attachments must be 20MB or less per message.', true);
        return current;
      }
      if (current.length + incoming.length > MAX_TEAM_ATTACHMENT_FILES) {
        showToast(`Only the first ${MAX_TEAM_ATTACHMENT_FILES} files were added.`, true);
      }
      return next;
    });
  };

  const MAX_EMAIL_ATTACHMENT_FILES = 10;
  const MAX_EMAIL_ATTACHMENT_TOTAL_BYTES = 20 * 1024 * 1024;

  const readEmailAttachmentFile = (file: File) => new Promise<{ name: string; mime_type: string; size: number; data_base64: string }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || '');
      resolve({
        name: file.name,
        mime_type: file.type || 'application/octet-stream',
        size: file.size,
        data_base64: value.includes(',') ? value.split(',').pop() || '' : value,
      });
    };
    reader.onerror = () => reject(reader.error || new Error('Could not read attachment.'));
    reader.readAsDataURL(file);
  });

  const addEmailAttachmentFiles = (files: FileList | File[]) => {
    const incoming = Array.from(files || []);
    if (!incoming.length) return;

    setEmailAttachments(current => {
      const next = [...current, ...incoming].slice(0, MAX_EMAIL_ATTACHMENT_FILES);
      const totalBytes = next.reduce((total, file) => total + file.size, 0);
      if (totalBytes > MAX_EMAIL_ATTACHMENT_TOTAL_BYTES) {
        showToast('Email attachments must be 20MB or less in total.', true);
        return current;
      }
      if (current.length + incoming.length > MAX_EMAIL_ATTACHMENT_FILES) {
        showToast(`Only the first ${MAX_EMAIL_ATTACHMENT_FILES} attachments were added.`, true);
      }
      return next;
    });
  };

  const prepareEmailAttachments = async () => {
    const totalBytes = emailAttachments.reduce((total, file) => total + file.size, 0);
    if (totalBytes > MAX_EMAIL_ATTACHMENT_TOTAL_BYTES) {
      throw new Error('Email attachments must be 20MB or less in total.');
    }
    return Promise.all(emailAttachments.map(readEmailAttachmentFile));
  };

  const getTeamMessageThreadId = (message: TeamMessage, currentUserId = user?.id || '') => {
    const recipients = Array.isArray(message.recipient_ids) ? message.recipient_ids : [];
    if (recipients.length === 0 || recipients.includes('all')) return 'all';
    if (message.user_id === currentUserId) return recipients.find(id => id !== currentUserId) || 'all';
    return message.user_id || 'all';
  };

  const getTeamCallRoomSlugFromMessage = (message: TeamMessage) => {
    const savedSlug = String(message.call_room_slug || '').trim();
    if (savedSlug) return sanitizeTeamCallRoom(savedSlug);
    const callUrl = String(message.content || '').match(/https:\/\/8x8\.vc\/[^\s)]+/)?.[0] || '';
    return sanitizeTeamCallRoom(callUrl.split('/').filter(Boolean).pop() || '');
  };

  const isTeamCallEndedMessage = (message: TeamMessage) => (
    message.event_type === 'team_call_ended' ||
    message.call_status === 'ended'
  );

  const getTeamCallEndedRooms = (messages = teamMessages) => new Set(
    messages
      .filter(isTeamCallEndedMessage)
      .map(getTeamCallRoomSlugFromMessage)
      .filter(Boolean)
  );

  const getTeamThreadMessages = (threadId: string) => teamMessages
    .filter(message => getTeamMessageThreadId(message) === threadId)
    .filter(message => !isTeamCallEndedMessage(message));

  const getTeamThreadUnreadCount = (threadId: string) => {
    const lastRead = teamReadState[threadId] || '';
    return getTeamThreadMessages(threadId).filter(message => message.user_id !== user?.id && String(message.created_at || '') > lastRead).length;
  };

  const getTeamMessageDateKey = (value?: string) => {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  };

  const formatTeamTime = (value?: string) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  };

  const formatTeamPreviewTime = (value?: string) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const now = new Date();
    const todayKey = getTeamMessageDateKey(now.toISOString());
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const dateKey = getTeamMessageDateKey(value);
    if (dateKey === todayKey) return formatTeamTime(value);
    if (dateKey === getTeamMessageDateKey(yesterday.toISOString())) return 'Yesterday';
    return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date);
  };

  const formatTeamDateDivider = (value?: string) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const now = new Date();
    const todayKey = getTeamMessageDateKey(now.toISOString());
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const dateKey = getTeamMessageDateKey(value);
    if (dateKey === todayKey) return 'Today';
    if (dateKey === getTeamMessageDateKey(yesterday.toISOString())) return 'Yesterday';
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(date);
  };

  const escapeTeamHtml = (value: string) => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  // Get Mon-Fri dates for the current week
  const getWeekDates = () => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
    const monday = new Date(now.setDate(diff));
    const dates = [];
    for (let i = 0; i < 5; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
  };

  const getTasksForDate = (dateStr: string) => {
    return tasks.filter(t => {
      const taskDateStr = t.task_date || t.created_at?.split('T')[0];
      return taskDateStr === dateStr;
    });
  };

  const renderTeamMessageContent = (content?: string) => {
    if (!content) return null;
    let html = escapeTeamHtml(content);
    html = html
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[\s(])_([^_\n]+)_/g, '$1<em>$2</em>')
      .replace(/\+\+([^+\n]+)\+\+/g, '<u>$1</u>')
      .replace(/~~([^~\n]+)~~/g, '<s>$1</s>')
      .replace(/`([^`\n]+)`/g, '<code>$1</code>')
      .replace(/^- (.+)$/gm, '<span class="team-md-list">&bull; $1</span>')
      .replace(/^\d+\. (.+)$/gm, '<span class="team-md-list team-md-numbered">$1</span>')
      .replace(/\n/g, '<br />');
    return <div className="team-message-content" dangerouslySetInnerHTML={{ __html: html }} />;
  };

  const sanitizeEmailHtml = (rawHtml?: string) => {
    const fallback = '<p>No message body saved.</p>';
    if (!rawHtml) return fallback;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(String(rawHtml), 'text/html');
      doc.querySelectorAll('script, style, iframe, object, embed, link, meta, base, form, input, button').forEach(node => node.remove());
      doc.querySelectorAll('*').forEach(node => {
        Array.from(node.attributes).forEach(attr => {
          const name = attr.name.toLowerCase();
          const value = attr.value.trim().toLowerCase();
          if (name.startsWith('on')) node.removeAttribute(attr.name);
          if ((name === 'href' || name === 'src') && (value.startsWith('javascript:') || value.startsWith('data:text/html'))) {
            node.removeAttribute(attr.name);
          }
          if (name === 'style' && /expression\s*\(|url\s*\(\s*javascript:/i.test(attr.value)) {
            node.removeAttribute(attr.name);
          }
        });
      });
      return doc.body.innerHTML || fallback;
    } catch {
      return escapeTeamHtml(String(rawHtml)).replace(/\n/g, '<br />');
    }
  };

  const updateTeamMessageDraft = (nextText: string, nextStart?: number, nextEnd?: number) => {
    setTeamMessageText(nextText);
    window.setTimeout(() => {
      const input = teamTextareaRef.current;
      if (!input) return;
      input.focus();
      if (typeof nextStart === 'number') input.selectionStart = nextStart;
      if (typeof nextEnd === 'number') input.selectionEnd = nextEnd ?? nextStart ?? input.selectionStart;
    }, 0);
  };

  const wrapTeamSelection = (before: string, after = before, placeholder = 'text') => {
    const input = teamTextareaRef.current;
    const start = input?.selectionStart ?? teamMessageText.length;
    const end = input?.selectionEnd ?? teamMessageText.length;
    const selected = teamMessageText.slice(start, end) || placeholder;
    const nextText = `${teamMessageText.slice(0, start)}${before}${selected}${after}${teamMessageText.slice(end)}`;
    updateTeamMessageDraft(nextText, start + before.length, start + before.length + selected.length);
  };

  const formatTeamDraft = (format: 'bold' | 'italic' | 'underline' | 'strike' | 'link' | 'ol' | 'ul' | 'code' | 'mention') => {
    const input = teamTextareaRef.current;
    const start = input?.selectionStart ?? teamMessageText.length;
    const end = input?.selectionEnd ?? teamMessageText.length;
    const selected = teamMessageText.slice(start, end);
    if (format === 'bold') return wrapTeamSelection('**', '**', 'bold text');
    if (format === 'italic') return wrapTeamSelection('_', '_', 'italic text');
    if (format === 'underline') return wrapTeamSelection('++', '++', 'underlined text');
    if (format === 'strike') return wrapTeamSelection('~~', '~~', 'struck text');
    if (format === 'code') return wrapTeamSelection('`', '`', 'code');
    if (format === 'link') return wrapTeamSelection('[', '](https://)', 'link text');
    if (format === 'mention') {
      const mentionName = activeTeamDmId !== 'all' ? usersList.find(staff => staff.id === activeTeamDmId)?.name || 'team' : 'all';
      const mention = `@${mentionName.replace(/\s+/g, '')} `;
      const nextText = `${teamMessageText.slice(0, start)}${mention}${teamMessageText.slice(end)}`;
      return updateTeamMessageDraft(nextText, start + mention.length, start + mention.length);
    }
    const linePrefix = format === 'ol' ? '1. ' : '- ';
    const block = selected || 'List item';
    const formatted = block.split('\n').map((line, index) => format === 'ol' ? `${index + 1}. ${line.replace(/^\d+\.\s*/, '')}` : `${linePrefix}${line.replace(/^-\s*/, '')}`).join('\n');
    const nextText = `${teamMessageText.slice(0, start)}${formatted}${teamMessageText.slice(end)}`;
    return updateTeamMessageDraft(nextText, start, start + formatted.length);
  };

  const startTeamCall = async () => {
    const roomSeed = activeTeamDmId === 'all' ? 'all-staff' : [user.id, activeTeamDmId].sort().join('-');
    const roomSlug = sanitizeTeamCallRoom(`DirotiQCRM-${roomSeed}-${Date.now()}`);
    const callUrl = getTeamCallExternalUrl(roomSlug);
    const targetName = activeTeamDmId === 'all' ? 'All staff' : usersList.find(staff => staff.id === activeTeamDmId)?.name || 'this DM';
    // Never show legacy "Optima Admin" branding in call titles.
    const cleanTarget = String(targetName || '').replace(/optima\s*admin/gi, 'Platform Owner').trim() || 'Team';
    setTeamCallRoomSlug(roomSlug);
    setTeamCallTitle(activeTeamDmId === 'all' ? 'All staff call' : `${cleanTarget} call`);
    setTeamCallError('');
    setTeamCallDocked(false);
    setTeamCallMovedToTab(false);
    teamCallExternalWindowRef.current = null;
    setTeamCallOpen(true);
    setTeamPosting(true);
    try {
      await axios.post('/api/team-chat', {
        content: `Team call started for ${targetName}\nJoin call: [Open call room](${callUrl})`,
        recipient_ids: [activeTeamDmId || 'all'],
        attachments: [],
        event_type: 'team_call_started',
        call_room_slug: roomSlug,
        call_status: 'ringing',
      });
      await fetchTeamMessages();
      showToast('Team call started inside the CRM.');
    } catch (err: any) {
      showApiError(err, 'Call opened, but the chat link could not be shared.');
    } finally {
      setTeamPosting(false);
    }
  };

  const dismissIncomingTeamCall = (messageId?: string) => {
    if (messageId) {
      const dismissed = new Set((safeLocalStorage.getItem('crm_dismissed_team_calls') || '').split(',').filter(Boolean));
      dismissed.add(messageId);
      safeLocalStorage.setItem('crm_dismissed_team_calls', Array.from(dismissed).slice(-50).join(','));
    }
    setIncomingTeamCall(null);
  };

  const joinIncomingTeamCall = (message: TeamMessage) => {
    const callUrl = String(message.content || '').match(/https:\/\/8x8\.vc\/[^\s)]+/)?.[0] || '';
    const roomSlug = callUrl.split('/').filter(Boolean).pop() || '';
    if (!roomSlug) {
      showToast('This call link is no longer available.', true);
      dismissIncomingTeamCall(message.id);
      return;
    }
    const isAllStaffCall = (message.recipient_ids || []).includes('all');
    setActiveTeamDmId(isAllStaffCall ? 'all' : message.user_id || 'all');
    setTeamRecipientId(isAllStaffCall ? 'all' : message.user_id || 'all');
    setTeamCallRoomSlug(sanitizeTeamCallRoom(roomSlug));
    const peerName = String(message.user_name || 'Team member').replace(/optima\s*admin/gi, 'Platform Owner');
    setTeamCallTitle(isAllStaffCall ? 'All staff call' : `${peerName} call`);
    setTeamCallError('');
    setTeamCallDocked(false);
    setTeamCallMovedToTab(false);
    teamCallExternalWindowRef.current = null;
    setTeamCallOpen(true);
    dismissIncomingTeamCall(message.id);
  };

  const focusTeamCallTab = () => {
    const win = teamCallExternalWindowRef.current;
    if (win && !win.closed) {
      try {
        win.focus();
        return;
      } catch {
        /* fall through */
      }
    }
    if (!teamCallRoomSlug) return;
    const params = new URLSearchParams({
      appId: TEAM_CALL_JAAS_APP_ID,
      room: teamCallRoomSlug,
      name: user?.name || 'DirotiQ CRM user',
      title: teamCallTitle,
    });
    const externalUrl = `${window.location.origin}/team-call.html?${params.toString()}`;
    const reopened = window.open(externalUrl, `dirotiq-call-${teamCallRoomSlug}`);
    if (reopened) teamCallExternalWindowRef.current = reopened;
  };

  const moveTeamCallToTab = () => {
    if (!teamCallRoomSlug) return;
    const params = new URLSearchParams({
      appId: TEAM_CALL_JAAS_APP_ID,
      room: teamCallRoomSlug,
      name: user?.name || 'DirotiQ CRM user',
      title: teamCallTitle,
    });
    const externalUrl = `${window.location.origin}/team-call.html?${params.toString()}`;
    // Open the meeting URL directly (more reliable than blank → navigate) and keep a handle for Focus.
    const externalWindow = window.open(externalUrl, `dirotiq-call-${teamCallRoomSlug}`);
    if (!externalWindow) {
      showToast('Your browser blocked the meeting tab. Allow pop-ups for DirotiQ CRM and try again.', true);
      return;
    }
    teamCallExternalWindowRef.current = externalWindow;

    const transferChannel = 'BroadcastChannel' in window ? new BroadcastChannel('optima-team-call-transfer') : null;
    let transferFinished = false;
    const finishTransfer = () => {
      if (transferFinished) return;
      transferFinished = true;
      try { transferChannel?.close(); } catch { /* ignore */ }
      try {
        teamCallApiRef.current?.dispose?.();
      } catch {
        // ignore dispose errors
      }
      teamCallApiRef.current = null;
      // Keep room slug so the CRM can show "meeting in tab" and re-focus it while you work.
      setTeamCallOpen(false);
      setTeamCallDocked(false);
      setTeamCallMovedToTab(true);
      showToast('Meeting moved to a tab — keep working in the CRM. Use Focus meeting anytime.');
    };
    if (transferChannel) {
      transferChannel.onmessage = event => {
        if (event.data?.type === 'team-call-tab-ready' && event.data?.room === teamCallRoomSlug) finishTransfer();
      };
      // Fallback: if the tab is slow to join, still free the CRM after a short wait so you can work.
      window.setTimeout(() => {
        if (!transferFinished) {
          finishTransfer();
          showToast('Meeting tab opened. If audio is quiet, click Focus meeting once it finishes joining.');
        }
      }, 4500);
    } else {
      window.setTimeout(finishTransfer, 1500);
    }
  };

  const fetchAllCallLogs = async () => {
    try {
      const res = await axios.get('/api/calls');
      setAllCallLogs(res.data || []);
    } catch (err) {
      console.error('Failed to load call logs:', err);
    }
  };

  const getDefaultIntegration = (brandId: string): BrandIntegration => ({
    brand_id: brandId,
    email_provider: 'internal',
    email_sender_name: managedBrands.find(b => b.id === brandId)?.name || '',
    email_sender_address: '',
    email_reply_to: '',
    email_logo_url: '',
    email_signature: `Best,\n${managedBrands.find(b => b.id === brandId)?.name || 'DirotiQ CRM'} Team`,
    smtp_host: '',
    smtp_port: '',
    smtp_secure: false,
    smtp_username: '',
    smtp_password_env: 'SMTP_PASSWORD',
    email_accounts: [],
    whatsapp_provider: 'manual',
    whatsapp_number: whatsappNumbers[brandId] || '',
    whatsapp_phone_number_id: '',
    whatsapp_business_account_id: '',
    whatsapp_access_token_env: `WHATSAPP_${brandId.replace(/[^a-z0-9]/gi, '_').toUpperCase()}_ACCESS_TOKEN`,
    whatsapp_verify_token: `verify_${brandId.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`,
    whatsapp_profile_name: managedBrands.find(b => b.id === brandId)?.name || '',
    whatsapp_profile_about: '',
    whatsapp_profile_picture_url: managedBrands.find(b => b.id === brandId)?.logo || '',
    whatsapp_business_category: 'Property Management',
    whatsapp_business_website: '',
    call_provider: 'manual',
    call_number: '',
    automation_enabled: false
  });

  const getBrandIntegrationFor = (brandId: string): BrandIntegration => (
    brandIntegrations.find(i => i.brand_id === brandId) || getDefaultIntegration(brandId)
  );

  const getEmailAccountsForIntegration = (integration: BrandIntegration) => {
    const savedAccounts = Array.isArray(integration.email_accounts) ? integration.email_accounts : [];
    const connectedAccounts = [];
    if (integration.gmail_refresh_token || integration.gmail_connected_email) {
      connectedAccounts.push({
        id: 'gmail_oauth',
        label: integration.gmail_connected_email ? `Gmail - ${integration.gmail_connected_email}` : 'Connected Gmail',
        provider: 'gmail',
        email: integration.gmail_connected_email || integration.email_sender_address || '',
        reply_to: integration.email_reply_to || integration.gmail_connected_email || '',
        is_default: integration.email_provider === 'gmail' || savedAccounts.length === 0,
      });
    }
    if (integration.outlook_refresh_token || integration.outlook_connected_email) {
      connectedAccounts.push({
        id: 'outlook_oauth',
        label: integration.outlook_connected_email ? `Outlook - ${integration.outlook_connected_email}` : 'Connected Outlook',
        provider: 'outlook',
        email: integration.outlook_connected_email || integration.email_sender_address || '',
        reply_to: integration.email_reply_to || integration.outlook_connected_email || '',
        is_default: integration.email_provider === 'outlook' || (savedAccounts.length === 0 && connectedAccounts.length === 0),
      });
    }
    if (connectedAccounts.length > 0 || savedAccounts.length > 0) {
      const connectedIds = new Set(connectedAccounts.map(account => account.id));
      return [...connectedAccounts, ...savedAccounts.filter(account => !connectedIds.has(account.id))];
    }
    if (!integration.email_sender_address && integration.email_provider === 'internal') return [];
    return [{
      id: 'primary',
      label: integration.email_sender_name || integration.email_sender_address || 'Primary email',
      provider: integration.email_provider || 'internal',
      email: integration.email_sender_address || '',
      reply_to: integration.email_reply_to || '',
      smtp_host: integration.smtp_host || '',
      smtp_port: integration.smtp_port || '',
      smtp_secure: Boolean(integration.smtp_secure),
      smtp_username: integration.smtp_username || integration.email_sender_address || '',
      smtp_password_env: integration.smtp_password_env || '',
      is_default: true,
    }];
  };

  const emailProviderDefaults = (provider: string) => {
    if (provider === 'outlook') return { smtp_host: 'smtp-mail.outlook.com', smtp_port: '587', smtp_secure: false, smtp_password_env: 'OUTLOOK_SMTP_PASSWORD' };
    if (provider === 'yahoo') return { smtp_host: 'smtp.mail.yahoo.com', smtp_port: '465', smtp_secure: true, smtp_password_env: 'YAHOO_SMTP_PASSWORD' };
    if (provider === 'smtp') return { smtp_host: '', smtp_port: '587', smtp_secure: false, smtp_password_env: 'SMTP_PASSWORD' };
    return { smtp_host: '', smtp_port: '', smtp_secure: false, smtp_password_env: '' };
  };

  const addEmailAccountToIntegration = () => {
    setIntegrationForm(prev => {
      const provider = prev.email_provider && prev.email_provider !== 'internal' ? prev.email_provider : 'outlook';
      const defaults = emailProviderDefaults(provider);
      const accounts = getEmailAccountsForIntegration(prev).filter(account => account.id !== 'primary');
      const nextAccount = {
        id: `email_account_${Date.now()}`,
        label: `${managedBrands.find(b => b.id === integrationBrandId)?.name || 'Brand'} ${provider.charAt(0).toUpperCase() + provider.slice(1)}`,
        provider,
        email: '',
        reply_to: '',
        smtp_username: '',
        ...defaults,
        is_default: accounts.length === 0,
      };
      return { ...prev, email_accounts: [...accounts, nextAccount] };
    });
  };

  const updateEmailAccountInIntegration = (accountId: string, patch: Record<string, any>) => {
    setIntegrationForm(prev => {
      const accounts = getEmailAccountsForIntegration(prev).filter(account => account.id !== 'primary');
      return {
        ...prev,
        email_accounts: accounts.map(account => {
          if (account.id !== accountId) return patch.is_default ? { ...account, is_default: false } : account;
          const providerPatch = patch.provider ? emailProviderDefaults(patch.provider) : {};
          return { ...account, ...(patch.provider ? providerPatch : {}), ...patch };
        }),
      };
    });
  };

  const removeEmailAccountFromIntegration = (accountId: string) => {
    setIntegrationForm(prev => {
      const accounts = getEmailAccountsForIntegration(prev).filter(account => account.id !== 'primary' && account.id !== accountId);
      if (accounts.length > 0 && !accounts.some(account => account.is_default)) accounts[0].is_default = true;
      return { ...prev, email_accounts: accounts };
    });
  };

  const isWhatsAppCloudConfigured = (integration: BrandIntegration, brandId: string) => (
    integration.whatsapp_provider === 'cloud_api' &&
    Boolean(integration.whatsapp_phone_number_id) &&
    Boolean(integration.whatsapp_access_token_env || `WHATSAPP_${brandId.replace(/[^a-z0-9]/gi, '_').toUpperCase()}_ACCESS_TOKEN`)
  );

  const fetchBrandIntegrations = async () => {
    try {
      const res = await axios.get('/api/brand-integrations');
      setBrandIntegrations(res.data || []);
    } catch (err) {
      console.error('Failed to load brand integrations:', err);
    }
  };

  const fetchEmailConnections = async (brandId = integrationBrandId) => {
    try {
      const res = await axios.get(`/api/email-connections?brand_id=${encodeURIComponent(brandId)}`);
      setEmailConnections(res.data || []);
      return res.data || [];
    } catch (err) {
      console.error('Failed to load email connections:', err);
      return [];
    }
  };

  const setDefaultEmailConnection = async (connectionId: string) => {
    try {
      await axios.post(`/api/email-connections/${encodeURIComponent(connectionId)}/default`);
      await fetchEmailConnections(integrationBrandId);
      await fetchBrandIntegrations();
      showToast('Default sending mailbox updated.');
    } catch (err: any) {
      showApiError(err, 'Could not update default mailbox.');
    }
  };

  const disconnectEmailConnection = async (connection: EmailConnection) => {
    try {
      const res = await axios.delete(`/api/email-connections/${encodeURIComponent(connection.id)}`);
      await fetchEmailConnections(integrationBrandId);
      await fetchBrandIntegrations();
      await fetchAllSentEmails();
      const removed = Number(res.data?.purged?.emails_removed || 0);
      const brandName = activeBrands.find(b => b.id === connection.brand_id)?.name || connection.brand_id;
      setDisconnectedEmailAlerts(prev => [...prev, {
        id: `disconnect_${connection.id}_${Date.now()}`,
        brandId: connection.brand_id,
        provider: connection.provider,
        email: connection.provider_email,
        brandName,
      }]);
      showToast(`${connection.provider_email} disconnected.${removed > 0 ? ` Cleared ${removed} synced email${removed === 1 ? '' : 's'}.` : ''}`);
    } catch (err: any) {
      showApiError(err, 'Could not disconnect mailbox.');
    }
  };

  const applyCustomMailboxPreset = (preset: string, email = customMailboxForm.provider_email) => {
    const domain = String(email.split('@')[1] || 'yourdomain.com').toLowerCase();
    const presets: Record<string, Partial<typeof customMailboxForm>> = {
      cpanel: { smtp_host: `mail.${domain}`, smtp_port: '465', smtp_secure: true, imap_host: `mail.${domain}`, imap_port: '993', imap_secure: true },
      zoho: { smtp_host: 'smtp.zoho.com', smtp_port: '465', smtp_secure: true, imap_host: 'imap.zoho.com', imap_port: '993', imap_secure: true },
      titan: { smtp_host: 'smtp.titan.email', smtp_port: '465', smtp_secure: true, imap_host: 'imap.titan.email', imap_port: '993', imap_secure: true },
      godaddy: { smtp_host: 'smtp.office365.com', smtp_port: '587', smtp_secure: false, imap_host: 'outlook.office365.com', imap_port: '993', imap_secure: true },
      other: {},
    };
    setCustomMailboxForm(prev => ({
      ...prev,
      provider_preset: preset,
      provider_email: email,
      smtp_username: prev.smtp_username || email,
      imap_username: prev.imap_username || email,
      ...(presets[preset] || {}),
    }));
  };

  const saveCustomMailboxConnection = async () => {
    if (!customMailboxForm.provider_email.trim() || !customMailboxForm.smtp_host.trim()) {
      showToast('Add the mailbox email and SMTP host first.', true);
      return;
    }
    setCustomMailboxSaving(true);
    try {
      await axios.post(`/api/email-connections/custom/${integrationBrandId}`, customMailboxForm);
      await fetchEmailConnections(integrationBrandId);
      await fetchBrandIntegrations();
      setCustomMailboxOpen(false);
      setCustomMailboxForm(prev => ({ ...prev, provider_email: '', display_name: '', smtp_username: '', smtp_password: '', imap_username: '' }));
      showToast('Custom mailbox connected.');
    } catch (err: any) {
      showApiError(err, 'Could not connect custom mailbox.');
    } finally {
      setCustomMailboxSaving(false);
    }
  };

  const fetchMessageTemplates = async () => {
    try {
      const res = await axios.get('/api/message-templates');
      setMessageTemplates(res.data || []);
    } catch (err) {
      console.error('Failed to load message templates:', err);
    }
  };

  const fetchGmailStatus = async (brandId = integrationBrandId) => {
    try {
      const res = await axios.get(`/api/integrations/gmail/status/${brandId}`);
      setGmailStatus(res.data);
      if (Number(res.data?.purged?.emails_removed || 0) > 0) {
        fetchAllSentEmails();
      }
      return res.data;
    } catch (err) {
      console.error('Failed to load Gmail status:', err);
      setGmailStatus(null);
      return null;
    }
  };

  const fetchLeadSources = async (brandId = integrationBrandId) => {
    try {
      const [sourcesRes, logsRes] = await Promise.all([
        axios.get(`/api/lead-sources?brand_id=${encodeURIComponent(brandId)}`),
        axios.get('/api/lead-sources/logs'),
      ]);
      setLeadSources(sourcesRes.data?.sources || []);
      setLeadSourceLogs(logsRes.data?.logs || []);
    } catch (err) {
      console.error('Failed to load lead sources:', err);
      setLeadSources([]);
      setLeadSourceLogs([]);
    }
  };

  const createLeadSource = async () => {
    if (!integrationBrandId) return;
    setLeadSourceSaving(true);
    try {
      const providerLabel = leadSourceForm.provider === 'facebook'
        ? 'Facebook Lead Ads'
        : leadSourceForm.provider === 'linkedin'
          ? 'LinkedIn Lead Gen'
          : leadSourceForm.provider === 'api'
            ? 'Manual/API Import'
            : 'Website Form';
      await axios.post('/api/lead-sources', {
        brand_id: integrationBrandId,
        name: leadSourceForm.name || `${providerLabel} - ${managedBrands.find(brand => brand.id === integrationBrandId)?.name || integrationBrandId}`,
        provider: leadSourceForm.provider,
        default_stage: leadSourceForm.default_stage || getBrandStageOptions(integrationBrandId)[0] || 'New Lead',
        duplicate_strategy: leadSourceForm.duplicate_strategy,
        unmapped_field_strategy: leadSourceForm.unmapped_field_strategy,
      });
      setLeadSourceForm(prev => ({ ...prev, name: '' }));
      await fetchLeadSources(integrationBrandId);
      showToast('Lead source created.');
    } catch (err: any) {
      showApiError(err, 'Could not create lead source.');
    } finally {
      setLeadSourceSaving(false);
    }
  };

  const updateLeadSource = async (sourceId: string, patch: Partial<LeadSource>) => {
    try {
      await axios.put(`/api/lead-sources/${sourceId}`, patch);
      await fetchLeadSources(integrationBrandId);
    } catch (err: any) {
      showApiError(err, 'Could not update lead source.');
    }
  };

  const rotateLeadSourceKey = async (sourceId: string) => {
    try {
      await axios.post(`/api/lead-sources/${sourceId}/rotate-key`);
      await fetchLeadSources(integrationBrandId);
      showToast('Lead source key rotated.');
    } catch (err: any) {
      showApiError(err, 'Could not rotate key.');
    }
  };

  const deleteLeadSource = async (sourceId: string) => {
    if (!confirm('Remove this lead source? Existing leads will stay in the CRM.')) return;
    try {
      await axios.delete(`/api/lead-sources/${sourceId}`);
      await fetchLeadSources(integrationBrandId);
      showToast('Lead source removed.');
    } catch (err: any) {
      showApiError(err, 'Could not remove lead source.');
    }
  };

  const fetchWebsiteAnalytics = async (brandId = integrationBrandId, siteId = '') => {
    try {
      const brandQuery = brandId ? `brand_id=${encodeURIComponent(brandId)}&` : '';
      const siteQuery = siteId ? `site_id=${encodeURIComponent(siteId)}&` : '';
      const [sitesRes, summaryRes] = await Promise.all([
        axios.get(`/api/website-analytics/sites${brandId && !siteId ? `?brand_id=${encodeURIComponent(brandId)}` : ''}`),
        axios.get(`/api/website-analytics/summary?${brandQuery}${siteQuery}days=30`),
      ]);
      setWebsiteAnalyticsSites(sitesRes.data?.sites || []);
      setWebsiteAnalyticsSummary(summaryRes.data || null);
    } catch (err) {
      console.error('Failed to load website analytics:', err);
      setWebsiteAnalyticsSites([]);
      setWebsiteAnalyticsSummary(null);
    }
  };

  const createWebsiteAnalyticsSite = async () => {
    if (!integrationBrandId) return;
    setWebsiteAnalyticsSaving(true);
    try {
      const brandName = managedBrands.find(brand => brand.id === integrationBrandId)?.name || integrationBrandId;
      await axios.post('/api/website-analytics/sites', {
        brand_id: integrationBrandId,
        name: websiteAnalyticsForm.name || `${brandName} website`,
        domain: websiteAnalyticsForm.domain,
      });
      setWebsiteAnalyticsForm({ name: '', domain: '' });
      await fetchWebsiteAnalytics(integrationBrandId);
      showToast('Website analytics connected.');
    } catch (err: any) {
      showApiError(err, 'Could not create website analytics site.');
    } finally {
      setWebsiteAnalyticsSaving(false);
    }
  };

  const updateWebsiteAnalyticsSite = async (siteId: string, patch: Partial<WebsiteAnalyticsSite>) => {
    try {
      await axios.put(`/api/website-analytics/sites/${siteId}`, patch);
      await fetchWebsiteAnalytics(integrationBrandId);
    } catch (err: any) {
      showApiError(err, 'Could not update website analytics site.');
    }
  };

  const deleteWebsiteAnalyticsSite = async (siteId: string) => {
    if (!confirm('Remove this website analytics connection? Existing traffic history will stay for reporting.')) return;
    try {
      await axios.delete(`/api/website-analytics/sites/${siteId}`);
      await fetchWebsiteAnalytics(integrationBrandId);
      showToast('Website analytics connection removed.');
    } catch (err: any) {
      showApiError(err, 'Could not remove website analytics site.');
    }
  };

  const fetchOutlookStatus = async (brandId = integrationBrandId) => {
    try {
      const res = await axios.get(`/api/integrations/outlook/status/${brandId}`);
      setOutlookStatus(res.data);
      return res.data;
    } catch (err) {
      console.error('Failed to load Outlook status:', err);
      setOutlookStatus(null);
      return null;
    }
  };

  useEffect(() => {
    const existing = brandIntegrations.find(i => i.brand_id === integrationBrandId);
    const next = existing || getDefaultIntegration(integrationBrandId);
    setIntegrationForm(next);
    setIntegrationStatus(null);
    setTemplateForm(prev => ({ ...prev, brand_id: integrationBrandId }));
  }, [integrationBrandId, brandIntegrations, managedBrands]);

  useEffect(() => {
    if (activeIntegrationChannel === 'email') {
      fetchGmailStatus(integrationBrandId);
      fetchOutlookStatus(integrationBrandId);
      fetchEmailConnections(integrationBrandId);
    }
    if (activeIntegrationChannel === 'leads') {
      fetchLeadSources(integrationBrandId);
      setLeadSourceForm(prev => ({
        ...prev,
        default_stage: prev.default_stage || getBrandStageOptions(integrationBrandId)[0] || 'New Lead',
      }));
    }
    if (activeIntegrationChannel === 'traffic') {
      fetchWebsiteAnalytics(integrationBrandId);
    }
  }, [activeIntegrationChannel, integrationBrandId]);

  useEffect(() => {
    if (activeTab === 'email-tracking' && selectedBrandForEmail?.id) {
      fetchEmailConnections(selectedBrandForEmail.id);
    }
  }, [activeTab, selectedBrandForEmail?.id]);

  useEffect(() => {
    if (integrationForm.email_sender_address && !gmailTestRecipient) {
      setGmailTestRecipient(integrationForm.email_sender_address);
    }
  }, [integrationForm.email_sender_address, gmailTestRecipient]);

  useEffect(() => {
    safeLocalStorage.setItem('crm_table_density', dashboardDensity);
  }, [dashboardDensity]);

  useEffect(() => {
    safeLocalStorage.setItem('crm_command_metrics_v2', JSON.stringify(commandMetrics));
  }, [commandMetrics]);

  useEffect(() => {
    safeLocalStorage.setItem('crm_saved_views', JSON.stringify(savedViews));
  }, [savedViews]);

  useEffect(() => {
    safeLocalStorage.setItem('crm_custom_lead_tabs', JSON.stringify(customLeadTabs));
  }, [customLeadTabs]);

  const saveBrandIntegration = async () => {
    setIntegrationSaving(true);
    try {
      const defaultAccount = getEmailAccountsForIntegration(integrationForm).find(account => account.is_default) || getEmailAccountsForIntegration(integrationForm)[0];
      const payload = activeIntegrationChannel === 'email' && defaultAccount ? {
        ...integrationForm,
        email_provider: defaultAccount.provider || integrationForm.email_provider,
        email_sender_address: defaultAccount.email || integrationForm.email_sender_address,
        email_reply_to: defaultAccount.reply_to || integrationForm.email_reply_to,
        smtp_host: defaultAccount.smtp_host || integrationForm.smtp_host,
        smtp_port: defaultAccount.smtp_port || integrationForm.smtp_port,
        smtp_secure: Boolean(defaultAccount.smtp_secure),
        smtp_username: defaultAccount.smtp_username || defaultAccount.email || integrationForm.smtp_username,
        smtp_password_env: defaultAccount.smtp_password_env || integrationForm.smtp_password_env,
      } : integrationForm;
      const res = await axios.put(`/api/brand-integrations/${integrationBrandId}`, payload);
      setBrandIntegrations(prev => {
        const exists = prev.some(i => i.brand_id === integrationBrandId);
        return exists ? prev.map(i => i.brand_id === integrationBrandId ? res.data : i) : [...prev, res.data];
      });
      setWhatsappNumbers(prev => ({ ...prev, [integrationBrandId]: integrationForm.whatsapp_number || prev[integrationBrandId] || '' }));
      setIntegrationStatus(null);
      if (integrationForm.whatsapp_provider === 'cloud_api') {
        const statusRes = await axios.get(`/api/brand-integrations/${integrationBrandId}/status`);
        setIntegrationStatus(statusRes.data);
        showToast(statusRes.data?.whatsapp?.api_ready ? 'Integration saved. Managed WhatsApp is ready.' : 'Integration saved. A few setup items still need attention.', !statusRes.data?.whatsapp?.api_ready);
      } else if (activeIntegrationChannel === 'email') {
        await fetchGmailStatus(integrationBrandId);
        await fetchOutlookStatus(integrationBrandId);
        showToast('Email setup saved.');
      } else {
        showToast('Brand integration profile saved.');
      }
    } catch (err) {
      showToast('Could not save integration profile.', true);
    } finally {
      setIntegrationSaving(false);
    }
  };

  const startGmailConnection = async () => {
    setGmailConnecting(true);
    try {
      await axios.put(`/api/brand-integrations/${integrationBrandId}`, { ...integrationForm, email_provider: 'gmail' });
      // Absolute UI origin so Render OAuth callback can bounce back to Vercel (not stay on the API host).
      const returnTo = `${window.location.origin}${window.location.pathname}${window.location.search || ''}`;
      const res = await axios.post(`/api/integrations/gmail/start/${integrationBrandId}`, { return_to: returnTo });
      if (res.data?.auth_url) {
        window.location.href = res.data.auth_url;
        return;
      }
      showToast('Could not start Gmail connection.', true);
    } catch (err: any) {
      showApiError(err, 'Could not start Gmail connection.');
      if (err?.response?.data?.redirect_uri) {
        console.info('Google redirect URI to add:', err.response.data.redirect_uri);
      }
    } finally {
      setGmailConnecting(false);
    }
  };

  const startOutlookConnection = async () => {
    setGmailConnecting(true);
    try {
      await axios.put(`/api/brand-integrations/${integrationBrandId}`, { ...integrationForm, email_provider: 'outlook' });
      // Absolute UI origin so Render OAuth callback can bounce back to Vercel (same pattern as Gmail).
      const returnTo = `${window.location.origin}${window.location.pathname}${window.location.search || ''}`;
      const res = await axios.post(`/api/integrations/outlook/start/${integrationBrandId}`, { return_to: returnTo });
      if (res.data?.auth_url) {
        window.location.href = res.data.auth_url;
        return;
      }
      showToast('Could not start Outlook connection.', true);
    } catch (err: any) {
      showApiError(err, 'Could not start Outlook connection.');
    } finally {
      setGmailConnecting(false);
    }
  };

  const sendGmailTestEmail = async () => {
    if (!gmailTestRecipient.trim()) {
      showToast('Add a test recipient email first.', true);
      return;
    }
    setGmailTesting(true);
    try {
      await axios.post(`/api/integrations/gmail/test/${integrationBrandId}`, { to_email: gmailTestRecipient.trim() });
      showToast(`Test email sent to ${gmailTestRecipient.trim()}.`);
      await fetchGmailStatus(integrationBrandId);
    } catch (err: any) {
      showApiError(err, 'Could not send test email.');
    } finally {
      setGmailTesting(false);
    }
  };

  const sendSmtpProviderTestEmail = async () => {
    if (!gmailTestRecipient.trim()) {
      showToast('Add a test recipient email first.', true);
      return;
    }
    setGmailTesting(true);
    try {
      const providerName = integrationForm.email_provider === 'outlook'
        ? 'Outlook'
        : integrationForm.email_provider === 'yahoo'
          ? 'Yahoo'
          : 'SMTP';
      await saveBrandIntegration();
      await axios.post('/api/emails/send-direct', {
        brand_id: integrationBrandId,
        to_email: gmailTestRecipient.trim(),
        subject: `${providerName} test from DirotiQ CRM`,
        html_content: `This is a ${providerName} SMTP test email from DirotiQ CRM.`,
        template_name: `${providerName} Test Email`,
        email_account_id: (getEmailAccountsForIntegration(integrationForm).find(account => account.is_default) || getEmailAccountsForIntegration(integrationForm)[0])?.id
      }, { timeout: 30000 });
      showToast(`Test email sent to ${gmailTestRecipient.trim()}.`);
      await fetchAllSentEmails();
    } catch (err: any) {
      const message = err?.code === 'ECONNABORTED'
        ? 'Email test timed out. Check the SMTP settings and try again.'
        : toUserFacingError(err, 'Could not send test email.');
      showToast(message, true);
    } finally {
      setGmailTesting(false);
    }
  };

  const sendDefaultMailboxTestEmail = async () => {
    const defaultConnection = emailConnections.find(connection => connection.brand_id === integrationBrandId && connection.is_default)
      || emailConnections.find(connection => connection.brand_id === integrationBrandId);
    if (!defaultConnection) {
      showToast('Connect a mailbox first.', true);
      return;
    }
    if (defaultConnection.provider === 'gmail') {
      await sendGmailTestEmail();
      return;
    }
    if (!gmailTestRecipient.trim()) {
      showToast('Add a test recipient email first.', true);
      return;
    }
    setGmailTesting(true);
    try {
      await axios.post('/api/emails/send-direct', {
        brand_id: integrationBrandId,
        to_email: gmailTestRecipient.trim(),
        subject: `Mailbox test from DirotiQ CRM`,
        html_content: `This is a mailbox test email from DirotiQ CRM.`,
        template_name: `Mailbox Test Email`,
        email_account_id: defaultConnection.id,
      }, { timeout: 30000 });
      showToast(`Test email sent to ${gmailTestRecipient.trim()}.`);
      await fetchAllSentEmails();
    } catch (err: any) {
      showApiError(err, 'Could not send test email.');
    } finally {
      setGmailTesting(false);
    }
  };

  const syncGmailReplies = async (brandId = selectedBrandForEmail?.id, silent = false) => {
    if (!brandId) return;
    setGmailSyncing(true);
    try {
      const res = await axios.post(`/api/integrations/gmail/sync/${brandId}`);
      await fetchAllSentEmails();
      if (activeEmailLead?.id) loadLeadDetailsHistory(activeEmailLead.id);
      const imported = Number(res.data?.imported || 0);
      const skipped = Number(res.data?.skipped || 0);
      if (!silent || imported > 0) {
        showToast(
          imported > 0
            ? `Imported ${imported} Gmail email${imported === 1 ? '' : 's'}.`
            : skipped > 0
              ? 'Gmail is up to date — no new messages to import.'
              : 'Gmail checked. No messages found in the last 30 days.',
        );
      }
    } catch (err: any) {
      console.error('Gmail sync failed:', err?.response?.data || err);
      if (!silent) showApiError(err, 'Could not sync Gmail. Open Email, click Sync, or reconnect Gmail with mailbox permissions.');
    } finally {
      setGmailSyncing(false);
    }
  };

  const syncOutlookMessages = async (brandId = selectedBrandForEmail?.id, silent = false) => {
    if (!brandId) return;
    setOutlookSyncing(true);
    try {
      const res = await axios.post(`/api/integrations/outlook/sync/${brandId}`);
      await fetchAllSentEmails();
      const imported = Number(res.data?.imported || 0);
      if (!silent || imported > 0) {
        showToast(imported > 0 ? `Imported ${imported} Outlook email${imported === 1 ? '' : 's'}.` : 'Outlook checked. No new messages found.');
      }
    } catch (err: any) {
      if (!silent) showApiError(err, 'Could not sync Outlook messages.');
    } finally {
      setOutlookSyncing(false);
    }
  };

  const syncCustomMailboxMessages = async (brandId = selectedBrandForEmail?.id, silent = false) => {
    if (!brandId) return;
    setCustomMailboxSyncing(true);
    try {
      const res = await axios.post(`/api/email-connections/custom/sync/${brandId}`);
      await fetchAllSentEmails();
      const imported = Number(res.data?.imported || 0);
      if (!silent || imported > 0) {
        showToast(imported > 0 ? `Imported ${imported} custom mailbox email${imported === 1 ? '' : 's'}.` : 'Custom mailbox checked. No new messages found.');
      }
    } catch (err: any) {
      if (!silent) showApiError(err, 'Could not sync custom mailbox.');
    } finally {
      setCustomMailboxSyncing(false);
    }
  };

  useEffect(() => {
    if (!user || activeTab !== 'email-tracking' || !selectedBrandForEmail?.id) return;
    const integration = getBrandIntegrationFor(selectedBrandForEmail.id);
    const gmailConnected = Boolean(
      integration?.gmail_refresh_token ||
      integration?.gmail_connected_email ||
      integration?.email_provider === 'gmail' ||
      emailProviderMode === 'gmail' ||
      (emailConnections || []).some(c => c.brand_id === selectedBrandForEmail.id && c.provider === 'gmail' && String(c.connection_status || 'connected') === 'connected'),
    );
    if (!gmailConnected) return;

    // Immediate pull after open, then poll so new Gmail mail shows in CRM.
    syncGmailReplies(selectedBrandForEmail.id, true);
    const timer = window.setInterval(() => {
      syncGmailReplies(selectedBrandForEmail.id, true);
    }, 60000);
    return () => window.clearInterval(timer);
  }, [user, activeTab, selectedBrandForEmail?.id, emailProviderMode, brandIntegrations, emailConnections]);

  const disconnectGmail = async () => {
    try {
      const res = await axios.delete(`/api/integrations/gmail/${integrationBrandId}`);
      await fetchBrandIntegrations();
      await fetchEmailConnections(integrationBrandId);
      await fetchGmailStatus(integrationBrandId);
      await fetchAllSentEmails();
      const removed = Number(res.data?.purged?.emails_removed || 0);
      const brandName = activeBrands.find(b => b.id === integrationBrandId)?.name || integrationBrandId;
      setDisconnectedEmailAlerts(prev => [...prev, {
        id: `disconnect_gmail_${integrationBrandId}_${Date.now()}`,
        brandId: integrationBrandId,
        provider: 'gmail',
        email: brandName,
        brandName,
      }]);
      showToast(`Gmail disconnected for this brand.${removed > 0 ? ` Cleared ${removed} synced email${removed === 1 ? '' : 's'}.` : ''}`);
    } catch {
      showToast('Could not disconnect Gmail.', true);
    }
  };

  const applyEmailProviderPreset = (provider: string) => {
    setIntegrationForm(prev => {
      const providerChanged = prev.email_provider !== provider;
      if (provider === 'outlook') {
        return {
          ...prev,
          email_provider: provider,
          smtp_host: providerChanged ? 'smtp-mail.outlook.com' : prev.smtp_host || 'smtp-mail.outlook.com',
          smtp_port: providerChanged ? '587' : prev.smtp_port || '587',
          smtp_secure: false,
          smtp_username: prev.smtp_username || prev.email_sender_address || '',
          smtp_password_env: providerChanged ? 'OUTLOOK_SMTP_PASSWORD' : prev.smtp_password_env || 'OUTLOOK_SMTP_PASSWORD',
        };
      }
      if (provider === 'yahoo') {
        return {
          ...prev,
          email_provider: provider,
          smtp_host: providerChanged ? 'smtp.mail.yahoo.com' : prev.smtp_host || 'smtp.mail.yahoo.com',
          smtp_port: providerChanged ? '465' : prev.smtp_port || '465',
          smtp_secure: true,
          smtp_username: prev.smtp_username || prev.email_sender_address || '',
          smtp_password_env: providerChanged ? 'YAHOO_SMTP_PASSWORD' : prev.smtp_password_env || 'YAHOO_SMTP_PASSWORD',
        };
      }
      if (provider === 'smtp') {
        return {
          ...prev,
          email_provider: provider,
          smtp_port: providerChanged ? '587' : prev.smtp_port || '587',
          smtp_secure: Boolean(prev.smtp_secure),
          smtp_username: prev.smtp_username || prev.email_sender_address || '',
          smtp_password_env: providerChanged ? 'SMTP_PASSWORD' : prev.smtp_password_env || 'SMTP_PASSWORD',
        };
      }
      return { ...prev, email_provider: provider };
    });
  };

  const checkBrandIntegrationStatus = async () => {
    setIntegrationChecking(true);
    try {
      const res = await axios.get(`/api/brand-integrations/${integrationBrandId}/status`);
      setIntegrationStatus(res.data);
      const ready = res.data?.whatsapp?.api_ready;
      showToast(ready ? 'Managed WhatsApp is ready for this brand.' : 'Setup check completed. A few setup items still need attention.', !ready);
    } catch {
      showToast('Could not check integration setup.', true);
    } finally {
      setIntegrationChecking(false);
    }
  };

  const loadMetaSdk = async (appId: string, graphVersion: string) => {
    const win = window as any;
    if (!win.FB) {
      await new Promise<void>((resolve, reject) => {
        const existing = document.getElementById('facebook-jssdk') as HTMLScriptElement | null;
        if (existing) {
          existing.addEventListener('load', () => resolve(), { once: true });
          existing.addEventListener('error', () => reject(new Error('Meta connection tools could not be loaded.')), { once: true });
          return;
        }
        const script = document.createElement('script');
        script.id = 'facebook-jssdk';
        script.src = 'https://connect.facebook.net/en_US/sdk.js';
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Meta connection tools could not be loaded.'));
        document.body.appendChild(script);
      });
    }
    win.FB.init({ appId, autoLogAppEvents: true, xfbml: false, version: graphVersion });
    return win.FB;
  };

  const startWhatsAppEmbeddedSignup = async () => {
    if (!integrationBrandId || whatsappConnecting) return;
    setWhatsAppConnecting(true);
    try {
      const configResponse = await axios.get('/api/integrations/whatsapp/embedded/config', { params: { brand_id: integrationBrandId } });
      const config = configResponse.data;
      const FB = await loadMetaSdk(config.app_id, config.graph_version);
      let sessionInfo: { waba_id: string; phone_number_id: string } | null = null;
      const sessionPromise = new Promise<{ waba_id: string; phone_number_id: string }>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          window.removeEventListener('message', listener);
          reject(new Error('Meta did not return the selected WhatsApp account. Please try again.'));
        }, 120000);
        const listener = (event: MessageEvent) => {
          let originHost = '';
          try {
            originHost = new URL(event.origin).hostname.replace(/^www\./, '');
          } catch {
            return;
          }
          if (originHost !== 'facebook.com' && !originHost.endsWith('.facebook.com')) return;
          let data: any = event.data;
          try {
            if (typeof data === 'string') data = JSON.parse(data);
          } catch {
            return;
          }
          if (data?.type !== 'WA_EMBEDDED_SIGNUP') return;
          if (data?.event === 'FINISH' && data?.data?.waba_id && data?.data?.phone_number_id) {
            window.clearTimeout(timeout);
            window.removeEventListener('message', listener);
            sessionInfo = { waba_id: String(data.data.waba_id), phone_number_id: String(data.data.phone_number_id) };
            resolve(sessionInfo);
          } else if (data?.event === 'ERROR') {
            window.clearTimeout(timeout);
            window.removeEventListener('message', listener);
            reject(new Error('Meta could not complete the WhatsApp connection.'));
          }
        };
        window.addEventListener('message', listener);
      });
      void sessionPromise.catch(() => undefined);
      const loginResponse = await new Promise<any>((resolve, reject) => {
        FB.login((response: any) => {
          if (response?.authResponse?.code) resolve(response);
          else reject(new Error('WhatsApp connection was cancelled before completion.'));
        }, {
          config_id: config.configuration_id,
          response_type: 'code',
          override_default_response_type: true,
          extras: { setup: {}, sessionInfoVersion: '3' },
        });
      });
      const selected = sessionInfo || await sessionPromise;
      const completed = await axios.post('/api/integrations/whatsapp/embedded/complete', {
        brand_id: integrationBrandId,
        code: loginResponse.authResponse.code,
        waba_id: selected.waba_id,
        phone_number_id: selected.phone_number_id,
      });
      if (completed.data?.connection) setIntegrationForm(prev => ({ ...prev, ...completed.data.connection }));
      await checkBrandIntegrationStatus();
      showToast(`WhatsApp connected${completed.data?.phone_number ? `: ${completed.data.phone_number}` : ''}.`);
    } catch (error: any) {
      showApiError(error, 'WhatsApp could not be connected. Please try again.');
    } finally {
      setWhatsAppConnecting(false);
    }
  };

  const disconnectWhatsAppEmbeddedSignup = async () => {
    if (!whatsappDisconnectConfirm) {
      setWhatsAppDisconnectConfirm(true);
      return;
    }
    setWhatsAppConnecting(true);
    try {
      const response = await axios.delete(`/api/integrations/whatsapp/embedded/${encodeURIComponent(integrationBrandId)}`);
      setIntegrationForm(prev => ({ ...prev, ...(response.data?.connection || {}) }));
      setWhatsAppDisconnectConfirm(false);
      await checkBrandIntegrationStatus();
      showToast('WhatsApp disconnected from this brand.');
    } catch (error: any) {
      showApiError(error, 'WhatsApp could not be disconnected.');
    } finally {
      setWhatsAppConnecting(false);
    }
  };

  const resetTemplateForm = () => {
    const channel: 'email' | 'whatsapp' | 'call' = activeIntegrationChannel === 'whatsapp' || activeIntegrationChannel === 'call' ? activeIntegrationChannel : 'email';
    setTemplateForm({ brand_id: integrationBrandId, channel, name: '', subject: '', body: '' });
  };

  const startEditMessageTemplate = (template: MessageTemplate) => {
    setIntegrationBrandId(template.brand_id);
    setActiveIntegrationChannel(template.channel);
    setTemplateForm({
      id: template.id,
      brand_id: template.brand_id,
      channel: template.channel,
      name: template.name,
      subject: template.subject || '',
      body: template.body || ''
    });
  };

  const saveMessageTemplate = async () => {
    if (!templateForm.name.trim() || !templateForm.body.trim()) {
      showToast('Add a template name and body first.', true);
      return;
    }
    setTemplateSaving(true);
    try {
      const payload = { ...templateForm, brand_id: integrationBrandId, channel: activeIntegrationChannel };
      if (templateForm.id) {
        await axios.put(`/api/message-templates/${templateForm.id}`, payload);
      } else {
        await axios.post('/api/message-templates', payload);
      }
      await fetchMessageTemplates();
      resetTemplateForm();
      showToast('Template saved.');
    } catch (err) {
      showToast('Could not save template.', true);
    } finally {
      setTemplateSaving(false);
    }
  };

  const deleteMessageTemplate = async (templateId: string) => {
    if (!confirm('Delete this communication template?')) return;
    try {
      await axios.delete(`/api/message-templates/${templateId}`);
      await fetchMessageTemplates();
      resetTemplateForm();
      showToast('Template deleted.');
    } catch (err) {
      showToast('Could not delete template.', true);
    }
  };

  const fetchTasksForActiveBrand = async () => {
    if (!selectedBrand) return;
    try {
      const res = await axios.get(`/api/tasks?brand_id=${selectedBrand.id}`);
      setTasks(res.data);
    } catch (err) {
      console.error('Failed to fetch brand tasks stream:', err);
    }
  };

  const fetchAllTasks = async () => {
    try {
      const res = await axios.get('/api/tasks');
      setAllTasks(res.data || []);
    } catch (err) {
      console.error('Failed to fetch all tasks:', err);
    }
  };

  // Customizable Widgets Logic
  const getLeadIdentityKey = (lead: Lead) => {
    const email = String(lead.email || '').toLowerCase().trim();
    if (email) return `email:${email}`;
    const phone = String(lead.phone || '').replace(/\D/g, '');
    if (phone) return `phone:${phone}`;
    return `name:${String(lead.name || lead.id).toLowerCase().trim()}`;
  };

  const getLeadOpportunityKey = (lead: Lead) => {
    return [
      lead.brand_id || '',
      lead.custom_fields?.segment || '',
      lead.custom_fields?.service_type || lead.custom_fields?.service_focus || lead.custom_fields?.service_interest || lead.custom_fields?.service_category_name || '',
      lead.funnel_stage || ''
    ].map(v => String(v || '').toLowerCase().trim()).join('::');
  };

  const isMultiOpportunityLead = (lead: Lead) => {
    const samePerson = leads.filter(l => l.id !== lead.id && getLeadIdentityKey(l) === getLeadIdentityKey(lead));
    return samePerson.some(l => getLeadOpportunityKey(l) !== getLeadOpportunityKey(lead));
  };

  // Brand-specific badge settings (labels, show/hide, multi-service wording, individual/business)
  useEffect(() => {
    if (!selectedBrand?.id) {
      setLeadBadgeSettings(null);
      return;
    }
    setLeadBadgeSettings(loadLeadBadgeSettings(selectedBrand.id));
  }, [selectedBrand?.id]);

  const getLeadBadgesFor = (lead: Lead) => {
    if (!selectedBrand || !leadBadgeSettings) return [];
    return resolveLeadBadges({
      lead,
      allLeads: leads,
      isDuplicate: duplicateLeadIds.has(lead.id),
      settings: leadBadgeSettings,
      availableFieldNames: customFields.map(cf => cf.field_name),
    });
  };

  /** Brand target-audience terms used to soft-highlight fitting leads (per-brand hue). */
  const brandAudienceTerms = useMemo(() => {
    if (!selectedBrand) return [] as string[];
    const managed = managedBrands.find(b => b.id === selectedBrand.id);
    const funnel = funnels[selectedBrand.id];
    return buildAudienceTerms({
      id: selectedBrand.id,
      name: selectedBrand.name,
      color: selectedBrand.color,
      description: managed?.description || funnel?.description || (selectedBrand as ManagedBrand).description,
      target_audience: managed?.target_audience || funnel?.target_audience,
      audience_keywords: managed?.audience_keywords || funnel?.audience_keywords,
    });
  }, [selectedBrand, managedBrands, funnels]);

  const leadAudienceMatchById = useMemo(() => {
    const map = new Map<string, { level: AudienceMatchLevel; matchedTerms: string[] }>();
    if (!selectedBrand || brandAudienceTerms.length === 0) return map;
    const managed = managedBrands.find(b => b.id === selectedBrand.id);
    const funnel = funnels[selectedBrand.id];
    const profile = {
      id: selectedBrand.id,
      name: selectedBrand.name,
      color: selectedBrand.color,
      description: managed?.description || funnel?.description,
      target_audience: managed?.target_audience || funnel?.target_audience,
      audience_keywords: managed?.audience_keywords || funnel?.audience_keywords,
    };
    for (const lead of leads) {
      const result = scoreLeadAudienceMatch(lead, profile, brandAudienceTerms);
      if (result.level !== 'none') {
        map.set(lead.id, { level: result.level, matchedTerms: result.matchedTerms });
      }
    }
    return map;
  }, [leads, selectedBrand, brandAudienceTerms, managedBrands, funnels]);

  const getLeadAudienceMatch = useCallback(
    (lead: Lead) => leadAudienceMatchById.get(lead.id) || { level: 'none' as AudienceMatchLevel, matchedTerms: [] as string[] },
    [leadAudienceMatchById],
  );

  const hasValidAbn = (lead: Lead) => {
    const raw = String(getLeadMetricRawValue(lead, 'abn number').value || '');
    const digits = raw.replace(/\D/g, '');
    return digits.length >= 9;
  };

  /** Prospect vs verified pool. Missing classification defaults to verified (legacy data). */
  const getLeadClassification = (lead: Lead): 'prospect' | 'verified' =>
    lead.lead_classification === 'prospect' ? 'prospect' : 'verified';
  const isVerifiedLead = (lead: Lead) => getLeadClassification(lead) === 'verified';
  const isProspectLead = (lead: Lead) => getLeadClassification(lead) === 'prospect';
  const filterLeadsByClassification = (items: Lead[], classification: 'prospect' | 'verified') =>
    items.filter(l => getLeadClassification(l) === classification);

  const countUniquePeople = (items: Lead[]) => new Set(items.map(getLeadIdentityKey)).size;

  // Brand-scoped identity key: same brand + (email || phone || name).
  // Two leads in DIFFERENT brands with the same email get DIFFERENT keys —
  // they are separate contacts. Only same-brand matches are duplicates.
  const getLeadIdentityKeyForBrand = (lead: Lead) => {
    const brand = lead.brand_id || '';
    const email = String(lead.email || '').toLowerCase().trim();
    if (email) return `${brand}::email:${email}`;
    const phone = String(lead.phone || '').replace(/\D/g, '');
    if (phone) return `${brand}::phone:${phone}`;
    return `${brand}::name:${String(lead.name || lead.id).toLowerCase().trim()}`;
  };

  // Deduplicate a lead list — keeps the earliest-created lead per identity group.
  const dedupeLeads = (items: Lead[]): Lead[] => {
    const seen = new Map<string, Lead>();
    items.forEach(l => {
      const key = getLeadIdentityKeyForBrand(l);
      const existing = seen.get(key);
      if (!existing || (l.created_at || '') < (existing.created_at || '')) {
        seen.set(key, l);
      }
    });
    return Array.from(seen.values());
  };

  // Count unique people within a single brand (for deduped dashboard totals).
  const countUniquePeopleForBrand = (items: Lead[]): number => new Set(items.map(getLeadIdentityKeyForBrand)).size;

  const getLeadBrand = (lead: Lead) => managedBrands.find(b => b.id === lead.brand_id) || BRANDS.find(b => b.id === lead.brand_id);

  const getLeadActivityCount = (lead: Lead) => {
    return allSentEmails.filter(e => e.lead_id === lead.id).length
      + allWhatsAppMessages.filter(w => w.lead_id === lead.id).length
      + allCallLogs.filter(c => c.lead_id === lead.id).length
      + leadNotes.filter(n => n.lead_id === lead.id).length;
  };

  const getGlobalLeadActivityCount = (lead: Lead) => {
    return allSentEmails.filter(e => e.lead_id === lead.id).length
      + allWhatsAppMessages.filter(w => w.lead_id === lead.id).length
      + allCallLogs.filter(c => c.lead_id === lead.id).length
      + leadNotes.filter(n => n.lead_id === lead.id).length;
  };

  const getLeadActionTrigger = (lead: Lead) => {
    const follow = getFollowUpStatus(lead);
    const emailCount = allSentEmails.filter(e => e.lead_id === lead.id).length;
    const waCount = allWhatsAppMessages.filter(w => w.lead_id === lead.id).length;
    const callCount = allCallLogs.filter(c => c.lead_id === lead.id).length;
    const noActivity = emailCount + waCount + callCount === 0;
    const followType = String(lead.custom_fields?.follow_up_type || '').toLowerCase();
    const stage = String(lead.funnel_stage || '').toLowerCase();
    const doNotContact = lead.custom_fields?.do_not_contact === true || String(lead.custom_fields?.do_not_contact).toLowerCase() === 'true';

    if (doNotContact) {
      return {
        priority: 0,
        label: 'Blocked',
        reason: 'Do-not-contact is enabled',
        trigger: 'Compliance guard',
        icon: 'fa-ban',
        tone: '#ef4444',
        tab: lead.brand_id
      };
    }
    if (follow.urgent) {
      const channel = followType.includes('whatsapp') ? 'WhatsApp' : followType.includes('email') ? 'Email' : 'Call';
      return {
        priority: 100,
        label: channel,
        reason: lead.follow_up_date ? `Follow-up due ${lead.follow_up_date}` : 'Follow-up marked as due',
        trigger: String(lead.custom_fields?.follow_up_status || 'Follow-up date reached'),
        icon: channel === 'WhatsApp' ? 'fab fa-whatsapp' : channel === 'Email' ? 'fa-envelope' : 'fa-phone',
        tone: channel === 'WhatsApp' ? '#25d366' : channel === 'Email' ? '#0f766e' : '#155e75',
        tab: channel === 'WhatsApp' ? 'whatsapp-tracking' : channel === 'Email' ? 'email-tracking' : 'calls'
      };
    }
    if (!String(lead.phone || '').replace(/\D/g, '')) {
      return {
        priority: 80,
        label: 'Fix phone',
        reason: 'Phone is missing, so call and WhatsApp cannot run',
        trigger: 'Data health rule',
        icon: 'fa-phone-slash',
        tone: '#ef4444',
        tab: lead.brand_id
      };
    }
    if (!String(lead.email || '').trim()) {
      return {
        priority: 70,
        label: 'Fix email',
        reason: 'Email is missing, so email automation cannot run',
        trigger: 'Data health rule',
        icon: 'fa-envelope-open-text',
        tone: '#f59e0b',
        tab: lead.brand_id
      };
    }
    if (stage.includes('new') && noActivity) {
      return {
        priority: 65,
        label: 'First touch',
        reason: 'New lead has no logged contact yet',
        trigger: 'New lead intake',
        icon: 'fa-paper-plane',
        tone: '#0f766e',
        tab: 'email-tracking'
      };
    }
    if (emailCount === 0) {
      return {
        priority: 55,
        label: 'Email',
        reason: 'No email has been sent to this lead yet',
        trigger: 'Channel coverage gap',
        icon: 'fa-envelope',
        tone: '#0f766e',
        tab: 'email-tracking'
      };
    }
    if (waCount === 0) {
      return {
        priority: 45,
        label: 'WhatsApp',
        reason: 'Email exists, but WhatsApp has not been tried',
        trigger: 'Next channel step',
        icon: 'fab fa-whatsapp',
        tone: '#25d366',
        tab: 'whatsapp-tracking'
      };
    }
    if (!['won', 'lost', 'closed'].some(done => stage.includes(done))) {
      return {
        priority: 35,
        label: 'Call',
        reason: 'Lead is active and has email/WhatsApp activity',
        trigger: 'Human follow-up recommended',
        icon: 'fa-phone',
        tone: '#0ea5e9',
        tab: 'calls'
      };
    }
    return {
      priority: 10,
      label: 'Review',
      reason: 'Pipeline stage is complete or quiet',
      trigger: 'Manual review',
      icon: 'fa-eye',
      tone: 'var(--text-secondary)',
      tab: lead.brand_id
    };
  };

  const getLeadIntelligence = (lead: Lead) => {
    const emails = allSentEmails.filter(e => e.lead_id === lead.id);
    const whatsapps = allWhatsAppMessages.filter(w => w.lead_id === lead.id);
    const calls = allCallLogs.filter(c => c.lead_id === lead.id);
    const notesForLead = leadNotes.filter(n => n.lead_id === lead.id);
    const action = getLeadActionTrigger(lead);
    const stage = String(lead.funnel_stage || '').toLowerCase();
    const fields = lead.custom_fields || {};
    const hasEmail = Boolean(String(lead.email || '').trim());
    const hasPhone = Boolean(String(lead.phone || '').replace(/\D/g, ''));
    const isDoNotContact = fields.do_not_contact === true || String(fields.do_not_contact).toLowerCase() === 'true';
    const isClosed = ['won', 'registered', 'converted', 'lost', 'closed'].some(token => stage.includes(token));
    const isWon = ['won', 'registered', 'converted'].some(token => stage.includes(token));
    const source = fields.source_name || fields.source || fields.lead_source_name || fields.lead_source || fields.campaign || lead.source || 'Manual/CRM';
    const activityDates = [
      lead.updated_at,
      lead.created_at,
      ...emails.map(e => e.opened_at || e.read_at || e.created_at),
      ...whatsapps.map(w => w.created_at),
      ...calls.map(c => c.created_at),
      ...notesForLead.map(n => n.created_at),
    ].filter(Boolean)
      .map(value => new Date(String(value)).getTime())
      .filter(value => !Number.isNaN(value));
    const latestActivityMs = activityDates.length ? Math.max(...activityDates) : 0;
    const daysSinceActivity = latestActivityMs ? Math.floor((Date.now() - latestActivityMs) / 86400000) : null;
    const touchCount = emails.length + whatsapps.length + calls.length + notesForLead.length;
    const hasReplySignal = emails.some(e => e.opened_at || e.read_at || Number(e.open_count || 0) > 0)
      || calls.some(c => /interested|answered|booked|positive|scheduled/i.test(String(c.outcome || c.notes || '')))
      || notesForLead.some(n => /interested|budget|ready|urgent|demo|quote|pricing|proposal|called back|booked/i.test(String(n.content || '')));
    const overdueFollowUp = isFollowUpDue(lead);
    const recent = daysSinceActivity !== null && daysSinceActivity <= 3;
    const stale = daysSinceActivity === null || daysSinceActivity >= 10;
    const reasons: string[] = [];
    let score = 42;

    if (hasEmail) score += 10; else reasons.push('Email is missing');
    if (hasPhone) score += 10; else reasons.push('Phone is missing');
    if (hasReplySignal) { score += 18; reasons.push('There is engagement or interest in the activity history'); }
    if (recent) { score += 10; reasons.push('Activity is recent'); }
    if (overdueFollowUp) { score += 12; reasons.push('Follow-up is due now'); }
    if (/proposal|quote|qualified|demo|trial|payment|closing|negotiation/i.test(stage)) { score += 14; reasons.push(`Stage is ${lead.funnel_stage}`); }
    if (stale && !isClosed) { score -= 16; reasons.push('No recent activity has been logged'); }
    if (isWon) score = Math.max(score, 88);
    if (isDoNotContact) score = 5;
    score = Math.max(0, Math.min(100, score));

    let label = 'Warm';
    let tone = '#f59e0b';
    let icon = 'fa-temperature-half';
    if (isDoNotContact) {
      label = 'Blocked';
      tone = '#ef4444';
      icon = 'fa-ban';
    } else if (isWon) {
      label = 'Converted';
      tone = '#10b981';
      icon = 'fa-circle-check';
    } else if (overdueFollowUp || (score >= 74 && !stale)) {
      label = 'Hot';
      tone = '#ef4444';
      icon = 'fa-fire';
    } else if (stale || score < 38) {
      label = 'Cold';
      tone = '#64748b';
      icon = 'fa-snowflake';
    } else if (action.priority >= 60) {
      label = 'Needs follow-up';
      tone = '#0f766e';
      icon = 'fa-bell';
    }

    const contactQuality = hasEmail && hasPhone ? 'Email and phone ready' : hasEmail ? 'Email only' : hasPhone ? 'Phone only' : 'Missing contact details';
    const lastActivity = daysSinceActivity === null ? 'No activity yet' : daysSinceActivity === 0 ? 'Today' : `${daysSinceActivity} day${daysSinceActivity === 1 ? '' : 's'} ago`;
    const summary = isDoNotContact
      ? `${lead.name} is marked do-not-contact. Keep this record for history only until that flag changes.`
      : isWon
        ? `${lead.name} is already in a converted stage. Keep the timeline updated and focus on onboarding or retention.`
        : `${lead.name} is a ${label.toLowerCase()} lead from ${source}. Stage is ${lead.funnel_stage || 'not set'}, contact quality is ${contactQuality.toLowerCase()}, and last activity was ${lastActivity.toLowerCase()}.`;

    return {
      score,
      label,
      tone,
      icon,
      summary,
      nextAction: action.reason,
      actionLabel: action.label,
      actionIcon: action.icon,
      reasons: reasons.length ? reasons.slice(0, 3) : ['No major risk found yet', 'Keep the next action updated as the lead progresses'],
      metrics: [
        { label: 'Score', value: `${score}/100` },
        { label: 'Touches', value: String(touchCount) },
        { label: 'Last activity', value: lastActivity },
        { label: 'Source', value: String(source) },
      ],
    };
  };

  const getNextActionForLead = (lead: Lead) => {
    return getLeadActionTrigger(lead);
  };

  const duplicateLeadGroups = useMemo(() => {
    const map = new Map<string, Lead[]>();
    leads.forEach(l => {
      const key = getLeadIdentityKey(l);
      if (!key) return;
      map.set(key, [...(map.get(key) || []), l]);
    });
    return Array.from(map.values()).filter(group => group.length > 1);
  }, [leads]);

  const globalDuplicateLeadGroups = useMemo(() => {
    const map = new Map<string, Lead[]>();
    allCrmLeads.forEach(l => {
      const key = getLeadIdentityKey(l);
      if (!key) return;
      map.set(key, [...(map.get(key) || []), l]);
    });
    return Array.from(map.values()).filter(group => group.length > 1);
  }, [allCrmLeads]);

  // Portfolio / command-center data insights use verified leads only.
  // Prospects stay in their own pool so high-quality numbers are not diluted.
  const insightSourceLeads = useMemo(
    () => filterLeadsByClassification(allCrmLeads.length ? allCrmLeads : leads, 'verified'),
    [allCrmLeads, leads],
  );

  const todayCommand = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sourceLeads = insightSourceLeads;
    const followUpDays = notificationPreferences.follow_up_remind_days;
    const due = sourceLeads.filter(l => isFollowUpDueWithinDays(l, followUpDays));
    const newLeads = sourceLeads.filter(l => String(l.funnel_stage || '').toLowerCase() === 'new lead');
    const missingPhone = sourceLeads.filter(l => !String(l.phone || '').replace(/\D/g, ''));
    const missingContact = sourceLeads.filter(l =>
      !String(l.phone || '').replace(/\D/g, '') &&
      !String(l.email || '').trim()
    );
    const taskgoLeads = sourceLeads.filter(l => l.brand_id === 'taskgo');
    const taskgoMissingAbn = taskgoLeads.filter(l => !hasValidAbn(l));
    const untouched = sourceLeads.filter(l => getGlobalLeadActivityCount(l) === 0);
    return {
      due,
      newLeads,
      missingPhone,
      missingContact,
      untouched,
      taskgo: {
        uniquePeople: countUniquePeople(taskgoLeads),
        withAbn: countUniquePeople(taskgoLeads.filter(hasValidAbn)),
        missingAbn: countUniquePeople(taskgoMissingAbn),
      }
    };
  }, [insightSourceLeads, allSentEmails, allWhatsAppMessages, allCallLogs, notificationPreferences.follow_up_remind_days]);

  const todayKey = new Date().toISOString().slice(0, 10);

  const portfolioLeaderboard = useMemo(() => {
    const sourceLeads = insightSourceLeads;
    const max = Math.max(1, ...activeBrands.map(brand => countUniquePeopleForBrand(sourceLeads.filter(l => l.brand_id === brand.id))));
    return activeBrands.map(brand => {
      const rows = sourceLeads.filter(l => l.brand_id === brand.id);
      const uniqueTotal = countUniquePeopleForBrand(rows);
      const due = rows.filter(l => isFollowUpDue(l)).length;
      const won = rows.filter(l => String(l.funnel_stage || '').toLowerCase().includes('won') || String(l.funnel_stage || '').toLowerCase().includes('subscribed') || String(l.funnel_stage || '').toLowerCase().includes('registered')).length;
      return { brand, total: uniqueTotal, due, won, pct: Math.round((uniqueTotal / max) * 100) };
    }).sort((a, b) => b.total - a.total);
  }, [insightSourceLeads, activeBrands]);

  const tasksDueToday = useMemo(() => {
    const sourceLeads = allCrmLeads.length ? allCrmLeads : leads;
    const leadTasks = sourceLeads
      .filter(l => String(l.follow_up_date || '').slice(0, 10) === todayKey)
      .map(l => ({ id: `lead-${l.id}`, type: 'Lead follow-up', title: l.name, brand_id: l.brand_id, detail: l.funnel_stage, lead: l }));
    const teamTasks = allTasks
      .filter(t => String(t.status || '').toLowerCase() !== 'completed')
      .filter(t => String(t.due_date || t.follow_up_date || t.created_at || '').slice(0, 10) === todayKey)
      .map(t => ({ id: `task-${t.id}`, type: 'Team task', title: t.content || 'Task', brand_id: t.brand_id || '', detail: t.status || 'Pending', task: t }));
    return [...leadTasks, ...teamTasks].slice(0, 12);
  }, [allCrmLeads, leads, allTasks, todayKey]);

  const recentActivityFeed = useMemo(() => {
    const sourceLeads = allCrmLeads.length ? allCrmLeads : leads;
    const leadById = new Map(sourceLeads.map(l => [l.id, l]));
    const leadActivities = sourceLeads.map(l => ({ id: `lead-${l.id}`, type: 'Lead updated', title: l.name, brand_id: l.brand_id, detail: l.funnel_stage || 'Lead record', created_at: l.updated_at || l.created_at || new Date().toISOString(), icon: 'fa-user-pen' }));
    const emailActivities = allSentEmails.map(e => { const lead = e.lead_id ? leadById.get(e.lead_id) : undefined; return { id: `email-${e.id}`, type: 'Email sent', title: lead?.name || e.subject || 'Email activity', brand_id: e.brand_id || lead?.brand_id || '', detail: e.subject || e.status || 'Email logged', created_at: e.created_at || new Date().toISOString(), icon: 'fa-envelope' }; });
    const waActivities = allWhatsAppMessages.map(w => { const lead = w.lead_id ? leadById.get(w.lead_id) : undefined; return { id: `wa-${w.id}`, type: 'WhatsApp', title: lead?.name || 'WhatsApp message', brand_id: w.brand_id || lead?.brand_id || '', detail: w.status || 'Message logged', created_at: w.created_at || new Date().toISOString(), icon: 'fa-comment-dots' }; });
    const callActivities = allCallLogs.map(c => { const lead = c.lead_id ? leadById.get(c.lead_id) : undefined; return { id: `call-${c.id}`, type: 'Call logged', title: lead?.name || 'Call activity', brand_id: lead?.brand_id || '', detail: c.outcome || `${c.duration || 0}s call`, created_at: c.created_at || new Date().toISOString(), icon: 'fa-phone' }; });
    const taskActivities = allTasks.map(t => ({ id: `task-${t.id}`, type: 'Task activity', title: t.content || 'Task', brand_id: t.brand_id || '', detail: t.status || 'Task update', created_at: t.created_at || new Date().toISOString(), icon: 'fa-list-check' }));
    return [...emailActivities, ...waActivities, ...callActivities, ...taskActivities, ...leadActivities]
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
      .slice(0, 10);
  }, [allCrmLeads, leads, allSentEmails, allWhatsAppMessages, allCallLogs, allTasks]);

  const brandOperatingMetrics = useMemo(() => {
    // Verified-only — prospects must not inflate portfolio operating metrics.
    const sourceLeads = insightSourceLeads;
    const brandLeads = (brandId: string) => sourceLeads.filter(l => l.brand_id === brandId);
    const fieldEquals = (rows: Lead[], key: string, value: string) => rows.filter(l => String(l.custom_fields?.[key] || '').toLowerCase().trim() === value.toLowerCase()).length;
    const fieldIncludes = (rows: Lead[], key: string, value: string) => rows.filter(l => String(l.custom_fields?.[key] || '').toLowerCase().includes(value.toLowerCase())).length;
    type MetricItem = { label: string; value: number | string; focus?: LeadWorkbenchFocus };
    const rows = activeBrands.map(brand => {
      const rowsForBrand = brandLeads(brand.id);
      let items: MetricItem[] = [];
      if (brand.id === 'taskgo') {
        items = [
          { label: 'Registered contractors', value: countUniquePeople(rowsForBrand), focus: { label: 'Registered contractors' } },
          { label: 'ABN verified contractors', value: countUniquePeople(rowsForBrand.filter(hasValidAbn)), focus: { label: 'ABN verified contractors', abn: 'has_abn' } },
          { label: 'Missing ABN', value: countUniquePeople(rowsForBrand.filter(l => !hasValidAbn(l))), focus: { label: 'Missing ABN', abn: 'no_abn' } },
        ];
      } else if (brand.id === 'optimaviz') {
        items = [
          { label: 'Demo leads', value: rowsForBrand.filter(l => getOptimavizLeadSegment(l) === 'demo_leads').length, focus: { label: 'Demo leads', segment: 'demo_leads' } },
          { label: 'Trial leads', value: rowsForBrand.filter(l => getOptimavizLeadSegment(l) === 'trial_leads').length, focus: { label: 'Trial leads', segment: 'trial_leads' } },
          { label: 'Subscribers', value: rowsForBrand.filter(isOptimavizSubscriber).length, focus: { label: 'Subscribers', segment: 'subscribed_platform_users' } },
        ];
      } else if (brand.id === 'nestwise') {
        items = [
          { label: 'Property owner leads', value: rowsForBrand.length, focus: { label: 'Property owner leads' } },
          { label: 'Onboarded owners', value: rowsForBrand.filter(l => l.funnel_stage === 'Won' || String(l.custom_fields?.follow_up_status || '').toLowerCase().includes('onboard')).length, focus: { label: 'Onboarded owners', stage: 'Won' } },
          { label: 'Bulawayo properties', value: fieldIncludes(rowsForBrand, 'property_location', 'bulawayo'), focus: { label: 'Bulawayo properties', customField: { field: 'property_location', value: 'Bulawayo' } } },
        ];
      } else if (brand.id === 'idao') {
        items = [
          { label: 'Training leads', value: fieldEquals(rowsForBrand, 'segment', 'training_leads'), focus: { label: 'Training leads', segment: 'training_leads' } },
          { label: 'Quotes sent', value: fieldEquals(rowsForBrand, 'quote_status', 'Quote Sent'), focus: { label: 'Quotes sent', customField: { field: 'quote_status', value: 'Quote Sent' } } },
          { label: 'Follow-ups due', value: fieldIncludes(rowsForBrand, 'follow_up_status', 'follow'), focus: { label: 'Follow-ups due', customField: { field: 'follow_up_status', value: 'follow' } } },
        ];
      } else if (brand.id === 'optimaclean') {
        items = [
          { label: 'Cleaning pipeline', value: rowsForBrand.length, focus: { label: 'Cleaning pipeline' } },
          { label: 'Proposal stage', value: rowsForBrand.filter(l => String(l.funnel_stage || '').toLowerCase().includes('proposal')).length, focus: { label: 'Proposal stage', stage: 'Proposal' } },
          { label: 'Clients', value: fieldEquals(rowsForBrand, 'segment', 'clients'), focus: { label: 'Clients', segment: 'clients' } },
        ];
      } else {
        items = [
          { label: 'Total leads', value: rowsForBrand.length, focus: { label: 'Total leads' } },
          { label: 'New leads', value: rowsForBrand.filter(l => String(l.funnel_stage || '').toLowerCase() === 'new lead').length, focus: { label: 'New leads', stage: 'New Lead' } },
          { label: 'Missing phones', value: rowsForBrand.filter(l => !String(l.phone || '').replace(/\D/g, '')).length, focus: { label: 'Missing phones' } },
        ];
      }
      return { brand, items };
    });
    return rows.filter(row => row.items.some(item => Number(item.value) > 0));
  }, [insightSourceLeads, activeBrands]);

  const pipelineHealthByBrand = useMemo(() => {
    const sourceLeads = insightSourceLeads;
    return activeBrands.map(brand => {
      const brandLeads = sourceLeads.filter(l => l.brand_id === brand.id);
      const stageRows = getBrandStageOptions(brand.id).map(stage => {
        const stageLeads = brandLeads.filter(l => l.funnel_stage === stage);
        const avgAge = stageLeads.length
          ? Math.round(stageLeads.reduce((sum, l) => sum + Math.max(0, Math.floor((Date.now() - new Date(l.created_at || Date.now()).getTime()) / 86400000)), 0) / stageLeads.length)
          : 0;
        return { stage, count: stageLeads.length, avgAge };
      });
      return { brand, total: brandLeads.length, stageRows };
    });
  }, [insightSourceLeads, activeBrands]);

  const notificationItems = useMemo(() => {
    const sourceLeads = insightSourceLeads;
    const openDataCleanupAlert = () => {
      setShowDataCleanupStudio(true);
      setActiveTab('intelligence');
    };
    const verifiedDuplicateGroups = globalDuplicateLeadGroups.filter(group => group.some(isVerifiedLead));
    const items = [
      { label: 'Follow-ups due', value: todayCommand.due.length, icon: 'fa-clock', color: '#f59e0b', action: () => setActiveTab('dashboard') },
      { label: 'Missing contact details', value: todayCommand.missingContact.length, icon: 'fa-address-card', color: '#ef4444', action: openDataCleanupAlert },
      { label: 'Duplicate people', value: verifiedDuplicateGroups.length, icon: 'fa-clone', color: '#0ea5e9', action: openDataCleanupAlert },
      { label: 'Do-not-contact leads', value: sourceLeads.filter(l => l.custom_fields?.do_not_contact === true || String(l.custom_fields?.do_not_contact).toLowerCase() === 'true').length, icon: 'fa-ban', color: '#ef4444', action: () => setActiveTab('dashboard') },
    ];
    // Cleared aggregate alerts stay hidden while the problem count is the same
    // or smaller, and reappear only when the count grows again.
    return items.filter(i => i.value > 0 && !isNotificationItemDismissed(i));
  }, [insightSourceLeads, todayCommand, globalDuplicateLeadGroups, dismissedNotificationIds]);

  const saveCurrentView = () => {
    if (!selectedBrand || !savedViewName.trim()) return;
    const view = {
      name: savedViewName.trim(),
      stage: selectedStageFilter,
      search: searchQuery,
      segment: selectedSegmentFilter,
      city: selectedCityFilter,
      service: selectedServiceFilter,
      abn: selectedAbnFilter,
      dateWindow: selectedDateWindow,
      dateFrom: selectedDateFrom,
      dateTo: selectedDateTo
    };
    setSavedViews(prev => ({ ...prev, [selectedBrand.id]: [...(prev[selectedBrand.id] || []), view] }));
    setSavedViewName('');
    showToast('Lead view saved.');
  };

  const applySavedView = (view: { stage: string; search: string; segment: string; city: string; service: string; abn: string; dateWindow?: DateWindowFilter; dateFrom?: string; dateTo?: string }) => {
    setSelectedStageFilter(view.stage || 'all');
    setSearchQuery(view.search || '');
    setSelectedSegmentFilter(view.segment || 'all');
    setSelectedCityFilter(view.city || 'all');
    setSelectedServiceFilter(view.service || 'all');
    setSelectedAbnFilter((view.abn as 'all' | 'has_abn' | 'no_abn') || 'all');
    setSelectedDateWindow(view.dateWindow || 'all');
    setSelectedDateFrom(view.dateFrom || '');
    setSelectedDateTo(view.dateTo || '');
    setActiveProductView(null);
  };

  /** Productized one-click lead views (high polish, low build). */
  const applyProductView = (viewId: 'needs-reply' | 'hot-unassigned' | 'cross-sell') => {
    setActiveProductView(viewId);
    if (viewId === 'needs-reply') {
      // Jump to action inbox (emails needing reply) for current brand context
      handleCommandNavigate('email-tracking');
      setEmailMailboxFilter('action');
      setEmailProviderFilter('all');
      showToast('Action Inbox: emails that need a reply.');
      return;
    }
    if (!selectedBrand) {
      showToast('Open a brand first, then apply this view.', true);
      return;
    }
    setBrandSubTab('leads');
    setLeadWorkspaceView('table');
    setSelectedStageFilter('all');
    setSelectedSegmentFilter('all');
    setSelectedCityFilter('all');
    setSelectedServiceFilter('all');
    setSelectedAbnFilter('all');
    setSelectedDateWindow('all');
    setSelectedDateFrom('');
    setSelectedDateTo('');
    setSelectedCustomFieldFilter(null);
    setActiveSpotlightFilters({});
    setSearchQuery('');
    setKanbanSearchQuery('');
    setLeadFocusFilter(null);
    if (viewId === 'hot-unassigned') {
      setLeadClassificationTab('verified');
      showToast('Hot verified leads with no owner — assign someone.');
    } else if (viewId === 'cross-sell') {
      setLeadClassificationTab('verified');
      showToast('Cross-sell candidates — multi-service or hand-off ready.');
    }
  };

  const captureCurrentFilters = (): CustomLeadTab['filters'] => ({
    stage: selectedStageFilter,
    search: searchQuery,
    segment: selectedSegmentFilter,
    city: selectedCityFilter,
    service: selectedServiceFilter,
    abn: selectedAbnFilter,
    dateWindow: selectedDateWindow,
    dateFrom: selectedDateFrom,
    dateTo: selectedDateTo,
  });

  const applyCustomTabFilters = (filters: CustomLeadTab['filters']) => {
    setSelectedStageFilter(filters.stage || 'all');
    setSearchQuery(filters.search || '');
    setSelectedSegmentFilter(filters.segment || 'all');
    setSelectedCityFilter(filters.city || 'all');
    setSelectedServiceFilter(filters.service || 'all');
    setSelectedAbnFilter((filters.abn as 'all' | 'has_abn' | 'no_abn') || 'all');
    setSelectedDateWindow(filters.dateWindow || 'all');
    setSelectedDateFrom(filters.dateFrom || '');
    setSelectedDateTo(filters.dateTo || '');
    setActiveProductView(null);
  };

  const openCreateCustomTab = () => {
    if (!selectedBrand) { showToast('Open a brand first.', true); return; }
    setCustomTabName('');
    setCustomTabIcon('fa-fire');
    setCustomTabColor('#f59e0b');
    setUseCurrentFiltersForTab(true);
    setEditingCustomTabId(null);
    setShowCustomTabModal(true);
  };

  const openEditCustomTab = (tab: CustomLeadTab) => {
    setCustomTabName(tab.name);
    setCustomTabIcon(tab.icon);
    setCustomTabColor(tab.color);
    setUseCurrentFiltersForTab(false);
    setEditingCustomTabId(tab.id);
    setShowCustomTabModal(true);
  };

  const saveCustomTab = () => {
    if (!selectedBrand || !customTabName.trim()) return;
    setCustomLeadTabs(prev => {
      const brandTabs = [...(prev[selectedBrand.id] || [])];
      if (editingCustomTabId) {
        const idx = brandTabs.findIndex(t => t.id === editingCustomTabId);
        if (idx >= 0) {
          const existing = brandTabs[idx]!;
          brandTabs[idx] = {
            ...existing,
            name: customTabName.trim(),
            icon: customTabIcon,
            color: customTabColor,
            filters: useCurrentFiltersForTab ? captureCurrentFilters() : existing.filters,
          };
        }
      } else {
        const newTab: CustomLeadTab = {
          id: `custom_${Date.now()}`,
          name: customTabName.trim(),
          icon: customTabIcon,
          color: customTabColor,
          filters: captureCurrentFilters(),
        };
        brandTabs.push(newTab);
      }
      return { ...prev, [selectedBrand.id]: brandTabs };
    });
    setShowCustomTabModal(false);
    setEditingCustomTabId(null);
    showToast(editingCustomTabId ? 'Tab updated.' : 'Tab created.');
  };

  const deleteCustomTab = (tabId: string) => {
    if (!selectedBrand) return;
    setCustomLeadTabs(prev => {
      const brandTabs = (prev[selectedBrand.id] || []).filter(t => t.id !== tabId);
      const next = { ...prev, [selectedBrand.id]: brandTabs };
      if (activeCustomTabId === tabId) {
        setActiveCustomTabId(null);
        setLeadClassificationTab('verified');
      }
      return next;
    });
    showToast('Tab deleted.');
  };

  const activateCustomTab = (tab: CustomLeadTab) => {
    setActiveCustomTabId(tab.id);
    applyCustomTabFilters(tab.filters);
  };

  const activateSystemTab = (tab: 'verified' | 'prospect') => {
    setLeadClassificationTab(tab);
    setActiveCustomTabId(null);
    clearLeadTableFilters();
  };

  const getActiveCustomTab = (): CustomLeadTab | undefined => {
    if (!activeCustomTabId || !selectedBrand) return undefined;
    return (customLeadTabs[selectedBrand.id] || []).find(t => t.id === activeCustomTabId);
  };

  const countLeadsForCustomTab = (tab: CustomLeadTab): number => {
    if (!selectedBrand) return 0;
    const s = tab.filters.search.toLowerCase();
    return leads.filter(lead => {
      const matchesSearch = !s ||
        String(lead.name || '').toLowerCase().includes(s) ||
        String(lead.email || '').toLowerCase().includes(s) ||
        String(lead.phone || '').toLowerCase().includes(s) ||
        (lead.notes && String(lead.notes || '').toLowerCase().includes(s));
      const leadStageForFilter = selectedBrand?.id === 'optimaviz' ? getOptimavizLeadStage(lead) : selectedBrand?.id === 'idao' ? getIdaoLeadStage(lead) : lead.funnel_stage;
      const leadSegmentForFilter = selectedBrand?.id === 'optimaviz' ? getOptimavizLeadSegment(lead) : selectedBrand?.id === 'idao' ? getIdaoLeadSegment(lead) : lead.custom_fields?.segment;
      const matchesStage = tab.filters.stage === 'all' || leadStageForFilter === tab.filters.stage;
      const matchesSegment = tab.filters.segment === 'all' || leadSegmentForFilter === tab.filters.segment;
      const matchesCity = tab.filters.city === 'all' || (lead.custom_fields && (lead.custom_fields.city || lead.custom_fields.City || '').toLowerCase() === tab.filters.city.toLowerCase());
      const matchesService = tab.filters.service === 'all' || (lead.custom_fields && (lead.custom_fields.service_category_name || lead.custom_fields.ServiceCategoryName || lead.custom_fields.service_category || '').toLowerCase() === tab.filters.service.toLowerCase());
      const matchesAbn = tab.filters.abn === 'all' || (() => {
        const abnValue = lead.custom_fields && (lead.custom_fields.abn_number || lead.custom_fields.AbnNumber || lead.custom_fields.abn);
        const hasAbn = abnValue && String(abnValue).replace(/\s+/g, '').length >= 9 && String(abnValue).toLowerCase() !== 'no abn supplied';
        return tab.filters.abn === 'has_abn' ? !!hasAbn : !hasAbn;
      })();
      const matchesDateWindow = tab.filters.dateWindow === 'all' || (tab.filters.dateFrom || tab.filters.dateTo ? isLeadInCustomDateRange(lead, tab.filters.dateFrom, tab.filters.dateTo) : isLeadInDateWindow(lead, tab.filters.dateWindow as any));
      return matchesSearch && matchesStage && matchesSegment && matchesCity && matchesService && matchesAbn && matchesDateWindow;
    }).length;
  };

  const handlePowerAction = async (actionId: PowerActionId) => {
    const focusLead = activeLead || lastViewedLead;
    if (actionId === 'sync-gmail') {
      const brandId = selectedBrandForEmail?.id || selectedBrand?.id || activeBrands[0]?.id;
      if (!brandId) { showToast('Pick a brand first.', true); return; }
      handleCommandNavigate('email-tracking');
      setSelectedBrandForEmail(activeBrands.find(b => b.id === brandId) || selectedBrandForEmail);
      await syncGmailReplies(brandId, false);
      return;
    }
    if (actionId === 'create-task') {
      if (!focusLead) { showToast('Open a lead first, then create a task.', true); return; }
      const brandId = focusLead.brand_id || selectedBrand?.id;
      if (!brandId) return;
      try {
        await axios.post('/api/tasks', {
          brand_id: brandId,
          content: `Follow up: ${focusLead.name || 'lead'}${focusLead.email ? ` (${focusLead.email})` : ''}`,
          status: 'Pending',
          task_date: new Date().toISOString().split('T')[0],
        });
        showToast(`Task created for ${focusLead.name || 'lead'}.`);
        if (selectedBrand?.id === brandId) fetchTasksForActiveBrand?.();
      } catch {
        showToast('Could not create task.', true);
      }
      return;
    }
    if (actionId === 'handoff-nestwise') {
      if (!focusLead) { showToast('Open a lead first to hand off.', true); return; }
      try {
        await axios.post(`/api/leads/${encodeURIComponent(focusLead.id)}/notes`, {
          content: `Cross-brand hand-off → NestWise. Source brand: ${focusLead.brand_name || focusLead.brand_id}. Contact: ${focusLead.email || focusLead.phone || 'n/a'}. Review for NestWise fit.`,
        });
        await axios.post(`/api/leads/${encodeURIComponent(focusLead.id)}/events`, {
          event_type: 'handoff',
          detail: 'nestwise',
        });
        const nest = activeBrands.find(b => b.id === 'nestwise') || managedBrands.find(b => b.id === 'nestwise');
        if (nest) handleSelectBrand(nest);
        else {
          setActiveTab('intelligence');
          showToast('Hand-off note logged. NestWise brand not found — open Intelligence for portfolio rules.');
          return;
        }
        showToast('Hand-off noted and NestWise opened.');
        if (activeLead?.id === focusLead.id) loadLeadDetailsHistory(focusLead.id);
      } catch {
        showToast('Could not complete hand-off.', true);
      }
      return;
    }
    if (actionId === 'view-needs-reply') applyProductView('needs-reply');
    if (actionId === 'view-hot-unassigned') applyProductView('hot-unassigned');
    if (actionId === 'view-cross-sell') applyProductView('cross-sell');
    if (actionId === 'go-email') handleCommandNavigate('email-tracking');
    if (actionId === 'go-comms') handleCommandNavigate('communications');
    if (actionId === 'go-team-chat') handleCommandNavigate('team-chat');
    if (actionId === 'open-keyboard-help') setKeyboardHelpOpen(true);
  };

  const openMergeGroup = (group: Lead[]) => {
    setMergeGroup(group);
    setMergePrimaryId(group[0]?.id || '');
  };

  const handleSmartMerge = async () => {
    if (!mergeGroup || !mergePrimaryId) return;
    const primary = mergeGroup.find(l => l.id === mergePrimaryId);
    if (!primary) return;
    const others = mergeGroup.filter(l => l.id !== mergePrimaryId);
    const mergedCustomFields = { ...(primary.custom_fields || {}) };
    const mergedTags = new Set<string>(Array.isArray(primary.tags) ? primary.tags : String(primary.tags || '').split(',').filter(Boolean));
    const services = new Set<string>(Array.isArray(primary.custom_fields?._allServices) ? primary.custom_fields?._allServices : []);
    others.forEach(l => {
      Object.entries(l.custom_fields || {}).forEach(([key, value]) => {
        if ((mergedCustomFields[key] === undefined || mergedCustomFields[key] === '' || mergedCustomFields[key] === 'No ABN supplied') && value) mergedCustomFields[key] = value;
      });
      (Array.isArray(l.tags) ? l.tags : String(l.tags || '').split(',')).filter(Boolean).forEach(t => mergedTags.add(String(t).trim()));
      const service = l.custom_fields?.service_category_name || l.custom_fields?.service_category || '';
      if (service) services.add(String(service));
    });
    if (services.size > 0) mergedCustomFields._allServices = Array.from(services);
    const mergedLead = {
      name: primary.name || others.find(l => l.name)?.name || '',
      email: primary.email || others.find(l => l.email)?.email || '',
      phone: primary.phone || others.find(l => l.phone)?.phone || '',
      notes: [primary.notes, ...others.map(l => l.notes)].filter(Boolean).join('\n\n'),
      tags: Array.from(mergedTags),
      custom_fields: mergedCustomFields
    };
    try {
      await axios.put(`/api/leads/${primary.id}`, mergedLead);
      await axios.post(`/api/leads/${primary.id}/notes`, { content: `Smart merged ${others.length} duplicate record${others.length !== 1 ? 's' : ''}: ${others.map(l => l.name).join(', ')}.` });
      for (const dup of others) {
        await axios.delete(`/api/leads/${dup.id}`);
      }
      setMergeGroup(null);
      setMergePrimaryId('');
      await fetchDashboardStats();
      if (selectedBrand) await fetchLeadsForActiveBrand();
      showToast('Duplicate records merged.');
    } catch (err) {
      showToast('Could not merge duplicate records.', true);
    }
  };

  const getImportedRowName = (row: Record<string, any>) => {
    const first = csvMapping.name ? String(row[csvMapping.name] || '').trim() : '';
    const second = csvMapping.name_secondary ? String(row[csvMapping.name_secondary] || '').trim() : '';
    return [first, second].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  };

  const importCleanup = useMemo(() => {
    if (!csvPreview || parsedRows.length === 0) return null;
    const nameCol = csvMapping.name;
    const emailCol = csvMapping.email;
    const phoneCol = csvMapping.phone;
    const abnCol = csvMapping.abn_number || csvMapping.AbnNumber || csvPreview.headers.find(h => h.toLowerCase().includes('abn')) || '';
    const missingName = nameCol ? parsedRows.filter(r => !getImportedRowName(r)).length : parsedRows.length;
    const missingEmail = emailCol ? parsedRows.filter(r => !String(r[emailCol] || '').trim()).length : 0;
    const missingPhone = phoneCol ? parsedRows.filter(r => !String(r[phoneCol] || '').replace(/\D/g, '')).length : 0;
    const crmDuplicateRows = parsedRows.filter((row) => {
      const email = emailCol ? String(row[emailCol] || '').trim().toLowerCase() : '';
      const phone = phoneCol ? String(row[phoneCol] || '').replace(/\D/g, '') : '';
      const name = nameCol ? getImportedRowName(row).toLowerCase() : '';
      return allCrmLeads.some(l => {
        const leadEmail = String(l.email || '').trim().toLowerCase();
        const leadPhone = String(l.phone || '').replace(/\D/g, '');
        const leadName = String(l.name || '').trim().toLowerCase();
        return (email && leadEmail === email) || (phone && leadPhone === phone);
      });
    }).length;
    const missingAbn = selectedBrand?.id === 'taskgo' && abnCol ? parsedRows.filter(r => !String(r[abnCol] || '').replace(/\D/g, '')).length : 0;
    return {
      missingName,
      missingEmail,
      missingPhone,
      crmDuplicateRows,
      fileDuplicateRows: duplicatesAnalysis.fileDuplicates.size,
      taskgoMissingAbn: missingAbn
    };
  }, [csvPreview, parsedRows, csvMapping, allCrmLeads, selectedBrand?.id, duplicatesAnalysis.fileDuplicates, duplicatesAnalysis.crmDuplicates]);

  const getCommandMetricValue = (metric: CommandMetricConfig) => {
    // Command-center metrics are verified-only so prospects never inflate totals.
    const sourceLeads = insightSourceLeads;
    const scopedLeads = metric.brandId && metric.brandId !== 'all'
      ? sourceLeads.filter(l => l.brand_id === metric.brandId)
      : sourceLeads;
    const fieldEquals = (rows: Lead[], key: string, value: string) => rows.filter(l => String(l.custom_fields?.[key] || '').toLowerCase().trim() === value.toLowerCase()).length;
    const fieldIncludes = (rows: Lead[], key: string, value: string) => rows.filter(l => String(l.custom_fields?.[key] || '').toLowerCase().includes(value.toLowerCase())).length;
    const usageComplete = (rows: Lead[], key: string) => rows.filter(l => ['complete', 'completed', 'yes', 'true', 'used', 'active'].includes(String(l.custom_fields?.[key] || '').toLowerCase())).length;
    switch (metric.kind) {
      case 'due_followups': return metric.brandId && metric.brandId !== 'all' ? todayCommand.due.filter(l => l.brand_id === metric.brandId).length : todayCommand.due.length;
      case 'new_leads': return scopedLeads.filter(l => String(l.funnel_stage || '').toLowerCase() === 'new lead').length;
      case 'no_activity': return scopedLeads.filter(l => getGlobalLeadActivityCount(l) === 0).length;
      case 'missing_phone': return scopedLeads.filter(l => !String(l.phone || '').replace(/\D/g, '')).length;
      case 'duplicate_people': {
        const verifiedDupGroups = globalDuplicateLeadGroups.filter(group => group.some(isVerifiedLead));
        return metric.brandId && metric.brandId !== 'all'
          ? verifiedDupGroups.filter(group => group.some(l => l.brand_id === metric.brandId && isVerifiedLead(l))).length
          : verifiedDupGroups.length;
      }
      case 'do_not_contact': return scopedLeads.filter(l => l.custom_fields?.do_not_contact === true || String(l.custom_fields?.do_not_contact).toLowerCase() === 'true').length;
      case 'total_leads': return countUniquePeopleForBrand(scopedLeads);
      case 'emails_sent': return allSentEmails.filter(e => !metric.brandId || metric.brandId === 'all' || e.brand_id === metric.brandId || scopedLeads.some(l => l.id === e.lead_id)).length;
      case 'whatsapp_sent': return allWhatsAppMessages.filter(w => !metric.brandId || metric.brandId === 'all' || w.brand_id === metric.brandId || scopedLeads.some(l => l.id === w.lead_id)).length;
      case 'calls_logged': return allCallLogs.filter(c => scopedLeads.some(l => l.id === c.lead_id)).length;
      case 'taskgo_unique_users': return todayCommand.taskgo.uniquePeople;
      case 'taskgo_with_abn': return todayCommand.taskgo.withAbn;
      case 'taskgo_missing_abn': return todayCommand.taskgo.missingAbn;
      case 'optimaviz_demo_requests': return sourceLeads.filter(l => l.brand_id === 'optimaviz' && getOptimavizLeadSegment(l) === 'demo_leads').length;
      case 'optimaviz_new_trials': return sourceLeads.filter(l => l.brand_id === 'optimaviz' && getOptimavizLeadSegment(l) === 'trial_leads').length;
      case 'optimaviz_subscribers': return sourceLeads.filter(l => l.brand_id === 'optimaviz' && isOptimavizSubscriber(l)).length;
      case 'optimaviz_feature_data_evaluation': return usageComplete(sourceLeads.filter(l => l.brand_id === 'optimaviz'), 'data_evaluation');
      case 'optimaviz_feature_performance_evaluation': return usageComplete(sourceLeads.filter(l => l.brand_id === 'optimaviz'), 'performance_evaluation');
      case 'optimaviz_feature_performance_exploration': return usageComplete(sourceLeads.filter(l => l.brand_id === 'optimaviz'), 'performance_exploration');
      case 'optimaviz_feature_analytics_optimisation': return usageComplete(sourceLeads.filter(l => l.brand_id === 'optimaviz'), 'analytics_for_optimisation');
      case 'optimaviz_feature_ml_optimisation': return usageComplete(sourceLeads.filter(l => l.brand_id === 'optimaviz'), 'machine_learning_for_optimisation');
      case 'optimaviz_feature_global_parameter': return usageComplete(sourceLeads.filter(l => l.brand_id === 'optimaviz'), 'global_parameter_impact_evaluation');
      case 'idao_training_leads': return fieldEquals(sourceLeads.filter(l => l.brand_id === 'idao'), 'segment', 'training_leads');
      case 'idao_quotes_sent': return sourceLeads.filter(l => l.brand_id === 'idao' && (String(l.custom_fields?.quote_status || '').toLowerCase().includes('sent') || String(l.funnel_stage || '').toLowerCase().includes('quote sent'))).length;
      case 'idao_followups_due': return sourceLeads.filter(l => l.brand_id === 'idao' && (getFollowUpStatus(l).urgent || String(l.custom_fields?.follow_up_status || '').toLowerCase().includes('due'))).length;
      case 'optimaclean_pipeline': return sourceLeads.filter(l => l.brand_id === 'optimaclean').length;
      case 'optimaclean_proposals': return sourceLeads.filter(l => l.brand_id === 'optimaclean' && String(l.funnel_stage || '').toLowerCase().includes('proposal')).length;
      case 'optimaclean_clients': return sourceLeads.filter(l => l.brand_id === 'optimaclean' && (String(l.funnel_stage || '').toLowerCase().includes('won') || fieldEquals([l], 'segment', 'clients'))).length;
      case 'nestwise_property_owners': return sourceLeads.filter(l => l.brand_id === 'nestwise').length;
      case 'nestwise_onboarded_owners': return sourceLeads.filter(l => l.brand_id === 'nestwise' && (String(l.funnel_stage || '').toLowerCase().includes('won') || String(l.custom_fields?.follow_up_status || '').toLowerCase().includes('onboard'))).length;
      case 'nestwise_bulawayo_properties': return fieldIncludes(sourceLeads.filter(l => l.brand_id === 'nestwise'), 'property_location', 'bulawayo');
      case 'nestwise_service_enquiries': return sourceLeads.filter(l => l.brand_id === 'nestwise' && ['airbnb_hosting_support', 'property_marketing', 'property_care', 'maintenance_repairs', 'property_security', 'photo_valuation'].includes(String(l.custom_fields?.segment || '').toLowerCase())).length;
      case 'stage_count': return scopedLeads.filter(l => l.funnel_stage === metric.stage).length;
      case 'custom_field_present': return scopedLeads.filter(l => metric.fieldKey && l.custom_fields?.[metric.fieldKey] !== undefined && String(l.custom_fields?.[metric.fieldKey]).trim()).length;
      case 'custom_field_match': return scopedLeads.filter(l => {
        if (!metric.fieldKey || !metric.stage) return false;
        return String(l.custom_fields?.[metric.fieldKey] || '').toLowerCase().trim() === String(metric.stage).toLowerCase().trim();
      }).length;
      default: return 0;
    }
  };

  const getCommandMetricOptionsForScope = (brandId?: string) => {
    const scope = brandId || 'all';
    return COMMAND_METRIC_OPTIONS.filter(opt => {
      if (!opt.brandId) return true;
      return scope === 'all' || opt.brandId === scope;
    });
  };

  const getCommandMetricOption = (kind: CommandMetricKind) => {
    return COMMAND_METRIC_OPTIONS.find(opt => opt.value === kind);
  };

  const openCommandMetricModal = (metric?: CommandMetricConfig) => {
    if (metric) {
      setEditingCommandMetricId(metric.id);
      setCommandMetricForm(metric);
    } else {
      setEditingCommandMetricId(null);
      setCommandMetricForm({
        id: `cmd_${Date.now()}`,
        label: 'New Metric',
        kind: 'total_leads',
        icon: 'fa-chart-simple',
        color: '#155e75',
        brandId: 'all',
        stage: '',
        fieldKey: ''
      });
    }
    setCommandMetricModalOpen(true);
  };

  const saveCommandMetric = () => {
    const label = commandMetricForm.label.trim();
    if (!label) {
      showToast('Metric label is required.', true);
      return;
    }
    const metric = { ...commandMetricForm, label, id: commandMetricForm.id || `cmd_${Date.now()}` };
    setCommandMetrics(prev => editingCommandMetricId ? prev.map(m => m.id === editingCommandMetricId ? metric : m) : [...prev, metric]);
    setCommandMetricModalOpen(false);
    setEditingCommandMetricId(null);
  };

  const deleteCommandMetric = (metricId: string) => {
    setCommandMetrics(prev => prev.filter(m => m.id !== metricId));
  };

  const resetCommandMetrics = () => {
    setCommandMetrics(DEFAULT_COMMAND_METRICS);
    showToast('Today Command Center reset to defaults.');
  };

  const computeWidgetValue = (widget: CustomWidget, brandLeads: Lead[]) => {
    const matches = brandLeads.filter(l => {
      if (widget.criteriaType === 'segment') {
        const seg = l.custom_fields && (l.custom_fields.segment || l.custom_fields.Segment);
        return seg === widget.criteriaValue;
      }
      if (widget.criteriaType === 'stage') {
        return l.funnel_stage === widget.criteriaValue;
      }
      if (widget.criteriaType === 'custom_field') {
        const val = l.custom_fields && l.custom_fields[widget.criteriaValue];
        if (widget.criteriaOp === 'present' || widget.criteriaOp === 'groupby') {
          return val !== undefined && val !== null && String(val).trim().length > 0;
        }
        if (widget.criteriaOp === 'equals') {
          return val !== undefined && val !== null && String(val).toLowerCase() === String(widget.criteriaCompareValue).toLowerCase();
        }
        if (widget.criteriaOp === 'contains') {
          return val !== undefined && val !== null && String(val).toLowerCase().includes(String(widget.criteriaCompareValue).toLowerCase());
        }
      }
      return false;
    });

    if (widget.countMode === 'unique_people') return countUniquePeople(matches);
    if (widget.countMode === 'valid_abn') return countUniquePeople(brandLeads.filter(hasValidAbn));
    if (widget.countMode === 'missing_abn') return countUniquePeople(brandLeads.filter(l => !hasValidAbn(l)));
    return matches.length;
  };

  const getUniqueCustomFieldValues = (fieldName: string): string[] => {
    if (!leads) return [];
    const vals = new Set<string>();
    leads.forEach(lead => {
      const extra = lead.custom_fields || {};
      const val = extra[fieldName];
      if (val !== undefined && val !== null && String(val).trim()) {
        vals.add(String(val).trim());
      }
    });
    return Array.from(vals).sort();
  };

  const handleSaveSpotlightForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBrand) return;
    
    const keysArray = spotlightFormKey.split(',').map(s => s.trim()).filter(Boolean);
    if (keysArray.length === 0) {
      showToast('Please specify at least one database field key.', true);
      return;
    }
    
    const updatedSpotlight: SpotlightConfig = {
      id: editingSpotlight ? editingSpotlight.id : `spotlight-${Date.now()}`,
      brandId: selectedBrand.id,
      title: spotlightFormTitle,
      icon: spotlightFormIcon || 'fas fa-chart-pie',
      fieldKeys: keysArray,
      type: spotlightFormType,
      binaryTrueLabel: spotlightFormType === 'binary' ? spotlightFormBinaryTrue : undefined,
      binaryFalseLabel: spotlightFormType === 'binary' ? spotlightFormBinaryFalse : undefined,
      segmentScope: spotlightFormSegmentScope.length > 0 ? spotlightFormSegmentScope : undefined
    };
    
    setBrandSpotlights(prev => {
      const currentList = prev[selectedBrand.id] || [];
      let updatedList = [];
      if (editingSpotlight) {
        updatedList = currentList.map(s => s.id === editingSpotlight.id ? updatedSpotlight : s);
      } else {
        updatedList = [...currentList, updatedSpotlight];
      }
      return {
        ...prev,
        [selectedBrand.id]: updatedList
      };
    });
    
    setEditingSpotlight(null);
    setSpotlightFormTitle('');
    setSpotlightFormIcon('fas fa-chart-pie');
    setSpotlightFormType('groupby');
    setSpotlightFormKey('');
    setSpotlightFormBinaryTrue('Compliant');
    setSpotlightFormBinaryFalse('Non-compliant');
    setSpotlightFormSegmentScope([]);
    showToast(`Spotlight "${updatedSpotlight.title}" saved successfully!`);
  };

  const handleDeleteSpotlight = (id: string) => {
    if (!selectedBrand) return;
    setBrandSpotlights(prev => {
      const currentList = prev[selectedBrand.id] || [];
      return {
        ...prev,
        [selectedBrand.id]: currentList.filter(s => s.id !== id)
      };
    });
    // also remove from active filters
    setActiveSpotlightFilters(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    showToast('Spotlight deleted successfully.');
  };

  const handleBulkAssignSegment = async (segmentValue: string) => {
    if (!selectedBrand || selectedLeadIds.size === 0) return;
    try {
      const ids = Array.from(selectedLeadIds);
      const res = await axios.post('/api/leads/bulk-assign-segment', {
        lead_ids: ids,
        segment: segmentValue
      });
      if (res.data.success) {
        setLeads(prev => prev.map(l => {
          if (ids.includes(l.id)) {
            const nextCustomFields = { ...(l.custom_fields || {}), segment: segmentValue === 'unassigned' ? '' : segmentValue };
            return { ...l, custom_fields: nextCustomFields };
          }
          return l;
        }));
        // Update active lead if it's in the updated subset
        if (activeLead && ids.includes(activeLead.id)) {
          setActiveLead(prev => {
            if (!prev) return null;
            const nextCustomFields = { ...(prev.custom_fields || {}), segment: segmentValue === 'unassigned' ? '' : segmentValue };
            return { ...prev, custom_fields: nextCustomFields };
          });
        }
        showToast(`Successfully assigned ${res.data.count} leads to the selected segment.`);
        setSelectedLeadIds(new Set());
      } else {
        showToast('Failed to assign leads to segment.', true);
      }
    } catch (err) {
      console.error(err);
      showToast('Error during bulk segment assignment.', true);
    }
  };

  const handleBulkDeleteSelectedLeads = async () => {
    if (!selectedBrand || selectedLeadIds.size === 0) return;
    const count = selectedLeadIds.size;
    showConfirm({
      title: 'Delete leads?',
      message: `You are about to permanently delete ${count} selected lead${count !== 1 ? 's' : ''}. This cannot be undone.`,
      confirmLabel: `Delete ${count} Lead${count !== 1 ? 's' : ''}`,
      isDangerous: true,
      onConfirm: async () => {
        try {
          const ids = Array.from(selectedLeadIds);
          await Promise.all(ids.map(id => axios.delete(`/api/leads/${id}`)));
          setLeads(prev => prev.filter(l => !ids.includes(l.id)));
          setAllCrmLeads(prev => prev.filter(l => !ids.includes(l.id)));
          if (activeLead && ids.includes(activeLead.id)) setActiveLead(null);
          setSelectedLeadIds(new Set());
          await fetchDashboardStats();
          showToast(`Deleted ${count} selected lead${count !== 1 ? 's' : ''}.`);
        } catch (err) {
          console.error(err);
          showToast('Could not delete the selected leads.', true);
        }
      },
    });
  };

  const endTeamCall = async (notifyTeam = true) => {
    const roomSlug = teamCallRoomSlug;
    setTeamCallOpen(false);
    setTeamCallDocked(false);
    setTeamCallMovedToTab(false);
    try {
      if (teamCallExternalWindowRef.current && !teamCallExternalWindowRef.current.closed) {
        teamCallExternalWindowRef.current.close();
      }
    } catch {
      /* ignore cross-window close issues */
    }
    teamCallExternalWindowRef.current = null;
    if (!notifyTeam || !roomSlug || endedTeamCallRoomsRef.current.has(roomSlug)) return;
    endedTeamCallRoomsRef.current.add(roomSlug);
    try {
      await axios.post('/api/team-chat', {
        content: '',
        recipient_ids: [activeTeamDmId || 'all'],
        attachments: [],
        event_type: 'team_call_ended',
        call_room_slug: roomSlug,
        call_status: 'ended',
      });
      await fetchTeamMessages();
    } catch (err) {
      console.error('Could not notify teammates that the call ended:', err);
    }
  };

  const handleBulkEditSelectedLeads = async () => {
    if (!selectedBrand || selectedLeadIds.size === 0) return;
    const selectedIds = Array.from(selectedLeadIds);
    const hasChanges = Object.values(bulkEditForm).some(v => String(v || '').trim());
    if (!hasChanges) {
      showToast('Choose at least one field to update.', true);
      return;
    }

    setBulkEditSaving(true);
    try {
      const updatedLeads: Lead[] = [];
      for (const lead of leads.filter(l => selectedIds.includes(l.id))) {
        const nextCustomFields = {
          ...(lead.custom_fields || {}),
          ...(bulkEditForm.follow_up_type ? { follow_up_type: bulkEditForm.follow_up_type } : {}),
          ...(bulkEditForm.follow_up_status ? { follow_up_status: bulkEditForm.follow_up_status } : {}),
          ...(bulkEditForm.next_action ? { next_action: bulkEditForm.next_action } : {})
        };
        const patch: any = { custom_fields: nextCustomFields };
        if (bulkEditForm.stage) patch.funnel_stage = bulkEditForm.stage;
        if (bulkEditForm.follow_up_date) patch.follow_up_date = bulkEditForm.follow_up_date;
        const res = await axios.put(`/api/leads/${lead.id}`, patch);
        updatedLeads.push(res.data);
        await axios.post(`/api/leads/${lead.id}/notes`, {
          content: `Bulk update applied${bulkEditForm.stage ? `: stage set to ${bulkEditForm.stage}` : ''}${bulkEditForm.follow_up_date ? `, follow-up reminder set for ${bulkEditForm.follow_up_date}` : ''}.`
        }).catch(() => null);
      }
      setLeads(prev => prev.map(l => updatedLeads.find(u => u.id === l.id) || l));
      setAllCrmLeads(prev => prev.map(l => updatedLeads.find(u => u.id === l.id) || l));
      if (activeLead) {
        const updatedActive = updatedLeads.find(u => u.id === activeLead.id);
        if (updatedActive) setActiveLead(updatedActive);
      }
      setBulkEditOpen(false);
      setBulkEditForm({ stage: '', follow_up_date: '', follow_up_type: '', follow_up_status: '', next_action: '' });
      setSelectedLeadIds(new Set());
      await fetchDashboardStats();
      showToast(`Updated ${updatedLeads.length} selected lead${updatedLeads.length !== 1 ? 's' : ''}.`);
    } catch (err) {
      console.error(err);
      showToast('Could not update the selected leads.', true);
    } finally {
      setBulkEditSaving(false);
    }
  };

  const handleAddWidget = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBrand) return;
    if (!widgetForm.title.trim()) {
      alert('Please enter a title for your custom widget.', 'warning');
      return;
    }

    const newWidget: CustomWidget = {
      id: editingWidget ? editingWidget.id : `w_${Date.now()}`,
      title: widgetForm.title.trim(),
      criteriaType: widgetForm.criteriaType,
      criteriaValue: widgetForm.criteriaValue,
      criteriaOp: widgetForm.criteriaOp,
      criteriaCompareValue: widgetForm.criteriaCompareValue,
      countMode: widgetForm.countMode,
      icon: widgetForm.icon || 'fa-chart-pie',
      color: widgetForm.color || selectedBrand.color,
      goal: widgetForm.goal ? Number(widgetForm.goal) : undefined
    };

    setCustomWidgets(prev => {
      const brandList = prev[selectedBrand.id] || DEFAULT_WIDGETS[selectedBrand.id] || [];
      const nextList = editingWidget
        ? brandList.map(w => w.id === editingWidget.id ? newWidget : w)
        : [...brandList, newWidget];
      const updated = {
        ...prev,
        [selectedBrand.id]: nextList
      };
      return updated;
    });

    setEditingWidget(null);
    setWidgetModalOpen(false);
  };

  const handleDeleteWidget = (brandId: string, widgetId: string) => {
    setCustomWidgets(prev => {
      const brandList = prev[brandId] || DEFAULT_WIDGETS[brandId] || [];
      const updated = {
        ...prev,
        [brandId]: brandList.filter(w => w.id !== widgetId)
      };
      return updated;
    });
  };

  useEffect(() => {
    localStorage.setItem('crm_custom_widgets', JSON.stringify(customWidgets));
  }, [customWidgets]);

  useEffect(() => {
    safeLocalStorage.setItem('crm_nestwise_dashboard_cards', JSON.stringify(nestwiseCards));
  }, [nestwiseCards]);

  const updateNestwiseCard = (cardId: string, patch: Partial<NestwiseDashboardCard>) => {
    setNestwiseCards(prev => prev.map(card => card.id === cardId ? { ...card, ...patch } : card));
  };

  const updateNestwiseCardItem = (cardId: string, itemId: string, patch: Partial<NestwiseCardItem>) => {
    setNestwiseCards(prev => prev.map(card => {
      if (card.id !== cardId) return card;
      return {
        ...card,
        items: card.items.map(item => item.id === itemId ? { ...item, ...patch } : item)
      };
    }));
  };

  const handleAddNestwiseCard = () => {
    setNestwiseCards(prev => [
      ...prev,
      {
        id: `nw_card_${Date.now()}`,
        title: 'New NestWise Card',
        icon: 'fa-chart-pie',
        color: selectedBrand?.color || '#f97316',
        type: 'metrics',
        items: [
          { id: `nw_item_${Date.now()}`, label: 'New item', fieldKey: '__total__', color: selectedBrand?.color || '#f97316' }
        ]
      }
    ]);
    setNestwiseCardsModalOpen(true);
    showToast('NestWise card added.');
  };

  const handleDeleteNestwiseCard = (cardId: string) => {
    if (!confirm('Delete this NestWise dashboard card?')) return;
    setNestwiseCards(prev => prev.filter(card => card.id !== cardId));
    showToast('NestWise card deleted.');
  };

  const handleAddNestwiseCardItem = (cardId: string) => {
    setNestwiseCards(prev => prev.map(card => {
      if (card.id !== cardId) return card;
      return {
        ...card,
        items: [
          ...card.items,
          {
            id: `nw_item_${Date.now()}`,
            label: card.type === 'journey' ? 'New journey step' : 'New item',
            fieldKey: card.type === 'journey' ? '' : '__total__',
            color: card.color
          }
        ]
      };
    }));
  };

  const handleDeleteNestwiseCardItem = (cardId: string, itemId: string) => {
    setNestwiseCards(prev => prev.map(card => {
      if (card.id !== cardId) return card;
      return { ...card, items: card.items.filter(item => item.id !== itemId) };
    }));
  };

  const resetNestwiseCards = () => {
    if (!confirm('Reset NestWise cards back to the default layout?')) return;
    setNestwiseCards(DEFAULT_NESTWISE_CARDS);
    showToast('NestWise cards reset.');
  };

  const getNestwiseCardItemValue = (item: NestwiseCardItem) => {
    const fieldKey = (item.fieldKey || '').trim();
    if (!fieldKey) return 0;
    const nestwiseLeadText = (lead: Lead, fields: string[]) => fields.map(field => String(lead.custom_fields?.[field] || '')).join(' ').toLowerCase();
    if (fieldKey === '__total__') return countUniquePeopleForBrand(leads);
    if (fieldKey === '__owner_leads__') {
      return leads.filter(l => l.brand_id === 'nestwise' || selectedBrand?.id === 'nestwise').length;
    }
    if (fieldKey === '__service_pipeline__') {
      return leads.filter(l => Boolean(String(l.custom_fields?.service_interest || l.custom_fields?.segment || '').trim())).length;
    }
    if (fieldKey === '__followups_due__') {
      return leads.filter(l => isFollowUpDue(l)).length;
    }
    if (fieldKey === '__missing_phone__') return leads.filter(l => !String(l.phone || '').replace(/\D/g, '')).length;
    if (fieldKey === '__owner_control__') {
      return leads.filter(l => {
        const value = String(l.custom_fields?.owner_retains_control || 'yes').toLowerCase();
        return !['no', 'false', 'not sure'].includes(value);
      }).length;
    }
    if (fieldKey === '__diaspora_support__') {
      return leads.filter(l => {
        const text = nestwiseLeadText(l, ['owner_location', 'property_location', 'location', 'city', 'suburb', 'enquiry', 'notes']);
        return /(diaspora|overseas|outside|australia|uk|united kingdom|south africa|botswana|canada|usa|united states|new zealand)/i.test(text);
      }).length;
    }
    if (fieldKey === '__reporting_needed__') {
      return leads.filter(l => {
        const text = nestwiseLeadText(l, ['reporting_requirement', 'inspection_type', 'service_interest', 'service_package', 'enquiry']);
        return /(report|photo|inspection|condition|maintenance update|owner update|updates)/i.test(text);
      }).length;
    }
    if (fieldKey === '__subscription_opportunities__') {
      return leads.filter(l => {
        const text = nestwiseLeadText(l, ['revenue_model', 'service_package', 'service_interest', 'segment']);
        return /(subscription|monthly|monitoring|maintenance plan|hosting support|property care|care subscription)/i.test(text);
      }).length;
    }
    if (fieldKey === '__emergency_response__') {
      return leads.filter(l => {
        const text = nestwiseLeadText(l, ['emergency_type', 'service_interest', 'service_package', 'segment', 'enquiry', 'notes']);
        return /(emergency|break-in|break in|trespass|vandalism|alarm|storm|security|rapid response)/i.test(text);
      }).length;
    }

    const matchTokens = String(item.matchValue || '')
      .split(/[|,]/)
      .map(v => v.trim().toLowerCase())
      .filter(Boolean);

    return leads.filter(l => {
      const raw = fieldKey === 'funnel_stage' ? l.funnel_stage : l.custom_fields?.[fieldKey];
      const value = normalizeFieldValue(raw).toLowerCase();
      if (!matchTokens.length) return Boolean(value && value !== 'has not filled/blank');
      if (fieldKey === 'segment' || fieldKey === 'funnel_stage') return matchTokens.includes(value);
      return matchTokens.some(token => value.includes(token));
    }).length;
  };

  useEffect(() => {
    setCustomWidgets(prev => {
      const currentTaskGo = prev.taskgo || [];
      const taskGoDefaultIds = new Set([
        'tg_abn',
        'tg_users',
        'tg_abn_valid',
        'tg_abn_missing',
        'tg_users_unique',
        'tg_contractors_roster',
        'tg_contractor_verification',
        'tg_client_support',
        'tg_login_help'
      ]);
      const hasCurrentDefaults = DEFAULT_WIDGETS.taskgo.every(def => currentTaskGo.some(w => w.id === def.id));
      if (hasCurrentDefaults) return prev;
      const userWidgets = currentTaskGo.filter(w => !taskGoDefaultIds.has(w.id));
      return {
        ...prev,
        taskgo: [...DEFAULT_WIDGETS.taskgo, ...userWidgets]
      };
    });
  }, []);

  useEffect(() => {
    safeLocalStorage.setItem('crm_dash_section_vis', JSON.stringify(dashboardSectionVisibility));
  }, [dashboardSectionVisibility]);

  useEffect(() => {
    safeLocalStorage.setItem('crm_dash_section_titles', JSON.stringify(dashboardSectionTitles));
  }, [dashboardSectionTitles]);

  // Run updates when selected brand or active workspace changes.
  // Keep brand switching fast by loading only the data needed for the visible tab.
  useEffect(() => {
    if (user && selectedBrand) {
      fetchLeadsForActiveBrand();
      fetchCustomFieldsForBrand();
      if (brandSubTab === 'sequences') fetchSequencesForBrand();
      if (brandSubTab === 'tasks') fetchTasksForActiveBrand();
      if (selectedBrand.id === 'optimaviz') fetchUsageAnalyticsForBrand(selectedBrand.id);
    }
    if (user && activeTab === 'dashboard') {
      fetchDashboardStats();
      fetchAllTasks();
      fetchAllSentEmails();
      fetchAllWhatsAppMessages();
      fetchAllCallLogs();
      fetchWebsiteAnalytics('');
      fetchPortfolioOpportunities();
    }
  }, [user, selectedBrand?.id, activeTab, brandSubTab]);

  useEffect(() => {
    if (user && activeTab === 'email-tracking' && selectedBrandForEmail?.id) {
      fetchLeadsForEmailBrand(selectedBrandForEmail.id);
      fetchAllSentEmails();
    }
  }, [user, activeTab, selectedBrandForEmail?.id]);

  useEffect(() => {
    if (user && activeTab === 'whatsapp-tracking' && selectedBrandForWhatsApp?.id) {
      fetchLeadsForEmailBrand(selectedBrandForWhatsApp.id);
      fetchAllWhatsAppMessages(selectedBrandForWhatsApp.id);
      fetchWhatsAppNumbers();
      fetchWhatsAppTemplates();
    }
  }, [user, activeTab, selectedBrandForWhatsApp?.id]);

  useEffect(() => {
    if (!user) return;
    fetchTeamMessages();
    fetchTeamNotes();
    fetchUsersList();
    const timer = window.setInterval(() => {
      fetchTeamMessages();
      fetchTeamNotes();
      fetchUsersList();
    }, activeTab === 'team-chat' ? 5000 : 8000);
    return () => window.clearInterval(timer);
  }, [user, activeTab]);

  useEffect(() => {
    if (!user || teamCallOpen) return;
    const dismissed = new Set((safeLocalStorage.getItem('crm_dismissed_team_calls') || '').split(',').filter(Boolean));
    const endedRooms = getTeamCallEndedRooms(teamMessages);
    const recentCutoff = Date.now() - (5 * 60 * 1000); // 5 minutes instead of 30 for fresh calls only
    const incoming = teamMessages
      .filter(message => {
        const recipients = Array.isArray(message.recipient_ids) ? message.recipient_ids : [];
        const isForCurrentUser = recipients.includes('all') || recipients.includes(user.id);
        const isRecent = new Date(message.created_at || 0).getTime() >= recentCutoff;
        const wasUserOnline = teamPresenceStatus === 'online'; // Only show if user is currently online
        const roomSlug = getTeamCallRoomSlugFromMessage(message);
        return message.user_id !== user.id
          && isForCurrentUser
          && isRecent
          && wasUserOnline
          && !dismissed.has(message.id)
          && Boolean(roomSlug)
          && !endedRooms.has(roomSlug)
          && /Team call started for/i.test(String(message.content || ''))
          && /https:\/\/8x8\.vc\//i.test(String(message.content || ''));
      })
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0];
    setIncomingTeamCall(incoming || null);
  }, [teamMessages, teamCallOpen, user?.id, teamPresenceStatus]);

  useEffect(() => {
    if (!teamCallOpen || !teamCallRoomSlug) return;
    const ended = teamMessages
      .filter(message => getTeamCallRoomSlugFromMessage(message) === sanitizeTeamCallRoom(teamCallRoomSlug))
      .filter(isTeamCallEndedMessage)
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0];
    if (ended && ended.user_id !== user?.id) {
      endTeamCall(false);
      showToast(`${ended.user_name || 'The caller'} ended the team call.`);
    }
  }, [teamMessages, teamCallOpen, teamCallRoomSlug, user?.id]);

  // Play notification sound and show browser notification when incoming call arrives
  useEffect(() => {
    if (!incomingTeamCall) return;
    
    const playNotificationSound = () => {
      try {
        // Create Web Audio API context for notification sound
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        
        // Two-tone notification sound: 800Hz for 200ms, then 1000Hz for 200ms (repeats 3 times)
        const now = audioContext.currentTime;
        const toneDuration = 0.2;
        const pauseDuration = 0.1;
        
        for (let i = 0; i < 3; i++) {
          const startTime = now + (i * (toneDuration * 2 + pauseDuration));
          
          // First tone
          oscillator.frequency.setValueAtTime(800, startTime);
          gain.gain.setValueAtTime(0.15, startTime);
          gain.gain.setValueAtTime(0.15, startTime + toneDuration);
          gain.gain.setValueAtTime(0, startTime + toneDuration);
          
          // Second tone
          oscillator.frequency.setValueAtTime(1000, startTime + toneDuration + pauseDuration);
          gain.gain.setValueAtTime(0.15, startTime + toneDuration + pauseDuration);
          gain.gain.setValueAtTime(0.15, startTime + toneDuration * 2 + pauseDuration);
          gain.gain.setValueAtTime(0, startTime + toneDuration * 2 + pauseDuration);
        }
        
        oscillator.start(now);
        oscillator.stop(now + (toneDuration * 2 + pauseDuration) * 3);
      } catch (error) {
        // Fallback: if Web Audio API not supported, try HTML5 audio
        try {
          if (!incomingCallAudioRef.current) {
            const audio = new Audio();
            // Data URL for a simple notification sound
            audio.src = 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA==';
            incomingCallAudioRef.current = audio;
          }
          incomingCallAudioRef.current.play().catch(() => {
            // Audio playback failed (may be blocked by browser)
          });
        } catch {
          // Silent fail for audio
        }
      }
    };
    
    // Show browser notification
    const showBrowserNotification = () => {
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('Incoming Team Call', {
            body: `${incomingTeamCall.user_name || 'A team member'} is calling you`,
            icon: '/logos/optima_crm_logo.png',
            badge: '/logos/optima_crm_logo.png',
            tag: 'incoming-team-call',
            requireInteraction: true
          });
        } catch {
          // Notification failed
        }
      }
    };
    
    // Request notification permission if not already granted
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    
    // Play sound and show notification immediately
    playNotificationSound();
    showBrowserNotification();
    
    // Repeat sound every 3 seconds while call notification is active
    const soundInterval = setInterval(() => {
      playNotificationSound();
    }, 3000);
    
    return () => clearInterval(soundInterval);
  }, [incomingTeamCall]);

  useEffect(() => {
    if (!user || activeTab !== 'team-chat') return;
    const threadMessages = getTeamThreadMessages(activeTeamDmId);
    const latest = threadMessages.reduce((max, message) => String(message.created_at || '') > max ? String(message.created_at || '') : max, '');
    if (!latest || teamReadState[activeTeamDmId] === latest) return;
    setTeamReadState(prev => {
      const next = { ...prev, [activeTeamDmId]: latest };
      safeLocalStorage.setItem('crm_team_chat_read_state', JSON.stringify(next));
      return next;
    });
  }, [user, activeTab, activeTeamDmId, teamMessages.length]);

  useEffect(() => {
    if (activeTab !== 'team-chat' || teamChatSubTab !== 'messages') return;
    const timer = window.setTimeout(() => {
      teamEndRef.current?.scrollIntoView({ block: 'end' });
    }, 50);
    return () => window.clearTimeout(timer);
  }, [activeTab, activeTeamDmId, teamChatSubTab, teamMessages.length]);

  useEffect(() => {
    safeLocalStorage.setItem('crm_team_presence_status', teamPresenceStatus);
    if (!user) return;
    axios.put('/api/team-presence', { status: teamPresenceStatus }).then(res => {
      if (res.data?.id) {
        setUsersList(prev => prev.map(staff => staff.id === res.data.id ? { ...staff, ...res.data } : staff));
      }
    }).catch(err => {
      console.error('Failed to update team presence:', err);
    });
  }, [user?.id, teamPresenceStatus]);

  useEffect(() => {
    if (!teamCallOpen || !teamCallRoomSlug) {
      teamCallApiRef.current?.dispose?.();
      teamCallApiRef.current = null;
      return;
    }

    let cancelled = false;
    const scriptId = 'optima-jaas-external-api';

    const loadTeamCallScript = () => new Promise<void>((resolve, reject) => {
      if ((window as any).JitsiMeetExternalAPI) {
        resolve();
        return;
      }

      const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('Could not load the team call service.')), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.id = scriptId;
      script.src = getTeamCallScriptSrc();
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Could not load the team call service.'));
      document.head.appendChild(script);
    });

    const mountTeamCall = async () => {
      setTeamCallLoading(true);
      setTeamCallError('');
      try {
        await loadTeamCallScript();
        if (cancelled || !teamCallContainerRef.current) return;

        teamCallApiRef.current?.dispose?.();
        teamCallContainerRef.current.innerHTML = '';

        const JitsiMeetExternalAPI = (window as any).JitsiMeetExternalAPI;
        teamCallApiRef.current = new JitsiMeetExternalAPI(TEAM_CALL_DOMAIN, {
          roomName: getTeamCallRoomName(teamCallRoomSlug),
          parentNode: teamCallContainerRef.current,
          width: '100%',
          height: '100%',
          userInfo: {
            displayName: user?.name || 'DirotiQ CRM user',
            email: user?.email || undefined,
          },
          configOverwrite: {
            disableDeepLinking: true,
            prejoinConfig: { enabled: false },
            startWithAudioMuted: false,
            startWithVideoMuted: true,
            subject: teamCallTitle,
            brandingRoomAlias: teamCallTitle,
            toolbarButtons: [
              'microphone',
              'camera',
              'desktop',
              'chat',
              'participants-pane',
              'tileview',
              'raisehand',
              'select-background',
              'settings',
              'fullscreen',
              'hangup',
            ],
          },
          interfaceConfigOverwrite: {
            APP_NAME: TEAM_CALL_BRAND_NAME,
            DEFAULT_REMOTE_DISPLAY_NAME: 'CRM teammate',
            HIDE_INVITE_MORE_HEADER: true,
            SHOW_JITSI_WATERMARK: false,
            SHOW_POWERED_BY: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
          },
        });
        teamCallApiRef.current?.addListener?.('readyToClose', () => endTeamCall(true));
      } catch (err: any) {
        if (!cancelled) {
          setTeamCallError(toUserFacingError(err, 'Could not start the team call.'));
        }
      } finally {
        if (!cancelled) setTeamCallLoading(false);
      }
    };

    mountTeamCall();

    return () => {
      cancelled = true;
      teamCallApiRef.current?.dispose?.();
      teamCallApiRef.current = null;
    };
  }, [teamCallOpen, teamCallRoomSlug, teamCallTitle, user?.email, user?.name]);

  useEffect(() => {
    if (!selectedBrand) return;
    const brandId = selectedBrand.id;
    const cfs = customFields
      .filter(cf => !cf.brand_id || String(cf.brand_id) === brandId)
      .map(cf => cf.field_name);

    const colVersion = localStorage.getItem(columnVersionStorageKey(brandId));
    // One-time migration: drop legacy full-list prefs that wiped columns.
    if (colVersion !== CURRENT_COL_VERSION) {
      clearLegacyColumnPrefs(brandId, localStorage);
      localStorage.removeItem(hiddenOptionalStorageKey(brandId));
      localStorage.setItem(columnVersionStorageKey(brandId), CURRENT_COL_VERSION);
      if (brandId === 'nestwise') {
        localStorage.setItem('crm_cols_version_nestwise', NESTWISE_DASHBOARD_VERSION);
      }
    }

    const hiddenOptional = localStorage.getItem(hiddenOptionalStorageKey(brandId)) || '';
    // Canonical: standards + ALL custom fields, minus optional user hides only.
    const finalList = resolveVisibleColumns({
      brandId,
      customFieldNames: cfs,
      hiddenOptional,
    });
    setColumnVisibility(new Set(finalList));
  }, [selectedBrand?.id, customFields]);

  // Reset filters when brand changes (not when custom fields merely re-hydrate).
  useEffect(() => {
    if (!selectedBrand) return;
    // Do NOT null customFieldsReadyBrandRef here after fetch — that race wiped columns.
    setSelectedSegmentFilter('all');
    setSelectedDateWindow('all');
    setSelectedDateFrom('');
    setSelectedDateTo('');
    setSortConfig({ col: 'created_at', dir: 'desc' });
  }, [selectedBrand?.id]);

  useEffect(() => {
    if (csvPreview && selectedBrand) {
      const currentStdHeaders = [csvMapping.name, csvMapping.name_secondary, csvMapping.email, csvMapping.phone, csvMapping.created_at].filter(Boolean);
      const existingCfNames = customFields.map(cf => String(cf.field_name || '').toLowerCase());
      const uploadAliasToField: Record<string, string> = {
        countryregion: 'country',
        companyname: 'company',
        jobtitle: 'job_title',
        quotesentviaemail: 'quote_status',
      };
      const ignoredUploadHeaders = new Set([
        'created_date',
        'date created',
        'created at',
        'created_at',
        'date joined',
        'joined date',
        'joined_at',
        'registration date',
        'submitted at',
        'submission date',
        'timestamp',
        'form_name',
        'name_secondary'
      ]);
      
      const suggested = csvPreview.headers.filter(h => {
        const hLower = String(h || '').toLowerCase();
        const compactHeader = hLower.replace(/[\s_/-]+/g, '');
        if (!h || hLower === 'id' || hLower === 'row-id' || hLower === 'rowid') return false;
        if (ignoredUploadHeaders.has(hLower)) return false;
        if (uploadAliasToField[compactHeader] && existingCfNames.includes(uploadAliasToField[compactHeader])) return false;
        if (currentStdHeaders.includes(h)) return false;
        if (existingCfNames.includes(hLower)) return false;
        return true;
      });
      
      setSuggestedCols(suggested);
      // Never auto-enable "Create new CRM columns from file" — user must opt in.
      setSelectedSuggestedCols(prev => {
        const next = new Set<string>();
        suggested.forEach(col => {
          if (prev.has(col)) next.add(col);
        });
        return next;
      });
    } else {
      setSuggestedCols([]);
      setSelectedSuggestedCols(new Set());
    }
  }, [csvPreview, csvMapping.name, csvMapping.name_secondary, csvMapping.email, csvMapping.phone, csvMapping.created_at, customFields, selectedBrand?.id]);

  const handleToggleSuggestedCol = (col: string, checked: boolean) => {
    setSelectedSuggestedCols(prev => {
      const next = new Set(prev);
      if (checked) next.add(col);
      else next.delete(col);
      return next;
    });

    if (checked) {
      setSelectedImportColumns(prev => {
        const next = new Set(prev);
        next.add(col);
        return next;
      });
    }
  };

  const handleImportColumnChecked = (col: string, checked: boolean) => {
    setSelectedImportColumns(prev => {
      const next = new Set(prev);
      if (checked) next.add(col);
      else next.delete(col);
      return next;
    });

    if (!checked && suggestedCols.includes(col)) {
      setSelectedSuggestedCols(prev => {
        const next = new Set(prev);
        next.delete(col);
        return next;
      });
    }
  };

  const handleCreateSuggestedColumns = async () => {
    const cols = Array.from(selectedSuggestedCols);
    if (cols.length === 0) {
      alert('Please select at least one column to add.', 'warning');
      return;
    }
    setColSaving(true);
    let successCount = 0;
    try {
      for (const col of cols) {
        try {
          await axios.post(`/api/brands/${selectedBrand!.id}/custom-fields`, {
            field_name: col,
            field_type: 'text',
            required: false
          });
          successCount++;
        } catch (createErr) {
          console.error(`Failed to automatically create column "${col}":`, createErr);
        }
      }
      alert(`Successfully created ${successCount} custom column(s) in the CRM!`, 'success');
      await fetchCustomFieldsForBrand();
      setSelectedSuggestedCols(new Set());
    } catch (err: any) {
      alert('Failed to save columns.');
    } finally {
      setColSaving(false);
    }
  };

  useEffect(() => {
    if (parsedRows.length > 0 && selectedBrand) {
      const fileDups = new Set<number>();
      const crmDups = new Set<number>();
      const detailsList: ImportDupDetail[] = [];

      const nameCol = csvMapping.name;
      const emailCol = csvMapping.email;
      const phoneCol = csvMapping.phone;

      const seenIdentities = new Map<string, number>();

      parsedRows.forEach((row, idx) => {
        const displayName = nameCol ? getImportedRowName(row) : '';
        const nameVal = displayName.toLowerCase();
        const emailVal = emailCol ? normalizeImportEmail(row[emailCol]) : '';
        const phoneVal = phoneCol ? normalizeImportPhone(row[phoneCol]) : '';
        const fileEmail = emailCol ? String(row[emailCol] || '').trim() : '';
        const filePhone = phoneCol ? String(row[phoneCol] || '').trim() : '';

        // A name alone is not a reliable identity. Only email/phone can make a
        // row a blocking file duplicate, so people sharing a name still import.
        let isFileDup = false;
        let fileDupOfRow: number | undefined;
        importIdentityKeys(emailVal, phoneVal, nameVal).forEach(identity => {
          if (seenIdentities.has(identity)) {
            isFileDup = true;
            fileDupOfRow = fileDupOfRow ?? seenIdentities.get(identity);
          } else {
            seenIdentities.set(identity, idx);
          }
        });

        if (isFileDup) {
          fileDups.add(idx);
          detailsList.push({
            rowIndex: idx,
            kind: 'file',
            message: `Row ${idx + 2}: same person appears again in this file (first seen on row ${(fileDupOfRow ?? 0) + 2}).`,
            fileName: displayName || 'Unknown',
            fileEmail,
            filePhone,
            fileDupOfRow,
          });
        }

        // Spot CRM duplicates across all brands (existing CRM contact matches this row)
        const matchingLeads = (allCrmLeads.length ? allCrmLeads : leads).filter(l => {
          const leadName = String(l.name || '').trim().toLowerCase();
          const leadEmail = normalizeImportEmail(l.email);
          const leadPhone = normalizeImportPhone(l.phone);

          const matchEmail = emailVal && leadEmail === emailVal;
          const matchPhone = phoneVal && leadPhone === phoneVal;

          return matchEmail || matchPhone;
        });

        if (matchingLeads.length > 0) {
          crmDups.add(idx);
          const primary = matchingLeads[0];
          const matchNames = matchingLeads.map(l => `${l.name} (${l.brand_name || l.brand_id} / ${l.funnel_stage})`).join(', ');
          detailsList.push({
            rowIndex: idx,
            kind: 'crm',
            message: `Row ${idx + 2}: "${displayName || 'Unknown'}" matches existing CRM lead: ${matchNames}.`,
            fileName: displayName || 'Unknown',
            fileEmail,
            filePhone,
            matchLeadId: primary.id,
            matchLeadName: primary.name,
            matchBrand: primary.brand_name || primary.brand_id,
            matchStage: primary.funnel_stage,
            matchEmail: primary.email || '',
            matchPhone: primary.phone || '',
            matchSegment: String(primary.custom_fields?.segment || ''),
          });
        }
      });

      setDuplicatesAnalysis({
        fileDuplicates: fileDups,
        crmDuplicates: crmDups,
        // Unique rows that are either file or CRM duplicates (a row can be both)
        duplicateCount: new Set([...fileDups, ...crmDups]).size,
        details: detailsList
      });
      // Drop stale per-row actions for rows that are no longer flagged
      setRowDuplicateActions(prev => {
        const next: Record<number, DuplicateImportStrategy> = {};
        Object.entries(prev).forEach(([k, v]) => {
          const idx = Number(k);
          if (fileDups.has(idx) || crmDups.has(idx)) next[idx] = v;
        });
        return next;
      });
    } else {
      setDuplicatesAnalysis({ fileDuplicates: new Set(), crmDuplicates: new Set(), duplicateCount: 0, details: [] });
      setRowDuplicateActions({});
      setImportCleanupFocus(null);
    }
    setConfirmDuplicateImport(false);
  }, [parsedRows, csvMapping.name, csvMapping.name_secondary, csvMapping.email, csvMapping.phone, leads, allCrmLeads, selectedBrand?.id]);

  // Lead Timeline & Interaction logs Loading
  const fetchAllWhatsAppMessages = async (brandId?: string) => {
    try {
      const query = brandId ? `?brand_id=${encodeURIComponent(brandId)}` : '';
      const res = await axios.get(`/api/whatsapp${query}`);
      setAllWhatsAppMessages(res.data);
    } catch (err) {
      console.error('Failed to load WhatsApp message logs:', err);
    }
  };

  const fetchWhatsAppNumbers = async () => {
    try {
      const res = await axios.get('/api/whatsapp/numbers');
      setWhatsappNumbers({ ...DEFAULT_WHATSAPP_NUMBERS, ...(res.data || {}) });
    } catch (err) {
      console.error('Failed to load WhatsApp brand numbers:', err);
    }
  };

  const defaultWhatsAppTemplatesForBrand = (brandId: string): WhatsAppTemplate[] => [
    { id: `wa_${brandId}_intro`, brand_id: brandId, name: 'Introduction / First Message', message: 'Hi {{name}}, this is {{brand}}. I wanted to quickly introduce our services and see if this is something useful for you.', is_active: true },
    { id: `wa_${brandId}_follow`, brand_id: brandId, name: 'Follow-Up Reminder', message: 'Hi {{name}}, just following up on my previous message. Please let me know if you would like more information.', is_active: true },
    { id: `wa_${brandId}_quote`, brand_id: brandId, name: 'Quote Follow-Up', message: 'Hi {{name}}, I am following up on the quote we sent. Let me know if you have any questions or if you would like us to proceed.', is_active: true },
  ];

  const getWhatsAppTemplatesForBrand = (brandId: string) => {
    const saved = whatsappTemplates.filter(t => t.brand_id === brandId && t.is_active !== false);
    const shared = messageTemplates
      .filter(t => t.brand_id === brandId && t.channel === 'whatsapp' && t.is_active !== false)
      .map(t => ({ id: t.id, brand_id: t.brand_id, name: t.name, message: t.body, is_active: t.is_active }));
    const combined = [...shared, ...saved];
    return combined.length > 0 ? combined : defaultWhatsAppTemplatesForBrand(brandId);
  };

  const fetchWhatsAppTemplates = async () => {
    try {
      const res = await axios.get('/api/whatsapp/templates');
      setWhatsappTemplates(res.data || []);
    } catch (err) {
      console.error('Failed to load WhatsApp templates:', err);
    }
  };

  const resetWhatsAppTemplateForm = () => { setWaTemplateEditingId(null); setWaTemplateName(''); setWaTemplateMessage(''); };
  const startEditWhatsAppTemplate = (template: WhatsAppTemplate) => { setWaTemplateEditingId(template.id); setWaTemplateName(template.name); setWaTemplateMessage(template.message); };

  const saveWhatsAppTemplate = async () => {
    if (!selectedBrandForWhatsApp || !waTemplateName.trim() || !waTemplateMessage.trim()) { showToast('Add a template name and message first.', true); return; }
    setWaSavingSettings(true);
    try {
      if (waTemplateEditingId && !String(waTemplateEditingId).startsWith('wa_')) {
        await axios.put(`/api/whatsapp/templates/${waTemplateEditingId}`, { brand_id: selectedBrandForWhatsApp.id, name: waTemplateName, message: waTemplateMessage, is_active: true });
      } else {
        await axios.post('/api/whatsapp/templates', { brand_id: selectedBrandForWhatsApp.id, name: waTemplateName, message: waTemplateMessage, is_active: true });
      }
      await fetchWhatsAppTemplates(); resetWhatsAppTemplateForm(); showToast('WhatsApp template saved.');
    } catch (err) { showToast('Could not save WhatsApp template.', true); } finally { setWaSavingSettings(false); }
  };

  const deleteWhatsAppTemplate = async (templateId: string) => {
    if (!confirm('Delete this WhatsApp template?')) return;
    try { await axios.delete(`/api/whatsapp/templates/${templateId}`); await fetchWhatsAppTemplates(); resetWhatsAppTemplateForm(); showToast('WhatsApp template deleted.'); } catch (err) { showToast('Could not delete WhatsApp template.', true); }
  };

  const saveWhatsAppNumbers = async () => {
    setWaSavingSettings(true);
    try { const res = await axios.put('/api/whatsapp/numbers', whatsappNumbers); setWhatsappNumbers({ ...DEFAULT_WHATSAPP_NUMBERS, ...(res.data || {}) }); showToast('WhatsApp brand numbers saved.'); } catch (err) { showToast('Could not save WhatsApp numbers.', true); } finally { setWaSavingSettings(false); }
  };

  const buildWhatsAppLink = (phone: string, message: string) => { const clean = (phone || '').replace(/[^0-9]/g, ''); return clean ? `https://wa.me/${clean}?text=${encodeURIComponent(message)}` : ''; };
  const applyTemplateVars = (message: string, lead: Lead, brand: Brand) => message.replace(/{{name}}/g, lead.name || '').replace(/{{first_name}}/g, (lead.name || '').split(' ')[0] || '').replace(/{{brand}}/g, brand.name || '');
  const applyEmailTemplateVars = (message: string, lead: Lead, brand: Brand) => message
    .replace(/\{\{name\}\}/g, lead.name || '')
    .replace(/\{\{first_name\}\}/g, (lead.name || '').split(' ')[0] || '')
    .replace(/\{\{brand\}\}/g, brand.name || '')
    .replace(/\{\{leadId\}\}/g, lead.id || '');

  const fetchLeadsForEmailBrand = async (brandId: string) => {
    try {
      const res = await axios.get(`/api/leads?brand_id=${brandId}&limit=500`);
      const leadsData = Array.isArray(res.data) ? res.data : (res.data.items || []);
      setLeads(leadsData);
    } catch (err) {
      console.error('Error loading email workspace leads', err);
    }
  };

  const getEmailProviderLabel = () => {
    if (emailProviderMode === 'gmail') return 'Gmail-ready';
    if (emailProviderMode === 'outlook') return 'Outlook-ready';
    if (emailProviderMode === 'yahoo') return 'Yahoo-ready';
    if (emailProviderMode === 'smtp') return 'SMTP-ready';
    return 'CRM outbox';
  };

  const sendTrackedEmail = async (lead: Lead, subject: string, content: string, brand: Brand, templateName = 'Manual Email', attachments: Array<{ name: string; mime_type: string; size: number; data_base64: string }> = []) => {
    if (lead.custom_fields?.do_not_contact === true || String(lead.custom_fields?.do_not_contact).toLowerCase() === 'true') {
      showToast('This lead is marked Do Not Contact.', true);
      return;
    }
    await axios.post('/api/emails/send', {
      lead_id: lead.id,
      subject,
      html_content: content,
      template_name: templateName,
      brand_id: brand.id,
      provider: emailProviderMode,
      email_account_id: selectedEmailAccountId || undefined,
      attachments
    });
    fetchAllSentEmails();
    fetchDashboardStats();
    if (activeLead?.id === lead.id) {
      loadLeadDetailsHistory(lead.id);
    }
  };

  const handleBulkEmailSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkEmailSubject.trim() || !bulkEmailBody.trim() || selectedLeadIds.size === 0 || !selectedBrand) return;
    const targetLeads = leads.filter(l => selectedLeadIds.has(l.id) && l.email);
    if (targetLeads.length === 0) {
      showToast('None of the selected leads have an email address.', true);
      return;
    }
    setBulkEmailSending(true);
    setBulkEmailProgress({ sent: 0, failed: 0, total: targetLeads.length, errors: [] });
    let sent = 0; let failed = 0; const errors: string[] = [];
    for (const lead of targetLeads) {
      try {
        await sendTrackedEmail(lead, bulkEmailSubject, bulkEmailBody, selectedBrand, 'Bulk Email Blast');
        sent++;
        setBulkEmailProgress({ sent, failed, total: targetLeads.length, errors: [...errors] });
      } catch (err: any) {
        failed++;
        errors.push(`${lead.name}: ${toUserFacingError(err, 'Could not send')}`);
        setBulkEmailProgress({ sent, failed, total: targetLeads.length, errors: [...errors] });
      }
    }
    setBulkEmailSending(false);
    showToast(`Bulk email complete: ${sent} sent, ${failed} failed.`, failed > 0 && sent === 0);
    if (sent > 0) {
      fetchAllSentEmails();
      fetchDashboardStats();
    }
  };

  const sendDirectBrandEmail = async (brand: Brand, toEmail: string, toName: string, subject: string, content: string, templateName = 'Direct Email', attachments: Array<{ name: string; mime_type: string; size: number; data_base64: string }> = []) => {
    await axios.post('/api/emails/send-direct', {
      brand_id: brand.id,
      to_email: toEmail,
      to_name: toName,
      subject,
      html_content: content,
      template_name: templateName,
      provider: emailProviderMode,
      email_account_id: selectedEmailAccountId || undefined,
      attachments
    });
    fetchAllSentEmails();
    fetchDashboardStats();
  };

  const getFollowUpStatus = (lead: Lead) => getFollowUpLabel(lead);

  const sendTrackedWhatsApp = async (lead: Lead, message: string, brandId: string, templateName = 'Manual WhatsApp') => {
    if (lead.custom_fields?.do_not_contact === true || String(lead.custom_fields?.do_not_contact).toLowerCase() === 'true') {
      showToast('This lead is marked Do Not Contact.', true);
      return;
    }
    const fromNumber = whatsappNumbers[brandId] || '';
    const toNumber = lead.phone || '';
    const integration = getBrandIntegrationFor(brandId);
    const apiReady = isWhatsAppCloudConfigured(integration, brandId);
    await axios.post('/api/whatsapp/send', { lead_id: lead.id, brand_id: brandId, from_number: fromNumber, to_number: toNumber, template_name: templateName, message, status: 'sent', log_only: !apiReady });
    const link = buildWhatsAppLink(toNumber, message);
    fetchAllWhatsAppMessages(activeTab === 'whatsapp-tracking' ? selectedBrandForWhatsApp.id : undefined);
    fetchDashboardStats();
    if (!apiReady && link) window.open(link, '_blank');
  };

  const handleBulkWhatsAppSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkWhatsAppMessage.trim() || selectedLeadIds.size === 0 || !selectedBrand) return;

    const isDoNotContact = (lead: Lead) => (
      lead.custom_fields?.do_not_contact === true ||
      String(lead.custom_fields?.do_not_contact).toLowerCase() === 'true'
    );
    const targetLeads = leads.filter(l => selectedLeadIds.has(l.id) && l.phone && !isDoNotContact(l));

    if (targetLeads.length === 0) {
      showToast('None of the selected leads can receive WhatsApp messages.', true);
      return;
    }

    setBulkWhatsAppSending(true);
    setBulkWhatsAppProgress({ sent: 0, failed: 0, total: targetLeads.length, errors: [] });

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];
    const brandId = selectedBrand.id;
    const fromNumber = whatsappNumbers[brandId] || '';
    const integration = getBrandIntegrationFor(brandId);
    const apiReady = isWhatsAppCloudConfigured(integration, brandId);

    for (const lead of targetLeads) {
      try {
        await axios.post('/api/whatsapp/send', {
          lead_id: lead.id,
          brand_id: brandId,
          from_number: fromNumber,
          to_number: lead.phone,
          template_name: 'Bulk WhatsApp Blast',
          message: applyTemplateVars(bulkWhatsAppMessage, lead, selectedBrand),
          status: 'sent',
          log_only: !apiReady
        });
        sent++;
        setBulkWhatsAppProgress({ sent, failed, total: targetLeads.length, errors: [...errors] });
      } catch (err: any) {
        failed++;
        errors.push(`${lead.name}: ${toUserFacingError(err, 'Could not send')}`);
        setBulkWhatsAppProgress({ sent, failed, total: targetLeads.length, errors: [...errors] });
      }
    }

    setBulkWhatsAppSending(false);
    showToast(`Bulk WhatsApp complete: ${sent} ${apiReady ? 'sent' : 'logged'}, ${failed} failed.`, failed > 0 && sent === 0);
    if (sent > 0) {
      fetchAllWhatsAppMessages();
      fetchDashboardStats();
    }
  };

  const sendDirectWhatsApp = async (brandId: string, toNumber: string, message: string, templateName = 'Direct WhatsApp') => {
    const fromNumber = whatsappNumbers[brandId] || '';
    const integration = getBrandIntegrationFor(brandId);
    const apiReady = isWhatsAppCloudConfigured(integration, brandId);
    await axios.post('/api/whatsapp/send', {
      brand_id: brandId,
      from_number: fromNumber,
      to_number: toNumber,
      template_name: templateName,
      message,
      status: 'sent',
      log_only: !apiReady
    });
    const link = buildWhatsAppLink(toNumber, message);
    fetchAllWhatsAppMessages(brandId);
    fetchDashboardStats();
    if (!apiReady && link) window.open(link, '_blank');
  };

  const loadLeadDetailsHistory = async (leadId: string) => {
    try {
      const [notesRes, emailsRes, waRes, callsRes] = await Promise.all([
        axios.get(`/api/leads/${leadId}/notes`),
        axios.get(`/api/emails/history/${leadId}`),
        axios.get(`/api/whatsapp/history/${leadId}`),
        axios.get(`/api/calls/history/${leadId}`)
      ]);
      setLeadNotes(notesRes.data);
      setLeadEmails(emailsRes.data);
      setLeadWhatsApp(waRes.data);
      setLeadCalls(callsRes.data);
    } catch (err) {
      console.error('Error loading lead logs checklist:', err);
    }
  };

  // 3. Authenticate Actions
  const handleLogout = async () => {
    try {
      await axios.post('/api/auth/logout');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      clearSessionToken();
      setUser(null);
      setSelectedBrand(null);
      setActiveTab('dashboard');
    }
  };

  // Helper outcome triggers
  const handleAddNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLead || !newNoteText.trim()) return;
    setNoteSaving(true);
    try {
      await axios.post(`/api/leads/${activeLead.id}/notes`, { content: newNoteText });
      setNewNoteText('');
      loadLeadDetailsHistory(activeLead.id);
    } catch (err) {
      alert('Failed to log new note.', 'error');
    } finally {
      setNoteSaving(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!activeLead || !noteId) return;
    try {
      await axios.delete(`/api/notes/${noteId}`);
      loadLeadDetailsHistory(activeLead.id);
    } catch {
      alert('Delete failed.', 'error');
    }
  };

  const handleDeleteEmail = async (emailId: string) => {
    try {
      // Server deletes CRM row, trashes Gmail, and tombstones provider id so sync cannot re-import.
      const res = await axios.delete(`/api/emails/${emailId}`);
      setConfirmDeleteEmailId(null);
      setSelectedMailboxEmailIds(prev => {
        const next = new Set(prev);
        next.delete(emailId);
        return next;
      });
      if (activeLead) loadLeadDetailsHistory(activeLead.id);
      fetchAllSentEmails();
      if (res.data?.gmail_error) {
        showToast('Deleted from CRM (and blocked from re-sync). Gmail trash needs reconnect with mailbox edit permission.', true);
      } else if (res.data?.gmail_deleted) {
        showToast('Email deleted from CRM and moved to Gmail Trash.');
      }
    } catch {
      alert('Could not delete email record.', 'error');
    }
  };

  const handleEmailAction = async (
    emailIds: string[],
    actionStatus: 'needs_reply' | 'handled' | 'ignored' | 'marketing' | 'follow_up',
    successMessage?: string,
  ) => {
    const ids = emailIds.filter(Boolean);
    if (ids.length === 0) return;
    const optimisticUpdate = {
      action_status: actionStatus,
      action_updated_at: new Date().toISOString(),
      action_updated_by: user?.id || '',
      action_updated_by_name: user?.name || 'You',
      ...(actionStatus === 'handled' ? { read_at: new Date().toISOString(), read_by: user?.id || '', read_by_name: user?.name || 'You' } : {}),
    };
    setAllSentEmails(prev => prev.map(email => ids.includes(email.id) ? { ...email, ...optimisticUpdate } : email));
    setLeadEmails(prev => prev.map(email => ids.includes(email.id) ? { ...email, ...optimisticUpdate } : email));
    try {
      const updatedEmails = await Promise.all(ids.map(id => axios.patch(`/api/emails/${encodeURIComponent(id)}/action`, {
        action_status: actionStatus,
      })));
      const updatedById = new Map(updatedEmails.map(res => [res.data.id, res.data]));
      setAllSentEmails(prev => prev.map(email => updatedById.has(email.id) ? { ...email, ...updatedById.get(email.id) } : email));
      setLeadEmails(prev => prev.map(email => updatedById.has(email.id) ? { ...email, ...updatedById.get(email.id) } : email));
      setSelectedMailboxEmailIds(new Set());
      showToast(successMessage || `Updated ${ids.length} email${ids.length !== 1 ? 's' : ''}.`);
    } catch (err) {
      console.error(err);
      showToast('Could not update the selected emails.', true);
      await fetchAllSentEmails();
    }
  };

  const handleBulkDeleteMailboxEmails = async () => {
    const ids = Array.from(selectedMailboxEmailIds);
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} selected email${ids.length !== 1 ? 's' : ''} from the CRM and Gmail? They will not reappear after sync.`)) return;
    try {
      const results = await Promise.all(ids.map(id => axios.delete(`/api/emails/${id}`)));
      const gmailOk = results.filter(r => r.data?.gmail_deleted).length;
      const gmailFail = results.filter(r => r.data?.gmail_error).length;
      if (selectedEmailLogId && ids.includes(selectedEmailLogId)) {
        setSelectedEmailLogId('');
        setEmailReplyBody('');
      }
      setSelectedMailboxEmailIds(new Set());
      await fetchAllSentEmails();
      if (gmailFail > 0) {
        showToast(`Deleted ${ids.length} from CRM (blocked from re-sync). ${gmailFail} could not be trashed in Gmail — reconnect Gmail with modify permission.`, true);
      } else if (gmailOk > 0) {
        showToast(`Deleted ${ids.length} email${ids.length !== 1 ? 's' : ''} from CRM and Gmail.`);
      } else {
        showToast(`Deleted ${ids.length} selected email${ids.length !== 1 ? 's' : ''}.`);
      }
    } catch (err) {
      console.error(err);
      showToast('Could not delete the selected emails.', true);
    }
  };

  const handleDeleteWhatsApp = async (waId: string) => {
    try {
      await axios.delete(`/api/whatsapp/${waId}`);
      setConfirmDeleteWaId(null);
      if (activeLead) loadLeadDetailsHistory(activeLead.id);
      fetchAllWhatsAppMessages();
    } catch {
      alert('Could not delete WhatsApp record.', 'error');
    }
  };

  const handleSendTeamMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamMessageText.trim() && teamFiles.length === 0) {
      showToast('Write a message or attach a file first.', true);
      return;
    }
    const totalBytes = teamFiles.reduce((total, file) => total + file.size, 0);
    if (teamFiles.length > MAX_TEAM_ATTACHMENT_FILES || totalBytes > MAX_TEAM_ATTACHMENT_TOTAL_BYTES) {
      showToast(`Send up to ${MAX_TEAM_ATTACHMENT_FILES} files and 20MB total per team message.`, true);
      return;
    }
    setTeamPosting(true);
    try {
      const attachments = await Promise.all(teamFiles.map(readTeamFile));
      await axios.post('/api/team-chat', {
        content: teamMessageText,
        recipient_ids: [activeTeamDmId || 'all'],
        attachments,
      });
      setTeamMessageText('');
      setTeamFiles([]);
      await fetchTeamMessages();
      showToast('Shared with the team.');
    } catch (err: any) {
      showApiError(err, 'Could not send team message.');
    } finally {
      setTeamPosting(false);
    }
  };


  const openTeamNoteEditor = (note?: TeamNote) => {
    setEditingTeamNote(note || null);
    setTeamNoteTitle(note?.title || '');
    setTeamNoteContent(note?.content || '');
    setTeamNotePinned(Boolean(note?.pinned));
    setTeamNoteOpen(true);
  };

  const handleSaveTeamNote = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!teamNoteContent.trim()) {
      showToast('Write a note before saving.', true);
      return;
    }
    setTeamNoteSaving(true);
    try {
      const payload = {
        title: teamNoteTitle.trim() || 'Untitled note',
        content: teamNoteContent.trim(),
        pinned: teamNotePinned,
        color: teamNotePinned ? '#fef3c7' : '#eef2ff',
      };
      if (editingTeamNote?.id) {
        await axios.put(`/api/team-notes/${editingTeamNote.id}`, payload);
        showToast('Team note updated.');
      } else {
        await axios.post('/api/team-notes', payload);
        showToast('Team note saved.');
      }
      setTeamNoteOpen(false);
      setEditingTeamNote(null);
      setTeamNoteTitle('');
      setTeamNoteContent('');
      setTeamNotePinned(false);
      await fetchTeamNotes();
    } catch (err: any) {
      showApiError(err, 'Could not save team note.');
    } finally {
      setTeamNoteSaving(false);
    }
  };

  const handleDeleteTeamNote = async (noteId: string) => {
    if (!confirm('Delete this team note?')) return;
    try {
      await axios.delete(`/api/team-notes/${noteId}`);
      await fetchTeamNotes();
      showToast('Team note deleted.');
    } catch (err: any) {
      showApiError(err, 'Could not delete team note.');
    }
  };

  const handleDeleteTeamMessage = async (messageId: string) => {
    if (!confirm('Delete this team message?')) return;
    try {
      await axios.delete(`/api/team-chat/${messageId}`);
      await fetchTeamMessages();
      fetchTeamNotes();
    } catch (err: any) {
      showApiError(err, 'Could not delete team message.');
    }
  };

  // Send interaction actions
  const handleSendEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLead || !emailSubject || !emailBody) return;
    const brandForLead = managedBrands.find(b => b.id === activeLead.brand_id) || selectedBrand || selectedBrandForEmail;
    setEmailSending(true);
    try {
      await sendTrackedEmail(activeLead, emailSubject, emailBody, brandForLead, 'Manual Lead Email');
      setEmailModalOpen(false);
      setEmailSubject('');
      setEmailBody('');
      loadLeadDetailsHistory(activeLead.id);
    } catch {
      alert('Failed to transmit email.', 'error');
    } finally {
      setEmailSending(false);
    }
  };

  const handleSendWhatsAppSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLead || !waMessage) return;
    const brandId = activeLead.brand_id || selectedBrandForWhatsApp.id;
    const integration = getBrandIntegrationFor(brandId);
    const apiReady = isWhatsAppCloudConfigured(integration, brandId);
    const fromNumber = whatsappNumbers[brandId] || '';
    setWaSending(true);
    try {
      await axios.post('/api/whatsapp/send', {
        lead_id: activeLead.id,
        brand_id: brandId,
        from_number: fromNumber,
        to_number: activeLead.phone || '',
        message: waMessage,
        log_only: !apiReady
      });
      const link = buildWhatsAppLink(activeLead.phone || '', waMessage);
      if (!apiReady && link) window.open(link, '_blank');
      setWaModalOpen(false);
      setWaMessage('');
      loadLeadDetailsHistory(activeLead.id);
    } catch {
      alert('Failed to send WhatsApp message.', 'error');
    } finally {
      setWaSending(false);
    }
  };

  const handleLogCallSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const callTarget = activeTab === 'calls' ? (activeCallLead || activeLead) : (activeLead || activeCallLead);
    if (!callTarget) return;
    setCallSaving(true);
    try {
      await axios.post('/api/calls/log', {
        lead_id: callTarget.id,
        outcome: callOutcome,
        notes: callNotes,
        duration: callDuration
      });
      if (callFollowUpDate) {
        await axios.put(`/api/leads/${callTarget.id}`, { follow_up_date: callFollowUpDate });
        setDiallerLeadsList(prev => prev.map(l => l.id === callTarget.id ? { ...l, follow_up_date: callFollowUpDate } : l));
        setActiveCallLead(prev => prev?.id === callTarget.id ? { ...prev, follow_up_date: callFollowUpDate } : prev);
      }
      setCallNotes('');
      setCallFollowUpDate('');
      setCallModalOpen(false);
      fetchAllCallLogs();
      fetchDashboardStats();
      loadLeadDetailsHistory(callTarget.id);
    } catch {
      alert('Failed to log call data.', 'error');
    } finally {
      setCallSaving(false);
    }
  };

  const handleQuickCallSubmit = async ({ lead, outcome, duration, notes, followUpDate }: QuickCallPayload) => {
    setQuickCallSaving(true);
    try {
      await axios.post('/api/calls/log', {
        lead_id: lead.id,
        outcome,
        notes,
        duration
      });

      if (followUpDate) {
        await axios.put(`/api/leads/${lead.id}`, { follow_up_date: followUpDate });
        const patchLead = (item: Lead) => item.id === lead.id ? { ...item, follow_up_date: followUpDate } : item;
        setLeads(prev => prev.map(patchLead));
        setAllCrmLeads(prev => prev.map(patchLead));
        setDiallerLeadsList(prev => prev.map(patchLead));
        setActiveLead(prev => prev?.id === lead.id ? { ...prev, follow_up_date: followUpDate } : prev);
        setActiveCallLead(prev => prev?.id === lead.id ? { ...prev, follow_up_date: followUpDate } : prev);
        setLastViewedLead(prev => prev?.id === lead.id ? { ...prev, follow_up_date: followUpDate } : prev);
      }

      await fetchAllCallLogs();
      await fetchDashboardStats();
      if (activeLead?.id === lead.id) loadLeadDetailsHistory(lead.id);
      setQuickCallOpen(false);
      showToast('Call logged.');
    } catch {
      showToast('Could not save quick call log.', true);
    } finally {
      setQuickCallSaving(false);
    }
  };

  // Lead updates
  const handleAddNewLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBrand) return;
    if (!addLeadForm.name) {
      alert('Please fill out the required Name field.', 'warning');
      return;
    }
    setLeadAdding(true);
    try {
      const selectedSegment = selectedBrand.id === 'optimaviz'
        ? (normalizeOptimavizSegmentValue(addLeadForm.segment) || 'demo_leads')
        : selectedBrand.id === 'idao'
          ? (normalizeIdaoSegmentValue(addLeadForm.segment) || 'training_leads')
          : (addLeadForm.segment || '');
      const selectedStage = selectedBrand.id === 'optimaviz'
        ? normalizeOptimavizStageValue(addLeadForm.funnel_stage, selectedSegment)
        : selectedBrand.id === 'idao'
          ? normalizeIdaoStageValue(addLeadForm.funnel_stage, selectedSegment)
          : (addLeadForm.funnel_stage || getBrandStageOptions(selectedBrand.id)[0]);
      const nextCustomFields = {
        segment: selectedSegment,
        ...addLeadCustomFieldValues,
        ...(selectedBrand.id === 'optimaviz' ? { next_action: addLeadCustomFieldValues.next_action || getOptimavizDefaultNextAction(selectedSegment, selectedStage) } : {}),
        ...(selectedBrand.id === 'idao' ? {
          service_type: addLeadCustomFieldValues.service_type || (IDAO_SERVICE_TYPES[selectedSegment] || [])[0] || '',
          service_focus: addLeadCustomFieldValues.service_type || addLeadCustomFieldValues.service_focus || (IDAO_SERVICE_TYPES[selectedSegment] || [])[0] || '',
          next_action: addLeadCustomFieldValues.next_action || getIdaoDefaultNextAction(selectedSegment, selectedStage)
        } : {})
      };
      await axios.post('/api/leads', {
        brand_id: selectedBrand.id,
        brand_name: selectedBrand.name,
        name: addLeadForm.name,
        email: addLeadForm.email,
        phone: addLeadForm.phone,
        funnel_stage: selectedStage,
        follow_up_date: selectedBrand.id === 'optimaviz'
          ? getOptimavizFollowUpDateForStage(selectedSegment, selectedStage)
          : selectedBrand.id === 'idao'
            ? getIdaoFollowUpDateForStage(selectedSegment, selectedStage)
            : undefined,
        notes: addLeadForm.notes,
        tags: [],
        owner_id: addLeadForm.owner_id || user.id,
        owner_name: addLeadForm.owner_name || user.name,
        custom_fields: nextCustomFields
      });
      setAddLeadForm({ name: '', email: '', phone: '', funnel_stage: '', notes: '', segment: '', owner_id: '', owner_name: '' });
      setAddLeadCustomFieldValues({});
      setAddLeadStep('segment');
      setAddLeadIsOpen(false);
      fetchLeadsForActiveBrand();
    } catch (err: any) {
      alert(toUserFacingError(err, 'Failed to add lead.'), 'error');
    } finally {
      setLeadAdding(false);
    }
  };

  const handleUpdateLeadField = async (field: string, val: any) => {
    if (!activeLead) return;
    try {
      const res = await axios.put(`/api/leads/${activeLead.id}`, { [field]: val });
      const updated = res.data;
      setActiveLead(updated);
      
      // Sync list
      setLeads(prev => prev.map(l => l.id === updated.id ? updated : l));
      setAllCrmLeads(prev => prev.map(l => l.id === updated.id ? updated : l));
      loadLeadDetailsHistory(updated.id);
    } catch (err) {
      console.error('Update failed:', err);
    }
  };

  const updateLeadStageAndDefaults = async (lead: Lead, nextStage: string) => {
    if (!lead) return;
    const isOptimavizLead = selectedBrand?.id === 'optimaviz' || lead.brand_id === 'optimaviz';
    const isIdaoLead = selectedBrand?.id === 'idao' || lead.brand_id === 'idao';
    const currentSegment = isOptimavizLead
      ? (getOptimavizLeadSegment(lead) || inferOptimavizSegmentFromStage(nextStage))
      : isIdaoLead
        ? (getIdaoLeadSegment(lead) || inferIdaoSegmentFromStage(nextStage))
        : (lead.custom_fields?.segment || '');
    const normalizedStage = isOptimavizLead
      ? normalizeOptimavizStageValue(nextStage, currentSegment)
      : isIdaoLead
        ? normalizeIdaoStageValue(nextStage, currentSegment)
        : nextStage;
    const nextCustomFields = isOptimavizLead
      ? { ...(lead.custom_fields || {}), segment: currentSegment, next_action: lead.custom_fields?.next_action || getOptimavizDefaultNextAction(currentSegment, normalizedStage) }
      : isIdaoLead
        ? { ...(lead.custom_fields || {}), segment: currentSegment, service_type: lead.custom_fields?.service_type || lead.custom_fields?.service_focus || (IDAO_SERVICE_TYPES[currentSegment] || [])[0] || '', service_focus: lead.custom_fields?.service_focus || lead.custom_fields?.service_type || (IDAO_SERVICE_TYPES[currentSegment] || [])[0] || '', next_action: lead.custom_fields?.next_action || getIdaoDefaultNextAction(currentSegment, normalizedStage) }
        : (lead.custom_fields || {});
    const nextFollowUp = isOptimavizLead
      ? (lead.follow_up_date || getOptimavizFollowUpDateForStage(currentSegment, normalizedStage))
      : isIdaoLead
        ? (lead.follow_up_date || getIdaoFollowUpDateForStage(currentSegment, normalizedStage))
        : lead.follow_up_date;
    const patch: any = { funnel_stage: normalizedStage, custom_fields: nextCustomFields };
    if (nextFollowUp) patch.follow_up_date = nextFollowUp;
    try {
      const res = await axios.put(`/api/leads/${lead.id}`, patch);
      const updated = isOptimavizLead ? normalizeOptimavizLeadsForDisplay([res.data])[0] : isIdaoLead ? normalizeIdaoLeadsForDisplay([res.data])[0] : res.data;
      setLeads(prev => prev.map(l => l.id === updated.id ? updated : l));
      setAllCrmLeads(prev => prev.map(l => l.id === updated.id ? updated : l));
      setActiveLead(prev => prev?.id === updated.id ? updated : prev);
      try {
        await axios.post('/api/notes', { lead_id: lead.id, content: `Stage changed to ${normalizedStage}${(isOptimavizLead || isIdaoLead) ? ` - Next action: ${nextCustomFields.next_action}` : ''}` });
      } catch {}
    } catch (err) {
      console.error('Stage update failed:', err);
      showToast('Could not update lead stage.', true);
    }
  };

  const handleLeadFollowUpAction = async (action: 'email' | 'whatsapp' | 'call' | 'no_response' | 'close_won' | 'close_lost' | 'next_follow_up') => {
    if (!activeLead) return;
    const todayKey = new Date().toISOString().split('T')[0];
    const currentFields = activeLead.custom_fields || {};
    const nextFields: Record<string, any> = { ...currentFields, last_follow_up_date: todayKey };
    let patch: any = { custom_fields: nextFields };
    let note = '';

    if (action === 'email') {
      nextFields.follow_up_type = 'Email';
      nextFields.follow_up_status = 'Email Sent';
      note = `Follow-up email logged for ${activeLead.email || activeLead.name}.`;
    } else if (action === 'whatsapp') {
      nextFields.follow_up_type = 'WhatsApp';
      nextFields.follow_up_status = 'WhatsApp Sent';
      note = `WhatsApp follow-up logged for ${activeLead.phone || activeLead.name}.`;
    } else if (action === 'call') {
      nextFields.follow_up_type = 'Call';
      nextFields.follow_up_status = 'Call Scheduled';
      note = 'Call follow-up scheduled.';
    } else if (action === 'no_response') {
      nextFields.follow_up_status = 'Contact did not respond';
      note = 'Lead marked as no response after follow-up attempt.';
    } else if (action === 'close_won') {
      nextFields.follow_up_status = 'Closed - Won';
      patch.funnel_stage = getStageOptionsForLead(activeLead).find(s => /won|converted|registered|subscriber/i.test(s)) || 'Won';
      patch.follow_up_date = '';
      note = 'Lead closed as won.';
    } else if (action === 'close_lost') {
      nextFields.follow_up_status = 'Closed - Lost';
      patch.funnel_stage = getStageOptionsForLead(activeLead).find(s => /lost|not interested|closed/i.test(s)) || 'Lost';
      patch.follow_up_date = '';
      note = 'Lead closed as lost or not interested.';
    } else {
      nextFields.follow_up_status = 'Next follow-up set';
      note = activeLead.follow_up_date ? `Next follow-up reminder set for ${activeLead.follow_up_date}.` : 'Next follow-up reminder updated.';
    }

    try {
      const res = await axios.put(`/api/leads/${activeLead.id}`, patch);
      const updated = res.data;
      await axios.post(`/api/leads/${activeLead.id}/notes`, { content: note });
      setActiveLead(updated);
      setLeads(prev => prev.map(l => l.id === updated.id ? updated : l));
      setAllCrmLeads(prev => prev.map(l => l.id === updated.id ? updated : l));
      loadLeadDetailsHistory(updated.id);
      if (action === 'whatsapp') {
        const phone = (activeLead.phone || '').replace(/\D/g, '');
        if (phone) window.open(`https://wa.me/${phone}`, '_blank');
      }
      showToast(note);
    } catch (err) {
      console.error(err);
      showToast('Could not update follow-up tracker.', true);
    }
  };

  const handleDeleteActiveLead = async () => {
    if (!activeLead) return;
    try {
      await axios.delete(`/api/leads/${activeLead.id}`);
      setLeads(prev => prev.filter(l => l.id !== activeLead.id));
      setActiveLead(null);
    } catch (err: any) {
      alert(toUserFacingError(err, 'Failed to delete lead.'), 'error');
    }
  };

  useEffect(() => {
    setDeleteConfirmState(false);
  }, [activeLead]);

  // Custom Fields (Columns) Manager
  const handleSaveCustomFieldSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBrand || !newColName.trim()) return;
    setColSaving(true);
    try {
      const fieldName = newColName.trim();
      const res = editingColumnId
        ? await axios.patch(`/api/custom-fields/${editingColumnId}`, {
            field_name: fieldName,
            field_type: newColType,
            required: newColRequired
          })
        : await axios.post(`/api/brands/${selectedBrand.id}/custom-fields`, {
            field_name: fieldName,
            field_type: newColType,
            required: newColRequired
          });
      const savedField = res.data?.field_name || fieldName;
      // Explicit re-add clears permanent-delete tombstones (server + local).
      try {
        const key = `crm_deleted_custom_cols_${selectedBrand.id}`;
        const prev: string[] = JSON.parse(localStorage.getItem(key) || '[]');
        const next = prev.filter(n => String(n).toLowerCase() !== String(savedField).toLowerCase());
        localStorage.setItem(key, JSON.stringify(next));
      } catch { /* ignore */ }
      setColumnVisibility(prev => {
        const updated = new Set(prev);
        if (editingColumnId) {
          customFields.filter(cf => cf.id === editingColumnId).forEach(cf => updated.delete(cf.field_name));
        }
        updated.add(savedField);
        return new Set(persistColumnVisibility(selectedBrand.id, updated));
      });
      setNewColName('');
      setNewColType('text');
      setNewColRequired(false);
      setEditingColumnId('');
      setEditFormHighlight(false);
      await fetchCustomFieldsForBrand();
      showToast(`Column "${formatColumnLabel(savedField)}" ${editingColumnId ? 'updated' : 'added'} and shown in the table.`);
    } catch {
      alert('Failed to save custom column.', 'error');
    } finally {
      setColSaving(false);
    }
  };

  const handleDeleteColumn = async (colId: string) => {
    if (!colId) return;
    // Find column metadata for name and protection check
    const colMeta = customFields.find(cf => cf.id === colId);
    if (!colMeta) return;
    // Confirmation dialog for permanent custom column deletion
    if (!window.confirm(`Delete column "${formatColumnLabel(colMeta.field_name)}" permanently? It will stay deleted (not just hidden) unless you add it again.`)) {
      return;
    }
    setConfirmDeleteCustomField(null);
    try {
      await axios.delete(`/api/custom-fields/${colId}`);
      if (colMeta && selectedBrand) {
        // Tombstone so auto-seed / required-fields never recreate it as a mere "uncheck".
        try {
          const key = `crm_deleted_custom_cols_${selectedBrand.id}`;
          const prev: string[] = JSON.parse(localStorage.getItem(key) || '[]');
          const next = Array.from(new Set([...prev.map(n => String(n).toLowerCase()), String(colMeta.field_name).toLowerCase()]));
          localStorage.setItem(key, JSON.stringify(next));
        } catch { /* ignore */ }
        setColumnVisibility(prev => {
          const updated = new Set(prev);
          updated.delete(colMeta.field_name);
          return new Set(persistColumnVisibility(selectedBrand.id, updated));
        });
        // Optimistic remove so the UI does not flash the column back before refetch.
        setCustomFields(prev => prev.filter(cf => cf.id !== colId));
        showToast(`Deleted column "${formatColumnLabel(colMeta.field_name)}" permanently.`);
      }
      await fetchCustomFieldsForBrand();
    } catch {
      alert('Failed to delete custom field.', 'error');
    }
  };

  // CSV Reader
  const parseAndPreview = async (text: string) => {
    if (!text.trim()) {
      setCsvPreview(null);
      return;
    }
    try {
      const res = await axios.post('/api/leads/upload/preview', { csvText: text });
      setCsvPreview(res.data);
      setCsvMapping(buildAutoMapping(res.data.headers, customFields, res.data.preview));
    } catch (err: any) {
      console.error(err.response?.data?.detail || err.message);
    }
  };

  // Shared CSV auto-mapping helper — used by processFile (CSV), processFile (XLSX),
  // and handleCsvTextChange so all three stay in sync automatically.
  const buildAutoMapping = (
    headers: string[],
    fields: typeof customFields,
    sampleRows: Array<Record<string, unknown>> = [],
  ): Record<string, string> => buildImportAutoMapping(headers, fields, sampleRows, findLeadDateHeader);

  const parseFullCsvText = (csv: string): Record<string, string>[] => {
    if (!csv.trim()) return [];
    
    function parseCSVLine(line: string): string[] {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result.map(val => val.replace(/^"|"$/g, '').trim());
    }

    const lines = csv.replace(/\r/g, '').split('\n').filter((l: string) => l.trim().length > 0);
    if (lines.length < 2) return [];
    const headers = parseCSVLine(lines[0]);
    return lines.slice(1).map((line: string, i: number) => {
      const cols = parseCSVLine(line);
      const item: Record<string, string> = { id: `row-${i}` };
      headers.forEach((h: string, j: number) => {
        if (h) {
          item[h] = cols[j] || '';
        }
      });
      return item;
    });
  };

  const handleCsvTextChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setCsvText(text);
    try {
      const dataRows = parseFullCsvText(text);
      if (dataRows.length > 0) {
        const headers = Object.keys(dataRows[0]).filter(k => k !== 'id');
        const autoMap = buildAutoMapping(headers, customFields, dataRows);
        setParsedRows(dataRows);
        // Essentials only by default — user opts into extra spreadsheet columns
        setSelectedImportColumns(
          new Set(
            [autoMap.name, autoMap.name_secondary, autoMap.email, autoMap.phone, autoMap.created_at].filter(Boolean),
          ),
        );
        setCsvPreview({
          headers,
          preview: dataRows.slice(0, 5),
          totalRows: dataRows.length
        });
        setCsvMapping(autoMap);
      } else {
        setParsedRows([]);
        setCsvPreview(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const applyParsedTableToImportState = (
    headers: string[],
    dataRows: Record<string, string>[],
    options?: { sheetNote?: string },
  ) => {
    if (!headers.length) {
      setImportError(options?.sheetNote || 'This sheet has no usable column headers.');
      setParsedRows([]);
      setCsvPreview(null);
      return;
    }
    if (dataRows.length === 0) {
      setImportError(options?.sheetNote || 'This sheet has headers but no data rows.');
      setParsedRows([]);
      const autoMap = buildAutoMapping(headers, customFields, []);
      setSelectedImportColumns(
        new Set(
          [autoMap.name, autoMap.name_secondary, autoMap.email, autoMap.phone, autoMap.created_at].filter(Boolean),
        ),
      );
      setCsvPreview({ headers, preview: [], totalRows: 0 });
      setCsvMapping(autoMap);
      return;
    }
    setImportError(null);
    setParsedRows(dataRows);
    const autoMap = buildAutoMapping(headers, customFields, dataRows);
    // Essentials only by default — optional columns stay unchecked until the user opts in
    setSelectedImportColumns(
      new Set(
        [autoMap.name, autoMap.name_secondary, autoMap.email, autoMap.phone, autoMap.created_at].filter(Boolean),
      ),
    );
    setCsvPreview({
      headers,
      preview: dataRows.slice(0, 5),
      totalRows: dataRows.length,
    });
    setCsvMapping(autoMap);
  };

  const applyExcelWorkbookSheet = (sheets: ExcelSheetRaw[], sheetIndex: number) => {
    const result = applyExcelSheetToImporter(sheets, sheetIndex);
    setExcelWorkbookSheets(sheets);
    setExcelSheetMetas(result.meta);
    setSelectedExcelSheetIndex(Math.max(0, Math.min(sheetIndex, sheets.length - 1)));

    const note =
      result.dataRows.length === 0
        ? `Sheet "${result.sheetName}" has no importable data rows. Try another sheet.`
        : result.meta.length > 1 && !result.meta[sheetIndex]?.looksLikeTable
          ? `Sheet "${result.sheetName}" may not be a data table. You can switch sheets below.`
          : undefined;

    applyParsedTableToImportState(result.headers, result.dataRows, { sheetNote: note });
  };

  const handleExcelSheetChange = (sheetIndex: number) => {
    if (!excelWorkbookSheets?.length) return;
    setImportSuccessMessage(null);
    applyExcelWorkbookSheet(excelWorkbookSheets, sheetIndex);
  };

  const processFile = (file: File) => {
    setFileName(file.name);
    setImportError(null);
    setImportSuccessMessage(null);
    setExcelWorkbookSheets(null);
    setExcelSheetMetas([]);
    setSelectedExcelSheetIndex(0);
    const fileLower = file.name.toLowerCase();
    if (fileLower.endsWith('.xls')) {
      setImportError('Legacy .xls files are not supported securely. Open the file in Excel and save it as .xlsx or CSV first.');
      return;
    }
    const reader = new FileReader();
    
    if (fileLower.endsWith('.xlsx')) {
      reader.onload = async (evt) => {
        try {
          const buffer = evt.target?.result as ArrayBuffer;
          // Default export returns every sheet: [{ sheet, data }, ...]
          const readXlsxFile = (await import('read-excel-file/browser')).default;
          const allSheets = (await readXlsxFile(buffer)) as ExcelSheetRaw[];
          if (!Array.isArray(allSheets) || allSheets.length === 0) {
            setImportError('This Excel workbook appears empty.');
            return;
          }
          const normalized: ExcelSheetRaw[] = allSheets.map((s, i) => ({
            sheet: String(s?.sheet || `Sheet ${i + 1}`),
            data: Array.isArray(s?.data) ? s.data : [],
          }));
          const bestIndex = pickBestSheetIndex(normalized);
          applyExcelWorkbookSheet(normalized, bestIndex);
          if (normalized.length > 1) {
            const best = normalized[bestIndex];
            setImportSuccessMessage(
              bestIndex === 0
                ? `Loaded ${normalized.length} sheets. Using "${best.sheet}" (first sheet). You can switch sheets below.`
                : `Loaded ${normalized.length} sheets. Auto-selected "${best.sheet}" because it looks like data (sheet 1 may be notes). You can switch sheets below.`,
            );
          }
        } catch (error) {
          setImportError('Failed to parse Excel file. Please verify it is a valid format.');
          console.error(error);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = (evt) => {
        try {
          const csvTextResult = evt.target?.result as string;
          setCsvText(csvTextResult);
          setExcelWorkbookSheets(null);
          setExcelSheetMetas([]);
          
          const dataRows = parseFullCsvText(csvTextResult);
          if (dataRows.length === 0) {
            setImportError('The CSV file does not contain any valid headers or rows.');
            return;
          }
          
          const headers = Object.keys(dataRows[0]).filter(k => k !== 'id');
          applyParsedTableToImportState(headers, dataRows);
        } catch (error) {
          setImportError('Failed to parse CSV file.');
          console.error(error);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Allow re-selecting the same path after a previous import session.
      setImportProgressSmooth(null);
      setImportSuccessMessage(null);
      processFile(file);
    }
    // Reset native value so the next pick of the same file still fires onChange.
    e.target.value = '';
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleClearFile = () => {
    setFileName('');
    setCsvText('');
    setCsvPreview(null);
    setParsedRows([]);
    setExcelWorkbookSheets(null);
    setExcelSheetMetas([]);
    setSelectedExcelSheetIndex(0);
    setImportError(null);
    setImportSuccessMessage(null);
    setImportProgressSmooth(null);
    setCsvMapping({ name: '', name_secondary: '', email: '', phone: '', created_at: '' });
    setSelectedImportColumns(new Set());
    setSelectedSuggestedCols(new Set());
    setSuggestedCols([]);
    setRowDuplicateActions({});
    setImportCleanupFocus(null);
    setConfirmDuplicateImport(false);
    clearExcelFileInput();
  };

  const handleConvertProspect = async (leadId: string, reason?: string) => {
    try {
      const res = await axios.post(`/api/leads/${leadId}/convert`, { reason });
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, ...res.data } : l));
      showToast('Prospect converted to Verified Lead');
    } catch (err: any) {
      showApiError(err, 'Failed to convert lead');
    }
  };

  const handleBulkConvertProspects = async (leadIds: string[], reason?: string) => {
    let converted = 0;
    for (const id of leadIds) {
      try {
        await axios.post(`/api/leads/${id}/convert`, { reason });
        converted++;
      } catch { /* skip failures */ }
    }
    if (converted > 0) {
      setLeads(prev => prev.map(l => leadIds.includes(l.id) ? { ...l, lead_classification: 'verified' as const } : l));
      showToast(`${converted} lead${converted === 1 ? '' : 's'} converted to Verified Leads`);
    }
  };

  const handleBulkTogglePool = async (target: 'verified' | 'prospect') => {
    if (!selectedBrand || selectedLeadIds.size === 0) return;
    const ids = Array.from(selectedLeadIds);
    const currentLabel = leadClassificationTab === 'verified' ? 'Verified Lead' : 'Prospect';
    const targetLabel = target === 'verified' ? 'Verified Lead' : 'Prospect';
    showConfirm({
      title: `Move ${ids.length} lead${ids.length !== 1 ? 's' : ''} to ${targetLabel}?`,
      message: `This will move ${ids.length} selected lead${ids.length !== 1 ? 's' : ''} from ${currentLabel} to ${targetLabel}.`,
      confirmLabel: `Move to ${targetLabel}`,
      onConfirm: async () => {
        try {
          let successCount = 0;
          for (const id of ids) {
            if (target === 'verified') {
              await axios.post(`/api/leads/${id}/convert`, { reason: 'Bulk moved to Verified' });
            } else {
              await axios.put(`/api/leads/${id}`, { lead_classification: 'prospect' });
            }
            successCount++;
          }
          setLeads(prev => prev.map(l => ids.includes(l.id) ? { ...l, lead_classification: target } : l));
          setAllCrmLeads(prev => prev.map(l => ids.includes(l.id) ? { ...l, lead_classification: target } : l));
          if (activeLead && ids.includes(activeLead.id)) {
            setActiveLead(prev => prev ? { ...prev, lead_classification: target } : null);
          }
          setSelectedLeadIds(new Set());
          setLeadClassificationTab(target);
          await fetchDashboardStats();
          showToast(`Successfully moved ${successCount} lead${successCount !== 1 ? 's' : ''} to ${targetLabel}`);
        } catch (err) {
          console.error(err);
          showApiError(err, 'Failed to move leads');
        }
      },
    });
  };

  const handleExportToExcel = async () => {
    if (!selectedBrand || tableDisplayLeads.length === 0) return;
    const { default: writeXlsxFile } = await import('write-excel-file/browser');

    // Audit: record export on each visible lead (capped) so Access history can show who exported.
    tableDisplayLeads.slice(0, 40).forEach(l => {
      axios.post(`/api/leads/${encodeURIComponent(l.id)}/events`, {
        event_type: 'export',
        detail: `excel:${selectedBrand.name}`,
      }).catch(() => {});
    });

    const rows = tableDisplayLeads.map(l => {
      const row: Record<string, string> = {};
      if (getVisibleColumns().has('name')) row['Name'] = l.name || '';
      if (getVisibleColumns().has('email')) row['Email'] = l.email || '';
      if (getVisibleColumns().has('phone')) row['Phone'] = l.phone || '';
      if (getVisibleColumns().has('stage')) row['Stage'] = l.funnel_stage || '';
      getTableCustomFields().forEach(f => {
        if (getVisibleColumns().has(f.field_name)) {
          const val = l.custom_fields?.[f.field_name];
          row[f.field_name === 'segment' ? 'Target Segment' : f.field_name] = Array.isArray(val) ? val.join(', ') : (val != null ? String(val) : '');
        }
      });
      if (getVisibleColumns().has('tags')) row['Tags'] = (l.tags || []).join(', ');
      if (selectedBrand?.id === 'optimaviz') {
        const trial = getOptimavizTrialInfo(l);
        if (getVisibleColumns().has('trial_status_virtual')) row['Trial Status'] = trial.isTrialLead ? trial.status : '';
        if (getVisibleColumns().has('days_remaining_virtual')) row['Days Remaining'] = trial.isTrialLead ? `${trial.daysRemaining} days` : '';
      }
      if (getVisibleColumns().has('added')) row['Lead Date'] = getLeadDateLabel(l);
      return row;
    });

    const headers = rows.length ? Object.keys(rows[0]) : [];
    const sheetData = [
      headers.map(header => ({ value: header, type: String, fontWeight: 'bold' as const })),
      ...rows.map(row => headers.map(header => ({ value: row[header] || '', type: String }))),
    ];
    const fileName = `${selectedBrand.name}_leads_${new Date().toISOString().slice(0, 10)}.xlsx`;
    await writeXlsxFile(sheetData, {
      sheet: selectedBrand.name.slice(0, 31),
      columns: headers.map(header => ({ width: Math.min(40, Math.max(12, header.length + 4)) })),
    }).toFile(fileName);
  };

  const getRowDuplicateAction = (idx: number): DuplicateImportStrategy =>
    rowDuplicateActions[idx] || duplicateImportStrategy;

  const handleCsvImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportError(null);
    setImportSuccessMessage(null);

    if (!selectedBrand || !csvPreview) {
      setImportError('No active brand or preview dataset found.');
      return;
    }

    // Require explicit confirmation when CRM/file matches will be merged or created as new.
    if (
      duplicatesAnalysis.duplicateCount > 0 &&
      duplicateImportStrategy !== 'skip' &&
      !confirmDuplicateImport
    ) {
      setConfirmDuplicateImport(true);
      setImportError(
        duplicateImportStrategy === 'merge'
          ? 'CRM matches will be merged into existing records. Review the Cleanup Wizard, then press import again to confirm.'
          : 'CRM matches will be created as additional leads (optionally under a new segment). Review the Cleanup Wizard, then press import again to confirm.'
      );
      return;
    }

    setConfirmDuplicateImport(false);
    setCsvImporting(true);
    setImportProgressSmooth({ value: 12, label: 'Preparing your spreadsheet…' });
    try {
      const colsToCreate = Array.from(selectedSuggestedCols).filter(col => selectedImportColumns.has(col)) as string[];

      // Build final mappings
      const finalMappings: Record<string, string> = {};
      
      // We force import Name mapping (optional or fallback-driven), and Email/Phone if specified
      finalMappings.name = csvMapping.name || '';
      if (csvMapping.name_secondary) {
        finalMappings.name_secondary = csvMapping.name_secondary;
      }

      if (csvMapping.email) {
        finalMappings.email = csvMapping.email;
      }

      if (csvMapping.phone) {
        finalMappings.phone = csvMapping.phone;
      }

      if (csvMapping.created_at) {
        finalMappings.created_at = csvMapping.created_at;
      }

      // Existing custom CRM fields mapped
      customFields.forEach(cf => {
        const mappedSource = csvMapping[cf.field_name];
        if (mappedSource && selectedImportColumns.has(mappedSource)) {
          finalMappings[cf.field_name] = mappedSource;
        }
      });

      // Checked and imported brand suggestions to auto-create on backend in one payload
      colsToCreate.forEach((col: string) => {
        finalMappings[col] = col;
      });

      // Attach per-row action for flagged duplicates; drop rows the user chose to skip.
      const dataRowsToImport = parsedRows
        .map((row, idx) => {
          const isDup = duplicatesAnalysis.fileDuplicates.has(idx) || duplicatesAnalysis.crmDuplicates.has(idx);
          if (!isDup) return { ...row };
          const action = getRowDuplicateAction(idx);
          if (action === 'skip') return null;
          return { ...row, __import_action: action };
        })
        .filter(Boolean) as Record<string, string>[];

      if (dataRowsToImport.length === 0) {
        setImportError('No leads left to import after skipping duplicates.');
        setCsvImporting(false);
        setImportProgressSmooth(null);
        return;
      }

      const payload = {
        brand_id: selectedBrand.id,
        brand_name: selectedBrand.name,
        funnel_stage: csvImportingStage || getBrandStageOptions(selectedBrand.id)[0],
        mappings: finalMappings,
        dataRows: dataRowsToImport,
        default_custom_fields: csvImportingSegment ? { segment: csvImportingSegment } : {},
        lead_destination: importLeadDestination,
        // Global fallback when a row has no __import_action (non-duplicate rows always create).
        duplicate_strategy: duplicateImportStrategy,
        // Returning-customer segment (e.g. shoes buyer now buying a hat)
        duplicate_segment: duplicateCreateSegment || undefined,
      };
      
      setImportProgressSmooth({ value: 28, label: 'Checking and saving leads…' });
      const importRes = await axios.post('/api/leads/upload', payload, {
        onUploadProgress: event => {
          if (!event.total) {
            // Indeterminate total — ease the bar forward without thrashing.
            setImportProgressSmooth({ value: 48, label: 'Uploading leads securely…' });
            return;
          }
          const ratio = Math.max(0, Math.min(1, event.loaded / event.total));
          const uploaded = Math.round(ratio * 55);
          setImportProgressSmooth({
            value: Math.min(85, 30 + uploaded),
            label: 'Uploading leads securely…',
          });
        },
      });
      setImportProgressSmooth({ value: 90, label: 'Refreshing your CRM…' });
      
      // Fetch custom fields to ensure our synced standard + custom columns display updated structures
      await fetchCustomFieldsForBrand();

      // Auto-enable newly created custom columns and mapped standard/custom ones in column visibility
      setColumnVisibility(prev => {
        const next = new Set(prev);
        getStandardColumns(selectedBrand.id).forEach(col => next.add(col));
        colsToCreate.forEach(col => next.add(col));
        customFields.forEach(cf => {
          if (finalMappings[cf.field_name]) {
            next.add(cf.field_name);
          }
        });
        return new Set(persistColumnVisibility(selectedBrand.id, next));
      });

      const added = Number(importRes.data.added ?? importRes.data.count ?? 0);
      const merged = Number(importRes.data.merged ?? 0);
      const skipped = Number(importRes.data.skipped ?? 0);
      const parts = [
        added ? `${added} added` : null,
        merged ? `${merged} merged` : null,
        skipped ? `${skipped} skipped` : null,
      ].filter(Boolean);
      setImportSuccessMessage(
        parts.length
          ? `Import complete! ${parts.join(', ')}.`
          : `Import complete! Successfully processed ${importRes.data.count || 0} leads.`
      );
      
      // Silent refresh: no full-page loading flash under the modal (was causing flicker/glitch).
      await fetchLeadsForActiveBrand({ silent: true, force: true });
      setImportProgressSmooth({ value: 100, label: 'Import complete' });

    } catch (err: any) {
      setImportError(toUserFacingError(err, 'Failed to import leads.'));
      setImportProgressSmooth(null);
    } finally {
      setCsvImporting(false);
    }
  };

  // Email sequences auto actions
  const handleAddSequenceStep = () => {
    setSeqForm(prev => ({
      ...prev,
      steps: [...prev.steps, { id: `step_${Date.now()}`, name: '', delay_days: prev.steps.length === 0 ? 0 : 1, channel: 'email', subject: '', html_content: '' }]
    }));
  };

  const handleUpdateStepField = (index: number, field: string, val: any) => {
    setSeqForm(prev => {
      const updatedSteps = [...prev.steps];
      updatedSteps[index] = { ...updatedSteps[index], [field]: val };
      return { ...prev, steps: updatedSteps };
    });
  };

  const handleRemoveSequenceStep = (index: number) => {
    setSeqForm(prev => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index)
    }));
  };

  const handleSaveSequenceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBrand || !seqForm.name) return;
    if (!seqForm.steps?.length) {
      alert('Add at least one step before saving the communication series.', 'warning');
      return;
    }
    setSeqSaving(true);
    try {
      if (seqForm.id) {
        await axios.put(`/api/sequences/${seqForm.id}`, seqForm);
      } else {
        await axios.post('/api/sequences', {
          brand_id: selectedBrand.id,
          ...seqForm
        });
      }
      setSeqModalIsOpen(false);
      setSeqForm({ name: '', description: '', trigger_stage: getBrandStageOptions(selectedBrand.id)[0], active: true, steps: [] });
      fetchSequencesForBrand();
    } catch (err: any) {
      alert(getApiErrorMessage(err, 'Failed to save communication series.'), 'error');
    } finally {
      setSeqSaving(false);
    }
  };

  const handleDeleteSequence = async (seqId: string) => {
    // Caller sets confirmDeleteSequenceId before calling; cleared after
    try {
      await axios.delete(`/api/sequences/${seqId}`);
      fetchSequencesForBrand();
    } catch {
      alert('Delete failed.', 'error');
    }
  };

  // Bulk enrollment
  const handleBulkEnrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollSequenceId || selectedLeadsEnroll.size === 0) {
      alert('Please select both a sequence and at least one lead.', 'warning');
      return;
    }
    setEnrollSaving(true);
    try {
      const res = await axios.post('/api/enrollments/bulk-enroll', {
        sequence_id: enrollSequenceId,
        lead_ids: Array.from(selectedLeadsEnroll)
      });
      alert(`Success! Enrolled ${res.data.enrolledCount} matching leads.`, 'success');
      setEnrollModalOpen(false);
      setSelectedLeadsEnroll(new Set());
      fetchSequencesForBrand();
    } catch (err: any) {
      alert(getApiErrorMessage(err, 'Bulk enrollment failed.'), 'error');
    } finally {
      setEnrollSaving(false);
    }
  };

  const handleToggleLeadEnrollSelect = (leadId: string) => {
    setSelectedLeadsEnroll(prev => {
      const updated = new Set(prev);
      if (updated.has(leadId)) {
        updated.delete(leadId);
      } else {
        updated.add(leadId);
      }
      return updated;
    });
  };

  // Call dialler logics
  const [diallerLeadsList, setDiallerLeadsList] = useState<Lead[]>([]);
  const fetchDiallerLeads = async () => {
    try {
      const res = await axios.get('/api/leads?limit=500');
      // Unwrap paginated response shape { items, total, ... }
      const allLeads: Lead[] = Array.isArray(res.data) ? res.data : (res.data.items || []);
      const callsLeads = allLeads.filter((l: Lead) => l.funnel_stage !== 'Won' && l.funnel_stage !== 'Lost');
      setDiallerLeadsList(callsLeads);
    } catch (err) {
      console.error('Error fetching dialler leads:', err);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isCalling) {
      interval = setInterval(() => {
        setCallSeconds(prev => prev + 1);
      }, 1000);
    } else {
      setCallSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isCalling]);

  const handleStartSimulatedCall = (lead: Lead) => {
    if (!lead.phone) {
      showToast('This contact has no phone number saved.', true);
      return;
    }
    setDiallerLead(lead);
    setActiveCallLead(lead);
    setActiveLead(lead);
    loadLeadDetailsHistory(lead.id);
    window.location.href = `tel:${String(lead.phone || '').replace(/[^\d+]/g, '')}`;
    setIsCalling(true);
    setCallSeconds(0);
  };

  const handleEndSimulatedCall = () => {
    setIsCalling(false);
    if (diallerLead) {
      // Open Call outcomes Logger
      setActiveLead(diallerLead);
      setActiveCallLead(diallerLead);
      setCallOutcome('Connected');
      setCallNotes('');
      setCallFollowUpDate('');
      setCallDuration(callSeconds > 0 ? callSeconds : 60);
      setCallModalOpen(true);
    }
  };

  // User Administration
  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.name || !userForm.email || !userForm.password || !userForm.role) return;
    const isSuperAdmin = ['superadmin', 'owner'].includes(String(user?.platform_role || '').toLowerCase())
      || String(user?.email || '').toLowerCase() === 'superadmin@optimaviz.com';
    // Non-superadmins may only create staff; server also enforces this.
    const payload = {
      ...userForm,
      role: isSuperAdmin ? userForm.role : 'user',
    };
    setUserSaving(true);
    try {
      await axios.post('/api/auth/users', payload);
      setUserForm({ name: '', email: '', password: '', role: 'user', allowed_brand_ids: [] });
      setAddUserIsOpen(false);
      fetchUsersList();
    } catch (err: any) {
      alert(toUserFacingError(err, 'Failed to register user.'), 'error');
    } finally {
      setUserSaving(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    // Caller sets confirmDeleteUserId before calling; cleared after
    try {
      await axios.delete(`/api/auth/users/${userId}`);
      fetchUsersList();
    } catch (err: any) {
      alert(toUserFacingError(err, 'Delete user failed.'), 'error');
    }
  };

  const handleUpdateUserBrands = async (targetUser: User, allowedBrandIds: string[]) => {
    try {
      const response = await axios.put(`/api/auth/users/${targetUser.id}`, {
        allowed_brand_ids: allowedBrandIds,
      });
      setUsersList(prev => prev.map(staff => staff.id === targetUser.id ? { ...staff, ...response.data } : staff));
      showToast('Brand access updated.');
    } catch (err: any) {
      showApiError(err, 'Could not update brand access.');
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwdUser || !newPwdField) return;
    try {
      await axios.post(`/api/auth/users/${pwdUser.id}/change-password`, { password: newPwdField });
      alert('Password changed successfully.');
      setPwdUser(null);
      setNewPwdField('');
    } catch (err: any) {
      alert(toUserFacingError(err, 'Failed to update user password.'), 'error');
    }
  };

  // Table sorting & filtering logic
  const startEditingCell = (e: React.MouseEvent, leadId: string, field: string, currentValue: string) => {
    e.stopPropagation();
    setEditingCell({ leadId, field });
    setEditingCellValue(currentValue);
  };

  const saveEditingCell = async (leadId: string, field: string) => {
    try {
      const lead = leads.find(l => l.id === leadId);
      if (field === 'funnel_stage' && ['optimaviz', 'idao'].includes(selectedBrand?.id || '') && lead) {
        await updateLeadStageAndDefaults(lead, editingCellValue);
        return;
      }
      if (field.startsWith('custom:')) {
        const cfName = field.substring(7);
        let nextValue: any = editingCellValue;
        let nextCustomFields = { ...(lead?.custom_fields || {}), [cfName]: nextValue };
        let patch: any = { custom_fields: nextCustomFields };
        if (selectedBrand?.id === 'optimaviz' && lead) {
          if (cfName === 'segment') {
            const normalizedSegment = normalizeOptimavizSegmentValue(nextValue) || 'demo_leads';
            const allowedStages = getOptimavizStageOptionsForSegment(normalizedSegment);
            const currentStage = normalizeOptimavizStageValue(lead.funnel_stage, normalizedSegment);
            const nextStage = allowedStages.includes(currentStage) ? currentStage : allowedStages[0];
            nextCustomFields = {
              ...nextCustomFields,
              segment: normalizedSegment,
              next_action: getOptimavizDefaultNextAction(normalizedSegment, nextStage)
            };
            patch = {
              funnel_stage: nextStage,
              follow_up_date: lead.follow_up_date || getOptimavizFollowUpDateForStage(normalizedSegment, nextStage),
              custom_fields: nextCustomFields
            };
          }
          if (cfName === 'next_action') {
            nextCustomFields = { ...nextCustomFields, next_action: nextValue };
            patch = { custom_fields: nextCustomFields };
          }
        }
        if (selectedBrand?.id === 'idao' && lead) {
          if (cfName === 'segment') {
            const normalizedSegment = normalizeIdaoSegmentValue(nextValue) || 'training_leads';
            const allowedStages = getIdaoStageOptionsForSegment(normalizedSegment);
            const currentStage = normalizeIdaoStageValue(lead.funnel_stage, normalizedSegment);
            const nextStage = allowedStages.includes(currentStage) ? currentStage : allowedStages[0];
            const serviceType = (IDAO_SERVICE_TYPES[normalizedSegment] || [])[0] || '';
            nextCustomFields = {
              ...nextCustomFields,
              segment: normalizedSegment,
              service_type: serviceType,
              service_focus: serviceType,
              next_action: getIdaoDefaultNextAction(normalizedSegment, nextStage)
            };
            patch = {
              funnel_stage: nextStage,
              follow_up_date: lead.follow_up_date || getIdaoFollowUpDateForStage(normalizedSegment, nextStage),
              custom_fields: nextCustomFields
            };
          }
          if (cfName === 'next_action') {
            nextCustomFields = { ...nextCustomFields, next_action: nextValue };
            patch = { custom_fields: nextCustomFields };
          }
          if (cfName === 'service_type') {
            nextCustomFields = { ...nextCustomFields, service_type: nextValue, service_focus: nextValue };
            patch = { custom_fields: nextCustomFields };
          }
        }
        const res = await axios.put(`/api/leads/${leadId}`, patch);
        const updated = selectedBrand?.id === 'optimaviz'
          ? normalizeOptimavizLeadsForDisplay([res.data])[0]
          : selectedBrand?.id === 'idao'
            ? normalizeIdaoLeadsForDisplay([res.data])[0]
            : res.data;
        setLeads(prev => prev.map(l => l.id === leadId ? updated : l));
        setAllCrmLeads(prev => prev.map(l => l.id === leadId ? updated : l));
        if (activeLead?.id === leadId) setActiveLead(updated);
      } else {
        await axios.put(`/api/leads/${leadId}`, { [field]: editingCellValue });
        setLeads(prev => prev.map(l => l.id === leadId ? { ...l, [field]: editingCellValue } : l));
        if (activeLead?.id === leadId) {
          setActiveLead(prev => prev ? { ...prev, [field]: editingCellValue } : null);
        }
      }
    } catch (err) {
      console.error('Failed to update inline cell:', err);
    } finally {
      setEditingCell(null);
    }
  };

  const handleCellKeyDown = (e: React.KeyboardEvent, leadId: string, field: string) => {
    if (e.key === 'Enter') {
      saveEditingCell(leadId, field);
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  const getSegmentLeadCount = (segmentValue: string) => {
    return leads.filter(l => l.custom_fields && l.custom_fields.segment === segmentValue).length;
  };

  const renderSortIndicator = (colKey: string) => {
    if (sortConfig.col !== colKey) return null;
    return sortConfig.dir === 'asc' ? ' ↑' : ' ↓';
  };

  const renderLeadSegmentPill = (val: string, lead?: any) => {
    const rawVal = selectedBrand?.id === 'optimaviz' ? normalizeOptimavizSegmentValue(val) : selectedBrand?.id === 'idao' ? normalizeIdaoSegmentValue(val) : val;
    const brandSegs = getBrandSegmentOptions(selectedBrand?.id);
    const seg = brandSegs.find(s => s.value === rawVal);
    if (!seg) {
      return <span className="pill" style={{ fontStyle: 'italic', fontSize: '11px', background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>Unassigned</span>;
    }

    let suffix = '';
    if (selectedBrand?.id === 'optimaviz' && rawVal === 'trial_leads' && lead) {
      const trial = getOptimavizTrialInfo(lead);
      if (trial.isTrialLead) suffix = trial.isExpired ? ' (Expired)' : ` (${trial.daysRemaining}d left)`;
    }
    if (selectedBrand?.id === 'optimaviz' && rawVal === 'demo_leads' && lead) {
      const stage = getOptimavizLeadStage(lead);
      if (stage === 'Demo Attended') suffix = ' ¢ Attended';
      if (stage === 'No Show / Did Not Attend') suffix = ' - Rebook';
    }

    const colors: Record<string, string> = { demo_leads: '#0f766e', trial_leads: '#10b981', subscribed_platform_users: '#155e75', training_leads: '#f59e0b', optimaviz_referrals: '#155e75', other_services: '#10b981' };
    const color = colors[rawVal] || seg.color || selectedBrand?.color || '#155e75';
    return (
      <span className="pill" style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        background: `${color}18`, color, border: `1px solid ${color}44`,
        fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px'
      }}>
        <i className={seg.icon}></i> {seg.label}{suffix}
      </span>
    );
  };

  const handleSortColToggle = (colKey: string) => {
    setSortConfig(prev => {
      if (prev.col === colKey) {
        return { col: colKey, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
      }
      return { col: colKey, dir: 'asc' };
    });
  };

  const persistColumnVisibility = (brandId: string, nextVisible: Iterable<string>) => {
    const customNames = customFields
      .filter(cf => !cf.brand_id || String(cf.brand_id) === brandId)
      .map(cf => cf.field_name);
    const nextSet = new Set(Array.from(nextVisible));
    // Store only optional hides — never a full visible list (that caused wipeouts).
    const hiddenOptional = customNames.filter(
      name => !nextSet.has(name) && !isProtectedColumn(name, brandId, customNames),
    );
    localStorage.setItem(hiddenOptionalStorageKey(brandId), hiddenOptional.join(','));
    localStorage.setItem(columnVersionStorageKey(brandId), CURRENT_COL_VERSION);
    clearLegacyColumnPrefs(brandId, localStorage);
    return resolveVisibleColumns({
      brandId,
      customFieldNames: customNames,
      hiddenOptional,
    });
  };

  const columnOrderStorageKey = (brandId: string) => `crm_lead_column_order_${brandId}`;
  const getColumnOrder = (brandId: string): string[] => {
    try {
      const saved = JSON.parse(localStorage.getItem(columnOrderStorageKey(brandId)) || '[]');
      return Array.isArray(saved) ? saved.filter((key): key is string => typeof key === 'string') : [];
    } catch { return []; }
  };
  const reorderLeadTableColumns = (draggedKey: string, targetKey: string) => {
    if (!selectedBrand || draggedKey === 'name' || targetKey === 'name') return;
    const keys = leadTableColumns.map(col => col.key);
    const from = keys.indexOf(draggedKey);
    const to = keys.indexOf(targetKey);
    if (from < 0 || to < 0) return;
    keys.splice(from, 1);
    keys.splice(to, 0, draggedKey);
    localStorage.setItem(columnOrderStorageKey(selectedBrand.id), JSON.stringify(keys));
    setColumnOrderVersion(version => version + 1);
  };

  const toggleColumnVis = (colKey: string) => {
    if (!selectedBrand) return;
    const customNames = customFields
      .filter(cf => !cf.brand_id || String(cf.brand_id) === selectedBrand.id)
      .map(cf => cf.field_name);
    setColumnVisibility(prev => {
      const updated = new Set(prev);
      if (updated.has(colKey)) {
        updated.delete(colKey);
      } else {
        updated.add(colKey);
      }
      return new Set(persistColumnVisibility(selectedBrand.id, updated));
    });
  };

  // Permanent: recompute from server custom fields every render — localStorage cannot drop columns.
  const getVisibleColumns = () => {
    if (!selectedBrand) {
      return columnVisibility.size > 0 ? columnVisibility : new Set<string>();
    }
    const customNames = customFields
      .filter(cf => !cf.brand_id || String(cf.brand_id) === selectedBrand.id)
      .map(cf => cf.field_name);
    const hiddenOptional = localStorage.getItem(hiddenOptionalStorageKey(selectedBrand.id)) || '';
    return new Set(
      resolveVisibleColumns({
        brandId: selectedBrand.id,
        customFieldNames: customNames,
        hiddenOptional,
      }),
    );
  };

  const clearLeadTableFilters = () => {
    setSelectedSegmentFilter('all');
    setSelectedStageFilter('all');
    setSelectedCityFilter('all');
    setSelectedServiceFilter('all');
    setSelectedAbnFilter('all');
    setSelectedDateWindow('all');
    setSelectedDateFrom('');
    setSelectedDateTo('');
    setSelectedCustomFieldFilter(null);
    setActiveSpotlightFilters({});
    setSearchQuery('');
    setKanbanSearchQuery('');
    setLeadFocusFilter(null);
    setActiveProductView(null);
  };

  /** Open a brand workspace on Leads and optionally apply a metric-driven focus filter. */
  const openBrandWorkbench = (brand: Brand, focus?: LeadWorkbenchFocus) => {
    handleSelectBrand(brand);
    setBrandSubTab('leads');
    setLeadWorkspaceView('table');
    // Dashboard metrics are verified-only — land in the verified pool so numbers match.
    setLeadClassificationTab(focus?.classification || 'verified');
    setSearchQuery(focus?.search || '');
    setKanbanSearchQuery('');
    setSelectedSegmentFilter(focus?.segment || 'all');
    setSelectedStageFilter(focus?.stage || 'all');
    setSelectedCityFilter('all');
    setSelectedServiceFilter('all');
    setSelectedAbnFilter(focus?.abn || 'all');
    setSelectedDateWindow('all');
    setSelectedDateFrom('');
    setSelectedDateTo('');
    setSelectedCustomFieldFilter(focus?.customField || null);
    setActiveSpotlightFilters({});
    setLeadFocusFilter(focus?.label || null);
  };

  // Spot duplicates in the dashboard dataset to highlight and allow deletion
  const duplicateLeadIds = useMemo(() => {
    const dups = new Set<string>();
    const seenNames = new Map<string, string>();
    const seenEmails = new Map<string, string>();
    const seenPhones = new Map<string, string>();

    const norm = (val: any) => String(val || '').trim().toLowerCase();
    const normPhone = (val: any) => String(val || '').trim().toLowerCase().replace(/[^0-9+]/g, '');

    leads.forEach(l => {
      const email = norm(l.email);
      const phone = normPhone(l.phone);
      const name = norm(l.name);

      if (email && seenEmails.has(email)) {
        dups.add(l.id);
        dups.add(seenEmails.get(email)!);
      } else if (email) {
        seenEmails.set(email, l.id);
      }

      if (phone && seenPhones.has(phone)) {
        dups.add(l.id);
        dups.add(seenPhones.get(phone)!);
      } else if (phone) {
        seenPhones.set(phone, l.id);
      }

      if (name && seenNames.has(name)) {
        dups.add(l.id);
        dups.add(seenNames.get(name)!);
      } else if (name) {
        seenNames.set(name, l.id);
      }
    });

    return dups;
  }, [leads]);

  const leadDateWindowCounts = useMemo(() => {
    const poolLeads = filterLeadsByClassification(leads, leadClassificationTab);
    return DATE_WINDOW_OPTIONS.reduce((acc, opt) => {
      acc[opt.value] = poolLeads.filter(lead => isLeadInDateWindow(lead, opt.value)).length;
      return acc;
    }, {} as Record<DateWindowFilter, number>);
  }, [leads, leadClassificationTab]);

  const hasCustomDateRange = Boolean(selectedDateFrom || selectedDateTo);

  useEffect(() => {
    if (selectedStageFilter === 'all' || !selectedBrand) return;
    const poolLeads = filterLeadsByClassification(leads, leadClassificationTab);
    const stageHasLeads = poolLeads.some(lead => {
      const stage = selectedBrand.id === 'optimaviz' ? getOptimavizLeadStage(lead) : selectedBrand.id === 'idao' ? getIdaoLeadStage(lead) : lead.funnel_stage;
      return stage === selectedStageFilter;
    });
    if (!stageHasLeads) setSelectedStageFilter('all');
  }, [leads, selectedBrand?.id, selectedStageFilter, leadClassificationTab]);

  // Apply filters on active brand leads (classification pool is exclusive — no mixing)
  const filteredSortedLeads = leads
    .filter(lead => {
      const activeCustomTab = getActiveCustomTab();
      if (activeCustomTab) {
        if (activeProductView === 'hot-unassigned') {
          const unowned = !lead.owner_id || lead.owner_id === '' || String(lead.owner_name || '').toLowerCase() === 'unassigned';
          if (!unowned) return false;
        }
        if (activeProductView === 'cross-sell') {
          const services = lead.custom_fields?._allServices;
          const multiService = Array.isArray(services) ? services.length > 1 : false;
          const tagHint = (lead.tags || []).some((t: string) => /cross|upsell|nestwise|multi/i.test(String(t)));
          const noteHint = /hand-?off|nestwise|cross-?sell/i.test(String(lead.notes || ''));
          const cfHint = Boolean(lead.custom_fields?.cross_sell || lead.custom_fields?.portfolio_offer);
          if (!multiService && !tagHint && !noteHint && !cfHint) return false;
        }
        const f = activeCustomTab.filters;
        const s = f.search.toLowerCase();
        const matchesSearch = !s ||
          String(lead.name || '').toLowerCase().includes(s) ||
          String(lead.email || '').toLowerCase().includes(s) ||
          String(lead.phone || '').toLowerCase().includes(s) ||
          (lead.notes && String(lead.notes || '').toLowerCase().includes(s));
        const leadStageForFilter = selectedBrand?.id === 'optimaviz' ? getOptimavizLeadStage(lead) : selectedBrand?.id === 'idao' ? getIdaoLeadStage(lead) : lead.funnel_stage;
        const leadSegmentForFilter = selectedBrand?.id === 'optimaviz' ? getOptimavizLeadSegment(lead) : selectedBrand?.id === 'idao' ? getIdaoLeadSegment(lead) : lead.custom_fields?.segment;
        const matchesStage = f.stage === 'all' || leadStageForFilter === f.stage;
        const matchesSegment = f.segment === 'all' || leadSegmentForFilter === f.segment;
        const matchesDateWindow = f.dateWindow === 'all' || (f.dateFrom || f.dateTo ? isLeadInCustomDateRange(lead, f.dateFrom, f.dateTo) : isLeadInDateWindow(lead, f.dateWindow));
        let matchesCity = true;
        if (f.city !== 'all') {
          const cityValue = lead.custom_fields && (lead.custom_fields.city || lead.custom_fields.City);
          matchesCity = normalizeFieldValue(cityValue).toLowerCase() === f.city.toLowerCase();
        }
        let matchesService = true;
        if (f.service !== 'all') {
          const serviceValue = lead.custom_fields && (lead.custom_fields.service_category_name || lead.custom_fields.ServiceCategoryName || lead.custom_fields.service_category);
          matchesService = normalizeFieldValue(serviceValue).toLowerCase() === f.service.toLowerCase();
        }
        let matchesAbn = true;
        if (f.abn !== 'all') {
          const abnValue = lead.custom_fields && (lead.custom_fields.abn_number || lead.custom_fields.AbnNumber || lead.custom_fields.abn);
          const hasAbn = abnValue && String(abnValue).replace(/\s+/g, '').length >= 9 && String(abnValue).toLowerCase() !== 'no abn supplied';
          matchesAbn = f.abn === 'has_abn' ? !!hasAbn : !hasAbn;
        }
        return matchesSearch && matchesStage && matchesSegment && matchesDateWindow && matchesCity && matchesService && matchesAbn;
      }

      if (getLeadClassification(lead) !== leadClassificationTab) return false;

      // Product views (quick wins)
      if (activeProductView === 'hot-unassigned') {
        const unowned = !lead.owner_id || lead.owner_id === '' || String(lead.owner_name || '').toLowerCase() === 'unassigned';
        if (!unowned) return false;
      }
      if (activeProductView === 'cross-sell') {
        const services = lead.custom_fields?._allServices;
        const multiService = Array.isArray(services) ? services.length > 1 : false;
        const tagHint = (lead.tags || []).some((t: string) => /cross|upsell|nestwise|multi/i.test(String(t)));
        const noteHint = /hand-?off|nestwise|cross-?sell/i.test(String(lead.notes || ''));
        const cfHint = Boolean(lead.custom_fields?.cross_sell || lead.custom_fields?.portfolio_offer);
        if (!multiService && !tagHint && !noteHint && !cfHint) return false;
      }

      const s = searchQuery.toLowerCase();
      const matchesSearch = !s ||
        String(lead.name || '').toLowerCase().includes(s) ||
        String(lead.email || '').toLowerCase().includes(s) ||
        String(lead.phone || '').toLowerCase().includes(s) ||
        (lead.notes && String(lead.notes || '').toLowerCase().includes(s));
        
      const leadStageForFilter = selectedBrand?.id === 'optimaviz' ? getOptimavizLeadStage(lead) : selectedBrand?.id === 'idao' ? getIdaoLeadStage(lead) : lead.funnel_stage;
      const leadSegmentForFilter = selectedBrand?.id === 'optimaviz' ? getOptimavizLeadSegment(lead) : selectedBrand?.id === 'idao' ? getIdaoLeadSegment(lead) : lead.custom_fields?.segment;
      const matchesStage = selectedStageFilter === 'all' || leadStageForFilter === selectedStageFilter;
      const matchesSegment = selectedSegmentFilter === 'all' || leadSegmentForFilter === selectedSegmentFilter;
      const matchesDateWindow = hasCustomDateRange
        ? isLeadInCustomDateRange(lead, selectedDateFrom, selectedDateTo)
        : isLeadInDateWindow(lead, selectedDateWindow);
      
      let matchesDuplicates = true;
      if (showOnlyDuplicates) {
        matchesDuplicates = duplicateLeadIds.has(lead.id);
      } else if (!includeDuplicates) {
        // Exclude duplicates unless user opts in
        matchesDuplicates = !duplicateLeadIds.has(lead.id);
      }
      
      let matchesCity = true;
      if (selectedCityFilter !== 'all') {
        const cityValue = lead.custom_fields && (lead.custom_fields.city || lead.custom_fields.City);
        matchesCity = normalizeFieldValue(cityValue).toLowerCase() === selectedCityFilter.toLowerCase();
      }

      let matchesService = true;
      if (selectedServiceFilter !== 'all') {
        const serviceValue = lead.custom_fields && (lead.custom_fields.service_category_name || lead.custom_fields.ServiceCategoryName || lead.custom_fields.service_category);
        matchesService = normalizeFieldValue(serviceValue).toLowerCase() === selectedServiceFilter.toLowerCase();
      }

      let matchesAbn = true;
      if (selectedAbnFilter !== 'all') {
        const abnValue = lead.custom_fields && (lead.custom_fields.abn_number || lead.custom_fields.AbnNumber || lead.custom_fields.abn);
        const hasAbn = abnValue && String(abnValue).replace(/\s+/g, '').length >= 9 && String(abnValue).toLowerCase() !== 'no abn supplied';
        matchesAbn = selectedAbnFilter === 'has_abn' ? !!hasAbn : !hasAbn;
      }

      let matchesSpotlights = true;
      if (selectedBrand) {
        const spotlightsForCurrentBrand = brandSpotlights[selectedBrand.id] || [];
        for (const spotlight of spotlightsForCurrentBrand) {
          const activeFilterVal = activeSpotlightFilters[spotlight.id];
          if (activeFilterVal && activeFilterVal !== 'all') {
            if (spotlight.type === 'binary') {
              let hasVal = false;
              for (const key of spotlight.fieldKeys) {
                const raw = lead.custom_fields?.[key];
                if (raw && String(raw).trim() && String(raw).toLowerCase() !== 'no abn supplied' && String(raw).toLowerCase() !== 'general platform' && String(raw).toLowerCase() !== 'general support') {
                  hasVal = true;
                  break;
                }
              }
              const expectedHasVal = activeFilterVal === 'true';
              if (hasVal !== expectedHasVal) {
                matchesSpotlights = false;
                break;
              }
            } else {
              let matchingVal = 'Has not filled/blank';
              for (const key of spotlight.fieldKeys) {
                const raw = lead.custom_fields?.[key];
                if (raw !== undefined && raw !== null) {
                  matchingVal = normalizeFieldValue(raw);
                  break;
                }
              }
              if (matchingVal.toLowerCase() !== activeFilterVal.toLowerCase()) {
                matchesSpotlights = false;
                break;
              }
            }
          }
        }
      }

      let matchesCustomField = true;
      if (selectedCustomFieldFilter) {
        const { field, value } = selectedCustomFieldFilter;
        const leadVal = getLeadMetricRawValue(lead, field).value;
        if (value === '__filled__') {
          matchesCustomField = isMeaningfulMetricValue(leadVal);
        } else if (value === '__missing__') {
          matchesCustomField = !isMeaningfulMetricValue(leadVal);
        } else {
          matchesCustomField = leadVal !== undefined && leadVal !== null && normalizeFieldValue(leadVal).toLowerCase() === value.trim().toLowerCase();
        }
      }

      return matchesSearch && matchesStage && matchesSegment && matchesDateWindow && matchesCity && matchesService && matchesAbn && matchesCustomField && matchesDuplicates && matchesSpotlights;
    })
    .sort((a, b) => {
      if (!sortConfig.col) return getLeadTimelineTime(b) - getLeadTimelineTime(a);
      const col = sortConfig.col;
      let valA: any = (a as any)[col] || (a.custom_fields && a.custom_fields[col]) || '';
      let valB: any = (b as any)[col] || (b.custom_fields && b.custom_fields[col]) || '';

      if (col === 'created_at' || col.includes('date') || col.includes('_at')) {
        const timeA = col === 'created_at' ? getLeadTimelineTime(a) : (parseLeadDateValue(valA)?.getTime() || 0);
        const timeB = col === 'created_at' ? getLeadTimelineTime(b) : (parseLeadDateValue(valB)?.getTime() || 0);
        return sortConfig.dir === 'asc' ? timeA - timeB : timeB - timeA;
      }
      
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return sortConfig.dir === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.dir === 'asc' ? 1 : -1;
      return 0;
    });

  // useMemo: only recomputes when leads or brand changes — not on every keystroke
  const tableDisplayLeads = useMemo(() => {
    if (!selectedBrand || selectedBrand.id !== 'taskgo') return filteredSortedLeads;
    const emailMap = new Map<string, any>();
    const result: any[] = [];
    filteredSortedLeads.forEach(l => {
      const emailKey = (l.email || '').toLowerCase().trim();
      if (emailMap.has(emailKey)) {
        const existing = emailMap.get(emailKey);
        const svc = l.custom_fields?.service_category_name;
        if (svc && !existing.custom_fields._allServices.includes(svc)) {
          existing.custom_fields._allServices.push(svc);
        }
      } else {
        const svc = l.custom_fields?.service_category_name;
        const entry = {
          ...l,
          custom_fields: {
            ...l.custom_fields,
            _allServices: svc ? [svc] : [],
          }
        };
        emailMap.set(emailKey, entry);
        result.push(entry);
      }
    });
    return result;
  }, [filteredSortedLeads, selectedBrand?.id]);

  /** One ordered column list for colgroup + header (body still key-matched). */
  const leadTableColumns = useMemo(() => {
    if (!selectedBrand) return [];
    return buildLeadTableColumns({
      brandId: selectedBrand.id,
      visible: getVisibleColumns(),
      customFields: getTableCustomFields(),
      order: getColumnOrder(selectedBrand.id),
    });
  }, [selectedBrand?.id, customFields, columnVisibility, columnOrderVersion]);

  const teamGlobalUnreadCount = ['all', ...usersList.filter(staff => staff.id !== user?.id).map(staff => staff.id)]
    .reduce((total, threadId) => total + getTeamThreadUnreadCount(threadId), 0);

  // Per-brand email and WhatsApp tracking
  const [seenBrandCommunication, setSeenBrandCommunication] = useState<Record<string, Record<string, number>>>(() => {
    try {
      return JSON.parse(safeLocalStorage.getItem('crm_seen_brand_communication') || '{}');
    } catch {
      return {};
    }
  });
  
  const getBrandCommunicationStats = useCallback((brandId: string) => {
    const brandEmails = allSentEmails.filter(email => email.brand_id === brandId);
    const brandWhatsApp = allWhatsAppMessages.filter(msg => msg.brand_id === brandId);
    const seen = seenBrandCommunication[brandId] || {};
    return {
      emailInbox: brandEmails.filter(e => ['inbound', 'received', 'reply'].includes(String(e.status).toLowerCase())).length,
      emailFailed: brandEmails.filter(e => String(e.status).toLowerCase().includes('fail')).length,
      whatsappUnread: brandWhatsApp.filter(m => !m.read).length,
      whatsappFailed: brandWhatsApp.filter(m => String(m.status).toLowerCase().includes('fail')).length,
      seenEmailInbox: seen.emailInbox || 0,
      seenEmailFailed: seen.emailFailed || 0,
      seenWhatsAppUnread: seen.whatsappUnread || 0,
      seenWhatsAppFailed: seen.whatsappFailed || 0,
    };
  }, [allSentEmails, allWhatsAppMessages, seenBrandCommunication]);
  
  const markBrandCommunicationSeen = useCallback((brandId: string) => {
    const stats = getBrandCommunicationStats(brandId);
    const newSeen = {
      ...seenBrandCommunication,
      [brandId]: {
        emailInbox: stats.emailInbox,
        emailFailed: stats.emailFailed,
        whatsappUnread: stats.whatsappUnread,
        whatsappFailed: stats.whatsappFailed,
      }
    };
    setSeenBrandCommunication(newSeen);
    safeLocalStorage.setItem('crm_seen_brand_communication', JSON.stringify(newSeen));
  }, [getBrandCommunicationStats, seenBrandCommunication]);
  
  const todayISO = new Date().toISOString().slice(0, 10);

  const leadLookupById = useMemo(() => {
    const map = new Map<string, Lead>();
    (allCrmLeads.length ? allCrmLeads : leads).forEach(lead => map.set(lead.id, lead));
    return map;
  }, [allCrmLeads, leads]);

  const brandCommunicationRows = useMemo(() => activeBrands.map(brand => {
    const stats = getBrandCommunicationStats(brand.id);
    const brandLeadIds = new Set((allCrmLeads.length ? allCrmLeads : leads).filter(lead => lead.brand_id === brand.id).map(lead => lead.id));
    const brandEmails = allSentEmails.filter(email => email.brand_id === brand.id || brandLeadIds.has(email.lead_id || ''));
    const emailAction = getEmailActionSummary(brandEmails);
    const emailAttention = emailAction.actionInbox + Math.max(0, stats.emailFailed - stats.seenEmailFailed);
    const whatsappAttention = Math.max(0, stats.whatsappUnread - stats.seenWhatsAppUnread) + Math.max(0, stats.whatsappFailed - stats.seenWhatsAppFailed);
    const dueCalls = allCallLogs.filter(call => {
      const lead = call.lead_id ? leadLookupById.get(call.lead_id) : null;
      const brandMatch = (call as any).brand_id === brand.id || lead?.brand_id === brand.id;
      if (!brandMatch) return false;
      const dueDate = String((call as any).follow_up_date || (call as any).next_follow_up_date || '').slice(0, 10);
      return dueDate && dueDate <= todayISO;
    }).length;
    return { brand, stats, emailAction, emailAttention, whatsappAttention, dueCalls };
  }), [activeBrands, allCallLogs, allCrmLeads, allSentEmails, getBrandCommunicationStats, leadLookupById, leads, todayISO]);

  const emailAttentionCount = brandCommunicationRows.reduce((sum, row) => sum + row.emailAttention, 0);
  const whatsappAttentionCount = brandCommunicationRows.reduce((sum, row) => sum + row.whatsappAttention, 0);
  const dueCallActionCount = brandCommunicationRows.reduce((sum, row) => sum + row.dueCalls, 0);
  const emailBrandRows = brandCommunicationRows.filter(row => row.emailAttention > 0);
  const whatsappBrandRows = brandCommunicationRows.filter(row => row.whatsappAttention > 0);
  const callBrandRows = brandCommunicationRows.filter(row => row.dueCalls > 0);

  const communicationHealthItems = [
    ...emailBrandRows.map(row => ({
      label: `${row.brand.name} email attention`,
      value: row.emailAttention,
      icon: 'fa-envelope-open-text',
      tone: '#155e75',
      action: () => { markBrandCommunicationSeen(row.brand.id); openCommunicationTool('email-tracking', row.brand.id); }
    })),
    ...whatsappBrandRows.map(row => ({
      label: `${row.brand.name} WhatsApp attention`,
      value: row.whatsappAttention,
      icon: 'fa-comment-dots',
      tone: '#16a34a',
      action: () => { markBrandCommunicationSeen(row.brand.id); openCommunicationTool('whatsapp-tracking', row.brand.id); }
    })),
    ...callBrandRows.map(row => ({
      label: `${row.brand.name} call follow-ups`,
      value: row.dueCalls,
      icon: 'fa-phone',
      tone: '#0f766e',
      action: () => openCommunicationTool('calls', row.brand.id)
    })),
    ...disconnectedEmailAlerts.map(alert => ({
      label: `${alert.brandName} ${alert.provider} disconnected`,
      value: 1,
      icon: 'fa-envelope-open-text',
      tone: '#ef4444',
      action: () => {
        setDisconnectedEmailAlerts(prev => prev.filter(a => a.id !== alert.id));
        undismissNotificationItem(`${alert.brandName} ${alert.provider} disconnected`, 1);
        openCommunicationTool('integrations', alert.brandId);
      }
    })),
    { label: 'Unread team messages', value: teamGlobalUnreadCount, icon: 'fa-comments', tone: '#0f766e', action: () => openCommunicationTool('team-chat') },
    ...notificationItems.slice(0, 4).map(item => ({ ...item, tone: item.color })),
  ].filter(item => item.value > 0 && isNotificationCategoryEnabled(item.label));
  communicationHealthItemsRef.current = communicationHealthItems;
  // Hide alerts that were opened/dismissed at the same count. Critical ones are NOT
  // auto-dismissed when the drawer opens, so they keep showing until resolved or manually dismissed.
  const visibleNotificationItems = communicationHealthItems.filter(item => !isNotificationItemDismissed(item));
  const notificationSignature = JSON.stringify(communicationHealthItems.map(item => [item.label, item.value]));
  notificationSignatureRef.current = notificationSignature;
  const unreadNotificationCount = visibleNotificationItems.length;

  // Communications Hub command-center aggregates (derived from existing data only)
  // Per-brand status pills used by the redesigned command center. No new data sources.
  const commsBrandStatus = useMemo(() => activeBrands.map(brand => {
    const row = brandCommunicationRows.find(r => r.brand.id === brand.id);
    const attention = (row?.emailAttention || 0) + (row?.whatsappAttention || 0) + (row?.dueCalls || 0);
    const severity = attention >= 20 ? 'danger' : attention >= 5 ? 'warning' : attention > 0 ? 'info' : 'idle';
    return {
      brand,
      attention,
      email: row?.emailAttention || 0,
      whatsapp: row?.whatsappAttention || 0,
      calls: row?.dueCalls || 0,
      severity,
    };
  }).sort((a, b) => b.attention - a.attention), [activeBrands, brandCommunicationRows]);

  const commsTotalAttention = commsBrandStatus.reduce((sum, s) => sum + s.attention, 0);
  const commsHighPriority = commsBrandStatus.filter(s => s.severity === 'danger').reduce((sum, s) => sum + s.attention, 0)
    + Math.max(0, teamGlobalUnreadCount - 9);
  const commsRepliesWaiting = emailAttentionCount;
  const commsChannelsActive = [emailAttentionCount, whatsappAttentionCount, dueCallActionCount, teamGlobalUnreadCount].filter(v => v > 0).length;


  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  // LOGIN SCREEN
  if (!user) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} apiBaseHint={API_BASE_URL} />;
  }


  return (
    <div className="App" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)' }}>
      
      {/* SIDEBAR NAVIGATION PANEL */}
      <AppSidebar
        activeTab={activeTab}
        activeBrands={activeBrands}
        user={user}
        profilePicture={profilePicture}
        allCrmLeads={allCrmLeads}
        leads={leads}
        portfolioPendingCount={portfolioCounts.pending}
        teamGlobalUnreadCount={teamGlobalUnreadCount}
        isDarkMode={isDarkMode}
        onSelectDashboard={handleSelectDashboard}
        onSelectBrand={handleSelectBrand}
        onSelectCommunications={handleSelectCommunications}
        onSelectIntelligence={() => {
          captureCurrentWorkspaceSnapshot();
          setSelectedBrand(null);
          setActiveTab('intelligence');
          applyBrandTheme(null, 'intelligence');
          openViewTab('intelligence', { title: 'Intelligence' });
          fetchPortfolioOpportunities();
          fetchAllTasks();
          fetchWebsiteAnalytics('');
        }}
        onSelectTeamChat={() => {
          captureCurrentWorkspaceSnapshot();
          setSelectedBrand(null);
          setActiveTab('team-chat');
          applyBrandTheme(null, 'team-chat');
          openViewTab('team-chat', { title: 'Team Chat' });
          fetchTeamMessages();
          fetchTeamNotes();
        }}
        onSelectSocialHub={() => {
          captureCurrentWorkspaceSnapshot();
          setSelectedBrand(null);
          setActiveTab('social-hub');
          applyBrandTheme(null, 'social-hub');
          openViewTab('social-hub', { title: 'Social Hub' });
        }}
        onSelectIntegrations={() => {
          captureCurrentWorkspaceSnapshot();
          setSelectedBrand(null);
          setActiveTab('integrations');
          applyBrandTheme(null, 'integrations');
          openViewTab('integrations', { title: 'Integrations' });
          setIntegrationBrandId(activeBrands[0]?.id || BRANDS[0].id);
          if (user.role === 'admin') fetchBrandIntegrations();
          fetchMessageTemplates();
        }}
        onSelectUsers={handleSelectUsers}
        onOpenProfile={() => {
          setProfileName(user.name);
          setCurrentPw('');
          setNewPw('');
          setConfirmNewPw('');
          setPwError('');
          setProfileModalOpen(true);
        }}
        onToggleDarkMode={() => setIsDarkMode(prev => !prev)}
        onLogout={handleLogout}
      />

      {/* MAIN CONTAINER FRAME */}
      <div className="main" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        
        {/* TOP COMPONENT STRIP */}
        <AppTopBar
          activeTab={activeTab}
          selectedBrand={selectedBrand}
          user={user}
          globalSearchQuery={globalSearchQuery}
          showGlobalSearch={showGlobalSearch}
          globalSearchResults={globalSearchResults}
          managedBrands={managedBrands}
          unreadNotificationCount={unreadNotificationCount}
          notificationDrawerOpen={notificationDrawerOpen}
          notificationSignature={notificationSignature}
          onGlobalSearchChange={handleGlobalSearch}
          onGlobalSearchVisibilityChange={setShowGlobalSearch}
          onOpenLead={jumpToLead}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          onToggleNotifications={() => {
            setNotificationDrawerOpen(open => {
              const nextOpen = !open;
              if (nextOpen) {
                // Keep a snapshot so the list stays visible while open, then silence normal
                // alerts for the badge. Critical categories keep alerting until resolved.
                const openItems = communicationHealthItems.filter(item => !isNotificationItemDismissed(item));
                setNotificationDrawerSnapshot(openItems);
                markNotificationsSeen({ forceAll: false, items: communicationHealthItems });
              } else {
                setNotificationDrawerSnapshot([]);
              }
              return nextOpen;
            });
          }}
        />

        <div className="workspace-chrome">
          <WorkspaceTabBar
            tabs={workspaceTabs}
            activeTabId={workspaceActiveTabId}
            activeRouteKey={activeTab}
            closedCount={closedStack.length}
            onActivate={activateWorkspaceTabById}
            onClose={(tabId) => {
              const wasActive = tabId === workspaceActiveTabId;
              const idx = workspaceTabs.findIndex(t => t.id === tabId);
              const neighbor = wasActive
                ? (workspaceTabs[idx - 1] || workspaceTabs[idx + 1] || null)
                : null;
              closeWorkspaceTab(tabId);
              if (wasActive && neighbor) {
                requestAnimationFrame(() => activateWorkspaceTabById(neighbor.id));
              }
            }}
            onCloseOthers={closeOtherWorkspaceTabs}
            onCloseToRight={closeWorkspaceTabsToRight}
            onTogglePin={toggleWorkspaceTabPin}
            onDuplicate={duplicateWorkspaceTab}
            onRename={renameWorkspaceTab}
            onReorder={reorderWorkspaceTabs}
            onNewDashboard={handleSelectDashboard}
            onReopenClosed={reopenClosedTab}
          />
        </div>

        {/* CENTRAL VIEW CANVAS — no remount key so tab switches keep inputs where possible */}
        <div
          ref={viewContentRef}
          className={`view-content ${activeTab === 'team-chat' ? 'view-content--team-chat' : ''}`}
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: activeTab === 'team-chat' ? 'hidden' : 'auto',
            padding: activeTab === 'team-chat' ? '24px 28px 16px' : '24px 28px 32px',
            animation: 'pageSlideIn 0.18s ease'
          }}
          onScroll={() => {
            if (activeWorkspaceTab && viewContentRef.current) {
              // Lightweight debounce via rAF batching not required for simple int store
              saveWorkspaceTabSnapshot(activeWorkspaceTab.id, {
                scrollTop: viewContentRef.current.scrollTop,
              });
            }
          }}
        >
          
          {/* =======================================================
               A. GENERAL DASHBOARD VIEW
             ======================================================= */}
          {activeTab === 'communications' && (
            <CommunicationsHubPage
              commsTotalAttention={commsTotalAttention} commsChannelsActive={commsChannelsActive}
              fetchAllSentEmails={fetchAllSentEmails} fetchAllWhatsAppMessages={fetchAllWhatsAppMessages}
              fetchAllCallLogs={fetchAllCallLogs} fetchTeamMessages={fetchTeamMessages}
              openCommunicationTool={openCommunicationTool} commsHighPriority={commsHighPriority}
              commsRepliesWaiting={commsRepliesWaiting} commsBrandStatus={commsBrandStatus}
              emailAttentionCount={emailAttentionCount} emailBrandRows={emailBrandRows}
              whatsappAttentionCount={whatsappAttentionCount} whatsappBrandRows={whatsappBrandRows}
              dueCallActionCount={dueCallActionCount} callBrandRows={callBrandRows}
              teamGlobalUnreadCount={teamGlobalUnreadCount} usersList={usersList}
              user={user} visibleNotificationItems={visibleNotificationItems}
              activeBrands={activeBrands} getBrandIntegrationFor={getBrandIntegrationFor}
              getEmailAccountsForIntegration={getEmailAccountsForIntegration} isWhatsAppCloudConfigured={isWhatsAppCloudConfigured}
              whatsappNumbers={whatsappNumbers}
            />
          )}

          {activeTab === 'social-hub' && (
            <SocialHubPage user={user} brands={activeBrands} showToast={showToast} />
          )}

          {activeTab === 'intelligence' && (
            <IntelligencePage
              allCrmLeads={allCrmLeads} leads={leads}
              sequences={sequences} websiteAnalyticsSummary={websiteAnalyticsSummary}
              portfolioOpportunities={portfolioOpportunities} globalDuplicateLeadGroups={globalDuplicateLeadGroups}
              dataCleanupSearch={dataCleanupSearch} setDataCleanupSearch={setDataCleanupSearch}
              activeBrands={activeBrands} managedBrands={managedBrands}
              handleSelectBrand={handleSelectBrand} todayCommand={todayCommand}
              portfolioCounts={portfolioCounts} scanPortfolioOpportunities={scanPortfolioOpportunities}
              portfolioSaving={portfolioSaving} showDataCleanupStudio={showDataCleanupStudio}
              setShowDataCleanupStudio={setShowDataCleanupStudio} usersList={usersList}
              allSentEmails={allSentEmails} allWhatsAppMessages={allWhatsAppMessages}
              allCallLogs={allCallLogs} getGlobalLeadActivityCount={getGlobalLeadActivityCount}
              reviewPortfolioOpportunity={reviewPortfolioOpportunity} setActiveIntegrationChannel={setActiveIntegrationChannel}
              setActiveTab={setActiveTab}
              portfolioForm={portfolioForm} setPortfolioForm={setPortfolioForm}
              savePortfolioRule={savePortfolioRule} portfolioRules={portfolioRules}
              dismissPendingPortfolioOpportunities={dismissPendingPortfolioOpportunities}
            />
          )}

          {activeTab === 'dashboard' && (
            <DashboardPage
              allCrmLeads={allCrmLeads} leads={leads}
              brandIntegrations={brandIntegrations} activeBrands={activeBrands}
              managedBrands={managedBrands} setIntegrationBrandId={setIntegrationBrandId}
              setActiveIntegrationChannel={setActiveIntegrationChannel} setActiveTab={setActiveTab}
              setupGuideCollapsed={setupGuideCollapsed} setSetupGuideCollapsed={setSetupGuideCollapsed}
              leadSources={leadSources} websiteAnalyticsSites={websiteAnalyticsSites}
              usersList={usersList} handleSelectBrand={handleSelectBrand}
              portfolioCounts={portfolioCounts} portfolioCollapsed={portfolioCollapsed}
              setPortfolioCollapsed={setPortfolioCollapsed} scanPortfolioOpportunities={scanPortfolioOpportunities}
              portfolioSaving={portfolioSaving} dismissPendingPortfolioOpportunities={dismissPendingPortfolioOpportunities}
              portfolioForm={portfolioForm} setPortfolioForm={setPortfolioForm}
              savePortfolioRule={savePortfolioRule} portfolioRules={portfolioRules}
              portfolioOpportunities={portfolioOpportunities} reviewPortfolioOpportunity={reviewPortfolioOpportunity}
              getGlobalLeadActivityCount={getGlobalLeadActivityCount} duplicateLeadIds={duplicateLeadIds}
              todayCommand={todayCommand} emailAttentionCount={emailAttentionCount}
              whatsappAttentionCount={whatsappAttentionCount} dueCallActionCount={dueCallActionCount}
              teamGlobalUnreadCount={teamGlobalUnreadCount} brandOperatingMetrics={brandOperatingMetrics}
              commandMetrics={commandMetrics} resetCommandMetrics={resetCommandMetrics}
              dashboardDensity={dashboardDensity} setDashboardDensity={setDashboardDensity}
              getCommandMetricValue={getCommandMetricValue} openCommandMetricModal={openCommandMetricModal}
              deleteCommandMetric={deleteCommandMetric} getNextActionForLead={getNextActionForLead}
              getLeadBrand={getLeadBrand} setSelectedBrand={setSelectedBrand}
              setSelectedBrandForEmail={setSelectedBrandForEmail} setActiveEmailLead={setActiveEmailLead}
              setSelectedBrandForWhatsApp={setSelectedBrandForWhatsApp} setActiveWhatsAppLead={setActiveWhatsAppLead}
              setSelectedBrandForCalls={setSelectedBrandForCalls} setActiveCallLead={setActiveCallLead}
              setActiveLead={setActiveLead} loadLeadDetailsHistory={loadLeadDetailsHistory}
              portfolioLeaderboard={portfolioLeaderboard} countUniquePeopleForBrand={countUniquePeopleForBrand}
              brandIntelligenceBreakdowns={brandIntelligenceBreakdowns} isSectionVisible={isSectionVisible}
              toggleSection={toggleSection} setIntelligenceBuilderOpen={setIntelligenceBuilderOpen}
              intelligenceBuilderOpen={intelligenceBuilderOpen} intelligenceForm={intelligenceForm}
              setIntelligenceForm={setIntelligenceForm} editingIntelligenceId={editingIntelligenceId}
              setEditingIntelligenceId={setEditingIntelligenceId} showToast={showToast}
              isFollowUpDue={isFollowUpDue} getSnapshotCardValue={getSnapshotCardValue}
              snapshotCards={snapshotCards} handleDeleteSnapshotCard={handleDeleteSnapshotCard}
              snapshotForm={snapshotForm} setSnapshotForm={setSnapshotForm}
              handleAddSnapshotCard={handleAddSnapshotCard} getBrandSegmentOptions={getBrandSegmentOptions}
              getBrandStageOptions={getBrandStageOptions} getStageColor={getStageColor}
              getLeadMetricRawValue={getLeadMetricRawValue} isMeaningfulMetricValue={isMeaningfulMetricValue}
              getLeadIdentityKeyForBrand={getLeadIdentityKeyForBrand} setBrandIntelligenceBreakdowns={setBrandIntelligenceBreakdowns}
              DEFAULT_INTELLIGENCE_BREAKDOWNS={DEFAULT_INTELLIGENCE_BREAKDOWNS} setSelectedStageFilter={setSelectedStageFilter}
              setSelectedCustomFieldFilter={setSelectedCustomFieldFilter} setSelectedSegmentFilter={setSelectedSegmentFilter}
              openBrandWorkbench={openBrandWorkbench}
            />
          )}

          {/* =======================================================
               B. INTEGRATED DIALLER CALL CENTER
             ======================================================= */}
          {activeTab === 'calls' && (
            <CallsPage
              diallerLeadsList={diallerLeadsList} selectedBrandForCalls={selectedBrandForCalls}
              setSelectedBrandForCalls={setSelectedBrandForCalls} callStageFilter={callStageFilter}
              setCallStageFilter={setCallStageFilter} activeCallLead={activeCallLead}
              setActiveCallLead={setActiveCallLead} leadCalls={leadCalls}
              getBrandIntegrationFor={getBrandIntegrationFor} handleSelectCommunications={handleSelectCommunications}
              managedBrands={managedBrands} activeBrands={activeBrands}
              setDiallerLead={setDiallerLead} setCallNotes={setCallNotes}
              setCallFollowUpDate={setCallFollowUpDate} getBrandStageOptions={getBrandStageOptions}
              setActiveLead={setActiveLead} loadLeadDetailsHistory={loadLeadDetailsHistory}
              isCalling={isCalling} diallerLead={diallerLead}
              callSeconds={callSeconds} handleEndSimulatedCall={handleEndSimulatedCall}
              handleStartSimulatedCall={handleStartSimulatedCall} callOutcome={callOutcome}
              setCallOutcome={setCallOutcome} callDuration={callDuration}
              setCallDuration={setCallDuration} callFollowUpDate={callFollowUpDate}
              messageTemplates={messageTemplates} applyTemplateVars={applyTemplateVars}
              callNotes={callNotes} handleLogCallSubmit={handleLogCallSubmit}
              callSaving={callSaving} setActiveTab={setActiveTab}
              setIntegrationBrandId={setIntegrationBrandId} integrationBrandId={integrationBrandId}
              setActiveIntegrationChannel={setActiveIntegrationChannel}
            />
          )}

          {/* =======================================================
               EMAIL TRACKING SYSTEM
             ======================================================= */}
          {activeTab === 'email-tracking' && (
            <EmailTrackingPage
              leads={leads} selectedBrandForEmail={selectedBrandForEmail}
              setSelectedBrandForEmail={setSelectedBrandForEmail} emailStageFilter={emailStageFilter}
              setEmailStageFilter={setEmailStageFilter} activeEmailLead={activeEmailLead}
              setActiveEmailLead={setActiveEmailLead} allSentEmails={allSentEmails}
              fetchAllSentEmails={fetchAllSentEmails} getBrandIntegrationFor={getBrandIntegrationFor}
              emailConnections={emailConnections} getEmailAccountsForIntegration={getEmailAccountsForIntegration}
              selectedEmailAccountId={selectedEmailAccountId} setSelectedEmailAccountId={setSelectedEmailAccountId}
              outlookSyncing={outlookSyncing} gmailSyncing={gmailSyncing}
              customMailboxSyncing={customMailboxSyncing} syncOutlookMessages={syncOutlookMessages}
              syncGmailReplies={syncGmailReplies} syncCustomMailboxMessages={syncCustomMailboxMessages}
              emailProviderFilter={emailProviderFilter} setEmailProviderFilter={setEmailProviderFilter}
              emailMailboxFilter={emailMailboxFilter} setEmailMailboxFilter={setEmailMailboxFilter}
              getEmailActionSummary={getEmailActionSummary} isEmailActionable={isEmailActionable}
              getEmailActionBucket={getEmailActionBucket} emailSearchQuery={emailSearchQuery}
              setEmailSearchQuery={setEmailSearchQuery} emailPage={emailPage}
              setEmailPage={setEmailPage} selectedMailboxEmailIds={selectedMailboxEmailIds}
              setSelectedMailboxEmailIds={setSelectedMailboxEmailIds} selectedEmailLogId={selectedEmailLogId}
              setSelectedEmailLogId={setSelectedEmailLogId} emailReplyBody={emailReplyBody}
              setEmailReplyBody={setEmailReplyBody} directEmailOpen={directEmailOpen}
              setDirectEmailOpen={setDirectEmailOpen} directEmailTo={directEmailTo}
              setDirectEmailTo={setDirectEmailTo} directEmailName={directEmailName}
              setDirectEmailName={setDirectEmailName} emailSubject={emailSubject}
              setEmailSubject={setEmailSubject} emailContent={emailContent}
              setEmailContent={setEmailContent} emailTemplateSel={emailTemplateSel}
              setEmailTemplateSel={setEmailTemplateSel} emailAttachments={emailAttachments}
              setEmailAttachments={setEmailAttachments} emailSending={emailSending}
              setEmailSending={setEmailSending} prepareEmailAttachments={prepareEmailAttachments}
              sendDirectBrandEmail={sendDirectBrandEmail} showToast={showToast}
              messageTemplates={messageTemplates} EMAIL_TEMPLATES={EMAIL_TEMPLATES}
              applyEmailTemplateVars={applyEmailTemplateVars} addEmailAttachmentFiles={addEmailAttachmentFiles}
              sendTrackedEmail={sendTrackedEmail} handleSelectCommunications={handleSelectCommunications}
              managedBrands={managedBrands} activeBrands={activeBrands}
              setActiveLead={setActiveLead} handleSelectBrand={handleSelectBrand}
              loadLeadDetailsHistory={loadLeadDetailsHistory} handleDeleteEmail={handleDeleteEmail}
              handleBulkDeleteMailboxEmails={handleBulkDeleteMailboxEmails} markEmailReadInCrm={markEmailReadInCrm}
              isInboundCrmEmail={isInboundCrmEmail} sanitizeEmailHtml={sanitizeEmailHtml}
              openingAttachmentKey={openingAttachmentKey} handleEmailAttachment={handleEmailAttachment}
              handleEmailAction={handleEmailAction} emailProviderMode={emailProviderMode}
              onOpenIntegrationsEmail={() => {
                setIntegrationBrandId(selectedBrandForEmail?.id || integrationBrandId);
                setActiveIntegrationChannel('email');
                setSelectedBrand(null);
                setActiveTab('integrations');
              }}
              setEmailProviderMode={setEmailProviderMode} setIntegrationBrandId={setIntegrationBrandId}
              integrationBrandId={integrationBrandId} setActiveIntegrationChannel={setActiveIntegrationChannel}
            />
          )}


          {activeTab === 'whatsapp-tracking' && (
            <WhatsAppPage
              activeTab={'whatsapp-tracking'} leads={leads}
              selectedBrandForWhatsApp={selectedBrandForWhatsApp} setSelectedBrandForWhatsApp={setSelectedBrandForWhatsApp}
              allWhatsAppMessages={allWhatsAppMessages} fetchAllWhatsAppMessages={fetchAllWhatsAppMessages}
              waContactSearch={waContactSearch} setWaContactSearch={setWaContactSearch}
              waPickerSearch={waPickerSearch} setWaPickerSearch={setWaPickerSearch}
              activeWhatsAppLead={activeWhatsAppLead} setActiveWhatsAppLead={setActiveWhatsAppLead}
              getBrandIntegrationFor={getBrandIntegrationFor} isWhatsAppCloudConfigured={isWhatsAppCloudConfigured}
              whatsappNumbers={whatsappNumbers} setWhatsappNumbers={setWhatsappNumbers}
              handleSelectCommunications={handleSelectCommunications} managedBrands={managedBrands}
              activeBrands={activeBrands} setDirectWhatsAppOpen={setDirectWhatsAppOpen}
              directWhatsAppOpen={directWhatsAppOpen} setWaDashboardMessage={setWaDashboardMessage}
              waDashboardMessage={waDashboardMessage} sendDirectWhatsApp={sendDirectWhatsApp}
              showToast={showToast} waContactPickerOpen={waContactPickerOpen}
              setWaContactPickerOpen={setWaContactPickerOpen} waPickerSelectedIds={waPickerSelectedIds}
              setWaPickerSelectedIds={setWaPickerSelectedIds} directWhatsAppNumber={directWhatsAppNumber}
              setDirectWhatsAppNumber={setDirectWhatsAppNumber} directWhatsAppName={directWhatsAppName}
              setDirectWhatsAppName={setDirectWhatsAppName} setSelectedBrand={setSelectedBrand}
              setSelectedLeadIds={setSelectedLeadIds} setBulkWhatsAppMessage={setBulkWhatsAppMessage}
              setBulkWhatsAppProgress={setBulkWhatsAppProgress} setBulkWhatsAppModalOpen={setBulkWhatsAppModalOpen}
              getFollowUpStatus={getFollowUpStatus} countUniquePeopleForBrand={countUniquePeopleForBrand}
              saveWhatsAppNumbers={saveWhatsAppNumbers} waSavingSettings={waSavingSettings}
              setWaSavingSettings={setWaSavingSettings} resetWhatsAppTemplateForm={resetWhatsAppTemplateForm}
              getWhatsAppTemplatesForBrand={getWhatsAppTemplatesForBrand} startEditWhatsAppTemplate={startEditWhatsAppTemplate}
              deleteWhatsAppTemplate={deleteWhatsAppTemplate} waTemplateName={waTemplateName}
              setWaTemplateName={setWaTemplateName} waTemplateMessage={waTemplateMessage}
              setWaTemplateMessage={setWaTemplateMessage} saveWhatsAppTemplate={saveWhatsAppTemplate}
              waTemplateEditingId={waTemplateEditingId} waTemplateSel={waTemplateSel}
              setWaTemplateSel={setWaTemplateSel} applyTemplateVars={applyTemplateVars}
              fetchLeadsForEmailBrand={fetchLeadsForEmailBrand} setActiveTab={setActiveTab}
              setIntegrationBrandId={setIntegrationBrandId} setActiveIntegrationChannel={setActiveIntegrationChannel}
            />
          )}


          {/* =======================================================
               C. SELECTED CORPORATE WORKSPACE (LEADS/SEQUENCES)
             ======================================================= */}
          {activeTab === 'team-chat' && (
            <TeamChatPage
              activeTab={'team-chat'} usersList={usersList}
              user={user} activeTeamDmId={activeTeamDmId}
              setActiveTeamDmId={setActiveTeamDmId} teamRecipientId={teamRecipientId}
              setTeamRecipientId={setTeamRecipientId} teamChatSubTab={teamChatSubTab}
              setTeamChatSubTab={setTeamChatSubTab} teamMessageText={teamMessageText}
              setTeamMessageText={setTeamMessageText} teamFiles={teamFiles}
              setTeamFiles={setTeamFiles} teamDmSearch={teamDmSearch}
              setTeamDmSearch={setTeamDmSearch} teamUnreadOnly={teamUnreadOnly}
              setTeamUnreadOnly={setTeamUnreadOnly} teamPresenceStatus={teamPresenceStatus}
              setTeamPresenceStatus={setTeamPresenceStatus} profilePicture={profilePicture}
              teamGlobalUnreadCount={teamGlobalUnreadCount} fetchTeamMessages={fetchTeamMessages}
              getTeamThreadMessages={getTeamThreadMessages} getTeamThreadUnreadCount={getTeamThreadUnreadCount}
              getTeamMessageDateKey={getTeamMessageDateKey} formatTeamPreviewTime={formatTeamPreviewTime}
              formatTeamDateDivider={formatTeamDateDivider} formatTeamTime={formatTeamTime}
              handleDeleteTeamMessage={handleDeleteTeamMessage} renderTeamMessageContent={renderTeamMessageContent}
              handleSendTeamMessage={handleSendTeamMessage} formatTeamDraft={formatTeamDraft}
              addTeamFiles={addTeamFiles} startTeamCall={startTeamCall}
              teamPosting={teamPosting} handleSelectCommunications={handleSelectCommunications}
              setUserNotesOpen={setUserNotesOpen} fetchTeamNotes={fetchTeamNotes}
              teamMessages={teamMessages}
            />
          )}


          {activeTab === 'integrations' && (
            <div style={{ animation: 'fadeIn 0.3s' }}>
              <IntegrationsPage
                activeBrands={activeBrands}
                integrationBrandId={integrationBrandId}
                setIntegrationBrandId={setIntegrationBrandId}
                integrationForm={integrationForm}
                setIntegrationForm={setIntegrationForm}
                activeIntegrationChannel={activeIntegrationChannel}
                setActiveIntegrationChannel={setActiveIntegrationChannel}
                leadSourceForm={leadSourceForm}
                setLeadSourceForm={setLeadSourceForm}
                leadSources={leadSources}
                leadSourceLogs={leadSourceLogs}
                leadSourceSaving={leadSourceSaving}
                messageTemplates={messageTemplates}
                templateForm={templateForm}
                setTemplateForm={setTemplateForm}
                templateSaving={templateSaving}
                integrationSaving={integrationSaving}
                integrationChecking={integrationChecking}
                integrationStatus={integrationStatus}
                user={user}
                gmailStatus={gmailStatus}
                outlookStatus={outlookStatus}
                gmailConnecting={gmailConnecting}
                gmailTesting={gmailTesting}
                gmailTestRecipient={gmailTestRecipient}
                setGmailTestRecipient={setGmailTestRecipient}
                customMailboxOpen={customMailboxOpen}
                setCustomMailboxOpen={setCustomMailboxOpen}
                customMailboxForm={customMailboxForm}
                setCustomMailboxForm={setCustomMailboxForm}
                customMailboxSaving={customMailboxSaving}
                emailConnections={emailConnections}
                whatsappConnecting={whatsappConnecting}
                whatsappDisconnectConfirm={whatsappDisconnectConfirm}
                setWhatsAppDisconnectConfirm={setWhatsAppDisconnectConfirm}
                websiteAnalyticsForm={websiteAnalyticsForm}
                setWebsiteAnalyticsForm={setWebsiteAnalyticsForm}
                websiteAnalyticsSaving={websiteAnalyticsSaving}
                websiteAnalyticsSites={websiteAnalyticsSites}
                websiteAnalyticsSummary={websiteAnalyticsSummary}
                createLeadSource={createLeadSource}
                rotateLeadSourceKey={rotateLeadSourceKey}
                updateLeadSource={updateLeadSource}
                deleteLeadSource={deleteLeadSource}
                createWebsiteAnalyticsSite={createWebsiteAnalyticsSite}
                fetchWebsiteAnalytics={fetchWebsiteAnalytics}
                updateWebsiteAnalyticsSite={updateWebsiteAnalyticsSite}
                deleteWebsiteAnalyticsSite={deleteWebsiteAnalyticsSite}
                saveBrandIntegration={saveBrandIntegration}
                checkBrandIntegrationStatus={checkBrandIntegrationStatus}
                startGmailConnection={startGmailConnection}
                disconnectGmail={disconnectGmail}
                sendGmailTestEmail={sendGmailTestEmail}
                startOutlookConnection={startOutlookConnection}
                sendSmtpProviderTestEmail={sendSmtpProviderTestEmail}
                saveCustomMailboxConnection={saveCustomMailboxConnection}
                applyCustomMailboxPreset={applyCustomMailboxPreset}
                applyEmailProviderPreset={applyEmailProviderPreset}
                disconnectEmailConnection={disconnectEmailConnection}
                setDefaultEmailConnection={setDefaultEmailConnection}
                sendDefaultMailboxTestEmail={sendDefaultMailboxTestEmail}
                addEmailAccountToIntegration={addEmailAccountToIntegration}
                updateEmailAccountInIntegration={updateEmailAccountInIntegration}
                removeEmailAccountFromIntegration={removeEmailAccountFromIntegration}
                startWhatsAppEmbeddedSignup={startWhatsAppEmbeddedSignup}
                disconnectWhatsAppEmbeddedSignup={disconnectWhatsAppEmbeddedSignup}
                resetTemplateForm={resetTemplateForm}
                saveMessageTemplate={saveMessageTemplate}
                startEditMessageTemplate={startEditMessageTemplate}
                deleteMessageTemplate={deleteMessageTemplate}
                showToast={showToast}
                getEmailAccountsForIntegration={getEmailAccountsForIntegration}
              />
            </div>
          )}

          {selectedBrand && (
            <div style={{ animation: 'fadeIn 0.3s' }}>
              {/* Compact brand context — tabs already handle navigation between brands */}
              <div className="brand-workspace-toolbar">
                <div className="brand-workspace-toolbar__identity">
                  <img src={selectedBrand.logo} alt="" className="brand-workspace-toolbar__logo" referrerPolicy="no-referrer" />
                  <div>
                    <div className="brand-workspace-toolbar__name">{selectedBrand.name}</div>
                    <div className="brand-workspace-toolbar__meta">Brand workspace</div>
                  </div>
                </div>
                <div className="brand-subnav" role="tablist" aria-label={`${selectedBrand.name} sections`}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={brandSubTab === 'leads'}
                    className={`brand-subnav__chip ${brandSubTab === 'leads' ? 'is-active' : ''}`}
                    style={{ ['--subnav-accent' as string]: selectedBrand.color }}
                    onClick={() => setBrandSubTab('leads')}
                  >
                    <i className="fas fa-address-book" />
                    <span>Leads</span>
                    <em>{leads.length}</em>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={brandSubTab === 'sequences'}
                    className={`brand-subnav__chip ${brandSubTab === 'sequences' ? 'is-active' : ''}`}
                    style={{ ['--subnav-accent' as string]: selectedBrand.color }}
                    onClick={() => setBrandSubTab('sequences')}
                  >
                    <i className="fas fa-envelope-open-text" />
                    <span>Sequences</span>
                    <em>{sequences.length}</em>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={brandSubTab === 'tasks'}
                    className={`brand-subnav__chip ${brandSubTab === 'tasks' ? 'is-active' : ''}`}
                    style={{ ['--subnav-accent' as string]: selectedBrand.color }}
                    onClick={() => { setBrandSubTab('tasks'); fetchTasksForActiveBrand(); }}
                  >
                    <i className="fas fa-tasks" />
                    <span>Tasks</span>
                  </button>
                </div>
              </div>

              {/* C.1 WORKSPACE - LEADS CONTROL TAB */}
              {brandSubTab === 'leads' && (
                <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start' }}>
                  
                  {/* LEADS LIST PANEL & CONTROLS */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    
                     {/* Classification Tabs — drive BOTH insights and the table so pools stay separate */}
                     <div style={{ display: 'flex', gap: '0', marginBottom: '12px', borderBottom: '2px solid var(--border)', alignItems: 'center', flexWrap: 'wrap' }}>
                       {(['verified', 'prospect'] as const).map(tab => {
                         const count = leads.filter(l => getLeadClassification(l) === tab).length;
                         const isActive = !activeCustomTabId && leadClassificationTab === tab;
                         const label = tab === 'verified' ? 'Verified Leads' : 'Prospects';
                         const icon = tab === 'verified' ? 'fa-check-circle' : 'fa-seedling';
                         const hint = tab === 'verified'
                           ? 'High-quality / confirmed leads — used for dashboard insights'
                           : 'Early-stage prospects — kept separate from verified metrics';
                         return (
                           <button
                             key={tab}
                             type="button"
                             title={hint}
                             onClick={() => activateSystemTab(tab)}
                             style={{
                               padding: '12px 20px',
                               background: 'transparent',
                               border: 'none',
                               borderBottom: isActive ? `3px solid ${selectedBrand.color}` : '3px solid transparent',
                               color: isActive ? selectedBrand.color : 'var(--text-secondary)',
                               fontWeight: '700',
                               fontSize: '14px',
                               cursor: 'pointer',
                               transition: 'all 0.2s',
                               marginBottom: '-2px',
                               display: 'flex',
                               alignItems: 'center',
                               gap: '8px',
                             }}
                           >
                             <i className={`fas ${icon}`} style={{ fontSize: '12px' }}></i>
                             {label}
                             <span style={{
                               background: isActive ? selectedBrand.color : 'var(--bg-muted)',
                               color: isActive ? '#fff' : 'var(--text-muted)',
                               borderRadius: '12px',
                               padding: '2px 10px',
                               fontSize: '12px',
                               fontWeight: '700',
                             }}>{count}</span>
                           </button>
                         );
                       })}
                       {(customLeadTabs[selectedBrand?.id || ''] || []).map(tab => {
                         const isActive = activeCustomTabId === tab.id;
                         const count = countLeadsForCustomTab(tab);
                         return (
                           <button
                             key={tab.id}
                             type="button"
                             title={tab.name}
                             onClick={() => activateCustomTab(tab)}
                             style={{
                               padding: '12px 20px',
                               background: 'transparent',
                               border: 'none',
                               borderBottom: isActive ? `3px solid ${tab.color}` : '3px solid transparent',
                               color: isActive ? tab.color : 'var(--text-secondary)',
                               fontWeight: '700',
                               fontSize: '14px',
                               cursor: 'pointer',
                               transition: 'all 0.2s',
                               marginBottom: '-2px',
                               display: 'flex',
                               alignItems: 'center',
                               gap: '8px',
                               position: 'relative',
                             }}
                           >
                             <i className={`fas ${tab.icon}`} style={{ fontSize: '12px' }}></i>
                             {tab.name}
                             <span style={{
                               background: isActive ? tab.color : 'var(--bg-muted)',
                               color: isActive ? '#fff' : 'var(--text-muted)',
                               borderRadius: '12px',
                               padding: '2px 10px',
                               fontSize: '12px',
                               fontWeight: '700',
                             }}>{count}</span>
                              <span
                                role="button"
                                aria-label={`Edit ${tab.name}`}
                                onClick={(e) => { e.stopPropagation(); openEditCustomTab(tab); }}
                                style={{
                                  marginLeft: '2px',
                                  background: 'transparent',
                                  border: 'none',
                                  color: 'var(--text-muted)',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  lineHeight: 1,
                                  padding: '0 2px',
                                }}
                              ><i className="fas fa-pen" style={{ fontSize: '10px' }}></i></span>
                              <span
                                role="button"
                                aria-label={`Delete ${tab.name}`}
                                onClick={(e) => { e.stopPropagation(); deleteCustomTab(tab.id); }}
                                style={{
                                  marginLeft: '2px',
                                  background: 'transparent',
                                  border: 'none',
                                  color: 'var(--text-muted)',
                                  cursor: 'pointer',
                                  fontSize: '14px',
                                  lineHeight: 1,
                                  padding: '0 2px',
                                }}
                              >×</span>
                           </button>
                         );
                       })}
                       <button
                         type="button"
                         onClick={openCreateCustomTab}
                         title="Add custom lead tab"
                         style={{
                           padding: '12px 16px',
                           background: 'transparent',
                           border: 'none',
                           borderBottom: '3px solid transparent',
                           color: 'var(--text-muted)',
                           fontWeight: '700',
                           fontSize: '14px',
                           cursor: 'pointer',
                           transition: 'all 0.2s',
                           marginBottom: '-2px',
                           display: 'flex',
                           alignItems: 'center',
                           gap: '4px',
                         }}
                       >
                         <i className="fas fa-plus" style={{ fontSize: '11px' }}></i>
                         Add tab
                       </button>
                     </div>
                     <div style={{
                       display: 'flex',
                       alignItems: 'center',
                       gap: '8px',
                       marginBottom: '14px',
                       padding: '8px 12px',
                       borderRadius: '10px',
                       background: (() => {
                         if (activeCustomTabId) {
                           const tab = getActiveCustomTab();
                           return tab ? `${tab.color}15` : 'var(--bg-muted)';
                         }
                         return leadClassificationTab === 'verified' ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.10)';
                       })(),
                       border: (() => {
                         if (activeCustomTabId) {
                           const tab = getActiveCustomTab();
                           return tab ? `1px solid ${tab.color}40` : '1px solid var(--border)';
                         }
                         return `1px solid ${leadClassificationTab === 'verified' ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.28)'}`;
                       })(),
                       color: 'var(--text-secondary)',
                       fontSize: '12.5px',
                       fontWeight: 600,
                     }}>
                       <i className={`fas ${activeCustomTabId ? (getActiveCustomTab()?.icon || 'fa-filter') : (leadClassificationTab === 'verified' ? 'fa-shield-halved' : 'fa-seedling')}`}
                         style={{ color: (() => {
                           if (activeCustomTabId) {
                             const tab = getActiveCustomTab();
                             return tab ? tab.color : 'var(--text-muted)';
                           }
                           return leadClassificationTab === 'verified' ? '#059669' : '#d97706';
                         })() }} />
                       <span>
                         {activeCustomTabId
                           ? `Custom view: ${getActiveCustomTab()?.name || 'Custom'} — showing filtered leads across all pools.`
                           : leadClassificationTab === 'verified'
                             ? 'Showing Verified Lead insights only — high-quality / confirmed pipeline. Prospects are excluded.'
                             : 'Showing Prospect insights only — early-stage pipeline. Verified leads are excluded.'}
                       </span>
                     </div>

                     {/* Merged Brand Snapshot + Lead Intelligence (scoped to active classification pool) */}
                     {(() => {
                       // Critical: insights must never mix verified + prospect pools.
                       const insightLeads = activeCustomTabId
                         ? leads.filter(lead => {
                             const tab = getActiveCustomTab();
                             if (!tab) return true;
                             const f = tab.filters;
                             const s = f.search.toLowerCase();
                             const matchesSearch = !s ||
                               String(lead.name || '').toLowerCase().includes(s) ||
                               String(lead.email || '').toLowerCase().includes(s) ||
                               String(lead.phone || '').toLowerCase().includes(s) ||
                               (lead.notes && String(lead.notes || '').toLowerCase().includes(s));
                             const leadStageForFilter = selectedBrand?.id === 'optimaviz' ? getOptimavizLeadStage(lead) : selectedBrand?.id === 'idao' ? getIdaoLeadStage(lead) : lead.funnel_stage;
                             const leadSegmentForFilter = selectedBrand?.id === 'optimaviz' ? getOptimavizLeadSegment(lead) : selectedBrand?.id === 'idao' ? getIdaoLeadSegment(lead) : lead.custom_fields?.segment;
                             const matchesStage = f.stage === 'all' || leadStageForFilter === f.stage;
                             const matchesSegment = f.segment === 'all' || leadSegmentForFilter === f.segment;
                             const matchesCity = f.city === 'all' || (lead.custom_fields && (lead.custom_fields.city || lead.custom_fields.City || '').toLowerCase() === f.city.toLowerCase());
                             const matchesService = f.service === 'all' || (lead.custom_fields && (lead.custom_fields.service_category_name || lead.custom_fields.ServiceCategoryName || lead.custom_fields.service_category || '').toLowerCase() === f.service.toLowerCase());
                             const matchesAbn = f.abn === 'all' || (() => {
                               const abnValue = lead.custom_fields && (lead.custom_fields.abn_number || lead.custom_fields.AbnNumber || lead.custom_fields.abn);
                               const hasAbn = abnValue && String(abnValue).replace(/\s+/g, '').length >= 9 && String(abnValue).toLowerCase() !== 'no abn supplied';
                               return f.abn === 'has_abn' ? !!hasAbn : !hasAbn;
                             })();
                             const matchesDateWindow = f.dateWindow === 'all' || (f.dateFrom || f.dateTo ? isLeadInCustomDateRange(lead, f.dateFrom, f.dateTo) : isLeadInDateWindow(lead, f.dateWindow));
                             return matchesSearch && matchesStage && matchesSegment && matchesCity && matchesService && matchesAbn && matchesDateWindow;
                           })
                         : filterLeadsByClassification(leads, leadClassificationTab);
                       const poolLabel = activeCustomTabId
                         ? (getActiveCustomTab()?.name || 'Custom')
                         : (leadClassificationTab === 'verified' ? 'Verified' : 'Prospect');
                      const getLeadValue = (lead: Lead, keys: string[]) => {
                        for (const key of keys) {
                          const match = getLeadMetricRawValue(lead, key);
                          if (isMeaningfulMetricValue(match.value)) return { key: match.key, value: String(match.value).trim() };
                        }
                        return null;
                      };
                      const segmentLabelByValue = Object.fromEntries(getBrandSegmentOptions(selectedBrand.id).map(seg => [seg.value, seg.label]));
                      const stageLabels = new Set(getBrandStageOptions(selectedBrand.id));
                      const formatBreakdownLabel = (value: string, type: string) => {
                        if (type === 'segment') return segmentLabelByValue[value] || value.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
                        if (type === 'stage' && stageLabels.has(value)) return value;
                        return value.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
                      };
                      const resolveBreakdownType = (config: { keys: string[]; title?: string; type: string }) => {
                        const keyText = config.keys.join(' ').toLowerCase();
                        const titleText = String(config.title || '').toLowerCase();
                        const isAbnMetric = /\babn\b|australian business number/.test(`${keyText} ${titleText}`);
                        if (isAbnMetric && /(missing|blank|without|no abn|not supplied|not filled)/.test(titleText)) return 'field_missing';
                        if (isAbnMetric && /(with|has|valid|verified|supplied|present)/.test(titleText)) return 'field_present';
                        return config.type;
                      };
                      const makeBreakdownRows = (config: IntelligenceBreakdownConfig, expanded: boolean) => {
                        const resolvedType = resolveBreakdownType(config);
                        if (resolvedType === 'field_present' || resolvedType === 'field_missing') {
                          const presentPeople = new Set<string>();
                          const missingPeople = new Set<string>();
                          insightLeads.forEach(lead => {
                            const hasValue = config.keys.some(key => isMeaningfulMetricValue(getLeadMetricRawValue(lead, key).value));
                            (hasValue ? presentPeople : missingPeople).add(getLeadIdentityKeyForBrand(lead));
                          });
                          const isPresent = resolvedType === 'field_present';
                          return {
                            totalDistinct: 2,
                            rows: [{
                              value: isPresent ? '__filled__' : '__missing__',
                              label: isPresent ? 'Has value' : 'Missing / blank',
                              count: isPresent ? presentPeople.size : missingPeople.size,
                              field: config.keys[0] || 'custom',
                              kind: resolvedType,
                            }, {
                              value: isPresent ? '__missing__' : '__filled__',
                              label: isPresent ? 'Missing / blank' : 'Has value',
                              count: isPresent ? missingPeople.size : presentPeople.size,
                              field: config.keys[0] || 'custom',
                              kind: isPresent ? 'field_missing' : 'field_present',
                            }].filter(r => r.count > 0),
                          };
                        }
                        const counts: Record<string, { label: string; count: number; field: string; people: Set<string> }> = {};
                        insightLeads.forEach(lead => {
                          const match = getLeadValue(lead, config.keys);
                          const value = match?.value || 'Unspecified';
                          const field = match?.key || config.keys[0] || 'custom';
                          const label = formatBreakdownLabel(value, config.type);
                          const existing = counts[value] || { label, count: 0, field, people: new Set<string>() };
                          existing.people.add(getLeadIdentityKeyForBrand(lead));
                          existing.count = existing.people.size;
                          counts[value] = existing;
                        });
                        const all = Object.entries(counts).sort((a, b) => b[1].count - a[1].count);
                        const limit = expanded ? 40 : 12;
                        return {
                          totalDistinct: all.length,
                          rows: all.slice(0, limit).map(([value, item]) => ({
                            value,
                            label: item.label,
                            count: item.count,
                            field: item.field,
                            kind: resolvedType as string,
                          })),
                        };
                      };
                      const uniquePeople = countUniquePeopleForBrand(insightLeads);
                      const followUpsDue = countUniquePeopleForBrand(insightLeads.filter(l => isFollowUpDue(l)));
                      const missingContact = countUniquePeopleForBrand(insightLeads.filter(l => !String(l.email || '').trim() && !String(l.phone || '').trim()));
                      const missingStage = countUniquePeopleForBrand(insightLeads.filter(l => !String(l.funnel_stage || '').trim()));
                      const duplicateRecords = Math.max(0, insightLeads.length - uniquePeople);
                      const brandDefaults = getDefaultIntelligenceBreakdowns(selectedBrand.id);
                      const hasCustomBreakdowns = Object.prototype.hasOwnProperty.call(
                        brandIntelligenceBreakdowns,
                        selectedBrand.id,
                      );
                      const storedBreakdowns = hasCustomBreakdowns
                        ? (brandIntelligenceBreakdowns[selectedBrand.id] || [])
                        : [];
                      const deletedBreakdownIds = new Set(deletedIntelligenceIds[selectedBrand.id] || []);
                      // Merge saved configs with brand defaults so NEW smart cards can appear,
                      // but never resurrect cards the user explicitly deleted.
                      const intelligenceBreakdowns = (() => {
                        const deletedBreakdownIds = new Set(deletedIntelligenceIds[selectedBrand.id] || []);
                        const base = hasCustomBreakdowns ? [...storedBreakdowns] : [...brandDefaults];
                        const merged = base.filter(item => !deletedBreakdownIds.has(item.id));
                        for (const def of brandDefaults) {
                          if (deletedBreakdownIds.has(def.id)) continue;
                          const covered = merged.some(item =>
                            item.id === def.id ||
                            item.keys.some(k => def.keys.map(x => x.toLowerCase()).includes(String(k).toLowerCase())) ||
                            String(item.title || '').toLowerCase() === String(def.title || '').toLowerCase()
                          );
                          if (!covered) merged.push(def);
                        }
                        return merged;
                      })();

                      // Discover custom fields that have real distribution for "Add insight" picker
                      // (scoped to the active verified/prospect pool only)
                      const fieldStats = new Map<string, Set<string>>();
                      insightLeads.forEach(lead => {
                        Object.entries(lead.custom_fields || {}).forEach(([key, raw]) => {
                          const v = String(raw ?? '').trim();
                          if (!v) return;
                          if (!fieldStats.has(key)) fieldStats.set(key, new Set());
                          fieldStats.get(key)!.add(v);
                        });
                      });
                      const discoverableFields = Array.from(fieldStats.entries())
                        .filter(([, values]) => values.size >= 2 && values.size <= 80)
                        .map(([key, values]) => ({ key, distinct: values.size }))
                        .sort((a, b) => b.distinct - a.distinct)
                        .slice(0, 24);

                      const healthCards = [
                        {
                          id: 'unique',
                          label: leadClassificationTab === 'verified' ? 'Unique verified' : 'Unique prospects',
                          value: uniquePeople,
                          icon: 'fa-address-book',
                          color: selectedBrand.color,
                          action: () => {
                            clearLeadTableFilters();
                          },
                        },
                        {
                          id: 'dups',
                          label: 'Duplicates',
                          value: duplicateRecords,
                          icon: 'fa-copy',
                          color: '#155e75',
                          action: () => {
                            setSelectedCustomFieldFilter(null);
                            setLeadFocusFilter('duplicate_people');
                          },
                        },
                        {
                          id: 'followups',
                          label: 'Follow-ups due',
                          value: followUpsDue,
                          icon: 'fa-clock',
                          color: '#ef4444',
                          action: () => setSelectedStageFilter('Follow-Up Due'),
                        },
                        {
                          id: 'cleanup',
                          label: 'Needs cleanup',
                          value: missingContact + missingStage,
                          icon: 'fa-wand-magic-sparkles',
                          color: '#f97316',
                          action: undefined as undefined | (() => void),
                        },
                      ];
                      const snapshotMetricCards = (snapshotCards[selectedBrand.id] || []).filter(c => c.active !== false).map(card => {
                        const current = getSnapshotCardValue(card, insightLeads);
                        return {
                          id: card.id,
                          label: card.label,
                          value: current,
                          icon: card.icon || 'fa-bullseye',
                          color: card.color || selectedBrand.color,
                          target: card.target,
                          unit: card.unit,
                          fieldKey: card.fieldKey,
                          matchValue: card.matchValue,
                        };
                      });
                      const showHealth = isSectionVisible(selectedBrand.id, 'lead_intelligence', true);
                      if (!showHealth && snapshotMetricCards.length === 0) {
                        return (
                          <div className="brand-intelligence-hidden">
                            <span>Brand insights are hidden for {selectedBrand.name}.</span>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggleSection(selectedBrand.id, 'lead_intelligence', true)}>Show section</button>
                          </div>
                        );
                      }
                      const snapshotSource = snapshotForm.fieldKey || 'segment';
                      const segmentOptions = getBrandSegmentOptions(selectedBrand.id).map(seg => ({ label: seg.label, value: seg.value, color: seg.color, icon: seg.icon }));
                      const stageOptions = getBrandStageOptions(selectedBrand.id).map(stage => ({ label: stage, value: stage, color: getStageColor(stage), icon: 'fas fa-table-columns' }));
                      const valueOptions = snapshotSource === 'segment' ? segmentOptions : snapshotSource === 'funnel_stage' ? stageOptions : [];

                      const applyInsightFilter = (row: { kind: string; field: string; value: string; label: string }) => {
                        // Clicking an insight drills into the table
                        if (row.kind === 'segment') {
                          setSelectedSegmentFilter(row.value);
                          setSelectedStageFilter('all');
                          setSelectedCustomFieldFilter(null);
                        } else if (row.kind === 'stage') {
                          setSelectedStageFilter(row.value);
                          setSelectedCustomFieldFilter(null);
                        } else if (row.kind === 'field_present') {
                          setSelectedCustomFieldFilter({ field: row.field, value: '__filled__' });
                        } else if (row.kind === 'field_missing') {
                          setSelectedCustomFieldFilter({ field: row.field, value: '__missing__' });
                        } else {
                          setSelectedCustomFieldFilter({ field: row.field, value: row.value });
                        }
                        setLeadFocusFilter(`Insight: ${row.label}`);
                      };

                      const isInsightRowActive = (row: { kind: string; field: string; value: string }) => {
                        if (row.kind === 'segment') return selectedSegmentFilter === row.value;
                        if (row.kind === 'stage') return selectedStageFilter === row.value;
                        if (!selectedCustomFieldFilter) return false;
                        return (
                          selectedCustomFieldFilter.field === row.field &&
                          String(selectedCustomFieldFilter.value).toLowerCase() === String(row.value).toLowerCase()
                        );
                      };

                      const activeInsightLabel = selectedCustomFieldFilter
                        ? `${formatColumnLabel(selectedCustomFieldFilter.field)}: ${
                            selectedCustomFieldFilter.value === '__filled__'
                              ? 'has value'
                              : selectedCustomFieldFilter.value === '__missing__'
                                ? 'missing'
                                : selectedCustomFieldFilter.value
                          }`
                        : selectedSegmentFilter !== 'all'
                          ? `Segment: ${formatColumnLabel(selectedSegmentFilter)}`
                          : selectedStageFilter !== 'all'
                            ? `Stage: ${selectedStageFilter}`
                            : null;

                      return (
                        <section className="brand-insights-panel">
                          <div className="brand-insights-head">
                            <div>
                              <h3>
                                <i className="fas fa-chart-pie" style={{ color: selectedBrand.color }}></i>
                                {' '}{poolLabel} lead insights
                                <span style={{
                                  marginLeft: '8px',
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  letterSpacing: '0.04em',
                                  textTransform: 'uppercase',
                                  padding: '3px 8px',
                                  borderRadius: '999px',
                                  background: leadClassificationTab === 'verified' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.18)',
                                  color: leadClassificationTab === 'verified' ? '#047857' : '#b45309',
                                  verticalAlign: 'middle',
                                }}>
                                  {poolLabel} only
                                </span>
                              </h3>
                              <p>
                                Metrics below use <strong>{poolLabel.toLowerCase()}</strong> leads only
                                {leadClassificationTab === 'verified' ? ' (prospects excluded)' : ' (verified excluded)'}.
                                {' '}Click any value (e.g. a city) to filter the table.
                              </p>
                            </div>
                            <div className="brand-insights-actions">
                              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setIntelligenceBuilderOpen(prev => !prev)}>
                                <i className="fas fa-sliders"></i> {intelligenceBuilderOpen ? 'Done' : 'Customize'}
                              </button>
                              {showHealth && (
                                <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggleSection(selectedBrand.id, 'lead_intelligence', true)}>
                                  <i className="fas fa-eye-slash"></i> Hide
                                </button>
                              )}
                              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowBreakdowns(prev => !prev)}>
                                <i className="fas fa-columns"></i> {showBreakdowns ? 'Hide breakdowns' : 'Show breakdowns'}
                              </button>
                              <label className="btn btn-ghost btn-sm" style={{marginLeft: '8px'}}>
                                <input type="checkbox" checked={includeDuplicates} onChange={e => setIncludeDuplicates(e.target.checked)} /> Include duplicates
                              </label>
                            </div>
                          </div>

                          {activeInsightLabel && (
                            <div className="brand-insights-active-filter">
                              <span><i className="fas fa-filter"></i> Table filtered by <strong>{activeInsightLabel}</strong></span>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => {
                                  setSelectedCustomFieldFilter(null);
                                  setSelectedSegmentFilter('all');
                                  setSelectedStageFilter('all');
                                  setLeadFocusFilter(null);
                                }}
                              >
                                <i className="fas fa-times"></i> Reset insight filter
                              </button>
                            </div>
                          )}

                          <div className="brand-insights-metrics">
                            {showHealth && healthCards.map(card => (
                              <button key={card.id} type="button" onClick={card.action || (() => undefined)}>
                                <span className="icon" style={{ color: card.color, background: `${card.color}18` }}><i className={`fas ${card.icon}`}></i></span>
                                <strong>{card.value}</strong>
                                <small>{card.label}</small>
                              </button>
                            ))}
                            {snapshotMetricCards.map(card => (
                              <div key={card.id} className="brand-insights-metric" title={card.target ? `Goal: ${card.target} ${card.unit || ''}` : card.label} style={{ position: 'relative' }}>
                                <span className="icon" style={{ color: card.color, background: `${card.color}18` }}><i className={`fas ${card.icon}`}></i></span>
                                <strong>{card.value}{card.target ? <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>/{card.target}</span> : null}</strong>
                                <small>{card.label}</small>
                                <div style={{ position: 'absolute', top: '4px', right: '4px', display: 'flex', gap: '2px' }} className="brand-insights-metric__actions">
                                  <button type="button" onClick={(e) => { e.stopPropagation(); handleEditSnapshotCard(selectedBrand.id, card); }} style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '10px', padding: '2px 4px' }} title="Edit metric">
                                    <i className="fas fa-pencil-alt"></i>
                                  </button>
                                  <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteSnapshotCard(selectedBrand.id, card.id); }} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '10px', padding: '2px 4px' }} title="Delete metric">
                                    <i className="fas fa-trash"></i>
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Always-visible column breakdowns (city, segment, stage, …) */}
                          {showHealth && showBreakdowns && (
                            <div className="brand-insights-breakdowns">
                              {intelligenceBreakdowns.map(config => {
                                const expanded = insightsExpandedId === config.id;
                                const { rows, totalDistinct } = makeBreakdownRows(config, expanded);
                                return (
                                  <div key={config.id} className="brand-insights-breakdown-card">
                                    <div className="brand-intelligence-breakdown-head">
                                      <strong>{config.title}</strong>
                                      <span className="brand-insights-breakdown-actions">
                                        <button
                                          type="button"
                                          title="Edit insight"
                                          onClick={() => {
                                            setEditingIntelligenceId(config.id);
                                            setIntelligenceForm({ title: config.title, keys: config.keys.join(', '), type: config.type });
                                            setIntelligenceBuilderOpen(true);
                                          }}
                                        >
                                          <i className="fas fa-pencil-alt"></i>
                                        </button>
                                        <button
                                          type="button"
                                          title="Delete insight permanently"
                                          onClick={() => handleDeleteBreakdown(config.id)}
                                        >
                                          <i className="fas fa-times"></i>
                                        </button>
                                      </span>
                                    </div>
                                    <div className="brand-insights-breakdown-list">
                                      {rows.map(row => {
                                        const active = isInsightRowActive(row);
                                        return (
                                          <button
                                            key={`${config.id}-${row.value}`}
                                            type="button"
                                            className={active ? 'is-active' : undefined}
                                            title={`Show ${row.label} leads in the table`}
                                            onClick={() => {
                                              if (active) {
                                                setSelectedCustomFieldFilter(null);
                                                if (row.kind === 'segment') setSelectedSegmentFilter('all');
                                                if (row.kind === 'stage') setSelectedStageFilter('all');
                                                setLeadFocusFilter(null);
                                              } else {
                                                applyInsightFilter(row);
                                              }
                                            }}
                                          >
                                            <span>{row.label}</span>
                                            <em>{row.count}</em>
                                          </button>
                                        );
                                      })}
                                      {rows.length === 0 && <small className="brand-insights-empty">No values yet for this field</small>}
                                      {totalDistinct > rows.length && (
                                        <button
                                          type="button"
                                          className="brand-insights-show-more"
                                          onClick={() => setInsightsExpandedId(expanded ? null : config.id)}
                                        >
                                          {expanded ? 'Show less' : `Show all ${totalDistinct}`}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Quick-add field from live data */}
                          {discoverableFields.length > 0 && (
                            <div className="brand-insights-quick-add">
                              <label>
                                <span>Add insight</span>
                                <select
                                  defaultValue=""
                                  onChange={e => {
                                    const key = e.target.value;
                                    if (!key) return;
                                    const exists = intelligenceBreakdowns.some(b => b.keys.map(k => k.toLowerCase()).includes(key.toLowerCase()));
                                    if (exists) {
                                      showToast(`Already tracking “${key}”.`, true);
                                      e.target.value = '';
                                      return;
                                    }
                                    const next: IntelligenceBreakdownConfig = {
                                      id: `${selectedBrand.id}-${key}-${Date.now()}`,
                                      title: `By ${formatColumnLabel(key)}`,
                                      keys: [key],
                                      type: key === 'segment' || key === 'lead_type' ? 'segment' : key === 'funnel_stage' || key === 'stage' ? 'stage' : 'custom',
                                    };
                                    // Clear any prior delete-block for matching default cards so re-add works.
                                    setDeletedIntelligenceIds(prev => {
                                      const matchingDefaultIds = brandDefaults
                                        .filter(def =>
                                          def.id === next.id ||
                                          def.keys.some(k => next.keys.map(x => x.toLowerCase()).includes(String(k).toLowerCase())) ||
                                          String(def.title || '').toLowerCase() === String(next.title || '').toLowerCase()
                                        )
                                        .map(def => def.id);
                                      const remaining = (prev[selectedBrand.id] || []).filter(id => !matchingDefaultIds.includes(id));
                                      return { ...prev, [selectedBrand.id]: remaining };
                                    });
                                    setBrandIntelligenceBreakdowns(prev => ({
                                      ...prev,
                                      [selectedBrand.id]: [
                                        ...(Object.prototype.hasOwnProperty.call(prev, selectedBrand.id)
                                          ? (prev[selectedBrand.id] || [])
                                          : brandDefaults),
                                        next,
                                      ],
                                    }));
                                    showToast(`Added insight: ${next.title}`);
                                    e.target.value = '';
                                  }}
                                >
                                  <option value="">Pick a field (e.g. city)…</option>
                                  {discoverableFields.map(f => (
                                    <option key={f.key} value={f.key}>
                                      {formatColumnLabel(f.key)} ({f.distinct} values)
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <small>Choose any column that has data on this brand. Click values below to filter the table.</small>
                            </div>
                          )}

                          {intelligenceBuilderOpen && (
                            <div className="brand-insights-customize">
                              <details className="snapshot-editor-panel snapshot-editor-panel--data" open>
                                <summary><i className="fas fa-bullseye"></i> Snapshot metrics <span>Track totals, segments, or stages</span></summary>
                                 <div className="snapshot-editor-grid snapshot-editor-grid--data">
                                   <label>
                                     Source
                                     <select value={snapshotForm.fieldKey} onChange={e => setSnapshotForm(prev => ({ ...prev, fieldKey: e.target.value, matchValue: '', label: '' }))}>
                                       <option value="segment">Segment / lead type</option>
                                       <option value="funnel_stage">Pipeline stage</option>
                                       <option value="__total__">Total leads</option>
                                     </select>
                                   </label>
                                   {snapshotForm.fieldKey !== '__total__' && (
                                     <label>
                                       Track
                                       <select value={snapshotForm.matchValue} onChange={e => {
                                         const item = valueOptions.find(opt => opt.value === e.target.value);
                                         setSnapshotForm(prev => ({ ...prev, matchValue: e.target.value, label: prev.label || item?.label || '', color: item?.color || prev.color }));
                                       }}>
                                         <option value="">Choose {snapshotForm.fieldKey === 'segment' ? 'segment' : 'stage'}</option>
                                         {valueOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                                       </select>
                                     </label>
                                   )}
                                   <label>
                                     Label
                                     <input value={snapshotForm.label} onChange={e => setSnapshotForm(prev => ({ ...prev, label: e.target.value }))} placeholder="Auto or custom label" />
                                   </label>
                                   <label>
                                     Goal <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>(optional)</span>
                                     <input value={snapshotForm.target} onChange={e => setSnapshotForm(prev => ({ ...prev, target: e.target.value }))} placeholder="Leave blank" />
                                   </label>
                                   <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                     <button className="btn btn-primary btn-sm" type="button" onClick={() => handleAddSnapshotCard(selectedBrand.id)}>
                                       <i className={`fas ${editingSnapshotCardId ? 'fa-check' : 'fa-plus'}`}></i> {editingSnapshotCardId ? 'Save changes' : 'Add metric'}
                                     </button>
                                     {editingSnapshotCardId && (
                                       <button type="button" className="btn btn-ghost btn-sm" onClick={() => {
                                         setEditingSnapshotCardId('');
                                         setSnapshotForm({ label: '', fieldKey: 'segment', matchValue: '', target: '', unit: 'Leads', icon: 'fa-bullseye', color: '#8B5CF6' });
                                       }}>Cancel</button>
                                     )}
                                   </div>
                                 </div>
                                {(snapshotCards[selectedBrand.id] || []).length > 0 && (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                                    {(snapshotCards[selectedBrand.id] || []).map(card => (
                                      <button key={card.id} type="button" className="btn btn-ghost btn-sm" onClick={() => handleDeleteSnapshotCard(selectedBrand.id, card.id)} title="Remove snapshot metric">
                                        <i className="fas fa-times" style={{ color: '#ef4444' }}></i> {card.label}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </details>
                              <div className="brand-intelligence-builder">
                                <label>
                                  Breakdown title
                                  <input value={intelligenceForm.title} onChange={e => setIntelligenceForm(prev => ({ ...prev, title: e.target.value }))} placeholder="By city" />
                                </label>
                                <label>
                                  Field keys
                                  <input value={intelligenceForm.keys} onChange={e => setIntelligenceForm(prev => ({ ...prev, keys: e.target.value }))} placeholder="city, suburb" />
                                </label>
                                <label>
                                  Metric type
                                  <select value={intelligenceForm.type} onChange={e => setIntelligenceForm(prev => ({ ...prev, type: e.target.value }))}>
                                    <option value="custom">Breakdown by field value</option>
                                    <option value="field_present">Count: field filled vs missing</option>
                                    <option value="field_missing">Count: field missing</option>
                                    <option value="segment">Breakdown by segment</option>
                                    <option value="stage">Breakdown by stage</option>
                                  </select>
                                </label>
                                <button type="button" className="btn btn-primary btn-sm" onClick={() => {
                                  const keys = intelligenceForm.keys.split(',').map(key => key.trim()).filter(Boolean);
                                  if (!intelligenceForm.title.trim() || keys.length === 0) { showToast('Add a title and at least one field key.', true); return; }
                                  const nextId = editingIntelligenceId || `${selectedBrand.id}-intel-${Date.now()}`;
                                  const nextTitle = intelligenceForm.title.trim();
                                  // Re-adding / editing clears tombstones so the card can show again.
                                  setDeletedIntelligenceIds(prev => {
                                    const matchingDefaultIds = brandDefaults
                                      .filter(def =>
                                        def.id === nextId ||
                                        def.id === editingIntelligenceId ||
                                        def.keys.some(k => keys.map(x => x.toLowerCase()).includes(String(k).toLowerCase())) ||
                                        String(def.title || '').toLowerCase() === nextTitle.toLowerCase()
                                      )
                                      .map(def => def.id);
                                    const remaining = (prev[selectedBrand.id] || []).filter(
                                      id => id !== nextId && id !== editingIntelligenceId && !matchingDefaultIds.includes(id)
                                    );
                                    return { ...prev, [selectedBrand.id]: remaining };
                                  });
                                  setBrandIntelligenceBreakdowns(prev => {
                                    const base = Object.prototype.hasOwnProperty.call(prev, selectedBrand.id)
                                      ? (prev[selectedBrand.id] || [])
                                      : brandDefaults;
                                    return {
                                      ...prev,
                                      [selectedBrand.id]: editingIntelligenceId
                                        ? base.map(item => item.id === editingIntelligenceId
                                          ? { ...item, title: nextTitle, keys, type: intelligenceForm.type }
                                          : item)
                                        : [
                                            ...base,
                                            { id: nextId, title: nextTitle, keys, type: intelligenceForm.type },
                                          ],
                                    };
                                  });
                                  setIntelligenceForm({ title: '', keys: 'city', type: 'custom' });
                                  setEditingIntelligenceId('');
                                  showToast(editingIntelligenceId ? 'Breakdown updated.' : 'Breakdown added.');
                                }}><i className={`fas ${editingIntelligenceId ? 'fa-save' : 'fa-plus'}`}></i> {editingIntelligenceId ? 'Save' : 'Add breakdown'}</button>
                              </div>
                            </div>
                          )}
                        </section>
                      );
                    })()}

                    {false && selectedBrand.id === 'taskgo' && (() => {
                      const uniquePeople = new Set(leads.map(l => (l.email || l.phone || l.id).toLowerCase().trim())).size;
                      const withAbn = leads.filter(hasValidAbn).length;
                      const missingAbn = leads.filter(l => !hasValidAbn(l)).length;
                      const supportOpen = leads.filter(l => ['Support Open', 'Complaint Open', 'Login Help', 'Follow-Up Needed'].includes(l.funnel_stage)).length;
                      const groupByField = (keys: string[]) => {
                        const counts: Record<string, number> = {};
                        leads.forEach(l => {
                          const value = keys.map(k => l.custom_fields?.[k]).find(v => String(v || '').trim());
                          const label = String(value || 'Unspecified').trim();
                          counts[label] = (counts[label] || 0) + 1;
                        });
                        return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
                      };
                      const serviceBreakdown = groupByField(['service_category_name', 'service_offered', 'service_type']);
                      const issueBreakdown = groupByField(['support_type', 'issue_type', 'lead_type', 'segment']);
                      const opsCards = [
                        { label: 'Contractor roster', value: uniquePeople, icon: 'fa-users', color: '#155e75' },
                        { label: 'ABN verified', value: withAbn, icon: 'fa-id-card', color: '#10b981' },
                        { label: 'Missing ABN', value: missingAbn, icon: 'fa-triangle-exclamation', color: '#f97316' },
                        { label: 'Support follow-ups', value: supportOpen, icon: 'fa-headset', color: '#ef4444' }
                      ];
                      return (
                        <div className="taskgo-legacy-dashboard">
                          <section className="taskgo-ops-card">
                            <div className="taskgo-ops-head">
                              <div>
                                <h3><i className="fas fa-chart-pie"></i> TaskGo Operations Center</h3>
                                <p>Website handles bookings and matching. CRM tracks contractor compliance, support, complaints, login help, and follow-ups.</p>
                              </div>
                            </div>
                            <div className="taskgo-ops-grid">
                              {opsCards.map(card => (
                                <button key={card.label} type="button" onClick={() => {
                                  if (card.label === 'Missing ABN') setSelectedAbnFilter('no_abn');
                                  if (card.label === 'ABN verified') setSelectedAbnFilter('has_abn');
                                  if (card.label === 'Support follow-ups') setSelectedStageFilter('Follow-Up Needed');
                                }}>
                                  <span style={{ color: card.color, background: `${card.color}18` }}><i className={`fas ${card.icon}`}></i></span>
                                  <strong>{card.value}</strong>
                                  <small>{card.label}</small>
                                </button>
                              ))}
                            </div>
                          </section>
                          <section className="taskgo-breakdowns-card">
                            <div className="taskgo-ops-head">
                              <div>
                                <h3><i className="fas fa-layer-group"></i> TaskGo Directory & Support Breakdowns</h3>
                                <p>Quickly scan contractor services and client/support issues without changing the lead workflow.</p>
                              </div>
                            </div>
                            <div className="taskgo-breakdown-grid">
                              <div>
                                <strong>Services</strong>
                                {serviceBreakdown.map(([label, count]) => (
                                  <button key={label} type="button" onClick={() => setSelectedCustomFieldFilter({ field: 'service_category_name', value: label })}>
                                    <span>{label}</span><em>{count}</em>
                                  </button>
                                ))}
                              </div>
                              <div>
                                <strong>Support / issues</strong>
                                {issueBreakdown.map(([label, count]) => (
                                  <button key={label} type="button" onClick={() => setSelectedCustomFieldFilter({ field: 'segment', value: label })}>
                                    <span>{label}</span><em>{count}</em>
                                  </button>
                                ))}
                              </div>
                            </div>
                          </section>
                        </div>
                      );
                    })()}

                    {/* Workflow preview and follow-up guide moved into Admin builder to keep brand workspaces compact. */}

                    {false && selectedBrand.id === 'idao' && (() => {
                      const countStage = (rows: Lead[], stageNames: string[]) => rows.filter(l => stageNames.includes(getIdaoLeadStage(l))).length;
                      const trainingRows = leads.filter(l => getIdaoLeadSegment(l) === 'training_leads');
                      const referralRows = leads.filter(l => getIdaoLeadSegment(l) === 'optimaviz_referrals');
                      const otherRows = leads.filter(l => getIdaoLeadSegment(l) === 'other_services');
                      const dueRows = leads.filter(l => isFollowUpDue(l));
                      const serviceType = (lead: Lead) => String(lead.custom_fields?.service_type || lead.custom_fields?.service_focus || '');
                      const executiveCards: Array<{ title: string; icon: string; color: string; total: number; rows: Array<[string, number]> }> = [
                        { title: '3 Day Training', icon: 'fa-graduation-cap', color: '#8B5CF6', total: trainingRows.length, rows: [['Emails Sent', countStage(trainingRows, ['Email Sent'])], ['Quotes Sent', countStage(trainingRows, ['Quote Sent'])], ['Follow-Ups Due', countStage(trainingRows, ['Follow-Up Due', 'Call Follow-Up'])], ['Registered / Confirmed', countStage(trainingRows, ['Registered'])]] },
                        { title: 'Optimaviz Referrals', icon: 'fa-project-diagram', color: '#3B82F6', total: referralRows.length, rows: [['Demo Requested', countStage(referralRows, ['Demo Requested'])], ['Demo Scheduled', countStage(referralRows, ['Demo Scheduled'])], ['Passed to Optimaviz', countStage(referralRows, ['Passed to Optimaviz'])], ['Follow-Ups Due', countStage(referralRows, ['Follow-Up Due']) + referralRows.filter(l => isFollowUpDue(l)).length]] },
                        { title: 'Other Services', icon: 'fa-briefcase', color: '#10B981', total: otherRows.length, rows: [['Corporate Training', otherRows.filter(l => serviceType(l) === 'Corporate Training').length], ['Flotation Optimisation', otherRows.filter(l => serviceType(l) === 'Flotation Optimisation').length], ['Quotes Sent', countStage(otherRows, ['Quote Sent'])], ['Follow-Ups Due', countStage(otherRows, ['Follow-Up Due', 'Call Follow-Up'])]] }
                      ];
                      const pipelines: Array<{ title: string; subtitle: string; color: string; stages: string[]; rows: Lead[] }> = [
                         { title: '3 Day Training Pipeline', subtitle: 'Email → Quote → Follow-up → Registered', color: '#8B5CF6', stages: ['Email Sent', 'Quote Sent', 'Follow-Up Due', 'Registered'], rows: trainingRows },
                         { title: 'Optimaviz Referral Pipeline', subtitle: 'Interest → Demo → Passed to Optimaviz → Trial', color: '#3B82F6', stages: ['Demo Requested', 'Demo Scheduled', 'Passed to Optimaviz', 'Trial Started'], rows: referralRows },
                        { title: 'Other Services Pipeline', subtitle: 'Corporate Training and Flotation Optimisation', color: '#10B981', stages: ['Service Enquiry', 'Quote Sent', 'Follow-Up Due', 'Won'], rows: otherRows }
                      ];
                      const outreachRows: Array<[string, Lead[]]> = [
                        ['3 Day Training Outreach', trainingRows],
                        ['Optimaviz Referral Outreach', referralRows],
                        ['Corporate Training Outreach', otherRows.filter(l => serviceType(l) === 'Corporate Training')],
                        ['Flotation Optimisation Outreach', otherRows.filter(l => serviceType(l) === 'Flotation Optimisation')]
                      ];
                      return (
                        <div style={{ display: 'grid', gap: '16px', marginBottom: '20px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '14px' }}>
                            {executiveCards.map(card => (
                              <div key={card.title} style={{ background: 'var(--bg-card)', border: `1px solid ${card.color}33`, borderRadius: '16px', padding: '16px', boxShadow: 'var(--shadow-sm)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                  <span style={{ fontSize: '11px', fontWeight: 900, color: card.color, textTransform: 'uppercase', letterSpacing: '0.5px' }}><i className={`fas ${card.icon}`} style={{ marginRight: '6px' }}></i>{card.title}</span>
                                  <strong style={{ fontSize: '24px', color: 'var(--text-primary)' }}>{card.total}</strong>
                                </div>
                                <div style={{ display: 'grid', gap: '7px' }}>
                                  {card.rows.map(([label, value]) => <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)' }}><span>{label}</span><b style={{ color: 'var(--text-primary)' }}>{value}</b></div>)}
                                </div>
                              </div>
                            ))}
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
                            {pipelines.map(pipe => {
                              const max = Math.max(1, pipe.rows.length);
                              return <div key={pipe.title} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px' }}>
                                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 900, color: 'var(--text-primary)' }}>{pipe.title}</h3>
                                <p style={{ margin: '4px 0 12px', fontSize: '11px', color: 'var(--text-muted)' }}>{pipe.subtitle}</p>
                                <div style={{ display: 'grid', gap: '9px' }}>
                                  {pipe.stages.map(stage => {
                                    const count = pipe.rows.filter(l => getIdaoLeadStage(l) === stage).length;
                                    const pct = Math.round((count / max) * 100);
                                    return <div key={stage}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '4px' }}><span>{stage}</span><span>{count}</span></div>
                                      <div style={{ height: '7px', borderRadius: '999px', background: 'var(--border)', overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: pipe.color }} /></div>
                                    </div>;
                                  })}
                                </div>
                              </div>;
                            })}
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1fr) minmax(240px, 1fr)', gap: '14px' }}>
                            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px' }}>
                              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 900 }}><i className="fas fa-bell" style={{ color: '#F59E0B', marginRight: '7px' }}></i>Follow-Ups Due</h3>
                              <p style={{ margin: '6px 0 12px', color: 'var(--text-muted)', fontSize: '12px' }}>{dueRows.length} IDAO leads need attention now.</p>
                              <div style={{ display: 'grid', gap: '8px', maxHeight: '160px', overflowY: 'auto' }}>
                                {dueRows.slice(0, 6).map(l => <button key={l.id} type="button" onClick={() => { setActiveLead(l); loadLeadDetailsHistory(l.id); }} style={{ textAlign: 'left', border: '1px solid var(--border)', background: 'var(--bg-base)', borderRadius: '10px', padding: '9px', cursor: 'pointer' }}><strong style={{ fontSize: '12px' }}>{l.name}</strong><div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{getIdaoLeadStage(l)} • {l.follow_up_date || 'No date'}</div></button>)}
                                {dueRows.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No overdue IDAO follow-ups.</span>}
                              </div>
                            </div>
                            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px' }}>
                              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 900 }}><i className="fas fa-chart-simple" style={{ color: '#10B981', marginRight: '7px' }}></i>Outreach by Segment</h3>
                              <p style={{ margin: '6px 0 12px', color: 'var(--text-muted)', fontSize: '12px' }}>Simple tracking for mining outreach and service follow-ups.</p>
                              <div style={{ display: 'grid', gap: '8px' }}>
                                {outreachRows.map(([label, rows]) => <div key={label} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '7px', fontSize: '12px' }}><span>{label}</span><b>{rows.length}</b></div>)}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {(() => {
                      const segmentOptions = getBrandSegmentOptions(selectedBrand.id) || [];
                      const currentStages = getStageFilterOptions();
                      // Stage chips only reflect the active verified/prospect pool
                      const poolLeads = filterLeadsByClassification(leads, leadClassificationTab);
                      const stageHasLeads = (stage: string) => poolLeads.some(lead => {
                        const leadStage = selectedBrand.id === 'optimaviz' ? getOptimavizLeadStage(lead) : selectedBrand.id === 'idao' ? getIdaoLeadStage(lead) : lead.funnel_stage;
                        return leadStage === stage;
                      });
                      const visibleStageOptions = currentStages.filter(stageHasLeads);
                      const stageOptionsForFilter = visibleStageOptions.length ? visibleStageOptions : currentStages;
                      const hasActiveLeadFilters = Boolean(
                        searchQuery ||
                        leadFocusFilter ||
                        selectedSegmentFilter !== 'all' ||
                        selectedStageFilter !== 'all' ||
                        selectedCityFilter !== 'all' ||
                        selectedServiceFilter !== 'all' ||
                        selectedAbnFilter !== 'all' ||
                        selectedDateWindow !== 'all' ||
                        selectedDateFrom ||
                        selectedDateTo ||
                        selectedCustomFieldFilter ||
                        Object.keys(activeSpotlightFilters).length > 0
                      );
                      return (
                        <div
                          className="compact-lead-workspace-toolbar is-sticky is-filters-only"
                          style={{ ['--toolbar-accent' as string]: selectedBrand.color }}
                        >
                          <label>
                            Segment
                            <select className="brand-aware-select" value={selectedSegmentFilter} onChange={e => { setSelectedSegmentFilter(e.target.value); setSelectedStageFilter('all'); setLeadFocusFilter(null); }}>
                              <option value="all">All segments</option>
                              {segmentOptions.map(seg => <option key={seg.value} value={seg.value}>{seg.label}</option>)}
                            </select>
                          </label>
                          <label>
                            Stage
                            <select className="brand-aware-select" value={selectedStageFilter} onChange={e => { setSelectedStageFilter(e.target.value); setLeadFocusFilter(null); }}>
                              <option value="all">All stages</option>
                              {stageOptionsForFilter.map(stage => <option key={stage} value={stage}>{stage}</option>)}
                            </select>
                          </label>
                           <label className="lead-search-field">
                             Search
                             <input
                               value={searchQuery}
                               onChange={e => setSearchQuery(e.target.value)}
                               placeholder="Name, email, phone, notes..."
                               autoComplete="off"
                               spellCheck={false}
                             />
                           </label>
                           {(() => {
                             const isCustomDate =
                               selectedDateWindow !== 'all' ||
                               Boolean(selectedDateFrom || selectedDateTo);
                             const customLabel =
                               selectedDateFrom || selectedDateTo
                                 ? [selectedDateFrom || '…', selectedDateTo || '…'].join(' – ')
                                 : DATE_WINDOW_OPTIONS.find(o => o.value === selectedDateWindow && o.value !== 'all')?.label || 'Custom';
                             return (
                               <div className="lead-date-filter" role="group" aria-label="Lead date filter">
                                 <div className="date-window-control date-window-control--simple">
                                   <button
                                     type="button"
                                     className={!isCustomDate ? 'active' : ''}
                                     onClick={() => {
                                       setSelectedDateWindow('all');
                                       setSelectedDateFrom('');
                                       setSelectedDateTo('');
                                       setLeadFocusFilter(null);
                                     }}
                                   >
                                     All dates
                                   </button>
                                   <details className={`lead-date-custom${isCustomDate ? ' is-active' : ''}`}>
                                     <summary title="Filter by period or custom range">
                                       <i className="fas fa-calendar-days" aria-hidden />
                                       <span>{isCustomDate ? customLabel : 'Custom'}</span>
                                       <i className="fas fa-chevron-down lead-date-custom__chevron" aria-hidden />
                                     </summary>
                                     <div className="lead-date-custom__panel">
                                       <div className="lead-date-custom__presets">
                                         {DATE_WINDOW_OPTIONS.filter(opt => opt.value !== 'all').map(opt => (
                                           <button
                                             key={opt.value}
                                             type="button"
                                             className={
                                               !selectedDateFrom &&
                                               !selectedDateTo &&
                                               selectedDateWindow === opt.value
                                                 ? 'active'
                                                 : ''
                                             }
                                             onClick={() => {
                                               setSelectedDateWindow(opt.value);
                                               setSelectedDateFrom('');
                                               setSelectedDateTo('');
                                               setLeadFocusFilter(null);
                                             }}
                                           >
                                             {opt.label}
                                           </button>
                                         ))}
                                       </div>
                                       <div className="lead-date-filter__range">
                                         <input
                                           type="date"
                                           value={selectedDateFrom}
                                           onChange={e => {
                                             setSelectedDateFrom(e.target.value);
                                             setSelectedDateWindow('all');
                                             setLeadFocusFilter(null);
                                           }}
                                           aria-label="Lead date from"
                                         />
                                         <span>to</span>
                                         <input
                                           type="date"
                                           value={selectedDateTo}
                                           onChange={e => {
                                             setSelectedDateTo(e.target.value);
                                             setSelectedDateWindow('all');
                                             setLeadFocusFilter(null);
                                           }}
                                           aria-label="Lead date to"
                                         />
                                       </div>
                                       {isCustomDate && (
                                         <button
                                           type="button"
                                           className="lead-date-custom__clear"
                                           onClick={() => {
                                             setSelectedDateFrom('');
                                             setSelectedDateTo('');
                                             setSelectedDateWindow('all');
                                           }}
                                         >
                                           Clear date filter
                                         </button>
                                       )}
                                     </div>
                                   </details>
                                 </div>
                               </div>
                             );
                           })()}
                           <div className="compact-density-toggle" role="group" aria-label="Lead density">
                            {(['comfortable', 'compact'] as const).map(mode => (
                              <button
                                key={mode}
                                type="button"
                                className={dashboardDensity === mode ? 'active' : ''}
                                onClick={() => setDashboardDensity(mode)}
                                title={mode === 'compact' ? 'Dense rows' : 'Comfortable rows'}
                              >
                                <i className={`fas ${mode === 'compact' ? 'fa-compress' : 'fa-expand'}`} aria-hidden />
                                <span>{mode === 'compact' ? 'Dense' : 'Comfy'}</span>
                              </button>
                            ))}
                          </div>
                          <div
                            className="compact-view-toggle"
                            role="group"
                            aria-label="Lead view"
                            style={{ ['--view-accent' as string]: selectedBrand.color }}
                          >
                            {(['table', 'kanban'] as const).map(view => (
                              <button key={view} type="button" onClick={() => setLeadWorkspaceView(view)} className={`${view} ${leadWorkspaceView === view ? 'active' : ''}`}>
                                <i className={`fas ${view === 'table' ? 'fa-table-list' : 'fa-columns'}`} aria-hidden />
                                <span>{view === 'table' ? 'Table' : 'Kanban'}</span>
                              </button>
                            ))}
                          </div>
                          {hasActiveLeadFilters && (
                            <button type="button" className="btn btn-ghost btn-sm lead-toolbar-clear" onClick={clearLeadTableFilters} title="Reset search and filters">
                              <i className="fas fa-filter-circle-xmark"></i> Clear
                            </button>
                          )}
                          {leadFocusFilter && (
                            <em className="lead-focus-chip" title="Opened from dashboard metric">
                              <i className="fas fa-bullseye"></i> {leadFocusFilter}
                              <button type="button" aria-label="Clear focus filter" onClick={() => { setLeadFocusFilter(null); clearLeadTableFilters(); }}>×</button>
                            </em>
                          )}
                        </div>
                      );
                    })()}


                    {leadWorkspaceView === 'kanban' && (() => {
                      const getWorkspaceLeadSegment = (lead: Lead) => selectedBrand.id === 'optimaviz'
                        ? getOptimavizLeadSegment(lead)
                        : selectedBrand.id === 'idao'
                          ? getIdaoLeadSegment(lead)
                          : String(lead.custom_fields?.segment || lead.custom_fields?.lead_type || '');
                      const activeSegment = selectedSegmentFilter === 'all'
                        ? ''
                        : (selectedBrand.id === 'optimaviz' ? normalizeOptimavizSegmentValue(selectedSegmentFilter) : selectedBrand.id === 'idao' ? normalizeIdaoSegmentValue(selectedSegmentFilter) : selectedSegmentFilter);
                      const baseColumns = selectedBrand.id === 'optimaviz'
                        ? getOptimavizStageOptionsForSegment(activeSegment || 'demo_leads')
                        : selectedBrand.id === 'idao'
                          ? getIdaoStageOptionsForSegment(activeSegment || 'training_leads')
                          : getStageFilterOptions();
                      const normalizeKanbanStage = (value: unknown) => String(value || '').trim().toLowerCase();
                      const actualStages = filteredSortedLeads
                        .filter(l => !activeSegment || getWorkspaceLeadSegment(l) === activeSegment)
                        .map(l => selectedBrand.id === 'optimaviz'
                          ? getOptimavizLeadStage(l)
                          : selectedBrand.id === 'idao'
                            ? getIdaoLeadStage(l)
                            : (l.funnel_stage || l.custom_fields?.stage || l.custom_fields?.pipeline_stage || l.custom_fields?.status || 'New Intake'))
                        .map(stage => String(stage || '').trim())
                        .filter(Boolean);
                      const columns = Array.from(new Map([...baseColumns, ...actualStages].map(stage => [normalizeKanbanStage(stage), stage])).values());
                      const resolveKanbanStage = (lead: Lead) => {
                        const rawStage = selectedBrand.id === 'optimaviz'
                          ? getOptimavizLeadStage(lead)
                          : selectedBrand.id === 'idao'
                            ? getIdaoLeadStage(lead)
                            : (lead.funnel_stage || lead.custom_fields?.stage || lead.custom_fields?.pipeline_stage || lead.custom_fields?.status || '');
                        const normalized = normalizeKanbanStage(rawStage);
                        const exactColumn = columns.find(stage => normalizeKanbanStage(stage) === normalized);
                        if (exactColumn) return exactColumn;
                        const fuzzyColumn = columns.find(stage => normalized && (normalizeKanbanStage(stage).includes(normalized) || normalized.includes(normalizeKanbanStage(stage))));
                        return fuzzyColumn || columns[0] || String(rawStage || 'New Lead');
                      };
                      const kanbanSearch = kanbanSearchQuery.trim().toLowerCase();
                      const kanbanLeads = filteredSortedLeads
                        .filter(l => !activeSegment || getWorkspaceLeadSegment(l) === activeSegment)
                        .filter(l => {
                          if (!kanbanSearch) return true;
                          return [
                            l.name,
                            l.email,
                            l.phone,
                            (l as any).organisation,
                            (l as any).organization,
                            l.custom_fields?.organisation,
                            l.custom_fields?.organization,
                            l.custom_fields?.next_action,
                            l.custom_fields?.service_type,
                            l.notes,
                          ].some(value => String(value || '').toLowerCase().includes(kanbanSearch));
                        });
                      const defaultLimit = 10;
                      return (
                        <div className={`kanban-compact-shell is-density-${dashboardDensity}`}>
                          <div className="kanban-compact-summary">
                            <span>{kanbanLeads.length} matching lead{kanbanLeads.length === 1 ? '' : 's'}</span>
                            {(kanbanSearch || searchQuery) && <button type="button" onClick={() => { setKanbanSearchQuery(''); setSearchQuery(''); }}>Clear search</button>}
                          </div>
                          <div className="kanban-compact-board">
                          {columns.map(stage => {
                            const stageLeads = kanbanLeads.filter(l => resolveKanbanStage(l) === stage);
                            const color = getStageColor(stage);
                            const key = `${selectedBrand.id}:${activeSegment}:${stage}`;
                            const limit = kanbanColumnLimits[key] || defaultLimit;
                            const visibleLeads = stageLeads.slice(0, limit);
                            const hasMore = stageLeads.length > visibleLeads.length;
                            return <div key={stage} className="kanban-compact-column" onDragOver={e => e.preventDefault()} onDrop={e => { const leadId = e.dataTransfer.getData('text/plain'); const lead = leads.find(l => l.id === leadId); if (lead) updateLeadStageAndDefaults(lead, stage); }} style={{ borderColor: `${color}44` }}>
                              <div className="kanban-compact-column__header">
                                <strong style={{ color }}>{stage}</strong>
                                <span style={{ background: `${color}18`, color, borderColor: `${color}44` }}>{stageLeads.length}</span>
                              </div>
                              <div className="kanban-compact-cards">
                                {visibleLeads.map(lead => { const trial = selectedBrand.id === 'optimaviz' ? getOptimavizTrialInfo(lead) : null; return <div key={lead.id} className="kanban-compact-card" draggable onDragStart={e => e.dataTransfer.setData('text/plain', lead.id)} onClick={() => { setActiveLead(lead); loadLeadDetailsHistory(lead.id); }}>
                                  <div className="kanban-compact-card__top">
                                    <strong>{lead.name}</strong>
                                    {lead.follow_up_date && <span className={isFollowUpDue(lead) ? 'is-overdue' : ''}>{lead.follow_up_date}</span>}
                                  </div>
                                  <small>{lead.email || lead.phone || 'No contact'}</small>
                                  {selectedBrand.id === 'idao' && <em>{lead.custom_fields?.service_type || lead.custom_fields?.service_focus || 'No service type'}</em>}
                                  {lead.custom_fields?.next_action && <p>{lead.custom_fields.next_action}</p>}
                                  {trial?.isTrialLead && <div className="kanban-trial-progress"><b style={{ color: trial.color }}>{trial.daysRemaining} days left</b><i><span style={{ width: `${trial.progress}%`, background: trial.color }} /></i></div>}
                                </div>; })}
                                {stageLeads.length === 0 && <div className="kanban-empty-column">{kanbanSearch ? 'No matches' : 'Drop leads here'}</div>}
                              </div>
                              {stageLeads.length > defaultLimit && (
                                <div className="kanban-compact-column__footer">
                                  {hasMore ? <button type="button" onClick={() => setKanbanColumnLimits(prev => ({ ...prev, [key]: Math.min(stageLeads.length, limit + defaultLimit) }))}>See {Math.min(defaultLimit, stageLeads.length - visibleLeads.length)} more</button> : <button type="button" onClick={() => setKanbanColumnLimits(prev => ({ ...prev, [key]: defaultLimit }))}>Collapse to 10</button>}
                                </div>
                              )}
                            </div>;
                          })}
                          </div>
                        </div>
                      );
                    })()}

                     {/* MOBILE CARD VIEW — shown via CSS on screens ≤ 768px */}
                    <div className={`lead-card-list is-density-${dashboardDensity}`}>
                      {tableDisplayLeads.length === 0 ? (
                        <div className="empty-state">
                          <div className="empty-state__icon" style={{ background: `color-mix(in srgb, ${selectedBrand.color} 12%, var(--bg-base))`, color: selectedBrand.color }}>
                            <i className={`fas ${leads.length === 0 ? 'fa-user-plus' : 'fa-filter-circle-xmark'}`}></i>
                          </div>
                          <p className="empty-state__title">{leads.length === 0 ? 'No leads yet' : 'No leads match your filters'}</p>
                          <p className="empty-state__desc">
                            {leads.length === 0
                              ? 'Add your first lead or import a CSV to start this brand pipeline.'
                              : 'Try adjusting search, segment, or stage — or clear filters to see everything again.'}
                          </p>
                          <div className="empty-state__actions">
                            {leads.length === 0 ? (
                              <>
                                <button type="button" className="btn btn-primary" style={{ background: selectedBrand.color }} onClick={() => setAddLeadIsOpen(true)}>
                                  <i className="fas fa-plus"></i> Add lead
                                </button>
                                <button type="button" className="btn btn-ghost" onClick={openImportModal}>
                                  <i className="fas fa-upload"></i> Import CSV
                                </button>
                              </>
                            ) : (
                              <button type="button" className="btn btn-ghost" onClick={clearLeadTableFilters}>
                                <i className="fas fa-filter-circle-xmark"></i> Clear filters
                              </button>
                            )}
                          </div>
                        </div>
                      ) : tableDisplayLeads.map(lead => {
                        const due = isFollowUpDue(lead);
                        const followLabel = due ? getFollowUpLabel(lead) : null;
                        return (
                          <div key={lead.id} className="lead-card" onClick={() => setActiveLead(lead)}>
                            <div className="lead-card__top">
                              <span className="lead-card__name">{lead.name || '(No name)'}</span>
                              {lead.stage && <span className="lead-card__stage">{lead.stage}</span>}
                            </div>
                            <div className="lead-card__contact">
                              {lead.email && <span><i className="fas fa-envelope"></i>{lead.email}</span>}
                              {lead.phone && <span><i className="fas fa-phone"></i>{lead.phone}</span>}
                              {lead.city && <span><i className="fas fa-location-dot"></i>{lead.city}</span>}
                            </div>
                            {followLabel && (
                              <div className={`lead-card__followup ${followLabel.label?.toLowerCase().startsWith('overdue') ? 'overdue' : ''}`}>
                                <i className="fas fa-clock"></i> {followLabel.label}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                     {/* TABLE FRAME */}
                    <div className={`lead-table-frame is-density-${dashboardDensity}`} style={{ display: leadWorkspaceView === 'kanban' ? 'none' : undefined }}>
                      <div className="lead-table-toolbar">
                        <div className="lead-table-toolbar__status">
                          <strong>{tableDisplayLeads.length} visible</strong>
                          <span>{selectedLeadIds.size ? `${selectedLeadIds.size} selected` : 'Select rows for bulk actions'}</span>
                        </div>
                        {selectedLeadIds.size > 0 && (
                          <div className="lead-table-bulk-actions">
                            <button type="button" className="btn btn-primary" onClick={() => setBulkEditOpen(true)} style={{ background: selectedBrand.color }}>
                              <i className="fas fa-pen-to-square"></i> Bulk Edit
                            </button>
                            <button type="button" className="btn btn-ghost" onClick={() => setBulkEmailModalOpen(true)}>
                              <i className="fas fa-envelope"></i> Email
                            </button>
                            <button type="button" className="btn btn-ghost" onClick={() => setBulkWhatsAppModalOpen(true)}>
                              <i className="fab fa-whatsapp"></i> WhatsApp
                            </button>
                             <button type="button" className="btn btn-danger" onClick={handleBulkDeleteSelectedLeads}>
                               <i className="fas fa-trash"></i> Delete
                             </button>
                             <button type="button" className="btn btn-ghost" onClick={() => handleBulkTogglePool(leadClassificationTab === 'verified' ? 'prospect' : 'verified')}>
                               <i className={leadClassificationTab === 'verified' ? 'fas fa-rocket' : 'fas fa-check-circle'}></i>
                               {leadClassificationTab === 'verified' ? 'Move to Prospects' : 'Move to Verified'}
                             </button>
                             <button type="button" className="btn btn-ghost" onClick={() => setSelectedLeadIds(new Set())}>Clear</button>
                           </div>
                        )}
                        <div className="product-views-strip" role="toolbar" aria-label="Product views">
                          <span className="product-views-strip__label"><i className="fas fa-bolt"></i> Views</span>
                          <button
                            type="button"
                            className={activeProductView === 'hot-unassigned' ? 'active' : ''}
                            onClick={() => applyProductView('hot-unassigned')}
                            title="Verified leads with no owner"
                          >
                            <i className="fas fa-fire"></i> Hot · no owner
                          </button>
                          <button
                            type="button"
                            className={activeProductView === 'cross-sell' ? 'active' : ''}
                            onClick={() => applyProductView('cross-sell')}
                            title="Leads that look ready for another brand"
                          >
                            <i className="fas fa-shuffle"></i> Cross-sell
                          </button>
                          <button
                            type="button"
                            className={activeProductView === 'needs-reply' ? 'active' : ''}
                            onClick={() => applyProductView('needs-reply')}
                            title="Open Action Inbox for emails needing reply"
                          >
                            <i className="fas fa-reply"></i> Needs reply
                          </button>
                          {activeProductView && (
                            <button type="button" className="product-views-strip__clear" onClick={() => { setActiveProductView(null); }} title="Clear product view">
                              Clear view
                            </button>
                          )}
                        </div>
                        <div className="lead-table-toolbar__tools">
                          <button type="button" className="btn btn-ghost" onClick={() => setManageColsIsOpen(true)} title="Show, hide, add, edit, or delete columns for this brand">
                            <i className="fas fa-columns"></i> Manage Columns
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => setLeadBadgesSettingsOpen(true)}
                            title="Create custom lead tags for this brand (Business, multi-service, free trial, gender, …)"
                          >
                            <i className="fas fa-tags"></i> Lead Tags
                          </button>
                          <button type="button" className="btn btn-ghost" onClick={openImportModal} title="Import leads from an Excel or CSV file">
                            <i className="fas fa-upload"></i> Import
                          </button>
                          <button type="button" className="btn btn-ghost" onClick={handleExportToExcel} disabled={tableDisplayLeads.length === 0} title={tableDisplayLeads.length === 0 ? 'No leads to export' : 'Export the visible leads to an Excel (.xlsx) file'}>
                            <i className="fas fa-file-export"></i> Export
                          </button>
                        </div>
                        <div className="column-scroll-controls" aria-label="Scroll table columns">
                          <span className="column-scroll-label">Columns</span>
                          <button
                            type="button"
                            className="column-scroll-btn"
                            onClick={() => leadTableScrollRef.current?.scrollBy({ left: -320, behavior: 'smooth' })}
                            title="Scroll columns left"
                          >
                            <i className="fas fa-chevron-left"></i>
                          </button>
                          <button
                            type="button"
                            className="column-scroll-btn"
                            onClick={() => leadTableScrollRef.current?.scrollBy({ left: 320, behavior: 'smooth' })}
                            title="Scroll columns right"
                          >
                            <i className="fas fa-chevron-right"></i>
                          </button>
                        </div>
                      </div>
                       {(selectedSegmentFilter !== 'all' || selectedStageFilter !== 'all' || selectedCityFilter !== 'all' || selectedServiceFilter !== 'all' || selectedAbnFilter !== 'all' || selectedDateWindow !== 'all' || selectedDateFrom || selectedDateTo || selectedCustomFieldFilter || Object.keys(activeSpotlightFilters).length > 0) && (
                         <div className="lead-active-filter-strip">
                           <span><i className="fas fa-filter"></i> Showing filtered leads</span>
                           {selectedSegmentFilter !== 'all' && <em>Segment: {formatColumnLabel(selectedSegmentFilter)}</em>}
                           {selectedStageFilter !== 'all' && <em>Stage: {selectedStageFilter}</em>}
                           {selectedCityFilter !== 'all' && <em>City: {selectedCityFilter}</em>}
                           {selectedServiceFilter !== 'all' && <em>Service: {selectedServiceFilter}</em>}
                           {selectedAbnFilter !== 'all' && <em>ABN: {selectedAbnFilter === 'has_abn' ? 'Has ABN' : 'No ABN'}</em>}
                           {selectedDateWindow !== 'all' && <em>Date: {selectedDateWindow}</em>}
                           {selectedDateFrom && <em>From: {selectedDateFrom}</em>}
                           {selectedDateTo && <em>To: {selectedDateTo}</em>}
                           {selectedCustomFieldFilter && <em>{formatColumnLabel(selectedCustomFieldFilter.field)}: {selectedCustomFieldFilter.value === '__filled__' ? 'has value' : selectedCustomFieldFilter.value === '__missing__' ? 'missing' : selectedCustomFieldFilter.value}</em>}
                           {Object.entries(activeSpotlightFilters).map(([key, value]) => <em key={key}>{formatColumnLabel(key)}: {value}</em>)}
                           <button type="button" onClick={clearLeadTableFilters}>Reset all leads</button>
                         </div>
                       )}
                      <ScrollArea.Root className="ScrollAreaRoot">
                        <ScrollArea.Viewport 
                          className="ScrollAreaViewport" 
                          ref={leadTableScrollRef}
                        >
                        <LeadDataTable
                          columns={leadTableColumns}
                          brand={{ id: selectedBrand.id, name: selectedBrand.name, color: selectedBrand.color }}
                          leads={tableDisplayLeads}
                          totalLeadCount={leads.length}
                          customFields={getTableCustomFields()}
                          selectedLeadIds={selectedLeadIds}
                          activeLeadId={activeLead?.id}
                          hoveredLeadId={hoveredLeadId}
                          onHoverLead={setHoveredLeadId}
                          onToggleLeadSelect={(leadId) => {
                            const next = new Set(selectedLeadIds);
                            if (next.has(leadId)) next.delete(leadId);
                            else next.add(leadId);
                            setSelectedLeadIds(next);
                          }}
                          allSelected={tableDisplayLeads.length > 0 && tableDisplayLeads.every(l => selectedLeadIds.has(l.id))}
                          onToggleSelectAll={(checked) => {
                            if (checked) {
                              setSelectedLeadIds(new Set([...selectedLeadIds, ...tableDisplayLeads.map(l => l.id)]));
                            } else {
                              const next = new Set(selectedLeadIds);
                              tableDisplayLeads.forEach(l => next.delete(l.id));
                              setSelectedLeadIds(next);
                            }
                          }}
                          editingCell={editingCell}
                          editingCellValue={editingCellValue}
                          onEditingCellValueChange={setEditingCellValue}
                          onStartEditingCell={startEditingCell}
                          onSaveEditingCell={saveEditingCell}
                          onCellKeyDown={handleCellKeyDown}
                          onSort={handleSortColToggle}
                          onColumnReorder={reorderLeadTableColumns}
                          renderSortIndicator={renderSortIndicator}
                          getLeadStage={(l) =>
                            selectedBrand.id === 'optimaviz'
                              ? getOptimavizLeadStage(l)
                              : selectedBrand.id === 'idao'
                                ? getIdaoLeadStage(l)
                                : l.funnel_stage
                          }
                          getLeadSegment={(l) =>
                            selectedBrand.id === 'optimaviz'
                              ? getOptimavizLeadSegment(l)
                              : selectedBrand.id === 'idao'
                                ? getIdaoLeadSegment(l)
                                : (l.custom_fields?.segment || '')
                          }
                          getStageOptionsForLead={getStageOptionsForLead}
                          getStageColor={getStageColor}
                          segmentOptions={(getBrandSegmentOptions(selectedBrand.id) || []).map(seg => ({
                            value: seg.value,
                            label: seg.label,
                          }))}
                          renderSegmentPill={(seg, lead) => renderLeadSegmentPill(seg || '', lead)}
                          getLeadBadges={getLeadBadgesFor}
                          getAudienceMatch={getLeadAudienceMatch}
                          getTrialInfo={selectedBrand.id === 'optimaviz' ? getOptimavizTrialInfo : undefined}
                          trialDays={OPTIMAVIZ_TRIAL_DAYS}
                          getLeadDateLabel={getLeadDateLabel}
                          normalizeFieldValue={normalizeFieldValue}
                          onOpenLead={(l) => {
                            setActiveLead(l);
                            loadLeadDetailsHistory(l.id);
                          }}
                          onEmailLead={(l) => {
                            setActiveLead(l);
                            setSelectedBrandForEmail(selectedBrand);
                            setActiveEmailLead(l);
                            setEmailSubject(`Hi ${l.name.split(' ')[0]} - Update from ${selectedBrand.name}`);
                            setEmailContent('');
                            setEmailTemplateSel('');
                            loadLeadDetailsHistory(l.id);
                            setActiveTab('email-tracking');
                          }}
                          onWhatsAppLead={(l) => {
                            setActiveLead(l);
                            loadLeadDetailsHistory(l.id);
                            setTimeout(() => setWaModalOpen(true), 50);
                          }}
                          onCallLead={(l) => {
                            setActiveLead(l);
                            loadLeadDetailsHistory(l.id);
                            setTimeout(() => setCallModalOpen(true), 50);
                          }}
                          onAddLead={() => setAddLeadIsOpen(true)}
                          onImport={openImportModal}
                          onClearFilters={clearLeadTableFilters}
                        />
                    </ScrollArea.Viewport>
                    <ScrollArea.Scrollbar className="ScrollAreaScrollbar" orientation="horizontal">
                      <ScrollArea.Thumb className="ScrollAreaThumb" style={{ backgroundColor: selectedBrand?.color || 'var(--accent)' }} />
                    </ScrollArea.Scrollbar>
                    <ScrollArea.Corner />
                  </ScrollArea.Root>



                </div>

              </div>

                  {/* LEAD DETAILS MODAL */}
                  {activeLead && (
                    <div className="modal-overlay" onClick={() => setActiveLead(null)}>
                      <div className="modal-content lead-detail-modal-compact" style={{ maxWidth: '860px', width: 'min(94vw, 860px)', maxHeight: '88vh' }} onClick={e => e.stopPropagation()}>
                       <div className="lead-detail-modal-head">
                         <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                           <div className="lead-detail-avatar" style={{ background: `oklch(from ${selectedBrand.color} l c h / 0.15)`, color: selectedBrand.color }}>
                             {activeLead.name.charAt(0)}
                           </div>
                            <div style={{ minWidth: 0 }}>
                              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {activeLead.name}
                                <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '10px', background: (activeLead as any).lead_classification === 'prospect' ? '#fef3c7' : '#d1fae5', color: (activeLead as any).lead_classification === 'prospect' ? '#92400e' : '#065f46', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                  {(activeLead as any).lead_classification === 'prospect' ? '🌱 Prospect' : '✅ Verified'}
                                </span>
                              </h3>
                              <span>Lead {getLeadDateLabel(activeLead) || 'Not set'}</span>
                            </div>
                         </div>
                         <button className="lead-detail-close" onClick={() => setActiveLead(null)}>&times;</button>
                       </div>

                      {/* Configurable multi-opportunity / duplicate banners + type pills */}
                      <LeadBadgeDetailBanners badges={getLeadBadgesFor(activeLead)} />
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                        <LeadBadgePills badges={getLeadBadgesFor(activeLead)} placement="after_name" size="md" />
                        <LeadBadgePills badges={getLeadBadgesFor(activeLead)} placement="detail_only" size="md" />
                      </div>

                      <label className="lead-detail-dnc" style={{ background: (activeLead.custom_fields?.do_not_contact === true || String(activeLead.custom_fields?.do_not_contact).toLowerCase() === 'true') ? 'rgba(239,68,68,0.10)' : 'var(--bg-base)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)' }}>
                          <i className="fas fa-ban" style={{ color: '#ef4444' }}></i> Do Not Contact
                        </span>
                        <input
                          type="checkbox"
                          checked={activeLead.custom_fields?.do_not_contact === true || String(activeLead.custom_fields?.do_not_contact).toLowerCase() === 'true'}
                          onChange={e => {
                            const prevFields = activeLead.custom_fields || {};
                            handleUpdateLeadField('custom_fields', { ...prevFields, do_not_contact: e.target.checked });
                          }}
                        />
                      </label>

                      {/* Send interactive communications proxy */}
                      <div className="lead-details-actions">
                        <button className="btn btn-primary btn-sm" onClick={() => {
                          setSelectedBrandForEmail(selectedBrand);
                          setActiveEmailLead(activeLead);
                          setEmailSubject(`Hi ${activeLead.name.split(' ')[0]} - Update from ${selectedBrand.name}`);
                          setEmailContent('');
                          setEmailTemplateSel('');
                          setActiveTab('email-tracking');
                        }} style={{ background: selectedBrand.color, fontSize: '11px', padding: '6px 10px' }}>
                          <i className="fas fa-envelope"></i> Email
                        </button>
                        <button className="btn btn-sm" onClick={() => setWaModalOpen(true)} style={{ background: '#25D366', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', padding: '6px 10px' }}>
                          <i className="fab fa-whatsapp"></i> WhatsApp
                        </button>
                        {activeLead.phone && (
                          <button className="btn btn-sm" onClick={() => handleStartSimulatedCall(activeLead)} style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', padding: '6px 10px' }}>
                            <i className="fas fa-phone-alt"></i> Call
                          </button>
                        )}
                        <button className="btn btn-ghost btn-sm" onClick={() => setCallModalOpen(true)} style={{ fontSize: '11px', padding: '6px 10px' }}>
                          <i className="fas fa-history"></i> Log
                        </button>
                      </div>

                      {/* Prospect → Verified Lead Conversion Button */}
                      {(activeLead as any).lead_classification === 'prospect' && (
                        <div style={{ padding: '8px 12px', marginBottom: '8px', background: 'linear-gradient(135deg, #fef3c7, #fde68a)', border: '1px solid #f59e0b', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <i className="fas fa-arrow-right" style={{ color: '#d97706' }}></i>
                          <span style={{ fontSize: '12px', fontWeight: '600', color: '#92400e', flex: 1 }}>This is a Prospect</span>
                          <button className="btn btn-sm" onClick={() => {
                            const reason = prompt('Reason for conversion (optional):');
                            handleConvertProspect(activeLead.id, reason || undefined);
                          }} style={{ background: '#d97706', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', padding: '4px 12px', fontWeight: '600' }}>
                            <i className="fas fa-check-circle" style={{ marginRight: '4px' }}></i> Convert to Verified
                          </button>
                        </div>
                      )}

                      <div className="lead-detail-tabs lead-detail-tabs--compact" role="tablist" aria-label="Lead details sections">
                        {([
                          ['overview', 'Overview', 'fa-address-card'],
                          ['activity', 'Lead Control', 'fa-route'],
                          ['communication', 'Comms Log', 'fa-comments'],
                        ] as const).map(([tab, label, icon]) => (
                          <button
                            key={tab}
                            type="button"
                            role="tab"
                            aria-selected={leadDetailTab === tab}
                            className={leadDetailTab === tab ? 'active' : ''}
                            onClick={() => setLeadDetailTab(tab)}
                          >
                            <i className={`fas ${icon}`}></i>
                            <span>{label}</span>
                          </button>
                        ))}
                      </div>

                      {/* Fields editable card */}
                      {leadDetailTab === 'overview' && (
                      <div className="lead-details-info lead-details-info--compact">
                        {(() => {
                          const insight = getLeadIntelligence(activeLead);
                          return (
                            <div className="lead-ai-summary-card" style={{ ['--lead-ai-tone' as any]: insight.tone }}>
                              <div className="lead-ai-summary-card__head">
                                <div>
                                  <span className="lead-ai-summary-card__eyebrow">
                                    <i className="fas fa-wand-magic-sparkles"></i> DirotiQ AI Summary
                                  </span>
                                  <h4 className="lead-ai-summary-card__title">Recommended focus: {insight.label}</h4>
                                </div>
                                <span className="lead-ai-summary-card__score">
                                  <i className={`fas ${insight.icon}`}></i>
                                  {insight.score}/100
                                </span>
                              </div>
                              <p>{insight.summary}</p>
                              <div className="lead-ai-summary-card__action">
                                <i className={`${insight.actionIcon.includes('fab') ? 'fab' : 'fas'} ${insight.actionIcon.replace('fab ', '').replace('fas ', '')}`}></i>
                                <div>
                                  <strong>Next best action: {insight.actionLabel}</strong>
                                  <span>{insight.nextAction}</span>
                                </div>
                              </div>
                              <div className="lead-ai-summary-card__metrics">
                                {insight.metrics.map(metric => (
                                  <div key={metric.label}>
                                    <span>{metric.label}</span>
                                    <strong>{metric.value}</strong>
                                  </div>
                                ))}
                              </div>
                              <div className="lead-ai-summary-card__reasons" aria-label="Why this recommendation matters">
                                {insight.reasons.map(reason => (
                                  <span key={reason}><i className="fas fa-check"></i>{reason}</span>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                        
                        <div className="info-row">
                          <span className="info-label">Funnel Stage</span>
                          <select 
                            value={activeLead.funnel_stage} 
                            onChange={e => ['optimaviz', 'idao'].includes(selectedBrand.id) ? updateLeadStageAndDefaults(activeLead, e.target.value) : handleUpdateLeadField('funnel_stage', e.target.value)}
                          >
                            {getStageOptionsForLead(activeLead).map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>

                        <div className="info-row">
                          <span className="info-label">Phone</span>
                          <input 
                            type="text" 
                            value={activeLead.phone} 
                            onChange={e => handleUpdateLeadField('phone', e.target.value)}
                          />
                        </div>

                        <div className="info-row">
                          <span className="info-label">Email</span>
                          <input 
                            type="email" 
                            value={activeLead.email} 
                            onChange={e => handleUpdateLeadField('email', e.target.value)}
                          />
                        </div>

                        <div className="info-row">
                          <span className="info-label">Assignee Owner</span>
                          <select 
                            value={activeLead.owner_id || ''} 
                            onChange={e => {
                              const selId = e.target.value;
                              const selUser = usersList.find(u => u.id === selId);
                              handleUpdateLeadField('owner_id', selId);
                              handleUpdateLeadField('owner_name', selUser ? selUser.name : 'Unassigned');
                            }}
                          >
                            <option value="">Unassigned</option>
                            {usersList.map(u => (
                              <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="lead-audit-card">
                          <div className="lead-audit-card__head">
                            <strong><i className="fas fa-shield-halved"></i> Access history</strong>
                            <span>Who viewed or exported this lead</span>
                          </div>
                          {leadAuditEvents.length === 0 ? (
                            <p className="lead-audit-card__empty">No views or exports logged yet.</p>
                          ) : (
                            <ul className="lead-audit-card__list">
                              {leadAuditEvents.slice(0, 8).map(ev => (
                                <li key={ev.id}>
                                  <em className={`lead-audit-pill lead-audit-pill--${ev.event_type}`}>
                                    {ev.event_type}
                                  </em>
                                  <span>{ev.user_name || 'Someone'}</span>
                                  <time dateTime={ev.created_at}>
                                    {ev.created_at ? new Date(ev.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}
                                  </time>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        {/* Rendering dynamic custom fields inputs */}
                        {customFields.map(f => (
                          <div key={f.id} className="info-row">
                            <span className="info-label">{f.field_name === 'segment' ? 'Target Segment' : f.field_name}</span>
                            {f.field_name === 'segment' ? (
                              <select
                                value={activeLead.custom_fields?.segment || ''}
                                onChange={e => {
                                  const prevFields = activeLead.custom_fields || {};
                                  if (selectedBrand.id === 'optimaviz') {
                                    const nextSegment = normalizeOptimavizSegmentValue(e.target.value) || 'demo_leads';
                                    const nextStage = getOptimavizStageOptionsForSegment(nextSegment)[0];
                                    const nextFields = { ...prevFields, segment: nextSegment, next_action: getOptimavizDefaultNextAction(nextSegment, nextStage) };
                                    axios.put(`/api/leads/${activeLead.id}`, { funnel_stage: nextStage, follow_up_date: activeLead.follow_up_date || getOptimavizFollowUpDateForStage(nextSegment, nextStage), custom_fields: nextFields }).then(res => {
                                      const updated = normalizeOptimavizLeadsForDisplay([res.data])[0];
                                      setActiveLead(updated);
                                      setLeads(prev => prev.map(l => l.id === updated.id ? updated : l));
                                    }).catch(err => console.error(err));
                                  } else if (selectedBrand.id === 'idao') {
                                    const nextSegment = normalizeIdaoSegmentValue(e.target.value) || 'training_leads';
                                    const nextStage = getIdaoStageOptionsForSegment(nextSegment)[0];
                                    const nextServiceType = (IDAO_SERVICE_TYPES[nextSegment] || [])[0] || '';
                                    const nextFields = {
                                      ...prevFields,
                                      segment: nextSegment,
                                      service_type: nextServiceType,
                                      service_focus: nextServiceType,
                                      next_action: getIdaoDefaultNextAction(nextSegment, nextStage)
                                    };
                                    axios.put(`/api/leads/${activeLead.id}`, {
                                      funnel_stage: nextStage,
                                      follow_up_date: activeLead.follow_up_date || getIdaoFollowUpDateForStage(nextSegment, nextStage),
                                      custom_fields: nextFields
                                    }).then(res => {
                                      const updated = normalizeIdaoLeadsForDisplay([res.data])[0];
                                      setActiveLead(updated);
                                      setLeads(prev => prev.map(l => l.id === updated.id ? updated : l));
                                    }).catch(err => console.error(err));
                                  } else {
                                    handleUpdateLeadField('custom_fields', { ...prevFields, segment: e.target.value });
                                  }
                                }}
                              >
                                <option value="">None / Unassigned</option>
                                {(getBrandSegmentOptions(selectedBrand.id) || []).map(seg => (
                                  <option key={seg.value} value={seg.value}>{seg.label}</option>
                                ))}
                              </select>
                            ) : (
                              <input 
                                type={f.field_type === 'number' ? 'number' : f.field_type === 'date' ? 'date' : 'text'} 
                                value={activeLead.custom_fields?.[f.field_name] || ''} 
                                onChange={e => {
                                  const prevFields = activeLead.custom_fields || {};
                                  handleUpdateLeadField('custom_fields', { ...prevFields, [f.field_name]: e.target.value });
                                }}
                              />
                            )}
                          </div>
                        ))}

                        {/* IDAO Simple Process & Follow-Up Console */}
                        {selectedBrand.id === 'idao' && (
                          <div style={{ marginTop: '20px', background: 'rgba(139, 92, 246, 0.04)', border: '1.5px solid rgba(139, 92, 246, 0.25)', borderRadius: '12px', padding: '16px' }}>
                            <h5 style={{ fontSize: '13.5px', fontWeight: '700', color: '#8B5CF6', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <i className="fas fa-route"></i> IDAO Tracking Process
                            </h5>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', marginBottom: '12px' }}>
                              <button type="button" onClick={async () => {
                                const segment = getIdaoLeadSegment(activeLead);
                                const pf = activeLead.custom_fields || {};
                                const today = new Date();
                                const follow = getIdaoFollowUpDateForStage(segment, 'Quote Sent') || new Date(today.getTime() + IDAO_QUOTE_FOLLOW_UP_DAYS * 86400000).toISOString().split('T')[0];
                                const nextFields = { ...pf, segment, quote_status: 'Quote Sent', quote_sent_date: today.toISOString().split('T')[0], follow_up_type: 'Email', follow_up_status: 'Follow-Up Due', outreach_status: 'Quote Sent', next_action: getIdaoDefaultNextAction(segment, 'Quote Sent') };
                                const payload = { funnel_stage: 'Quote Sent', follow_up_date: follow, custom_fields: nextFields };
                                const res = await axios.put(`/api/leads/${activeLead.id}`, payload);
                                const updated = normalizeIdaoLeadsForDisplay([res.data])[0];
                                setLeads(prev => prev.map(l => l.id === updated.id ? updated : l));
                                setActiveLead(updated);
                                await axios.post(`/api/leads/${activeLead.id}/notes`, { content: `Quote sent. Follow-up reminder set for ${follow}.` });
                                showToast('Quote sent and follow-up reminder set.');
                               }} style={{ padding: '6px', fontSize: '10px', fontWeight: '700', borderRadius: '6px', border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.08)', color: '#f59e0b', cursor: 'pointer' }}><i className="fas fa-file-invoice" style={{ marginRight: '4px' }}></i>Quote Sent</button>
                               <button type="button" onClick={async () => {
                                 const segment = getIdaoLeadSegment(activeLead);
                                 const pf = activeLead.custom_fields || {};
                                 const follow = getIdaoFollowUpDateForStage(segment, 'Call Follow-Up') || new Date(Date.now() + IDAO_PAYMENT_FOLLOW_UP_DAYS * 86400000).toISOString().split('T')[0];
                                 const nextFields = { ...pf, segment, follow_up_type: 'Call', follow_up_status: 'Call Scheduled', outreach_status: 'Call Follow-Up', next_action: getIdaoDefaultNextAction(segment, 'Call Follow-Up') };
                                 const res = await axios.put(`/api/leads/${activeLead.id}`, { funnel_stage: 'Call Follow-Up', follow_up_date: follow, custom_fields: nextFields });
                                 const updated = normalizeIdaoLeadsForDisplay([res.data])[0];
                                 setLeads(prev => prev.map(l => l.id === updated.id ? updated : l));
                                 setActiveLead(updated);
                                 await axios.post(`/api/leads/${activeLead.id}/notes`, { content: `Follow-up call scheduled for ${follow}.` });
                                 showToast('Call follow-up scheduled.');
                               }} style={{ padding: '6px', fontSize: '10px', fontWeight: '700', borderRadius: '6px', border: '1px solid rgba(15,118,110,0.3)', background: 'rgba(15,118,110,0.08)', color: '#0f766e', cursor: 'pointer' }}><i className="fas fa-phone" style={{ marginRight: '4px' }}></i>Call</button>
                               <button type="button" onClick={async () => {
                                 const segment = getIdaoLeadSegment(activeLead);
                                 const pf = activeLead.custom_fields || {};
                                 const nextFields = { ...pf, segment, follow_up_status: 'Closed', outreach_status: 'Registered', registration_status: 'Registered', next_action: getIdaoDefaultNextAction(segment, 'Registered') };
                                 const res = await axios.put(`/api/leads/${activeLead.id}`, { funnel_stage: 'Registered', follow_up_date: '', custom_fields: nextFields });
                                 const updated = normalizeIdaoLeadsForDisplay([res.data])[0];
                                 setLeads(prev => prev.map(l => l.id === updated.id ? updated : l));
                                 setActiveLead(updated);
                                 await axios.post(`/api/leads/${activeLead.id}/notes`, { content: 'Registration marked as confirmed.' });
                                 showToast('Registration confirmed.');
                               }} style={{ padding: '6px', fontSize: '10px', fontWeight: '700', borderRadius: '6px', border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.08)', color: '#10b981', cursor: 'pointer' }}><i className="fas fa-check-circle" style={{ marginRight: '4px' }}></i>Registered</button>
                            </div>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>Default reminder timing is simple for now: email follow-up after {IDAO_QUOTE_FOLLOW_UP_DAYS} days, call follow-up after {IDAO_PAYMENT_FOLLOW_UP_DAYS} days. You can edit follow-up dates, next actions, and statuses per lead.</p>
                          </div>
                        )}

                        {/* SaaS Free Trial Status Tracking & Conversion Console */}
                        {selectedBrand.id === 'optimaviz' && getOptimavizLeadSegment(activeLead) === 'trial_leads' && (
                          <div style={{ marginTop: '20px', background: 'rgba(236, 72, 153, 0.04)', border: '1.5px solid rgba(236, 72, 153, 0.25)', borderRadius: '12px', padding: '16px' }}>
                            <h5 style={{ fontSize: '13.5px', fontWeight: '700', color: '#ec4899', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <i className="fas fa-hourglass-half"></i> 14-Day Free Trial Tracker
                            </h5>
                            {(() => {
                              const TRIAL_DAYS = 14;
                              const startDateStr = activeLead.custom_fields?.trial_start_date || activeLead.created_at.split('T')[0];
                              const startDate = new Date(startDateStr);
                              const endDate = new Date(startDate.getTime() + TRIAL_DAYS * 24 * 3600 * 1000);
                              const today = new Date();
                              const elapsed = Math.max(0, Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 3600 * 24)));
                              const daysRemaining = Math.max(0, TRIAL_DAYS - elapsed);
                              const isExpired = daysRemaining <= 0;
                              const pct = Math.min(100, Math.round((elapsed / TRIAL_DAYS) * 100));
                              const urgentColor = daysRemaining <= 3 ? '#ef4444' : daysRemaining <= 7 ? '#f59e0b' : '#ec4899';
                              return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                  <div style={{ fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Trial Start Date:</span>
                                    <input type="date" value={startDateStr} onChange={e => { const pf = activeLead.custom_fields || {}; handleUpdateLeadField('custom_fields', { ...pf, trial_start_date: e.target.value }); }} style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}/>
                                  </div>
                                  <div style={{ padding: '12px', background: 'var(--bg-card)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Day {elapsed} of {TRIAL_DAYS} - Ends {endDate.toLocaleDateString()}</span>
                                      {isExpired ? (
                                        <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '10px', background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca' }}>Trial Expired</span>
                                      ) : (
                                        <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '10px', background: `${urgentColor}15`, color: urgentColor, border: `1px solid ${urgentColor}40` }}>{daysRemaining}d remaining</span>
                                      )}
                                    </div>
                                    <div style={{ width: '100%', height: '8px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                                      <div style={{ width: `${pct}%`, height: '100%', background: isExpired ? '#ef4444' : `linear-gradient(90deg, #ec4899, ${urgentColor})`, borderRadius: '4px', transition: 'width 0.3s' }}></div>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                      <span>Start</span><span style={{ fontWeight: '700', color: urgentColor }}>{pct}% elapsed</span><span>Day 14</span>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        const prevFields = activeLead.custom_fields || {};
                                        const nowStr = new Date().toISOString().split('T')[0];
                                        const nextCustomFields = { ...prevFields, segment: 'trial_leads', trial_start_date: nowStr };
                                        await axios.put(`/api/leads/${activeLead.id}`, { custom_fields: nextCustomFields });
                                        await axios.post(`/api/leads/${activeLead.id}/notes`, { content: `Trial start date reset to ${nowStr}. New 14-day window begins.` });
                                        setLeads(prev => prev.map(l => l.id === activeLead.id ? { ...l, custom_fields: nextCustomFields } : l));
                                        setActiveLead(prev => prev ? { ...prev, custom_fields: nextCustomFields } : null);
                                        showToast('Trial start date reset to today.');
                                      } catch(err) { showToast('Failed to reset trial.', true); }
                                    }}
                                    style={{ padding: '6px 10px', fontSize: '11px', fontWeight: '600', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                                  ><i className="fas fa-redo" style={{ marginRight: '5px' }}></i>Reset Trial to Today</button>

                                  <button
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        const prevFields = activeLead.custom_fields || {};
                                        const nowStr = new Date().toISOString().split('T')[0];
                                        const nextCustomFields = { ...prevFields, segment: 'subscribed_platform_users', trial_converted_at: nowStr, trial_conversion_status: 'converted' };
                                        await axios.put(`/api/leads/${activeLead.id}`, { custom_fields: nextCustomFields });
                                        const noteContent = `Free trial converted to Subscribed User. ${isExpired ? 'Trial had expired.' : `${daysRemaining} days remaining at conversion.`}`;
                                        await axios.post(`/api/leads/${activeLead.id}/notes`, { content: noteContent });
                                        setLeads(prev => prev.map(l => l.id === activeLead.id ? { ...l, custom_fields: nextCustomFields } : l));
                                        setActiveLead(prev => prev ? { ...prev, custom_fields: nextCustomFields } : null);
                                        loadLeadDetailsHistory(activeLead.id);
                                        showToast('Lead converted to Subscribed User!');
                                      } catch (err) {
                                        showToast('Failed to convert free trial lead.', true);
                                      }
                                    }}
                                    style={{
                                      padding: '8px 12px',
                                      fontSize: '12px',
                                      fontWeight: '700',
                                      borderRadius: '8px',
                                      border: 'none',
                                      background: '#10b981',
                                      color: 'white',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '6px',
                                      boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)',
                                      marginTop: '4px',
                                      transition: 'all 0.15s ease'
                                    }}
                                  >
                                    <i className="fas fa-check-double"></i> Check & Convert to Subscribed
                                  </button>
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        {/* Demo Request Lead Follow-Up Console */}
                        {false && selectedBrand.id === 'optimaviz' && getOptimavizLeadSegment(activeLead) === 'demo_leads' && (
                          <div style={{ marginTop: '20px', background: 'rgba(245,158,11,0.04)', border: '1.5px solid rgba(245,158,11,0.25)', borderRadius: '12px', padding: '16px' }}>
                            <h5 style={{ fontSize: '13.5px', fontWeight: '700', color: '#f59e0b', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <i className="fas fa-chalkboard-teacher"></i> Demo Follow-Up Tracker
                            </h5>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div style={{ padding: '10px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>Demo Date</div>
                                  <input type="date" value={activeLead.custom_fields?.demo_date || ''} onChange={e => { const pf = activeLead.custom_fields || {}; handleUpdateLeadField('custom_fields', { ...pf, demo_date: e.target.value }); }} style={{ width: '100%', padding: '5px 8px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)' }}/>
                                </div>
                                <div style={{ padding: '10px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>Follow-Up Status</div>
                                  <select value={activeLead.custom_fields?.follow_up_status || ''} onChange={e => { const pf = activeLead.custom_fields || {}; handleUpdateLeadField('custom_fields', { ...pf, follow_up_status: e.target.value }); }} style={{ width: '100%', padding: '5px 8px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
                                    <option value="">Select Status</option>
                                    <option value="Pending Follow-Up">Pending Follow-Up</option>
                                    <option value="Email Sent">Email Sent</option>
                                    <option value="WhatsApp Sent">WhatsApp Sent</option>
                                    <option value="Call Scheduled">Call Scheduled</option>
                                    <option value="Not Interested">Not Interested</option>
                                    <option value="Converted to Trial">Converted to Trial</option>
                                    <option value="Converted to Subscribed">Converted to Subscribed</option>
                                  </select>
                                </div>
                              </div>

                              <div style={{ padding: '10px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                 <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '600' }}>🔔 Follow-Up Reminder</div>
                                <input
                                  type="date"
                                  value={activeLead.follow_up_date || ''}
                                  onChange={e => handleUpdateLeadField('follow_up_date', e.target.value)}
                                  style={{ width: '100%', padding: '5px 8px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)' }}
                                />
                                {activeLead.follow_up_date && (() => {
                                  const due = parseDateOnly(activeLead.follow_up_date);
                                  const now = new Date(); now.setHours(0,0,0,0);
                                  const diff = due ? Math.ceil((due.getTime() - now.getTime()) / 86400000) : 0;
                                  const overdue = diff < 0;
                                  const today = diff === 0;
                                  const label = overdue ? `${Math.abs(diff)} day${Math.abs(diff) !== 1 ? 's' : ''} overdue` : today ? 'Due today' : `Due in ${diff} day${diff !== 1 ? 's' : ''}`;
                                  const color = overdue ? '#ef4444' : today ? '#f59e0b' : '#10b981';
                                  return <div style={{ marginTop: '5px', fontSize: '11px', fontWeight: '600', color }}>{label}</div>;
                                })()}
                              </div>

                              <div style={{ padding: '12px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '600' }}>Demo Attended?</div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                   {[{ val: true, label: '✓ Yes, Attended', color: '#10b981' }, { val: false, label: '✗ Did Not Attend', color: '#ef4444' }].map(opt => {
                                    const cur = activeLead.custom_fields?.demo_attended;
                                    const isSelected = cur === opt.val || cur === String(opt.val);
                                    return (
                                      <button key={String(opt.val)} type="button" onClick={() => { const pf = activeLead.custom_fields || {}; handleUpdateLeadField('custom_fields', { ...pf, demo_attended: opt.val }); }} style={{ flex: 1, padding: '7px', fontSize: '11.5px', fontWeight: '700', borderRadius: '8px', border: isSelected ? `2px solid ${opt.color}` : '1px solid var(--border)', background: isSelected ? `${opt.color}15` : 'var(--bg-base)', color: isSelected ? opt.color : 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.15s' }}>
                                        {opt.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginTop: '2px' }}>
                                <button type="button" onClick={async () => { const pf = activeLead.custom_fields || {}; handleUpdateLeadField('custom_fields', { ...pf, follow_up_status: 'Email Sent', last_follow_up_date: new Date().toISOString().split('T')[0] }); await axios.post(`/api/leads/${activeLead.id}/notes`, { content: `Follow-up email sent to ${activeLead.email || activeLead.name}.` }); showToast('Email follow-up logged.'); }} style={{ padding: '5px', fontSize: '10px', fontWeight: '700', borderRadius: '6px', border: '1px solid rgba(21,94,117,0.3)', background: 'rgba(21,94,117,0.08)', color: '#155e75', cursor: 'pointer' }}>
                                  <i className="fas fa-envelope" style={{ marginRight: '3px' }}></i>Email
                                </button>
                                <button type="button" onClick={async () => { const pf = activeLead.custom_fields || {}; handleUpdateLeadField('custom_fields', { ...pf, follow_up_status: 'WhatsApp Sent', last_follow_up_date: new Date().toISOString().split('T')[0] }); await axios.post(`/api/leads/${activeLead.id}/notes`, { content: `WhatsApp follow-up sent to ${activeLead.phone || activeLead.name}.` }); showToast('WhatsApp follow-up logged.'); const phone = (activeLead.phone || '').replace(/\D/g,''); if (phone) window.open(`https://wa.me/${phone}`, '_blank'); }} style={{ padding: '5px', fontSize: '10px', fontWeight: '700', borderRadius: '6px', border: '1px solid rgba(37,211,102,0.3)', background: 'rgba(37,211,102,0.08)', color: '#25d366', cursor: 'pointer' }}>
                                  <i className="fab fa-whatsapp" style={{ marginRight: '3px' }}></i>WhatsApp
                                </button>
                                <button type="button" onClick={async () => { try { const pf = activeLead.custom_fields || {}; const nowStr = new Date().toISOString().split('T')[0]; const next = { ...pf, segment: 'trial_leads', trial_start_date: nowStr, follow_up_status: 'Converted to Trial', next_action: 'Send Onboarding Email' }; await axios.put(`/api/leads/${activeLead.id}`, { funnel_stage: 'Trial Started', custom_fields: next }); await axios.post(`/api/leads/${activeLead.id}/notes`, { content: `Demo lead converted to Trial Lead. Trial starts ${nowStr}.` }); setLeads(prev => prev.map(l => l.id === activeLead.id ? { ...l, funnel_stage: 'Trial Started', custom_fields: next } : l)); setActiveLead(prev => prev ? { ...prev, funnel_stage: 'Trial Started', custom_fields: next } : null); showToast('Lead moved to Free Trial!'); } catch(e) { showToast('Failed to convert.', true); } }} style={{ padding: '5px', fontSize: '10px', fontWeight: '700', borderRadius: '6px', border: '1px solid rgba(236,72,153,0.3)', background: 'rgba(236,72,153,0.08)', color: '#ec4899', cursor: 'pointer' }}>
                                  <i className="fas fa-hourglass-half" style={{ marginRight: '3px' }}></i>Trial
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Inline Delete Area */}
                        {!deleteConfirmState ? (
                          <button 
                            type="button" 
                            onClick={() => setDeleteConfirmState(true)}
                            className="btn btn-ghost" 
                            style={{ color: '#ef4444', border: '1.5px solid rgba(239, 68, 68, 0.2)', width: '100%', marginTop: '16px', fontSize: '12px', fontWeight: 'bold' }}
                          >
                            <i className="fas fa-trash-alt" style={{ marginRight: '6px' }}></i> Delete Record
                          </button>
                        ) : (
                          <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: '12px', padding: '12px', marginTop: '16px', textAlign: 'center' }}>
                            <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 'bold', color: '#991b1b' }}>Are you sure you want to delete this contact?</p>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                              <button 
                                type="button" 
                                onClick={() => setDeleteConfirmState(false)}
                                className="btn btn-ghost" 
                                style={{ fontSize: '11px', padding: '4px 10px' }}
                              >
                                Cancel
                              </button>
                              <button 
                                type="button" 
                                onClick={handleDeleteActiveLead}
                                className="btn" 
                                style={{ background: '#ef4444', color: 'white', fontSize: '11px', padding: '4px 10px', border: 'none', borderRadius: '6px' }}
                              >
                                 Yes, Delete
                               </button>
                            </div>
                          </div>
                        )}
           
             </div>
           )}

                      {/* Timeline Interaction Notes Frame */}
                      {leadDetailTab !== 'overview' && (
                      <div className="lead-details-history">
                        {leadDetailTab === 'communication' && (
                          <div className="lead-comms-log-intro">
                            <div>
                              <strong><i className="fas fa-comments"></i> Comms Log</strong>
                              <span>History and notes for this lead. Lead Control stays focused on next actions.</span>
                            </div>
                            <em>{leadNotes.length + leadCalls.length + leadEmails.length + leadWhatsApp.length} total</em>
                          </div>
                        )}
                        {leadDetailTab === 'activity' && (
                          <div className="lead-followup-tracker" style={{ ['--tracker-accent' as any]: selectedBrand.color }}>
                            <div className="lead-followup-tracker__head">
                              <div>
                                <strong><i className="fas fa-route"></i> Lead Follow-Up Control</strong>
                                <span>{isFollowUpDue(activeLead) ? getFollowUpLabel(activeLead).label : activeLead.follow_up_date ? `Reminder set for ${activeLead.follow_up_date}` : 'No reminder set yet'}</span>
                              </div>
                              <span className={isFollowUpDue(activeLead) ? 'is-due' : ''}>{activeLead.custom_fields?.follow_up_status || 'Open'}</span>
                            </div>
                            <div className="lead-followup-tracker__grid">
                              <label>
                                Stage
                                <select value={activeLead.funnel_stage || ''} onChange={e => ['optimaviz', 'idao'].includes(selectedBrand.id) ? updateLeadStageAndDefaults(activeLead, e.target.value) : handleUpdateLeadField('funnel_stage', e.target.value)}>
                                  {getStageOptionsForLead(activeLead).map(stage => <option key={stage} value={stage}>{stage}</option>)}
                                </select>
                              </label>
                              <label>
                                Contact channel
                                <select value={activeLead.custom_fields?.follow_up_type || ''} onChange={e => handleUpdateLeadField('custom_fields', { ...(activeLead.custom_fields || {}), follow_up_type: e.target.value })}>
                                  <option value="">Choose channel</option>
                                  <option value="Email">Email</option>
                                  <option value="Call">Call</option>
                                  <option value="WhatsApp">WhatsApp</option>
                                </select>
                              </label>
                              <label>
                                Follow-up reminder
                                <input type="date" value={activeLead.follow_up_date || ''} onChange={e => handleUpdateLeadField('follow_up_date', e.target.value)} />
                              </label>
                              <label>
                                Outcome
                                <select value={activeLead.custom_fields?.follow_up_status || ''} onChange={e => handleUpdateLeadField('custom_fields', { ...(activeLead.custom_fields || {}), follow_up_status: e.target.value })}>
                                  <option value="">Open</option>
                                  <option value="Pending Follow-Up">Pending Follow-Up</option>
                                  <option value="Email Sent">Email Sent</option>
                                  <option value="WhatsApp Sent">WhatsApp Sent</option>
                                  <option value="Call Scheduled">Call Scheduled</option>
                                  <option value="Contact did not respond">Contact did not respond</option>
                                  <option value="Next follow-up set">Next follow-up set</option>
                                  <option value="Closed - Won">Closed - Won</option>
                                  <option value="Closed - Lost">Closed - Lost</option>
                                </select>
                              </label>
                              <label className="lead-followup-tracker__wide">
                                Next action
                                <input value={activeLead.custom_fields?.next_action || ''} onChange={e => handleUpdateLeadField('custom_fields', { ...(activeLead.custom_fields || {}), next_action: e.target.value })} placeholder="What should happen next?" />
                              </label>
                            </div>
                            <div className="lead-followup-tracker__actions">
                              <button type="button" onClick={() => handleLeadFollowUpAction('email')}><i className="fas fa-envelope"></i> Email done</button>
                              <button type="button" onClick={() => handleLeadFollowUpAction('whatsapp')}><i className="fab fa-whatsapp"></i> WhatsApp done</button>
                              <button type="button" onClick={() => handleLeadFollowUpAction('call')}><i className="fas fa-phone"></i> Call set</button>
                              <button type="button" onClick={() => handleLeadFollowUpAction('no_response')}><i className="fas fa-user-clock"></i> No response</button>
                              <button type="button" onClick={() => handleLeadFollowUpAction('close_won')}><i className="fas fa-check"></i> Close won</button>
                              <button type="button" onClick={() => handleLeadFollowUpAction('close_lost')}><i className="fas fa-ban"></i> Close lost</button>
                            </div>
                          </div>
                        )}
                        {leadDetailTab === 'communication' && (
                        <>
                        <div className="lead-comms-log-shell" style={{ ['--comms-accent' as any]: selectedBrand.color }}>
                          <div className="lead-comms-log-head">
                            <div>
                              <h4><i className="fas fa-stream"></i> Unified Comms Timeline</h4>
                              <p>Notes, calls, emails, and WhatsApp messages in one readable history.</p>
                            </div>
                          </div>
                          <div className="lead-comms-log-stats">
                            {[
                              ['Notes', leadNotes.length, 'fa-note-sticky'],
                              ['Calls', leadCalls.length, 'fa-phone'],
                              ['Emails', leadEmails.length, 'fa-envelope'],
                              ['WhatsApp', leadWhatsApp.length, 'fa-brands fa-whatsapp'],
                            ].map(([label, value, icon]) => (
                              <div key={String(label)}>
                                <i className={`${String(label) === 'WhatsApp' ? 'fab' : 'fas'} ${String(icon).replace('fa-brands ', '')}`}></i>
                                <strong>{value}</strong>
                                <span>{label}</span>
                              </div>
                            ))}
                          </div>

                        <form onSubmit={handleAddNoteSubmit} className="lead-comms-note-composer">
                          <textarea 
                            value={newNoteText} 
                            onChange={e => setNewNoteText(e.target.value)} 
                            placeholder="Add an internal note for this lead..." 
                            rows={3} 
                          />
                          <button type="submit" disabled={noteSaving || !newNoteText.trim()} className="btn btn-primary" style={{ background: selectedBrand.color }}>
                            {noteSaving ? 'Logging...' : 'Add Note'}
                          </button>
                        </form>

                        {/* Simple lead activity feed. Keep website/form details in source analytics, not as noisy lead rows. */}
                        {(() => {
                          const activityItems = [
                            ...leadNotes.map(x => ({ ...x, type: 'note' })),
                            ...leadCalls.map(x => ({ ...x, type: 'call' })),
                            ...leadEmails.map(x => ({ ...x, type: 'email' })),
                            ...leadWhatsApp.map(x => ({ ...x, type: 'whatsapp' }))
                          ].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
                          const filteredItems = leadActivityFilter === 'all'
                            ? activityItems
                            : activityItems.filter((item: any) => item.type === leadActivityFilter);
                          const activityCounts = {
                            all: activityItems.length,
                            note: leadNotes.length,
                            call: leadCalls.length,
                            email: leadEmails.length,
                            whatsapp: leadWhatsApp.length,
                          };
                          return (
                        <>
                          <div className="lead-activity-filter-row">
                            {[
                              ['all', 'All'],
                              ['note', 'Notes'],
                              ['call', 'Calls'],
                              ['email', 'Email'],
                              ['whatsapp', 'WhatsApp'],
                            ].map(([value, label]) => (
                              <button
                                key={value}
                                type="button"
                                className={leadActivityFilter === value ? 'active' : ''}
                                onClick={() => setLeadActivityFilter(value as typeof leadActivityFilter)}
                              >
                                {label} <span>{activityCounts[value as keyof typeof activityCounts]}</span>
                              </button>
                            ))}
                          </div>
                          <div className="lead-comms-timeline-list">
                          {activityItems.length === 0 ? (
                            <div className="lead-comms-empty">No activity yet. Start with a note, email, WhatsApp, or call.</div>
                          ) : filteredItems.length === 0 ? (
                            <div className="lead-comms-empty">No {leadActivityFilter} activity for this lead yet.</div>
                          ) : (
                            filteredItems.map((item: any) => (
                              <div key={item.id} className={`history-item lead-comms-timeline-item lead-comms-timeline-item--${item.type}`}>
                                <div className="lead-comms-timeline-icon">
                                  <i className={`fas ${item.type === 'note' ? 'fa-note-sticky' : item.type === 'call' ? 'fa-phone' : item.type === 'email' ? 'fa-envelope' : 'fa-brands fa-whatsapp'}`}></i>
                                </div>
                                <div className="lead-comms-timeline-body">
                                  <div className="lead-comms-timeline-meta">
                                    <span>
                                      {item.type === 'note' && <strong>Note</strong>}
                                      {item.type === 'call' && <strong>Call logged</strong>}
                                      {item.type === 'email' && <strong>Email</strong>}
                                      {item.type === 'whatsapp' && <strong>WhatsApp message</strong>}
                                      {item.created_by ? ` by ${item.created_by}` : ''}
                                    </span>
                                    <time>{new Date(item.created_at).toLocaleDateString()}</time>
                                  </div>
                                  <div className="lead-comms-timeline-content">
                                    {item.type === 'note' && item.content}
                                    {item.type === 'call' && `Outcome: "${item.outcome}". Duration: ${item.duration}s. Notes: ${item.notes || '—'}`}
                                    {item.type === 'email' && (
                                      <span>
                                        <strong>Subject:</strong> {item.subject}
                                        {item.status === 'failed' && <span style={{ color: '#ef4444', marginLeft: '6px', fontSize: '10px', fontWeight: '700' }}>(failed)</span>}
                                        {item.opened_at && (
                                          <span title={`First opened: ${new Date(item.opened_at).toLocaleString()}${item.open_count > 1 ? ` - opened ${item.open_count}×` : ''}`} style={{ marginLeft: '8px', display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '1px 7px', borderRadius: '20px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', fontSize: '10px', fontWeight: '700', cursor: 'default' }}>
                                            <i className="fas fa-envelope-open" style={{ fontSize: '9px' }}></i>
                                            Opened{item.open_count > 1 ? ` ×${item.open_count}` : ''}
                                          </span>
                                        )}
                                        {!item.opened_at && item.status === 'sent' && (
                                          <span style={{ marginLeft: '8px', display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '1px 7px', borderRadius: '20px', background: 'rgba(148,163,184,0.10)', border: '1px solid rgba(148,163,184,0.2)', color: 'var(--text-muted)', fontSize: '10px', fontWeight: '600', cursor: 'default' }}>
                                            <i className="fas fa-envelope" style={{ fontSize: '9px' }}></i>
                                            Not opened yet
                                          </span>
                                        )}
                                      </span>
                                    )}
                                    {item.type === 'whatsapp' && item.message}
                                  </div>
                                  <div className="lead-comms-timeline-actions">
                                    {item.type === 'note' && (
                                      confirmDeleteNoteId === item.id ? (
                                        <span style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                                          <button type="button" onClick={() => { handleDeleteNote(item.id); setConfirmDeleteNoteId(null); }} style={{ color: '#fff', background: '#ef4444', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', padding: '2px 6px', fontWeight: '600' }}>Confirm delete</button>
                                          <button type="button" onClick={() => setConfirmDeleteNoteId(null)} style={{ color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '10px' }}>Cancel</button>
                                        </span>
                                      ) : (
                                        <button type="button" onClick={() => setConfirmDeleteNoteId(item.id)}>Delete</button>
                                      )
                                    )}
                                    {item.type === 'email' && (
                                      confirmDeleteEmailId === item.id ? (
                                        <span style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                                          <button type="button" onClick={() => handleDeleteEmail(item.id)} style={{ color: '#fff', background: '#ef4444', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', padding: '2px 6px', fontWeight: '600' }}>Confirm delete</button>
                                          <button type="button" onClick={() => setConfirmDeleteEmailId(null)} style={{ color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '10px' }}>Cancel</button>
                                        </span>
                                      ) : (
                                        <button type="button" onClick={() => setConfirmDeleteEmailId(item.id)}>Delete</button>
                                      )
                                    )}
                                    {item.type === 'whatsapp' && (
                                      confirmDeleteWaId === item.id ? (
                                        <span style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                                          <button type="button" onClick={() => handleDeleteWhatsApp(item.id)} style={{ color: '#fff', background: '#ef4444', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', padding: '2px 6px', fontWeight: '600' }}>Confirm delete</button>
                                          <button type="button" onClick={() => setConfirmDeleteWaId(null)} style={{ color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '10px' }}>Cancel</button>
                                        </span>
                                      ) : (
                                        <button type="button" onClick={() => setConfirmDeleteWaId(item.id)}>Delete</button>
                                      )
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                          </div>
                        </>
                          );
                        })()}
                        </div>
                        </>
                        )}

                       </div>
                       )}

                  </div>
                </div>
              )}
            
            </div>
          )}

               {/* C.2 WORKSPACE - AUTO WORKFLOW SEQUENCES TAB */}
              {brandSubTab === 'sequences' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div>
                      <h4 style={{ fontSize: '16px', fontWeight: '700' }}>Cross-channel automation flows</h4>
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Build controlled sequences that can email, WhatsApp, schedule calls, or create internal tasks from lead-stage triggers.</p>
                    </div>

                    <button className="btn btn-primary" onClick={() => {
                      setSeqForm({ name: '', description: '', trigger_stage: getBrandStageOptions(selectedBrand.id)[0], active: true, steps: [] });
                      setSeqModalIsOpen(true);
                    }} style={{ background: selectedBrand.color }}>
                      <i className="fas fa-plus"></i> Create drip campaign
                    </button>
                  </div>

                  {sequences.length === 0 ? (
                    <div style={{ background: 'var(--bg-card)', padding: '64px', borderRadius: '16px', border: '2px dashed var(--border)', textAlign: 'center' }}>
                      <i className="fas fa-route" style={{ fontSize: '48px', color: selectedBrand.color, marginBottom: '16px', opacity: 0.5, display: 'block' }}></i>
                      <h4>Create automated communication series</h4>
                      <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Start with email, then add WhatsApp, call reminders, or internal tasks as the relationship moves forward.</p>
                      <button className="btn btn-primary" onClick={() => {
                        setSeqForm({ name: '', description: '', trigger_stage: getBrandStageOptions(selectedBrand.id)[0], active: true, steps: [] });
                        setSeqModalIsOpen(true);
                      }} style={{ background: selectedBrand.color }}>Create Drip Flow</button>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '24px' }}>
                      {sequences.map(seq => {
                        const stats = sequenceStats[seq.id] || { total: 0, active: 0, completed: 0, cancelled: 0 };
                        return (
                        <div key={seq.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                            <div style={{ flex: 1 }}>
                              <h5 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '4px' }}>{seq.name}</h5>
                              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{seq.description || 'No description'}</p>
                            </div>
                            <span className={`pill ${seq.active ? 'pill-green' : 'pill-amber'}`}>
                              {seq.active ? 'Active' : 'Paused'}
                            </span>
                          </div>

                          <div style={{ background: `oklch(from ${selectedBrand.color} l c h / 0.08)`, borderRadius: '8px', padding: '10px 12px', fontSize: '12px', marginBottom: '16px' }}>
                            <i className="fas fa-bolt" style={{ color: selectedBrand.color, marginRight: '6px' }}></i>
                            Auto-trigger: <strong>{seq.trigger_stage || 'Manual Trigger'}</strong>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px' }}>
                            {[
                              ['Active', stats.active],
                              ['Completed', stats.completed],
                              ['Total', stats.total],
                            ].map(([label, value]) => (
                              <div key={label} style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '8px', background: 'var(--bg-base)' }}>
                                <strong style={{ display: 'block', color: 'var(--text-primary)', fontSize: '14px' }}>{value}</strong>
                                <span style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' }}>{label}</span>
                              </div>
                            ))}
                          </div>
                          {stats.next_due && (
                            <div style={{ margin: '-8px 0 14px', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 700 }}>
                              Next due: {new Date(stats.next_due).toLocaleString()}
                            </div>
                          )}

                          <div style={{ marginBottom: '20px' }}>
                            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
                              {seq.steps.length} CROSS-CHANNEL STEPS
                            </div>
                            {seq.steps.map((st, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', fontSize: '12px', borderBottom: i === seq.steps.length - 1 ? 'none' : '1px solid var(--border)' }}>
                                <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: selectedBrand.color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '700' }}>
                                  {i + 1}
                                </div>
                                <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{st.name}</span>
                                <span style={{ padding: '3px 7px', borderRadius: '999px', background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' }}>
                                  {st.channel || 'email'}
                                </span>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{st.delay_days === 0 ? 'Day 0' : `+${st.delay_days} days`}</span>
                              </div>
                            ))}
                          </div>

                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn btn-primary btn-sm" onClick={() => {
                              setEnrollSequenceId(seq.id);
                              setSelectedLeadsEnroll(new Set());
                              setEnrollModalOpen(true);
                            }} style={{ background: selectedBrand.color, flex: 1 }}>
                              <i className="fas fa-user-plus"></i> Enroll records
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => {
                              setSeqForm({
                                id: seq.id,
                                name: seq.name,
                                description: seq.description || '',
                                trigger_stage: seq.trigger_stage || 'New Lead',
                                active: seq.active,
                                steps: seq.steps
                              });
                              setSeqModalIsOpen(true);
                            }}><i className="fas fa-edit"></i></button>
                            {confirmDeleteSequenceId === seq.id ? (
                              <span style={{ display: 'inline-flex', gap: '5px', alignItems: 'center' }}>
                                <button className="btn btn-sm" onClick={() => { handleDeleteSequence(seq.id); setConfirmDeleteSequenceId(null); }} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '11px', padding: '3px 8px', fontWeight: '600', cursor: 'pointer' }}>Confirm</button>
                                <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDeleteSequenceId(null)} style={{ fontSize: '11px' }}>Cancel</button>
                              </span>
                            ) : (
                              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDeleteSequenceId(seq.id)} style={{ color: '#ff4d4d' }}><i className="fas fa-trash"></i></button>
                            )}
                          </div>
                        </div>
                      )})}
                    </div>
                  )}

                </div>
              )}

              {/* C.3 WORKSPACE - TEAM TASKS OPERATIONS SEGMENT */}
              {brandSubTab === 'tasks' && (() => {
                const weekDates = getWeekDates();
                const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
                return (
                  <div style={{ animation: 'fadeIn 0.2s', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    
                    {/* Mon-Fri Calendar View */}
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px' }}>
                      <h3 style={{ fontSize: '15.5px', fontWeight: '800', marginBottom: '20px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <i className="fas fa-calendar-week" style={{ color: selectedBrand.color }}></i> Team Activities - Weekly Overview
                      </h3>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
                        {weekDates.map((dateStr, idx) => {
                          const date = new Date(dateStr);
                          const dayTasks = getTasksForDate(dateStr);
                          const isSelected = selectedTaskDate === dateStr;
                          return (
                            <div key={dateStr} style={{
                              background: isSelected ? `color-mix(in srgb, ${selectedBrand.color} 12%, var(--bg-base))` : 'var(--bg-base)',
                              border: isSelected ? `2px solid ${selectedBrand.color}` : '1px solid var(--border)',
                              borderRadius: '12px',
                              padding: '14px',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              minHeight: '300px',
                              display: 'flex',
                              flexDirection: 'column'
                            }}
                            onClick={() => setSelectedTaskDate(isSelected ? '' : dateStr)}
                            onMouseOver={e => (e.target as any).style.boxShadow = 'var(--shadow-sm)'}
                            onMouseOut={e => (e.target as any).style.boxShadow = 'none'}
                            >
                              <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                                <div style={{ fontSize: '12px', fontWeight: '700', color: selectedBrand.color, textTransform: 'uppercase' }}>{dayNames[idx]}</div>
                                <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginTop: '4px' }}>{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                              </div>
                              
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, overflowY: 'auto' }}>
                                {dayTasks.length === 0 ? (
                                  <div style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                                    No activities
                                  </div>
                                ) : (
                                  dayTasks.map(t => (
                                    <div key={t.id} style={{
                                      background: 'var(--bg-card)',
                                      border: `1px solid var(--border)`,
                                      borderRadius: '8px',
                                      padding: '10px',
                                      fontSize: '12px'
                                    }}>
                                      <div style={{ fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>{t.user_name}</div>
                                      <div style={{
                                        display: 'inline-block',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        fontSize: '10px',
                                        fontWeight: '600',
                                        marginBottom: '4px',
                                        background: t.status === 'Completed' ? '#dbeafe' : t.status === 'Needs Help' ? '#fee2e2' : t.status === 'Pending' ? '#dbeafe' : '#fef3c7',
                                        color: t.status === 'Completed' ? '#0c4a6e' : t.status === 'Needs Help' ? '#7f1d1d' : t.status === 'Pending' ? '#0c4a6e' : '#92400e'
                                      }}>
                                        {t.status}
                                      </div>
                                      <div style={{ color: 'var(--text-secondary)', lineHeight: '1.4', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                                        {t.content}
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Activity Post Form */}
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px' }}>
                      <h4 style={{ fontSize: '14.5px', fontWeight: '800', marginBottom: '16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="fas fa-plus-circle" style={{ color: selectedBrand.color }}></i> Post Team Activity
                      </h4>
                      
                      <form onSubmit={async (e) => {
                        e.preventDefault();
                        if (!taskContent) return;
                        setTaskPosting(true);
                        try {
                          await axios.post('/api/tasks', {
                            brand_id: selectedBrand.id,
                            content: taskContent,
                            status: taskStatus,
                            task_date: selectedTaskDate || new Date().toISOString().split('T')[0]
                          });
                          setTaskContent('');
                          setSelectedTaskDate('');
                          fetchTasksForActiveBrand();
                        } catch {
                          alert('Failed to post activity.');
                        } finally {
                          setTaskPosting(false);
                        }
                      }} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>Select Day *</label>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                            {weekDates.map((dateStr, idx) => {
                              const date = new Date(dateStr);
                              const isSelected = selectedTaskDate === dateStr;
                              return (
                                <button
                                  key={dateStr}
                                  type="button"
                                  onClick={() => setSelectedTaskDate(isSelected ? '' : dateStr)}
                                  style={{
                                    padding: '10px 8px',
                                    borderRadius: '8px',
                                    border: isSelected ? `2px solid ${selectedBrand.color}` : '1px solid var(--border)',
                                    background: isSelected ? `color-mix(in srgb, ${selectedBrand.color} 12%, var(--bg-base))` : 'var(--bg-base)',
                                    color: isSelected ? selectedBrand.color : 'var(--text-secondary)',
                                    fontWeight: isSelected ? '700' : '600',
                                    cursor: 'pointer',
                                    fontSize: '11px',
                                    transition: 'all 0.2s',
                                    textAlign: 'center'
                                  }}
                                >
                                  <div>{dayNames[idx].slice(0, 3)}</div>
                                  <div style={{ fontSize: '10px', marginTop: '2px' }}>{date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}</div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>Activity Status *</label>
                          <select 
                            value={taskStatus} 
                            onChange={e => setTaskStatus(e.target.value as any)} 
                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                          >
                            <option value="In Progress">In Progress</option>
                            <option value="Completed">Completed</option>
                            <option value="Pending">Pending</option>
                            <option value="Needs Help">Needs Help</option>
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>What's your activity? *</label>
                          <textarea 
                            rows={4} 
                            placeholder="Describe your current activity or status..." 
                            value={taskContent} 
                            onChange={e => setTaskContent(e.target.value)} 
                            style={{ width: '100%', resize: 'none' }}
                            required
                          />
                        </div>

                        <button type="submit" className="btn btn-primary" disabled={taskPosting} style={{ background: selectedBrand.color, width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                          {taskPosting ? 'Posting...' : <><i className="fas fa-paper-plane"></i> Post Activity</>}
                        </button>
                      </form>
                    </div>

                  </div>
                );
              })()}


            </div>
          )}

           {/* =======================================================
               D. USER AND PERMISSION SETTINGS VIEW
             ======================================================= */}
           {activeTab === 'users' && (
            <UsersPage
              handleSelectDashboard={handleSelectDashboard}
              setAddUserIsOpen={setAddUserIsOpen}
              usersList={usersList}
              currentUser={user}
              selectedUserManagementId={selectedUserManagementId}
              setSelectedUserManagementId={setSelectedUserManagementId}
              activeBrands={activeBrands}
              handleUpdateUserBrands={handleUpdateUserBrands}
              setPwdUser={setPwdUser}
              setNewPwdField={setNewPwdField}
              setShowAdminPwd={setShowAdminPwd}
              confirmDeleteUserId={confirmDeleteUserId}
              setConfirmDeleteUserId={setConfirmDeleteUserId}
              handleDeleteUser={handleDeleteUser}
              newBrandSetupMode={newBrandSetupMode}
              setNewBrandSetupMode={setNewBrandSetupMode}
              newBrandSourceBrandId={newBrandSourceBrandId}
              setNewBrandSourceBrandId={setNewBrandSourceBrandId}
              newBrandName={newBrandName}
              setNewBrandName={setNewBrandName}
              newBrandLogo={newBrandLogo}
              newBrandLogoFileName={newBrandLogoFileName}
              handleNewBrandLogoUpload={handleNewBrandLogoUpload}
              newBrandColor={newBrandColor}
              setNewBrandColor={setNewBrandColor}
              newBrandDescription={newBrandDescription}
              setNewBrandDescription={setNewBrandDescription}
              newBrandTargetAudience={newBrandTargetAudience}
              setNewBrandTargetAudience={setNewBrandTargetAudience}
              newBrandAudienceKeywords={newBrandAudienceKeywords}
              setNewBrandAudienceKeywords={setNewBrandAudienceKeywords}
              newBrandCrossSellNotes={newBrandCrossSellNotes}
              setNewBrandCrossSellNotes={setNewBrandCrossSellNotes}
              newBrandMarketScope={newBrandMarketScope}
              setNewBrandMarketScope={setNewBrandMarketScope}
              newBrandMarketCountries={newBrandMarketCountries}
              setNewBrandMarketCountries={setNewBrandMarketCountries}
              newBrandSegments={newBrandSegments}
              setNewBrandSegments={setNewBrandSegments}
              newBrandStages={newBrandStages}
              setNewBrandStages={setNewBrandStages}
              handleAddBrand={handleAddBrand}
              filteredManagedBrands={filteredManagedBrands}
              managedBrands={managedBrands}
              brandLibrarySearch={brandLibrarySearch}
              setBrandLibrarySearch={setBrandLibrarySearch}
              brandLibraryStatus={brandLibraryStatus}
              setBrandLibraryStatus={setBrandLibraryStatus}
              expandedBrandProfileId={expandedBrandProfileId}
              setExpandedBrandProfileId={setExpandedBrandProfileId}
              handleRestoreBrand={handleRestoreBrand}
              handleArchiveBrand={handleArchiveBrand}
              handleDeleteManagedBrand={handleDeleteManagedBrand}
              updateManagedBrandProfile={updateManagedBrandProfile}
              brandMarketCountryDrafts={brandMarketCountryDrafts}
              setBrandMarketCountryDrafts={setBrandMarketCountryDrafts}
              saveBrandIntelligenceProfile={saveBrandIntelligenceProfile}
              parseLineList={parseLineList}
              workflowDesignerBrandId={workflowDesignerBrandId}
              syncWorkflowDesignerDrafts={syncWorkflowDesignerDrafts}
              getBrandSegmentOptions={getBrandSegmentOptions}
              slugifyValue={slugifyValue}
              getSegmentStagesForBrand={getSegmentStagesForBrand}
              workflowSegmentStageDrafts={workflowSegmentStageDrafts}
              setWorkflowSegmentStageDrafts={setWorkflowSegmentStageDrafts}
              workflowFollowUpDrafts={workflowFollowUpDrafts}
              setWorkflowFollowUpDrafts={setWorkflowFollowUpDrafts}
              getFollowUpPlaybookForSegment={getFollowUpPlaybookForSegment}
              workflowPreviewCollapsed={workflowPreviewCollapsed}
              setWorkflowPreviewCollapsed={setWorkflowPreviewCollapsed}
              getStageColor={getStageColor}
              handleSaveWorkflowDesigner={handleSaveWorkflowDesigner}
              handleDownloadBrandImportTemplate={handleDownloadBrandImportTemplate}
              workspaceProfileBrandId={workspaceProfileBrandId}
              setWorkspaceProfileBrandId={setWorkspaceProfileBrandId}
              getBrandWorkspaceProfiles={getBrandWorkspaceProfiles}
              selectedWorkspaceProfileId={selectedWorkspaceProfileId}
              setSelectedWorkspaceProfileId={setSelectedWorkspaceProfileId}
              workspaceProfileName={workspaceProfileName}
              setWorkspaceProfileName={setWorkspaceProfileName}
              saveBrandWorkspaceProfile={saveBrandWorkspaceProfile}
              applyBrandWorkspaceProfile={applyBrandWorkspaceProfile}
              duplicateBrandWorkspaceProfile={duplicateBrandWorkspaceProfile}
              setDefaultBrandWorkspaceProfile={setDefaultBrandWorkspaceProfile}
              deleteBrandWorkspaceProfile={deleteBrandWorkspaceProfile}
              workflowSegmentsDraft={workflowSegmentsDraft}
              setWorkflowSegmentsDraft={setWorkflowSegmentsDraft}
              workflowStagesDraft={workflowStagesDraft}
              setWorkflowStagesDraft={setWorkflowStagesDraft}
            />
          )}

        </div>
      </div>


      {/* ==============================================================================
           E. DIALOG MODALS CANVAS GROUP
         ============================================================================== */}

      {/* CUSTOMIZABLE BRAND DIRECTORY SPOTLIGHTS MODAL */}
      {spotlightModalOpen && selectedBrand && (
        <div className="modal-overlay">
          <div className="modal-content spotlight-config-modal" style={{ maxWidth: '680px', width: '95%', maxHeight: '90vh', overflow: 'hidden' }}>
            <div className="modal-header">
              <h3><i className="fas fa-cog" style={{ color: selectedBrand.color }}></i> Spotlights & Directory Insights Configuration</h3>
              <button className="modal-close" aria-label="Close" onClick={() => setSpotlightModalOpen(false)}>&times;</button>
            </div>
            
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 12px 0' }}>
                  Manage the strategic insights widgets rendered at the top of <b>{selectedBrand.name}</b>'s leads directory board.
                </p>
                
                {/* List of active widgets */}
                <h4 style={{ fontSize: '13px', fontWeight: '700', marginBottom: '8px', color: 'var(--text-primary)' }}>Active Spotlights for {selectedBrand.name}</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px' }}>
                  {(brandSpotlights[selectedBrand.id] || []).length === 0 ? (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>No active spotlights configured. Add one below!</div>
                  ) : (
                    (brandSpotlights[selectedBrand.id] || []).map(s => (
                      <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ color: selectedBrand.color }}><i className={s.icon}></i></span>
                          <div>
                            <div style={{ fontSize: '12.5px', fontWeight: '600', color: 'var(--text-primary)' }}>{s.title}</div>
                            <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
                              Type: <span style={{ textTransform: 'capitalize' }}>{s.type}</span> &bull; Fields: <code>{s.fieldKeys.join(', ')}</code>
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button 
                            onClick={() => {
                              setEditingSpotlight(s);
                              setSpotlightFormTitle(s.title);
                              setSpotlightFormIcon(s.icon);
                              setSpotlightFormType(s.type);
                              setSpotlightFormKey(s.fieldKeys.join(', '));
                              setSpotlightFormBinaryTrue(s.binaryTrueLabel || 'Compliant');
                              setSpotlightFormBinaryFalse(s.binaryFalseLabel || 'Non-compliant');
                              setSpotlightFormSegmentScope(s.segmentScope || []);
                            }}
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '4px 8px', color: selectedBrand.color, height: 'auto', background: `oklch(from ${selectedBrand.color} l c h / 0.08)` }}
                          >
                            <i className="fas fa-edit"></i> Edit
                          </button>
                          <button 
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete the spotlight widget "${s.title}"?`)) {
                                handleDeleteSpotlight(s.id);
                              }
                            }}
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '4px 8px', color: '#ef4444', height: 'auto', background: 'rgba(239, 68, 68, 0.08)' }}
                          >
                            <i className="fas fa-trash-alt"></i> Delete
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Add / Edit Form */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: '700', marginBottom: '12px', color: selectedBrand.color }}>
                  {editingSpotlight ? `Edit Spotlight Widget: ${editingSpotlight.title}` : 'Add New Spotlight Widget'}
                </h4>
                
                <form onSubmit={handleSaveSpotlightForm} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>Widget Title *</label>
                      <input 
                        type="text" 
                        required
                        placeholder="e.g. Free Trial Duration"
                        value={spotlightFormTitle}
                        onChange={e => setSpotlightFormTitle(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>FontAwesome Icon Class</label>
                      <input 
                        type="text" 
                        placeholder="e.g. fas fa-clock"
                        value={spotlightFormIcon}
                        onChange={e => setSpotlightFormIcon(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>Evaluation Logic Type</label>
                      <select 
                        value={spotlightFormType}
                        onChange={e => setSpotlightFormType(e.target.value as 'groupby' | 'binary' | 'trial')}
                        style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                      >
                        <option value="groupby">Group By Values (e.g. Unique Categories, Cities, Plans)</option>
                        <option value="binary">Binary Check (e.g. Yes/No Compliance Comparison Rate)</option>
                        <option value="trial">14-Day Trial Countdown (Optimaviz free trial tracker)</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>Custom Field Key(s) (comma-separated)</label>
                      <input 
                        type="text" 
                        required
                        placeholder="e.g. trial_duration_days, TrialLength"
                        value={spotlightFormKey}
                        onChange={e => setSpotlightFormKey(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px' }}
                      />
                      <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>CRM custom metadata key mapping matched in order</span>
                    </div>
                  </div>

                  {spotlightFormType === 'binary' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'var(--bg-base)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '4px' }}>Binary True Display Label</label>
                        <input 
                          type="text" 
                          placeholder="Compliant"
                          value={spotlightFormBinaryTrue}
                          onChange={e => setSpotlightFormBinaryTrue(e.target.value)}
                          style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '11px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '4px' }}>Binary False Display Label</label>
                        <input 
                          type="text" 
                          placeholder="Non-compliant"
                          value={spotlightFormBinaryFalse}
                          onChange={e => setSpotlightFormBinaryFalse(e.target.value)}
                          style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '11px' }}
                        />
                      </div>
                    </div>
                  )}

                  {(getBrandSegmentOptions(selectedBrand.id) || []).length > 0 && (
                    <div style={{ background: 'var(--bg-base)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>
                        Segment Scope <span style={{ fontWeight: '400', color: 'var(--text-muted)' }}>(leave all unchecked to show for all segments)</span>
                      </label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {(getBrandSegmentOptions(selectedBrand.id) || []).map(seg => (
                          <label key={seg.value} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', padding: '4px 10px', borderRadius: '6px', border: `1.5px solid ${spotlightFormSegmentScope.includes(seg.value) ? selectedBrand.color : 'var(--border)'}`, background: spotlightFormSegmentScope.includes(seg.value) ? `oklch(from ${selectedBrand.color} l c h / 0.08)` : 'var(--bg-card)', fontWeight: spotlightFormSegmentScope.includes(seg.value) ? '700' : '400', color: spotlightFormSegmentScope.includes(seg.value) ? selectedBrand.color : 'var(--text-primary)', transition: 'all 0.1s' }}>
                            <input
                              type="checkbox"
                              checked={spotlightFormSegmentScope.includes(seg.value)}
                              onChange={e => {
                                setSpotlightFormSegmentScope(prev =>
                                  e.target.checked ? [...prev, seg.value] : prev.filter(v => v !== seg.value)
                                );
                              }}
                              style={{ display: 'none' }}
                            />
                            <i className={seg.icon} style={{ fontSize: '11px' }}></i>
                            {seg.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
                    {editingSpotlight && (
                      <button 
                        type="button" 
                        onClick={() => {
                          setEditingSpotlight(null);
                          setSpotlightFormTitle('');
                          setSpotlightFormIcon('fas fa-chart-pie');
                          setSpotlightFormType('groupby');
                          setSpotlightFormKey('');
                          setSpotlightFormBinaryTrue('Compliant');
                          setSpotlightFormBinaryFalse('Non-compliant');
                          setSpotlightFormSegmentScope([]);
                        }}
                        className="btn btn-ghost" 
                        style={{ fontSize: '12px', padding: '6px 12px' }}
                      >
                        Cancel Edit
                      </button>
                    )}
                    <button 
                      type="submit" 
                      className="btn btn-primary" 
                      style={{ background: selectedBrand.color, fontSize: '12px', padding: '6px 14px' }}
                    >
                      <i className="fas fa-check"></i> {editingSpotlight ? 'Save Changes' : 'Create Spotlight'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
            
            <div className="modal-footer">
              <button onClick={() => setSpotlightModalOpen(false)} className="btn btn-secondary" style={{ fontSize: '12px', padding: '6px 14px' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM MINI-DASHBOARD WIDGET BUILDER MODAL */}
      {nestwiseCardsModalOpen && selectedBrand?.id === 'nestwise' && (
        <div className="modal-overlay">
          <div className="modal-content nestwise-card-manager-modal">
            <div className="modal-header">
              <h3><i className="fas fa-sliders" style={{ color: selectedBrand.color }}></i> Customize NestWise Cards</h3>
              <button className="modal-close" aria-label="Close" onClick={() => setNestwiseCardsModalOpen(false)}>&times;</button>
            </div>
            <div className="modal-body nestwise-card-manager">
              <div className="nestwise-card-manager-help">
                <strong>Field shortcuts:</strong> <code>__total__</code>, <code>__owner_leads__</code>, <code>__service_pipeline__</code>, <code>__owner_control__</code>, <code>__diaspora_support__</code>, <code>__reporting_needed__</code>, <code>__subscription_opportunities__</code>, <code>__emergency_response__</code>, <code>__followups_due__</code>, <code>__missing_phone__</code>. You can also use <code>segment</code>, <code>service_interest</code>, <code>revenue_model</code>, <code>funnel_stage</code>, or any NestWise custom column. Use <code>|</code> to match multiple values.
              </div>

              {nestwiseCards.length === 0 && (
                <div className="nestwise-empty-manager">No cards yet. Add one below.</div>
              )}

              {nestwiseCards.map(card => (
                <section key={card.id} className="nestwise-manager-card">
                  <div className="nestwise-manager-card-header">
                    <div>
                      <label>Card title</label>
                      <input value={card.title} onChange={e => updateNestwiseCard(card.id, { title: e.target.value })} />
                    </div>
                    <div>
                      <label>Icon</label>
                      <input value={card.icon} onChange={e => updateNestwiseCard(card.id, { icon: e.target.value })} placeholder="fa-house-chimney" />
                    </div>
                    <div>
                      <label>Color</label>
                      <input value={card.color} onChange={e => updateNestwiseCard(card.id, { color: e.target.value })} />
                    </div>
                    <div>
                      <label>Type</label>
                      <select value={card.type} onChange={e => updateNestwiseCard(card.id, { type: e.target.value as NestwiseDashboardCard['type'] })}>
                        <option value="metrics">Metric rows</option>
                        <option value="progress">Progress rows</option>
                        <option value="journey">Journey steps</option>
                      </select>
                    </div>
                    <button type="button" className="section-card-icon-btn danger" onClick={() => handleDeleteNestwiseCard(card.id)} title="Delete card">
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>

                  <div className="nestwise-manager-items">
                    {card.items.map((item, idx) => (
                      <div key={item.id} className={card.type === 'journey' ? 'nestwise-manager-item journey' : 'nestwise-manager-item'}>
                        <div>
                          <label>{card.type === 'journey' ? `Step ${idx + 1}` : 'Row label'}</label>
                          <input value={item.label} onChange={e => updateNestwiseCardItem(card.id, item.id, { label: e.target.value })} />
                        </div>
                        {card.type !== 'journey' && (
                          <>
                            <div>
                              <label>Field key</label>
                              <input value={item.fieldKey || ''} onChange={e => updateNestwiseCardItem(card.id, item.id, { fieldKey: e.target.value })} placeholder="segment" />
                            </div>
                            <div>
                              <label>Match value</label>
                              <input value={item.matchValue || ''} onChange={e => updateNestwiseCardItem(card.id, item.id, { matchValue: e.target.value })} placeholder="airbnb_hosts|long_rental" />
                            </div>
                          </>
                        )}
                        <div>
                          <label>Color</label>
                          <input value={item.color || card.color} onChange={e => updateNestwiseCardItem(card.id, item.id, { color: e.target.value })} />
                        </div>
                        <button type="button" className="section-card-icon-btn danger" onClick={() => handleDeleteNestwiseCardItem(card.id, item.id)} title="Delete row">
                          <i className="fas fa-times"></i>
                        </button>
                      </div>
                    ))}
                  </div>

                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleAddNestwiseCardItem(card.id)} style={{ color: card.color, borderColor: card.color }}>
                    <i className="fas fa-plus"></i> Add Row
                  </button>
                </section>
              ))}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={resetNestwiseCards}>
                <i className="fas fa-rotate-left"></i> Reset Defaults
              </button>
              <button type="button" className="btn btn-ghost" onClick={handleAddNestwiseCard}>
                <i className="fas fa-plus"></i> Add Card
              </button>
              <button type="button" className="btn btn-primary" style={{ background: selectedBrand.color }} onClick={() => setNestwiseCardsModalOpen(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {widgetModalOpen && selectedBrand && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '540px', width: '90%', maxHeight: '90vh', overflow: 'hidden' }}>
            <div className="modal-header">
              <h3><i className="fas fa-magic" style={{ color: selectedBrand.color }}></i> {editingWidget ? 'Edit Metric Widget' : 'Create Custom Metric Widget'}</h3>
              <button className="modal-close" aria-label="Close" onClick={() => { setEditingWidget(null); setWidgetModalOpen(false); }}>&times;</button>
            </div>
            <form onSubmit={handleAddWidget} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div className="modal-body">
                
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Widget Display Title *</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. Contractors with ABN, High Value Deals" 
                    value={widgetForm.title} 
                    onChange={e => setWidgetForm({...widgetForm, title: e.target.value})} 
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Criteria Type</label>
                    <select 
                      value={widgetForm.criteriaType} 
                      onChange={e => {
                        const type = e.target.value as 'segment' | 'stage' | 'custom_field';
                        let firstVal = '';
                        if (type === 'segment') {
                          firstVal = getBrandSegmentOptions(selectedBrand.id)?.[0]?.value || '';
                        } else if (type === 'stage') {
                          firstVal = getBrandStageOptions(selectedBrand.id)[0];
                        } else if (type === 'custom_field') {
                          firstVal = customFields[0]?.field_name || '';
                        }
                        setWidgetForm({
                          ...widgetForm,
                          criteriaType: type,
                          criteriaValue: firstVal,
                          criteriaOp: 'present'
                        });
                      }}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                    >
                      <option value="segment">By Marketing Segment</option>
                      <option value="stage">By Sales Stage</option>
                      <option value="custom_field">By Custom Field Column</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Target Parameter Match</label>
                    {widgetForm.criteriaType === 'segment' && (
                      <select 
                        value={widgetForm.criteriaValue} 
                        onChange={e => setWidgetForm({...widgetForm, criteriaValue: e.target.value})} 
                        style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                      >
                        {(getBrandSegmentOptions(selectedBrand.id) || []).map(seg => (
                          <option key={seg.value} value={seg.value}>{seg.label}</option>
                        ))}
                      </select>
                    )}

                    {widgetForm.criteriaType === 'stage' && (
                      <select 
                        value={widgetForm.criteriaValue} 
                        onChange={e => setWidgetForm({...widgetForm, criteriaValue: e.target.value})} 
                        style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                      >
                        {getBrandStageOptions(selectedBrand.id).map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    )}

                    {widgetForm.criteriaType === 'custom_field' && (
                      customFields.length > 0 ? (
                        <select 
                          value={widgetForm.criteriaValue} 
                          onChange={e => setWidgetForm({...widgetForm, criteriaValue: e.target.value})} 
                          style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                        >
                          {customFields.map(f => (
                            <option key={f.id} value={f.field_name}>{f.field_name}</option>
                          ))}
                        </select>
                      ) : (
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', paddingTop: '10px' }}>No custom fields defined yet!</div>
                      )
                    )}
                  </div>
                </div>

                 {widgetForm.criteriaType === 'custom_field' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Operator</label>
                        <select 
                          value={widgetForm.criteriaOp} 
                          onChange={e => setWidgetForm({...widgetForm, criteriaOp: e.target.value as any})} 
                          style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                        >
                          <option value="present">Is Present (Not Empty)</option>
                          <option value="groupby">Dynamic Breakdown (Group-by distinct values e.g. Perth, Bunbury)</option>
                          <option value="equals">Equals Exactly</option>
                          <option value="contains">Contains Substring</option>
                        </select>
                      </div>

                      {widgetForm.criteriaOp !== 'present' && widgetForm.criteriaOp !== 'groupby' && (
                        <div>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Value to compare</label>
                          <input 
                            type="text" 
                            required 
                            placeholder="e.g. Yes, 100, NSW" 
                            value={widgetForm.criteriaCompareValue} 
                            onChange={e => setWidgetForm({...widgetForm, criteriaCompareValue: e.target.value})} 
                            style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px' }}
                          />
                        </div>
                      )}
                    </div>

                    {widgetForm.criteriaValue && (
                      <div style={{ background: 'var(--bg-base)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                          <i className="fas fa-search" style={{ marginRight: '4px' }}></i> Values currently present in Leads database for "{widgetForm.criteriaValue}":
                        </span>
                        {(() => {
                          const uniqueVals = getUniqueCustomFieldValues(widgetForm.criteriaValue);
                          if (uniqueVals.length === 0) {
                            return <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>No values recorded yet in this custom field column.</span>;
                          }
                          return (
                            <div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                                {uniqueVals.map(v => (
                                  <button
                                    type="button"
                                    key={v}
                                    onClick={() => setWidgetForm({ ...widgetForm, criteriaCompareValue: v })}
                                    style={{ fontSize: '10px', background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', color: 'var(--text-primary)', fontWeight: '500' }}
                                    title="Click to fill Value to compare"
                                  >
                                    {v}
                                  </button>
                                ))}
                              </div>
                              <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>💡 Click any item to auto-populate "Value to compare".</span>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Visual Icon</label>
                    <select 
                      value={widgetForm.icon} 
                      onChange={e => setWidgetForm({...widgetForm, icon: e.target.value})} 
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                    >
                      <option value="fa-chart-pie">Pie Chart</option>
                      <option value="fa-file-invoice">Invoice / ABN</option>
                      <option value="fa-id-card">ID Card / Missing ABN</option>
                      <option value="fa-users">Users Team</option>
                      <option value="fa-hourglass-half">Free Trial / Wait</option>
                      <option value="fa-check-double">Task Complete / Sub</option>
                      <option value="fa-brain">AI / Brain Model</option>
                      <option value="fa-briefcase">Briefcase Advisory</option>
                      <option value="fa-key">Property / Key</option>
                      <option value="fa-broom">Service Broom</option>
                      <option value="fa-user-clock">Active Roster / Wait</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Aesthetic Accent Color</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input 
                        type="color" 
                        value={widgetForm.color} 
                        onChange={e => setWidgetForm({...widgetForm, color: e.target.value})} 
                        style={{ border: 'none', background: 'transparent', width: '36px', height: '36px', padding: 0, cursor: 'pointer' }}
                      />
                      <input 
                        type="text" 
                        value={widgetForm.color} 
                        onChange={e => setWidgetForm({...widgetForm, color: e.target.value})} 
                        style={{ flex: 1, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px' }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Counting Mode</label>
                  <select
                    value={widgetForm.countMode}
                    onChange={e => setWidgetForm({ ...widgetForm, countMode: e.target.value as any })}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                  >
                    <option value="records">Count matching records</option>
                    <option value="unique_people">Count unique people only</option>
                    <option value="valid_abn">Count unique people with valid ABN</option>
                    <option value="missing_abn">Count unique people with no valid ABN</option>
                  </select>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Target Goal Limit (Optional)</label>
                  <input 
                    type="number" 
                    placeholder="e.g. 50, 100 (leave empty for none)" 
                    value={widgetForm.goal || ''} 
                    onChange={e => setWidgetForm({...widgetForm, goal: Number(e.target.value)})} 
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px' }}
                  />
                </div>

              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => { setEditingWidget(null); setWidgetModalOpen(false); }}>Cancel Design</button>
                <button type="submit" className="btn btn-primary" style={{ background: selectedBrand.color }}>
                  {editingWidget ? 'Save Metric Changes' : 'Create Telemetry Metric'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 1. MANUAL ADD LEAD MODAL */}
      {addLeadIsOpen && selectedBrand && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '560px', width: '90%', maxHeight: '92vh', overflow: 'hidden' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0 }}><i className="fas fa-user-plus" style={{ marginRight: '8px', color: selectedBrand.color }}></i> Add New Lead</h3>
                {addLeadStep === 'form' && addLeadForm.segment && (() => {
                  const seg = (getBrandSegmentOptions(selectedBrand.id) || []).find(s => s.value === addLeadForm.segment);
                  return seg ? (
                    <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: seg.color }}>
                      <i className={seg.icon}></i>
                      <span>{seg.label}</span>
                    </div>
                  ) : null;
                })()}
              </div>
              <button className="modal-close" aria-label="Close" onClick={() => { setAddLeadIsOpen(false); setAddLeadStep('segment'); }}>&times;</button>
            </div>

            {addLeadStep === 'segment' ? (
              <div className="modal-body">
                {(getBrandSegmentOptions(selectedBrand.id) || []).length > 0 ? (
                  <>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                      Choose which segment this lead belongs to. Each segment has its own set of data fields.
                    </p>
                    <div style={{ display: 'grid', gap: '10px' }}>
                      {(getBrandSegmentOptions(selectedBrand.id) || []).map(seg => (
                        <button
                          key={seg.value}
                          type="button"
                          onClick={() => {
                            const stageOptions = selectedBrand.id === 'optimaviz'
                              ? getOptimavizStageOptionsForSegment(seg.value)
                              : selectedBrand.id === 'idao'
                                ? getIdaoStageOptionsForSegment(seg.value)
                                : getBrandStageOptions(selectedBrand.id);
                            const defaultStage = stageOptions[0] || '';
                            setAddLeadForm(f => ({ ...f, segment: seg.value, funnel_stage: defaultStage }));
                            setAddLeadCustomFieldValues(selectedBrand.id === 'optimaviz'
                              ? { next_action: getOptimavizDefaultNextAction(seg.value, defaultStage) }
                              : selectedBrand.id === 'idao'
                                ? { service_type: (IDAO_SERVICE_TYPES[seg.value] || [])[0] || '', next_action: getIdaoDefaultNextAction(seg.value, defaultStage) }
                                : {});
                            setAddLeadStep('form');
                          }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '14px',
                            padding: '14px 16px', borderRadius: '12px',
                            border: `2px solid ${seg.color}22`,
                            background: `${seg.color}0d`,
                            cursor: 'pointer', textAlign: 'left', width: '100%',
                            transition: 'all 0.15s'
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = seg.color; (e.currentTarget as HTMLButtonElement).style.background = `${seg.color}1a`; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = `${seg.color}22`; (e.currentTarget as HTMLButtonElement).style.background = `${seg.color}0d`; }}
                        >
                          <span style={{ width: '42px', height: '42px', borderRadius: '12px', background: seg.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <i className={seg.icon} style={{ color: '#fff', fontSize: '16px' }}></i>
                          </span>
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>{seg.label}</div>
                            <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                              {leads.filter(l => l.custom_fields?.segment === seg.value).length} leads in this segment
                            </div>
                          </div>
                          <i className="fas fa-chevron-right" style={{ marginLeft: 'auto', color: seg.color, fontSize: '13px' }}></i>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>
                    <i className="fas fa-info-circle" style={{ fontSize: '24px', marginBottom: '10px', display: 'block' }}></i>
                    <p style={{ fontSize: '13px' }}>No segments configured for this brand. Proceeding to form.</p>
                    <button type="button" className="btn btn-primary" style={{ background: selectedBrand.color, marginTop: '12px' }} onClick={() => setAddLeadStep('form')}>Continue</button>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleAddNewLeadSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
                <div className="modal-body" style={{ overflowY: 'auto' }}>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Full Name *</label>
                    <input type="text" required value={addLeadForm.name} onChange={e => setAddLeadForm({...addLeadForm, name: e.target.value})} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px' }} placeholder="e.g. Jane Doe"/>
                  </div>
                  {selectedBrand.id === 'optimaviz' && (
                    <div style={{ marginBottom: '16px', background: 'var(--bg-base)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '12px', fontWeight: '800', color: selectedBrand.color, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}><i className="fas fa-route"></i> Optimaviz Workflow</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '10px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>Stage</label>
                          <select value={addLeadForm.funnel_stage || getOptimavizStageOptionsForSegment(addLeadForm.segment)[0]} onChange={e => {
                            const nextStage = e.target.value;
                            setAddLeadForm(prev => ({ ...prev, funnel_stage: nextStage }));
                            setAddLeadCustomFieldValues(prev => ({ ...prev, next_action: prev.next_action || getOptimavizDefaultNextAction(addLeadForm.segment, nextStage) }));
                          }} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                            {getOptimavizStageOptionsForSegment(addLeadForm.segment).map(stage => <option key={stage} value={stage}>{stage}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>Next Action</label>
                          <select value={addLeadCustomFieldValues.next_action || getOptimavizDefaultNextAction(addLeadForm.segment, addLeadForm.funnel_stage)} onChange={e => setAddLeadCustomFieldValues(prev => ({ ...prev, next_action: e.target.value }))} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                            {(OPTIMAVIZ_NEXT_ACTIONS[normalizeOptimavizSegmentValue(addLeadForm.segment) || 'demo_leads'] || []).map(action => <option key={action} value={action}>{action}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}


                  {selectedBrand.id === 'idao' && (
                    <div style={{ marginBottom: '16px', background: 'var(--bg-base)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '12px', fontWeight: '800', color: selectedBrand.color, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}><i className="fas fa-route"></i> IDAO Workflow</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '10px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>Service Type</label>
                          <select value={addLeadCustomFieldValues.service_type || (IDAO_SERVICE_TYPES[normalizeIdaoSegmentValue(addLeadForm.segment) || 'training_leads'] || [])[0] || ''} onChange={e => setAddLeadCustomFieldValues(prev => ({ ...prev, service_type: e.target.value, service_focus: e.target.value }))} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                            {(IDAO_SERVICE_TYPES[normalizeIdaoSegmentValue(addLeadForm.segment) || 'training_leads'] || []).map(service => <option key={service} value={service}>{service}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>Stage</label>
                          <select value={addLeadForm.funnel_stage || getIdaoStageOptionsForSegment(addLeadForm.segment)[0]} onChange={e => {
                            const nextStage = e.target.value;
                            setAddLeadForm(prev => ({ ...prev, funnel_stage: nextStage }));
                            setAddLeadCustomFieldValues(prev => ({ ...prev, next_action: prev.next_action || getIdaoDefaultNextAction(addLeadForm.segment, nextStage) }));
                          }} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                            {getIdaoStageOptionsForSegment(addLeadForm.segment).map(stage => <option key={stage} value={stage}>{stage}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>Next Action</label>
                          <select value={addLeadCustomFieldValues.next_action || getIdaoDefaultNextAction(addLeadForm.segment, addLeadForm.funnel_stage)} onChange={e => setAddLeadCustomFieldValues(prev => ({ ...prev, next_action: e.target.value }))} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                            {(IDAO_NEXT_ACTIONS[normalizeIdaoSegmentValue(addLeadForm.segment) || 'training_leads'] || []).map(action => <option key={action} value={action}>{action}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Email</label>
                      <input type="email" value={addLeadForm.email} onChange={e => setAddLeadForm({...addLeadForm, email: e.target.value})} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px' }} placeholder="email@example.com"/>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Phone</label>
                      <input type="text" value={addLeadForm.phone} onChange={e => setAddLeadForm({...addLeadForm, phone: e.target.value})} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px' }} placeholder="+1 555 000 0000"/>
                    </div>
                  </div>

                  {(() => {
                    const segmentFields = customFields.filter(f => f.brand_id === selectedBrand.id && f.field_name !== 'segment' && !(selectedBrand.id === 'optimaviz' && OPTIMAVIZ_STANDARD_CUSTOM_FIELD_COLUMNS.has(String(f.field_name || '').toLowerCase())));
                    if (segmentFields.length === 0) return null;
                    return (
                      <div style={{ marginBottom: '16px', background: 'var(--bg-base)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '12px', fontWeight: '700', color: selectedBrand.color, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <i className="fas fa-table-columns"></i> Segment Fields
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                          {segmentFields.map(f => (
                            <div key={f.id}>
                              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px', textTransform: 'capitalize' }}>
                                {f.field_name.replace(/_/g, ' ')}
                              </label>
                              {f.field_type === 'boolean' ? (
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  {['true', 'false'].map(bv => (
                                    <button
                                      key={bv}
                                      type="button"
                                      onClick={() => setAddLeadCustomFieldValues(prev => ({ ...prev, [f.field_name]: prev[f.field_name] === bv ? '' : bv }))}
                                      style={{ flex: 1, padding: '7px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', border: `1.5px solid ${addLeadCustomFieldValues[f.field_name] === bv ? (bv === 'true' ? '#059669' : '#dc2626') : 'var(--border)'}`, background: addLeadCustomFieldValues[f.field_name] === bv ? (bv === 'true' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)') : 'var(--bg-card)', color: addLeadCustomFieldValues[f.field_name] === bv ? (bv === 'true' ? '#059669' : '#dc2626') : 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.1s' }}
                                    >
                                      <i className={`fas ${bv === 'true' ? 'fa-check' : 'fa-times'}`} style={{ marginRight: '4px' }}></i>
                                      {bv === 'true' ? 'Yes' : 'No'}
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <input
                                  type={f.field_type === 'number' ? 'number' : f.field_type === 'date' ? 'date' : 'text'}
                                  value={addLeadCustomFieldValues[f.field_name] || ''}
                                  onChange={e => setAddLeadCustomFieldValues(prev => ({ ...prev, [f.field_name]: e.target.value }))}
                                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px' }}
                                  placeholder={`Enter ${f.field_name.replace(/_/g, ' ')}`}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>
                      <i className="fas fa-user-shield" style={{ marginRight: '6px', color: selectedBrand.color }}></i> Responsibility *
                    </label>
                    <select 
                      required 
                      value={addLeadForm.owner_id || ''} 
                      onChange={e => {
                        const selId = e.target.value;
                        const selU = usersList.find(u => u.id === selId);
                        setAddLeadForm({ ...addLeadForm, owner_id: selId, owner_name: selU ? selU.name : '' });
                      }} 
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                    >
                      <option value="">-- Assign Responsibility --</option>
                      {usersList.map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Notes</label>
                    <textarea value={addLeadForm.notes} onChange={e => setAddLeadForm({...addLeadForm, notes: e.target.value})} rows={3} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px' }} placeholder="Any additional notes..."/>
                  </div>
                </div>
                <div className="modal-footer">
                  {(getBrandSegmentOptions(selectedBrand.id) || []).length > 0 && (
                    <button type="button" className="btn btn-ghost" onClick={() => setAddLeadStep('segment')}>
                      <i className="fas fa-arrow-left"></i> Back
                    </button>
                  )}
                  <button type="button" className="btn btn-ghost" onClick={() => { setAddLeadIsOpen(false); setAddLeadStep('segment'); }}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={leadAdding} style={{ background: selectedBrand.color }}>
                    {leadAdding ? 'Saving...' : 'Save Lead'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 2. CSV EXCEL BULK LEADS UPLOADER */}
      {uploadIsOpen && selectedBrand && (
        <div className="modal-overlay import-modal-overlay">
          <div className="modal-content upload-modal import-leads-modal is-streamlined" style={{ maxWidth: '720px', width: 'min(96vw, 720px)', maxHeight: 'calc(100dvh - 28px)', overflow: 'hidden' }}>
            <div className="modal-header">
              <h3><i className="fas fa-file-import"></i> Import leads</h3>
              <button className="modal-close" aria-label="Close" disabled={csvImporting} onClick={closeImportModal}>&times;</button>
            </div>
            <form onSubmit={handleCsvImportSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div ref={importModalBodyRef} className="modal-body import-leads-modal__body" style={{ overflowY: 'auto', flex: 1, minHeight: 0, paddingRight: '8px' }}>
                <ol className="import-wizard-steps" aria-label="Import steps">
                  <li className={importSuccessMessage || fileName || csvText ? 'is-done' : 'is-active'}><i className="fas fa-1"></i><span>Upload file</span></li>
                  <li className={importSuccessMessage || csvPreview ? (importSuccessMessage || csvMapping.name ? 'is-done' : 'is-active') : ''}><i className="fas fa-2"></i><span>Map columns</span></li>
                  <li className={importSuccessMessage ? 'is-done' : (csvPreview && csvMapping.name ? 'is-active' : '')}><i className="fas fa-3"></i><span>Review & import</span></li>
                </ol>

                {importSuccessMessage ? (
                  <div className="import-success-slate">
                    <div className="import-success-slate__icon" style={{ color: selectedBrand.color, background: `color-mix(in srgb, ${selectedBrand.color} 12%, var(--bg-base))` }}>
                      <i className="fas fa-check" />
                    </div>
                    <h4>Leads loaded into {selectedBrand.name}</h4>
                    <p>{importSuccessMessage}</p>
                    <p className="import-success-slate__hint">
                      Close this dialog to return to your pipeline. Opening Import again starts a fresh upload — no previous file is kept.
                    </p>
                  </div>
                ) : (
                <>
                {/* Visual inline error feedback banner */}
                {importError && (
                  <div style={{ backgroundColor: 'oklch(95% 0.05 20 / 0.1)', border: '1px solid var(--error)', borderRadius: '8px', padding: '12px 14px', marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <i className="fas fa-exclamation-circle" style={{ color: 'var(--error)', fontSize: '16px' }}></i>
                    <p style={{ margin: 0, fontSize: '12px', fontWeight: '600', color: 'var(--error)', lineHeight: '1.4' }}>{importError}</p>
                  </div>
                )}
                {!csvMapping.name && csvPreview && (
                  <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '10px 12px', borderRadius: '8px', marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <i className="fas fa-info-circle" style={{ color: '#f59e0b', fontSize: '14px', marginTop: '2px' }}></i>
                    <p style={{ margin: 0, fontSize: '11px', color: '#92400e', lineHeight: '1.4' }}>
                      <strong>Action Required:</strong> Please map the <strong>Name Column</strong> under the Column Mapping Configuration below. Excel and CSV leads require a mapped Name value to import.
                    </p>
                  </div>
                )}

                {/* File Upload Zone */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>
                    <i className="fas fa-file-csv" style={{ color: selectedBrand.color, marginRight: '6px' }}></i> Upload Spreadsheet File
                  </label>
                  <div 
                    className={`upload-dropzone${isDragOver ? ' is-drag-over' : ''}`}
                    style={{ 
                      border: isDragOver ? `2px dashed ${selectedBrand.color}` : '2px dashed var(--border)', 
                      borderRadius: '12px', 
                      padding: '24px', 
                      textAlign: 'center', 
                      background: isDragOver ? `oklch(from var(--bg-base) l c h / 0.6)` : 'var(--bg-base)',
                      boxShadow: isDragOver ? `0 0 0 4px ${selectedBrand.color}22` : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.18s ease',
                      transform: isDragOver ? 'scale(1.01)' : 'scale(1)',
                    }}
                    onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                    onDragEnter={e => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={e => { e.preventDefault(); setIsDragOver(false); }}
                    onDrop={handleFileDrop}
                    onClick={() => document.getElementById('excel-file-input')?.click()}
                  >
                    <i className="fas fa-cloud-upload-alt" style={{ fontSize: '28px', color: isDragOver ? selectedBrand.color : 'var(--text-muted)', marginBottom: '8px', transition: 'color 0.18s' }}></i>
                    <p style={{ fontSize: '13px', fontWeight: '600', margin: '0 0 4px', color: isDragOver ? selectedBrand.color : 'var(--text-primary)', transition: 'color 0.18s' }}>{isDragOver ? 'Drop your file here!' : 'Click to browse or drag & drop'}</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>Supports Microsoft Excel (.xlsx) and CSV (.csv) files</p>
                    <input 
                      id="excel-file-input"
                      ref={excelFileInputRef}
                      type="file" 
                      accept=".xlsx, .csv"
                      onChange={handleFileChange} 
                      style={{ display: 'none' }}
                      disabled={csvImporting}
                    />
                  </div>
                  {fileName && !importSuccessMessage && (
                    <div className="import-file-chip" style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-primary)', background: 'rgba(16, 124, 65, 0.08)', padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(16, 124, 65, 0.2)' }}>
                      <i className="fas fa-file-alt" style={{ color: selectedBrand.color }}></i>
                      <span style={{ fontWeight: '600', flex: 1 }}>{fileName}</span>
                      <button type="button" disabled={csvImporting} onClick={handleClearFile} aria-label="Remove file" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: csvImporting ? 'not-allowed' : 'pointer', fontSize: '14px', padding: '0 4px' }}>&times;</button>
                    </div>
                  )}
                  {excelSheetMetas.length > 1 && (
                    <div
                      className="import-sheet-picker"
                      style={{
                        marginTop: '12px',
                        padding: '12px 14px',
                        borderRadius: '10px',
                        border: `1px solid color-mix(in srgb, ${selectedBrand.color} 28%, var(--border))`,
                        background: `color-mix(in srgb, ${selectedBrand.color} 6%, var(--bg-card))`,
                      }}
                    >
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-primary)' }}>
                        <i className="fas fa-layer-group" style={{ color: selectedBrand.color, marginRight: '6px' }}></i>
                        Excel sheet
                      </label>
                      <p style={{ margin: '0 0 8px', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                        This workbook has {excelSheetMetas.length} sheets. We auto-select the sheet that looks most like a data table (headers + rows). Change it if needed.
                      </p>
                      <select
                        value={selectedExcelSheetIndex}
                        onChange={e => handleExcelSheetChange(Number(e.target.value))}
                        className="brand-aware-select"
                        style={{ width: '100%', height: '38px', borderRadius: '8px', padding: '0 10px', fontSize: '12px', fontWeight: 700 }}
                      >
                        {excelSheetMetas.map(meta => (
                          <option key={`${meta.index}-${meta.name}`} value={meta.index}>
                            {meta.name}
                            {meta.looksLikeTable ? ' · data table' : ' · maybe notes'}
                            {` · ${Math.max(0, meta.rowCount - 1)} rows`}
                            {meta.index === selectedExcelSheetIndex ? ' (selected)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <details className="import-advanced-details">
                  <summary><i className="fas fa-keyboard"></i> Paste CSV text instead</summary>
                  <textarea 
                    value={csvText} 
                    onChange={handleCsvTextChange} 
                    placeholder={"name,email,phone\\nAlice Smith,alice@domain.co,55539201"}
                    rows={3}
                    style={{ width: '100%', padding: '12px', border: '1px solid var(--border)', borderRadius: '8px', fontFamily: 'var(--font-mono)', fontSize: '12px', background: 'var(--bg-card)', marginBottom: 10 }}
                  />
                </details>

                {csvPreview && (
                  <div style={{ marginTop: '12px' }}>
                    <p className="import-tip">
                      <strong>{csvPreview.totalRows} rows</strong> detected for <strong>{selectedBrand.name}</strong>.
                      Map <strong>Name</strong> (required), then email/phone/date. Extra columns stay optional below.
                    </p>
                    <h5 style={{ fontSize: '12.5px', fontWeight: '700', marginBottom: '8px', color: 'var(--text-primary)' }}>
                      Essential mapping
                    </h5>
                    
                    <div className="import-map-essentials">
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '4px', color: 'var(--text-secondary)' }}>First / Full Name Column</label>
                        <ImportColumnPicker value={csvMapping.name || ''} options={csvPreview.headers} placeholder="None / Auto Detect" onChange={val => {
                          setCsvMapping({...csvMapping, name: val});
                          if(val) setSelectedImportColumns(prev => { const n = new Set(prev); n.add(val); return n; });
                        }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '4px', color: 'var(--text-secondary)' }}>Last Name Column</label>
                        <ImportColumnPicker value={csvMapping.name_secondary || ''} options={csvPreview.headers} placeholder="None / Ignore" onChange={val => {
                          setCsvMapping({...csvMapping, name_secondary: val});
                          if(val) setSelectedImportColumns(prev => { const n = new Set(prev); n.add(val); return n; });
                        }} />
                        <p style={{ margin: '4px 0 0', fontSize: '10px', color: 'var(--text-muted)' }}>
                          Optional. CRM will join first + last name.
                        </p>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '4px', color: 'var(--text-secondary)' }}>Email Column</label>
                        <ImportColumnPicker value={csvMapping.email || ''} options={csvPreview.headers} placeholder="None / Ignore" onChange={val => {
                          setCsvMapping({...csvMapping, email: val});
                          if(val) setSelectedImportColumns(prev => { const n = new Set(prev); n.add(val); return n; });
                        }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '4px', color: 'var(--text-secondary)' }}>Phone Column</label>
                        <ImportColumnPicker value={csvMapping.phone || ''} options={csvPreview.headers} placeholder="None / Ignore" onChange={val => {
                          setCsvMapping({...csvMapping, phone: val});
                          if(val) setSelectedImportColumns(prev => { const n = new Set(prev); n.add(val); return n; });
                        }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '4px', color: 'var(--text-secondary)' }}>Lead Date Column</label>
                        <ImportColumnPicker value={csvMapping.created_at || ''} options={csvPreview.headers} placeholder="Use import date" onChange={val => {
                          setCsvMapping({...csvMapping, created_at: val});
                          if(val) setSelectedImportColumns(prev => { const n = new Set(prev); n.add(val); return n; });
                        }} />
                        <p style={{ margin: '4px 0 0', fontSize: '10px', color: 'var(--text-muted)' }}>
                          Used for newest-to-oldest sorting and day/week/month tracking.
                        </p>
                      </div>
                    </div>

                    {importCleanup && (
                      <div className="import-cleanup-wizard" style={{ marginBottom: '20px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px' }}>
                        <h6 style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: '7px' }}>
                          <i className="fas fa-broom" style={{ color: selectedBrand.color }}></i> Import Cleanup Wizard
                        </h6>
                        <p style={{ margin: '0 0 10px', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                          Click a card to review rows and choose an action. <strong>File duplicates</strong> = the same email address or phone number appears more than once in this spreadsheet.
                          {' '}<strong>CRM duplicates</strong> = this row already matches a lead in the CRM by email address or phone number.
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                          {([
                            { key: 'missingName' as const, label: 'Missing names', value: importCleanup.missingName, color: '#ef4444' },
                            { key: 'missingEmail' as const, label: 'Missing emails', value: importCleanup.missingEmail, color: '#f59e0b' },
                            { key: 'missingPhone' as const, label: 'Missing phones', value: importCleanup.missingPhone, color: '#f59e0b' },
                            { key: 'fileDups' as const, label: 'File duplicates', value: importCleanup.fileDuplicateRows, color: '#0f766e' },
                            { key: 'crmDups' as const, label: 'CRM duplicates', value: importCleanup.crmDuplicateRows, color: '#0ea5e9' },
                            ...(selectedBrand.id === 'taskgo'
                              ? [{ key: 'taskgoAbn' as const, label: 'TaskGo no ABN', value: importCleanup.taskgoMissingAbn, color: '#f97316' }]
                              : []),
                          ]).map(card => {
                            const active = importCleanupFocus === card.key;
                            const clickable = Number(card.value) > 0;
                            return (
                              <button
                                key={card.key}
                                type="button"
                                disabled={!clickable}
                                onClick={() => setImportCleanupFocus(prev => prev === card.key ? null : card.key)}
                                style={{
                                  padding: '9px',
                                  borderRadius: '9px',
                                  border: active ? `1.5px solid ${card.color}` : '1px solid var(--border)',
                                  background: active ? `${card.color}14` : 'var(--bg-card)',
                                  textAlign: 'left',
                                  cursor: clickable ? 'pointer' : 'default',
                                  opacity: clickable ? 1 : 0.7,
                                }}
                              >
                                <strong style={{ display: 'block', color: card.value ? card.color : 'var(--text-primary)', fontSize: '17px' }}>{card.value}</strong>
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{card.label}</span>
                                {clickable && (
                                  <span style={{ display: 'block', marginTop: 4, fontSize: '9.5px', fontWeight: 700, color: card.color }}>
                                    {active ? 'Hide details' : 'Review & act'}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {importCleanupFocus && (
                          <div className="import-cleanup-detail" style={{ marginTop: 12, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-card)', padding: 12 }}>
                            {importCleanupFocus === 'fileDups' && (
                              <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                                  <div>
                                    <strong style={{ fontSize: 12 }}>File duplicates</strong>
                                    <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                                      These rows repeat a name/email/phone already present earlier in the same file. Choose skip, merge, or create for each.
                                    </p>
                                  </div>
                                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    {(['skip', 'merge', 'create'] as DuplicateImportStrategy[]).map(action => (
                                      <button
                                        key={action}
                                        type="button"
                                        className="btn btn-sm btn-ghost"
                                        style={{ fontSize: 10, padding: '3px 8px' }}
                                        onClick={() => {
                                          setRowDuplicateActions(prev => {
                                            const next = { ...prev };
                                            duplicatesAnalysis.fileDuplicates.forEach(idx => { next[idx] = action; });
                                            return next;
                                          });
                                          setConfirmDuplicateImport(false);
                                        }}
                                      >
                                        All → {action}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  {duplicatesAnalysis.details.filter(d => d.kind === 'file').map(d => (
                                    <div key={`file-${d.rowIndex}`} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, background: 'var(--bg-base)' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                                        <strong style={{ fontSize: 11.5 }}>Row {d.rowIndex + 2}: {d.fileName}</strong>
                                        <select
                                          value={getRowDuplicateAction(d.rowIndex)}
                                          onChange={e => {
                                            const val = e.target.value as DuplicateImportStrategy;
                                            setRowDuplicateActions(prev => ({ ...prev, [d.rowIndex]: val }));
                                            setConfirmDuplicateImport(false);
                                          }}
                                          style={{ fontSize: 11, padding: '3px 6px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)' }}
                                        >
                                          <option value="skip">Skip this row</option>
                                          <option value="merge">Merge into first file occurrence / CRM</option>
                                          <option value="create">Create as separate lead</option>
                                        </select>
                                      </div>
                                      <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                        <div>
                                          <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>This row</span>
                                          <div>Email: {d.fileEmail || '—'}</div>
                                          <div>Phone: {d.filePhone || '—'}</div>
                                        </div>
                                        <div>
                                          <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>First seen</span>
                                          <div>Spreadsheet row {(d.fileDupOfRow ?? 0) + 2}</div>
                                          <div style={{ color: 'var(--text-muted)' }}>{d.message}</div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                  {duplicatesAnalysis.details.filter(d => d.kind === 'file').length === 0 && (
                                    <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>No file duplicates detected.</p>
                                  )}
                                </div>
                              </>
                            )}

                            {importCleanupFocus === 'crmDups' && (
                              <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                                  <div>
                                    <strong style={{ fontSize: 12 }}>CRM duplicates — compare & choose</strong>
                                    <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                                      File row vs existing CRM lead. Use <em>Merge</em> to update the existing person, or <em>Create new</em> for a returning customer under another segment (e.g. bought shoes, now buying a hat).
                                    </p>
                                  </div>
                                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    {(['skip', 'merge', 'create'] as DuplicateImportStrategy[]).map(action => (
                                      <button
                                        key={action}
                                        type="button"
                                        className="btn btn-sm btn-ghost"
                                        style={{ fontSize: 10, padding: '3px 8px' }}
                                        onClick={() => {
                                          setRowDuplicateActions(prev => {
                                            const next = { ...prev };
                                            duplicatesAnalysis.crmDuplicates.forEach(idx => { next[idx] = action; });
                                            return next;
                                          });
                                          setDuplicateImportStrategy(action);
                                          setConfirmDuplicateImport(false);
                                        }}
                                      >
                                        All → {action}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  {duplicatesAnalysis.details.filter(d => d.kind === 'crm').map(d => (
                                    <div key={`crm-${d.rowIndex}`} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, background: 'var(--bg-base)' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                                        <strong style={{ fontSize: 11.5 }}>Row {d.rowIndex + 2}: {d.fileName}</strong>
                                        <select
                                          value={getRowDuplicateAction(d.rowIndex)}
                                          onChange={e => {
                                            const val = e.target.value as DuplicateImportStrategy;
                                            setRowDuplicateActions(prev => ({ ...prev, [d.rowIndex]: val }));
                                            setConfirmDuplicateImport(false);
                                          }}
                                          style={{ fontSize: 11, padding: '3px 6px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)' }}
                                        >
                                          <option value="skip">Skip (do not import)</option>
                                          <option value="merge">Merge into existing CRM lead</option>
                                          <option value="create">Create as new lead / segment</option>
                                        </select>
                                      </div>
                                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 10.5 }}>
                                        <div style={{ border: '1px solid rgba(14,165,233,.25)', borderRadius: 8, padding: 8, background: 'rgba(14,165,233,.06)' }}>
                                          <div style={{ fontWeight: 800, color: '#0284c7', marginBottom: 4 }}>From file</div>
                                          <div><strong>Name:</strong> {d.fileName || '—'}</div>
                                          <div><strong>Email:</strong> {d.fileEmail || '—'}</div>
                                          <div><strong>Phone:</strong> {d.filePhone || '—'}</div>
                                        </div>
                                        <div style={{ border: '1px solid rgba(16,185,129,.25)', borderRadius: 8, padding: 8, background: 'rgba(16,185,129,.06)' }}>
                                          <div style={{ fontWeight: 800, color: '#059669', marginBottom: 4 }}>In CRM</div>
                                          <div><strong>Name:</strong> {d.matchLeadName || '—'}</div>
                                          <div><strong>Email:</strong> {d.matchEmail || '—'}</div>
                                          <div><strong>Phone:</strong> {d.matchPhone || '—'}</div>
                                          <div><strong>Brand:</strong> {d.matchBrand || '—'}</div>
                                          <div><strong>Stage:</strong> {d.matchStage || '—'}</div>
                                          <div><strong>Segment:</strong> {d.matchSegment || '—'}</div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                  {duplicatesAnalysis.details.filter(d => d.kind === 'crm').length === 0 && (
                                    <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>No CRM duplicates detected.</p>
                                  )}
                                </div>
                              </>
                            )}

                            {(importCleanupFocus === 'missingName' || importCleanupFocus === 'missingEmail' || importCleanupFocus === 'missingPhone' || importCleanupFocus === 'taskgoAbn') && (() => {
                              const nameCol = csvMapping.name;
                              const emailCol = csvMapping.email;
                              const phoneCol = csvMapping.phone;
                              const abnCol = csvMapping.abn_number || csvMapping.AbnNumber || csvPreview.headers.find(h => h.toLowerCase().includes('abn')) || '';
                              const rows = parsedRows
                                .map((row, idx) => ({ row, idx }))
                                .filter(({ row }) => {
                                  if (importCleanupFocus === 'missingName') return nameCol ? !getImportedRowName(row) : true;
                                  if (importCleanupFocus === 'missingEmail') return emailCol ? !String(row[emailCol] || '').trim() : false;
                                  if (importCleanupFocus === 'missingPhone') return phoneCol ? !String(row[phoneCol] || '').replace(/\D/g, '') : false;
                                  if (importCleanupFocus === 'taskgoAbn') return abnCol ? !String(row[abnCol] || '').replace(/\D/g, '') : false;
                                  return false;
                                })
                                .slice(0, 40);
                              const title =
                                importCleanupFocus === 'missingName' ? 'Rows missing a name'
                                : importCleanupFocus === 'missingEmail' ? 'Rows missing email'
                                : importCleanupFocus === 'missingPhone' ? 'Rows missing phone'
                                : 'TaskGo rows missing ABN';
                              return (
                                <>
                                  <strong style={{ fontSize: 12 }}>{title}</strong>
                                  <p style={{ margin: '4px 0 8px', fontSize: 11, color: 'var(--text-muted)' }}>
                                    These rows will still import (name falls back to email/phone when blank). Fix the source file if you need complete data.
                                  </p>
                                  <div style={{ maxHeight: 180, overflowY: 'auto', fontSize: 10.5, fontFamily: 'var(--font-mono)' }}>
                                    {rows.map(({ row, idx }) => (
                                      <div key={idx} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                                        Row {idx + 2}: {Object.entries(row).filter(([k]) => k !== 'id').slice(0, 4).map(([k, v]) => `${k}=${v || '∅'}`).join(' · ')}
                                      </div>
                                    ))}
                                    {rows.length === 0 && <p style={{ margin: 0, color: 'var(--text-muted)' }}>Nothing to show.</p>}
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        )}

                        {duplicatesAnalysis.duplicateCount > 0 && (
                          <div className="import-duplicate-warning" style={{ marginTop: 12 }}>
                            <div>
                              <strong>{duplicatesAnalysis.duplicateCount} possible duplicate row{duplicatesAnalysis.duplicateCount !== 1 ? 's' : ''}</strong>
                              <span>
                                Default action for flagged rows. Per-row choices in the review panel override this.
                                {duplicateImportStrategy === 'create' && ' New copies can be placed under a different segment for returning customers.'}
                                {duplicateImportStrategy === 'merge' && ' Existing CRM records are filled with missing data from the file.'}
                                {duplicateImportStrategy === 'skip' && ' Flagged rows are not imported (this was dropping leads before when the server always skipped).'}
                              </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'stretch', minWidth: 200 }}>
                              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, fontWeight: 700 }}>
                                Duplicate handling
                                <select
                                  value={duplicateImportStrategy}
                                  onChange={e => {
                                    const val = e.target.value as DuplicateImportStrategy;
                                    setDuplicateImportStrategy(val);
                                    // Apply as default to all flagged rows that have no explicit override yet
                                    setRowDuplicateActions(prev => {
                                      const next = { ...prev };
                                      [...duplicatesAnalysis.fileDuplicates, ...duplicatesAnalysis.crmDuplicates].forEach(idx => {
                                        if (!prev[idx]) next[idx] = val;
                                      });
                                      // Also refresh all to the new global default for simplicity when user changes strategy
                                      duplicatesAnalysis.fileDuplicates.forEach(idx => { next[idx] = val; });
                                      duplicatesAnalysis.crmDuplicates.forEach(idx => { next[idx] = val; });
                                      return next;
                                    });
                                    setConfirmDuplicateImport(false);
                                    setImportError(null);
                                  }}
                                  style={{ fontSize: 11, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', fontWeight: 600 }}
                                >
                                  <option value="skip">Skip duplicates</option>
                                  <option value="merge">Merge into existing CRM</option>
                                  <option value="create">Create as new leads</option>
                                </select>
                              </label>
                              {(duplicateImportStrategy === 'create' || duplicateImportStrategy === 'merge') && getBrandSegmentOptions(selectedBrand.id)?.length > 0 && (
                                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, fontWeight: 700 }}>
                                  Segment for matched / returning leads
                                  <select
                                    value={duplicateCreateSegment}
                                    onChange={e => setDuplicateCreateSegment(e.target.value)}
                                    style={{ fontSize: 11, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', fontWeight: 600 }}
                                  >
                                    <option value="">Same as import segment / keep existing</option>
                                    {(getBrandSegmentOptions(selectedBrand.id) || []).map(seg => (
                                      <option key={seg.value} value={seg.value}>{seg.label}</option>
                                    ))}
                                  </select>
                                </label>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <details className="import-advanced-details" open={false}>
                      <summary><i className="fas fa-check-square"></i> Optional spreadsheet columns</summary>
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <h6 style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          Include columns from file
                        </h6>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button 
                            type="button" 
                            onClick={() => {
                              setSelectedImportColumns(new Set(csvPreview.headers));
                              setSelectedSuggestedCols(new Set(suggestedCols));
                            }}
                            style={{ padding: '2px 6px', fontSize: '10px', background: 'var(--border)', color: 'var(--text-secondary)', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            All
                          </button>
                          <button 
                            type="button" 
                            onClick={() => {
                              const standard = [csvMapping.name, csvMapping.name_secondary, csvMapping.email, csvMapping.phone, csvMapping.created_at].filter(Boolean);
                              setSelectedImportColumns(new Set(standard));
                              setSelectedSuggestedCols(new Set());
                            }}
                            style={{ padding: '2px 6px', fontSize: '10px', background: 'var(--border)', color: 'var(--text-secondary)', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            Essentials only
                          </button>
                          <button 
                            type="button" 
                            onClick={() => {
                              setSelectedImportColumns(new Set());
                              setSelectedSuggestedCols(new Set());
                            }}
                            style={{ padding: '2px 6px', fontSize: '10px', background: 'var(--border)', color: 'var(--text-secondary)', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            None
                          </button>
                        </div>
                      </div>
                      <p style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                        Only checked columns are imported. Essentials from your mapping are pre-selected; everything else starts off.
                      </p>
                      <div className="import-column-chip-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {csvPreview.headers.map(h => {
                          const isChecked = selectedImportColumns.has(h);
                          const isEssential = h === csvMapping.name || h === csvMapping.name_secondary || h === csvMapping.email || h === csvMapping.phone || h === csvMapping.created_at;
                          return (
                            <label 
                              key={h} 
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '6px', 
                                fontSize: '11px', 
                                background: isChecked ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-card)', 
                                border: isChecked ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border)',
                                padding: '4px 8px', 
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: isChecked ? '600' : 'normal',
                                color: isChecked ? '#059669' : 'var(--text-primary)',
                              }}
                            >
                              <input 
                                type="checkbox" 
                                checked={isChecked} 
                                onChange={event => handleImportColumnChecked(h, event.target.checked)}
                                style={{ accentColor: '#10B981' }}
                              />
                              {h} {isEssential && isChecked && <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>(mapped)</span>}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    </details>

                    {/* Auto-Suggest Checkboxes for new Brand Columns / Custom Fields */}
                    {suggestedCols.length > 0 && (
                      <details className="import-advanced-details">
                        <summary><i className="fas fa-magic"></i> Create new CRM columns from file</summary>
                      <div style={{ marginBottom: '12px' }}>
                        <p style={{ fontSize: '10.5px', color: 'var(--text-secondary)', marginBottom: '10px', lineHeight: '1.4' }}>
                          These headers are not in your brand yet. All options start <strong>off</strong> — tick only the columns you want to create as custom fields:
                        </p>
                        <div className="import-column-chip-grid import-column-chip-grid--suggested" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {suggestedCols.map(col => {
                            const isChecked = selectedSuggestedCols.has(col);
                            return (
                              <label 
                                key={col} 
                                style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: '6px', 
                                  fontSize: '11px', 
                                  background: isChecked ? 'rgba(245, 158, 11, 0.08)' : 'var(--bg-card)', 
                                  border: isChecked ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid var(--border)',
                                  padding: '4px 8px', 
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  userSelect: 'none',
                                  fontWeight: isChecked ? '600' : 'normal',
                                  color: isChecked ? '#b45309' : 'var(--text-primary)',
                                  transition: 'all 0.15s'
                                }}
                              >
                                <input 
                                  type="checkbox" 
                                  checked={isChecked} 
                                  onChange={event => handleToggleSuggestedCol(col, event.target.checked)}
                                  style={{ accentColor: '#f59e0b' }}
                                />
                                {col}
                              </label>
                            );
                          })}
                        </div>
                        <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-start' }}>
                          <button 
                            type="button" 
                            onClick={handleCreateSuggestedColumns} 
                            disabled={colSaving || selectedSuggestedCols.size === 0}
                            className="btn btn-sm"
                            style={{ background: '#f59e0b', color: '#fff', border: '1px solid #f59e0b', fontSize: '10.5px', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '6px', cursor: 'pointer' }}
                          >
                            <i className="fas fa-plus"></i> {colSaving ? 'Saving…' : `Create ${selectedSuggestedCols.size || ''} column(s)`}
                          </button>
                        </div>
                      </div>
                      </details>
                    )}

                    {/* Map Existing Custom CRM Fields */}
                    {customFields.length > 0 && (
                      <details className="import-advanced-details">
                        <summary><i className="fas fa-link"></i> Map existing custom fields</summary>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: 12 }}>
                          {customFields.map(cf => (
                            <div key={cf.id}>
                              <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '4px', color: 'var(--text-secondary)' }}>{cf.field_name}</label>
                              <ImportColumnPicker
                                value={csvMapping[cf.field_name] || ''}
                                options={csvPreview.headers}
                                placeholder="Ignore"
                                onChange={value => setCsvMapping({ ...csvMapping, [cf.field_name]: value })}
                              />
                            </div>
                          ))}
                        </div>
                      </details>
                    )}

                     {getBrandSegmentOptions(selectedBrand.id) && (
                       <div style={{ marginBottom: '16px', clear: 'both' }}>
                         <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '4px', color: 'var(--text-secondary)' }}>Assign target marketing segment category:</label>
                         <select value={csvImportingSegment} onChange={e => setCsvImportingSegment(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px', background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                           <option value="">No Segment (Leave unassigned)</option>
                           {(getBrandSegmentOptions(selectedBrand.id) || []).map(seg => (
                             <option key={seg.value} value={seg.value}>{seg.label}</option>
                           ))}
                         </select>
                       </div>
                      )}

                     <div style={{ marginBottom: '16px', clear: 'both', padding: '12px', border: '1px solid var(--border)', borderRadius: '10px', background: 'var(--bg-card)' }}>
                       <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', marginBottom: '8px', color: 'var(--text-primary)' }}>
                         <i className="fas fa-map-marker-alt" style={{ color: selectedBrand.color, marginRight: '6px' }}></i>
                         Import destination <span style={{ color: '#ef4444' }}>*</span>
                       </label>
                       <p style={{ margin: '0 0 10px', fontSize: '10.5px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                         Choose where these records should land in the pipeline.
                       </p>
                       <div style={{ display: 'flex', gap: '8px' }}>
                         {(['verified', 'prospect'] as const).map(dest => (
                           <button
                             key={dest}
                             type="button"
                             onClick={() => setImportLeadDestination(dest)}
                             style={{
                               flex: 1,
                               padding: '10px 12px',
                               borderRadius: '8px',
                               border: `1.5px solid ${importLeadDestination === dest ? (dest === 'verified' ? '#10B981' : '#3B82F6') : 'var(--border)'}`,
                               background: importLeadDestination === dest ? (dest === 'verified' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(59, 130, 246, 0.08)') : 'var(--bg-base)',
                               color: importLeadDestination === dest ? (dest === 'verified' ? '#059669' : '#1d4ed8') : 'var(--text-secondary)',
                               cursor: 'pointer',
                               fontSize: '12px',
                               fontWeight: 700,
                               textAlign: 'center',
                               transition: 'all 0.15s',
                             }}
                           >
                             <div style={{ fontSize: '16px', marginBottom: '4px' }}>
                               {dest === 'verified' ? '✅' : '🔍'}
                             </div>
                             {dest === 'verified' ? 'Verified Leads' : 'Prospects'}
                           </button>
                         ))}
                       </div>
                     </div>

                     <h6 style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Preview Data Rows (First 5 matches):</h6>
                    <div style={{ maxHeight: '120px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '11px', padding: '6px 12px', background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
                      {csvPreview.preview.map((row, idx) => {
                        const isDup = duplicatesAnalysis.fileDuplicates.has(idx) || duplicatesAnalysis.crmDuplicates.has(idx);
                        return (
                          <div 
                            key={idx} 
                            style={{ 
                              padding: '6px 10px', 
                              borderBottom: idx === csvPreview.preview.length - 1 ? 'none' : '1px solid var(--border)', 
                              whiteSpace: 'nowrap', 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis',
                              background: isDup ? 'rgba(239, 68, 68, 0.08)' : 'transparent',
                              borderLeft: isDup ? `4px solid #ef4444` : 'none',
                              color: isDup ? '#b91c1c' : 'var(--text-primary)',
                              fontSize: '11px',
                              fontFamily: 'var(--font-mono)'
                            }}
                            title={isDup ? 'Duplicate record detected!' : undefined}
                          >
                            {isDup && <strong style={{ color: '#dc2626', marginRight: '6px' }}>[⚠️ DUPLICATE / CONFLICT]</strong>}
                            {Object.entries(row).filter(([k]) => k !== 'id').map(([k,v]) => `${k}: ${v}`).join(' | ')}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                </>
                )}
              </div>
              <div className="modal-footer import-leads-modal__footer" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {(importProgress || csvImporting) && (
                  <div
                    className={`import-progress-panel${importProgress?.value === 100 ? ' is-complete' : ''}${csvImporting ? ' is-active' : ''}`}
                    aria-live="polite"
                  >
                    <div className="import-progress-panel__meta">
                      <span>
                        <i
                          className={`fas ${csvImporting ? 'fa-circle-notch fa-spin' : importProgress?.value === 100 ? 'fa-check-circle' : 'fa-cloud-upload-alt'}`}
                          style={{ marginRight: 6 }}
                        />
                        {importProgress?.label || 'Working…'}
                      </span>
                      <span className="import-progress-panel__pct">{importProgress?.value ?? 0}%</span>
                    </div>
                    <div
                      className="import-progress-panel__track"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={importProgress?.value ?? 0}
                    >
                      <div
                        className="import-progress-panel__fill"
                        style={{
                          width: `${importProgress?.value ?? 0}%`,
                          background: selectedBrand.color,
                        }}
                      />
                    </div>
                  </div>
                )}
                {importError && (
                  <div className="import-footer-banner import-footer-banner--error">
                    <i className="fas fa-exclamation-circle" />
                    <p>{importError}</p>
                  </div>
                )}
                {importSuccessMessage && (
                  <div className="import-footer-banner import-footer-banner--success">
                    <i className="fas fa-check-circle" />
                    <p>{importSuccessMessage}</p>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', width: '100%' }}>
                  <button type="button" className="btn btn-ghost" disabled={csvImporting} onClick={closeImportModal}>
                    {importSuccessMessage ? 'Close' : 'Cancel'}
                  </button>
                  {importSuccessMessage ? (
                    <button type="button" className="btn btn-primary" onClick={closeImportModal} style={{ background: selectedBrand.color }}>
                      Done
                    </button>
                  ) : (
                  <button type="submit" className="btn btn-primary" disabled={csvImporting || !csvPreview} style={{ background: selectedBrand.color }}>
                    {csvImporting
                      ? 'Importing…'
                      : duplicatesAnalysis.duplicateCount > 0 && duplicateImportStrategy === 'skip'
                        ? 'Import (skip duplicates)'
                        : duplicatesAnalysis.duplicateCount > 0 && confirmDuplicateImport && duplicateImportStrategy === 'merge'
                          ? 'Confirm merge & import'
                          : duplicatesAnalysis.duplicateCount > 0 && confirmDuplicateImport && duplicateImportStrategy === 'create'
                            ? 'Confirm create & import'
                            : duplicatesAnalysis.duplicateCount > 0 && duplicateImportStrategy === 'merge'
                              ? 'Import (merge matches)'
                              : duplicatesAnalysis.duplicateCount > 0 && duplicateImportStrategy === 'create'
                                ? 'Import (create new for matches)'
                                : 'Import Spreadsheet Data'}
                  </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {leadBadgesSettingsOpen && selectedBrand && leadBadgeSettings && (
        <LeadBadgesSettingsModal
          brandId={selectedBrand.id}
          brandName={selectedBrand.name}
          brandColor={selectedBrand.color}
          customFieldNames={customFields.map(cf => cf.field_name)}
          initialSettings={leadBadgeSettings}
          onClose={() => setLeadBadgesSettingsOpen(false)}
          onSave={next => setLeadBadgeSettings(next)}
        />
      )}

      {/* 3. DYNAMIC COLUMN (CUSTOM FIELDS) MANAGER MODAL */}
      {manageColsIsOpen && selectedBrand && (
        <div className="modal-overlay">
          <div className="modal-content dynamic-columns-modal" style={{ maxWidth: '680px', width: 'min(94vw, 680px)', maxHeight: '88vh', overflow: 'hidden' }}>
            <div className="modal-header">
              <h3><i className="fas fa-columns"></i> Manage Dynamic Columns</h3>
              <button className="modal-close" aria-label="Close" onClick={() => setManageColsIsOpen(false)}>&times;</button>
            </div>
            <div className="modal-body">
              
              <div className="dynamic-column-section" ref={editFormRef} style={editFormHighlight ? { border: '2px solid var(--accent)', borderRadius: '10px', padding: '12px', background: 'color-mix(in srgb, var(--accent) 6%, var(--bg-card))', transition: 'all 0.3s ease' } : {}}>
                <h5 style={{ fontSize: '13px', fontWeight: '700', marginBottom: '12px' }}>{editingColumnId ? 'Edit Brand Column' : 'Add Brand Column'}</h5>
                <p style={{ margin: '-4px 0 12px', fontSize: '11px', color: 'var(--text-muted)' }}>
                  Brand columns are flexible for each business. Add city, country, service type, contractor status, training country, rental city, or any field the brand needs.
                </p>
                <form onSubmit={handleSaveCustomFieldSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(140px, 1fr)', gap: '12px' }}>
                    <input 
                      type="text" 
                      placeholder="Column title (e.g. Budget size)" 
                      value={newColName} 
                      onChange={e => setNewColName(e.target.value)} 
                      required
                      style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px' }}
                    />
                    <select 
                      value={newColType} 
                      onChange={e => setNewColType(e.target.value as any)}
                      style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                    >
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="boolean">Yes / No</option>
                      <option value="date">Calendar Date</option>
                    </select>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '600' }}>
                      <input type="checkbox" checked={newColRequired} onChange={e => setNewColRequired(e.target.checked)}/> Required Field
                    </label>
                    
                    <button type="submit" disabled={colSaving} className="btn btn-primary btn-sm" style={{ background: selectedBrand.color }}>
                      {colSaving ? 'Saving...' : editingColumnId ? 'Save Column' : 'Add Column'}
                    </button>
                    {editingColumnId && (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => {
                        setEditingColumnId('');
                        setNewColName('');
                        setNewColType('text');
                        setNewColRequired(false);
                        setEditFormHighlight(false);
                      }}>Cancel edit</button>
                    )}
                  </div>
                </form>
              </div>

              <div className="dynamic-column-section">
                <h5 style={{ fontSize: '13px', fontWeight: '700', marginBottom: '12px' }}>Standard Columns</h5>
                <p style={{ margin: '-4px 0 12px', fontSize: '11px', color: 'var(--text-muted)' }}>
                  Protected (used by search/filters): Name, Email, Phone, Date Added, Segment, Stage, Tags. All other standard columns can be permanently deleted.
                </p>
                <div className="dynamic-column-list">
                  {(() => {
                    const deletedStd: string[] = JSON.parse(localStorage.getItem(`crm_deleted_std_cols_${selectedBrand.id}`) || '[]');
                    const deletedStdSet = new Set(deletedStd.map(c => String(c).toLowerCase()));
                    return getStandardColumns(selectedBrand.id)
                      .filter(c => !deletedStdSet.has(String(c).toLowerCase()))
                      .map(c => {
                        const isProtected = isProtectedColumn(c, selectedBrand.id);
                        return (
                          <div key={c} className="dynamic-column-row">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', flex: 1, cursor: 'default', opacity: isProtected ? 0.75 : 1 }}>
                              <input type="checkbox" checked={true} disabled />
                              <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{formatColumnLabel(c)}</span>
                              {isProtected && <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', background: 'var(--border)', padding: '1px 6px', borderRadius: '4px' }}>PROTECTED</span>}
                            </label>
                            {!isProtected && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (!window.confirm(`Permanently delete standard column "${formatColumnLabel(c)}" for ${selectedBrand.name}? It will stay removed until you restore columns.`)) return;
                                  const updated = Array.from(new Set([...deletedStd, c]));
                                  localStorage.setItem(`crm_deleted_std_cols_${selectedBrand.id}`, JSON.stringify(updated));
                                  setColumnVisibility(prev => {
                                    const next = new Set(prev);
                                    next.delete(c);
                                    return new Set(persistColumnVisibility(selectedBrand.id, next));
                                  });
                                  showToast(`Deleted column "${formatColumnLabel(c)}" permanently.`);
                                }}
                                style={{ background: 'transparent', border: 'none', color: '#ff4d4d', cursor: 'pointer', fontSize: '11px', padding: '4px 8px' }}
                                title={`Delete "${formatColumnLabel(c)}" permanently`}
                              >
                                <i className="fas fa-trash"></i>
                              </button>
                            )}
                          </div>
                        );
                      });
                  })()}
                </div>
              </div>

              <div className="dynamic-column-section">
                <h5 style={{ fontSize: '13px', fontWeight: '700', marginBottom: '12px' }}>Brand Columns</h5>
                <p style={{ margin: '-4px 0 12px', fontSize: '11px', color: 'var(--text-muted)' }}>
                  Custom to {selectedBrand.name}. Hide with the checkbox, or permanently delete (stays deleted — not just unchecked). Segment / stage / tags stay protected when present.
                </p>
                <div className="dynamic-column-list">
                  {customFields.map(cf => {
                    const isVisible = getVisibleColumns().has(cf.field_name);
                    const isProtected = isProtectedColumn(cf.field_name, selectedBrand.id, customFields.map(f => f.field_name));
                    return (
                      <div key={cf.id} className="dynamic-column-row">
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', flex: 1, cursor: isProtected ? 'default' : 'pointer', opacity: isProtected ? 0.75 : 1 }}>
                          <input 
                            type="checkbox" 
                            checked={isVisible || isProtected} 
                            disabled={isProtected}
                            onChange={() => toggleColumnVis(cf.field_name)}
                          /> 
                          <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                            <i className="fas fa-tag" style={{ color: selectedBrand.color, marginRight: '4px', fontSize: '10px' }}></i> 
                            {formatColumnLabel(cf.field_name)}
                          </span>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>({cf.field_type}{isProtected ? ' · protected' : ''})</span>
                        </label>
                        {!isProtected && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingColumnId(cf.id);
                              setNewColName(cf.field_name);
                              setNewColType((cf.field_type as any) || 'text');
                              setNewColRequired(!!cf.required);
                              setEditFormHighlight(true);
                              setTimeout(() => {
                                editFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              }, 50);
                            }}
                            style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '11px', padding: '4px 8px' }}
                            title={`Edit name/type for "${formatColumnLabel(cf.field_name)}"`}
                          >
                            <i className="fas fa-pencil-alt"></i>
                          </button>
                        )}
                        {!isProtected && (
                          <button
                            type="button"
                            onClick={() => handleDeleteColumn(cf.id)}
                            style={{ background: 'transparent', border: 'none', color: '#ff4d4d', cursor: 'pointer', fontSize: '11px', padding: '4px 8px' }}
                            title={`Permanently delete "${formatColumnLabel(cf.field_name)}"`}
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        )}
                        {isProtected && <small style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Protected</small>}
                      </div>
                    );
                  })}
                  {customFields.length === 0 && <div className="dynamic-column-empty">No brand columns yet. Add one above when this brand needs extra data.</div>}
                </div>
              </div>

            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  if (!selectedBrand) return;
                  const customNames = customFields
                    .filter(cf => !cf.brand_id || String(cf.brand_id) === selectedBrand.id)
                    .map(cf => cf.field_name);
                  localStorage.removeItem(hiddenOptionalStorageKey(selectedBrand.id));
                  // Also re-show standard columns the user permanently removed in this browser.
                  localStorage.removeItem(`crm_deleted_std_cols_${selectedBrand.id}`);
                  clearLegacyColumnPrefs(selectedBrand.id, localStorage);
                  localStorage.setItem(columnVersionStorageKey(selectedBrand.id), CURRENT_COL_VERSION);
                  const restored = resolveVisibleColumns({
                    brandId: selectedBrand.id,
                    customFieldNames: customNames,
                    hiddenOptional: [],
                  });
                  setColumnVisibility(new Set(restored));
                  showToast(`Restored visible standard columns for ${selectedBrand.name}. Permanently deleted brand columns stay removed until you add them again.`);
                }}
              >
                <i className="fas fa-rotate-left"></i> Restore all columns
              </button>
              <button className="btn btn-ghost" onClick={() => setManageColsIsOpen(false)}>Close Manager</button>
            </div>
          </div>
        </div>
      )}

      {/* 4. EMAIL OUTGOING WORKFLOW STEP MODAL */}
      {emailModalOpen && activeLead && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px', width: '90%', maxHeight: '90vh', overflow: 'hidden' }}>
            <div className="modal-header">
              <h3><i className="fas fa-paper-plane"></i> Transmit manual outlook email</h3>
              <button className="modal-close" aria-label="Close" onClick={() => setEmailModalOpen(false)}>&times;</button>
            </div>
            <form onSubmit={handleSendEmailSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div className="modal-body">
                <div style={{ padding: '8px 12px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px', marginBottom: '16px' }}>
                  Recipent: <strong>{activeLead.name}</strong> &lt;{activeLead.email}&gt;
                </div>
                
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Email Subject Text</label>
                  <input type="text" required value={emailSubject} onChange={e => setEmailSubject(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px' }}/>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Body Document content (HTML support)</label>
                  <textarea required value={emailBody} onChange={e => setEmailBody(e.target.value)} rows={6} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', fontFamily: 'monospace' }}/>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setEmailModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={emailSending} style={{ background: selectedBrand?.color }}>
                  {emailSending ? 'Sending...' : 'Transmit Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. WHATSAPP CHAT OUT BOX MODAL */}
      {waModalOpen && activeLead && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px', width: '95%', maxHeight: '90vh', overflow: 'hidden', borderRadius: '16px' }}>
            <div className="modal-header" style={{ background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)', color: '#fff', borderRadius: '16px 16px 0 0', padding: '16px 20px' }}>
              <h3 style={{ margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: '700' }}>
                <i className="fab fa-whatsapp" style={{ fontSize: '18px' }}></i> WhatsApp Message
              </h3>
              <button className="modal-close--on-accent" aria-label="Close" onClick={() => setWaModalOpen(false)}>&times;</button>
            </div>
            <form onSubmit={handleSendWhatsAppSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div className="modal-body" style={{ padding: '20px' }}>
                {/* Recipient info strip */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'rgba(37,211,102,0.06)', border: '1px solid rgba(37,211,102,0.25)', borderRadius: '10px', marginBottom: '16px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: '700', fontSize: '14px', flexShrink: 0 }}>
                    {activeLead.name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>{activeLead.name}</div>
                    <div style={{ fontSize: '12px', color: activeLead.phone ? '#25D366' : 'var(--warning)', fontWeight: '600' }}>
                      <i className={`fas ${activeLead.phone ? 'fa-check-circle' : 'fa-exclamation-triangle'}`} style={{ marginRight: '4px', fontSize: '10px' }}></i>
                      {activeLead.phone || 'No phone number — message will be logged only'}
                    </div>
                  </div>
                </div>

                {/* Template quick-pick */}
                {(() => {
                  const brandId = activeLead.brand_id || selectedBrand?.id || '';
                  const templates = getWhatsAppTemplatesForBrand(brandId);
                  if (templates.length === 0) return null;
                  return (
                    <div style={{ marginBottom: '14px' }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Quick Templates</label>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {templates.slice(0, 6).map(t => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setWaMessage(t.message)}
                            style={{ padding: '5px 10px', borderRadius: '20px', border: '1px solid rgba(37,211,102,0.35)', background: waMessage === t.message ? '#25D366' : 'rgba(37,211,102,0.06)', color: waMessage === t.message ? '#fff' : '#128C7E', fontSize: '11px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s' }}
                          >
                            {t.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Message textarea */}
                <div style={{ marginBottom: '8px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Message</label>
                  <textarea
                    required
                    value={waMessage}
                    onChange={e => setWaMessage(e.target.value)}
                    placeholder="Type your message..."
                    rows={5}
                    style={{ width: '100%', padding: '12px 14px', border: '1.5px solid var(--border)', borderRadius: '10px', fontSize: '13px', background: 'var(--bg-base)', color: 'var(--text-primary)', resize: 'vertical', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5 }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#25D366'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                  />
                  <div style={{ textAlign: 'right', fontSize: '11px', color: waMessage.length > 1500 ? '#ef4444' : 'var(--text-muted)', marginTop: '4px' }}>
                    {waMessage.length} / 1600 chars
                  </div>
                </div>
              </div>
              <div className="modal-footer" style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setWaModalOpen(false)}>Cancel</button>
                <button type="submit" disabled={waSending || !waMessage.trim()} style={{ background: waSending ? '#888' : '#25D366', color: 'white', border: 'none', padding: '10px 22px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', cursor: waSending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '7px', transition: 'background 0.15s' }}>
                  <i className={waSending ? 'fas fa-spinner fa-spin' : 'fab fa-whatsapp'}></i>
                  {waSending ? 'Sending...' : activeLead.phone ? 'Send Message' : 'Log Message'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. BULK EMAIL BLAST MODAL */}
      {bulkEditOpen && selectedBrand && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '560px', width: '92%' }}>
            <div className="modal-header">
              <h3><i className="fas fa-pen-to-square"></i> Bulk Edit Selected Leads</h3>
              <button className="modal-close" aria-label="Close" disabled={bulkEditSaving} onClick={() => !bulkEditSaving && setBulkEditOpen(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <p style={{ marginTop: 0, color: 'var(--text-secondary)', fontSize: '13px' }}>
                Apply one or more updates to {selectedLeadIds.size} selected lead{selectedLeadIds.size !== 1 ? 's' : ''}. Empty fields will be left unchanged.
              </p>
              <div className="bulk-edit-grid">
                <label>
                  Stage
                  <select value={bulkEditForm.stage} onChange={e => setBulkEditForm(prev => ({ ...prev, stage: e.target.value }))}>
                    <option value="">Leave unchanged</option>
                    {getStageFilterOptions().map(stage => <option key={stage} value={stage}>{stage}</option>)}
                  </select>
                </label>
                <label>
                  Follow-up reminder
                  <input type="date" value={bulkEditForm.follow_up_date} onChange={e => setBulkEditForm(prev => ({ ...prev, follow_up_date: e.target.value }))} />
                </label>
                <label>
                  Contact channel
                  <select value={bulkEditForm.follow_up_type} onChange={e => setBulkEditForm(prev => ({ ...prev, follow_up_type: e.target.value }))}>
                    <option value="">Leave unchanged</option>
                    <option value="Email">Email</option>
                    <option value="Call">Call</option>
                    <option value="WhatsApp">WhatsApp</option>
                  </select>
                </label>
                <label>
                  Follow-up status
                  <select value={bulkEditForm.follow_up_status} onChange={e => setBulkEditForm(prev => ({ ...prev, follow_up_status: e.target.value }))}>
                    <option value="">Leave unchanged</option>
                    <option value="Pending Follow-Up">Pending Follow-Up</option>
                    <option value="Email Sent">Email Sent</option>
                    <option value="WhatsApp Sent">WhatsApp Sent</option>
                    <option value="Call Scheduled">Call Scheduled</option>
                    <option value="Contact did not respond">Contact did not respond</option>
                    <option value="Next follow-up set">Next follow-up set</option>
                    <option value="Closed - Won">Closed - Won</option>
                    <option value="Closed - Lost">Closed - Lost</option>
                  </select>
                </label>
                <label className="bulk-edit-grid__wide">
                  Next action
                  <input value={bulkEditForm.next_action} onChange={e => setBulkEditForm(prev => ({ ...prev, next_action: e.target.value }))} placeholder="e.g. Call tomorrow, send proposal, wait for reply" />
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" disabled={bulkEditSaving} onClick={() => setBulkEditOpen(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" disabled={bulkEditSaving} onClick={handleBulkEditSelectedLeads} style={{ background: selectedBrand.color }}>
                {bulkEditSaving ? 'Updating...' : 'Update Selected Leads'}
              </button>
            </div>
          </div>
        </div>
      )}

      {bulkEmailModalOpen && selectedBrand && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '580px', width: '95%', maxHeight: '92vh', overflow: 'hidden', borderRadius: '16px' }}>
            <div className="modal-header" style={{ background: 'linear-gradient(135deg, #0f766e 0%, #164e63 100%)', color: '#fff', borderRadius: '16px 16px 0 0', padding: '16px 20px' }}>
              <h3 style={{ margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: '700' }}>
                <i className="fas fa-paper-plane" style={{ fontSize: '16px' }}></i> Email Blast
              </h3>
              <button className="modal-close--on-accent" aria-label="Close" disabled={bulkEmailSending} onClick={() => { if (!bulkEmailSending) { setBulkEmailModalOpen(false); setBulkEmailProgress(null); } }}>&times;</button>
            </div>

            {/* recipient summary strip */}
            {(() => {
              const targetLeads = leads.filter(l => selectedLeadIds.has(l.id));
              const withEmail = targetLeads.filter(l => l.email);
              const noEmail = targetLeads.filter(l => !l.email);
              return (
                <div style={{ padding: '12px 20px', background: 'rgba(15,118,110,0.07)', borderBottom: '1px solid rgba(15,118,110,0.18)', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: '#0f766e' }}>
                    <i className="fas fa-users"></i> {targetLeads.length} selected
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: '#10b981' }}>
                    <i className="fas fa-check-circle"></i> {withEmail.length} will receive email
                  </div>
                  {noEmail.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '600', color: '#f59e0b' }}>
                      <i className="fas fa-exclamation-triangle"></i> {noEmail.length} skipped (no email)
                    </div>
                  )}
                  <div style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                    Brand: <span style={{ color: selectedBrand.color }}>{selectedBrand.name}</span>
                  </div>
                </div>
              );
            })()}

            <form onSubmit={handleBulkEmailSend} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto', maxHeight: '50vh' }}>
                {/* Subject */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Subject</label>
                  <input
                    type="text"
                    required
                    disabled={bulkEmailSending}
                    value={bulkEmailSubject}
                    onChange={e => setBulkEmailSubject(e.target.value)}
                    placeholder="e.g. Exclusive offer just for you"
                    style={{ width: '100%', padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: '10px', fontSize: '13px', background: 'var(--bg-base)', color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit' }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#0f766e'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                  />
                </div>

                {/* Body */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Message Body <span style={{ fontWeight: '400', textTransform: 'none', color: 'var(--text-muted)' }}>(HTML supported)</span>
                  </label>
                  <textarea
                    required
                    disabled={bulkEmailSending}
                    value={bulkEmailBody}
                    onChange={e => setBulkEmailBody(e.target.value)}
                    placeholder="Write your email content here..."
                    rows={8}
                    style={{ width: '100%', padding: '12px 14px', border: '1.5px solid var(--border)', borderRadius: '10px', fontSize: '13px', background: 'var(--bg-base)', color: 'var(--text-primary)', resize: 'vertical', outline: 'none', fontFamily: 'inherit', lineHeight: 1.6 }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#0f766e'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                  />
                </div>

                {/* Progress bar */}
                {bulkEmailProgress && (
                  <div style={{ padding: '14px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '700', marginBottom: '8px' }}>
                       <span style={{ color: '#0f766e' }}>Sending… {bulkEmailProgress.sent + bulkEmailProgress.failed} / {bulkEmailProgress.total}</span>
                      <span>
                        <span style={{ color: '#10b981', marginRight: '10px' }}><i className="fas fa-check"></i> {bulkEmailProgress.sent} sent</span>
                        {bulkEmailProgress.failed > 0 && <span style={{ color: '#ef4444' }}><i className="fas fa-times"></i> {bulkEmailProgress.failed} failed</span>}
                      </span>
                    </div>
                    <div style={{ height: '6px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.round(((bulkEmailProgress.sent + bulkEmailProgress.failed) / bulkEmailProgress.total) * 100)}%`, background: 'linear-gradient(90deg,#0f766e,#164e63)', borderRadius: '99px', transition: 'width 0.3s ease' }} />
                    </div>
                    {!bulkEmailSending && bulkEmailProgress.failed === 0 && (
                      <div style={{ marginTop: '10px', fontSize: '12px', fontWeight: '700', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <i className="fas fa-check-circle"></i> All emails sent successfully!
                      </div>
                    )}
                    {bulkEmailProgress.errors.length > 0 && (
                      <div style={{ marginTop: '10px', maxHeight: '80px', overflowY: 'auto' }}>
                        {bulkEmailProgress.errors.map((e, i) => (
                          <div key={i} style={{ fontSize: '11px', color: '#f87171', marginBottom: '2px' }}><i className="fas fa-exclamation-circle" style={{ marginRight: '4px' }}></i>{e}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={bulkEmailSending}
                  onClick={() => { setBulkEmailModalOpen(false); setBulkEmailProgress(null); }}
                >
                  {bulkEmailProgress && !bulkEmailSending ? 'Close' : 'Cancel'}
                </button>
                {(!bulkEmailProgress || bulkEmailSending) && (
                  <button
                    type="submit"
                    disabled={bulkEmailSending || !bulkEmailSubject.trim() || !bulkEmailBody.trim()}
                    style={{ background: bulkEmailSending ? '#888' : 'linear-gradient(135deg,#0f766e,#164e63)', color: 'white', border: 'none', padding: '10px 22px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', cursor: bulkEmailSending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '7px' }}
                  >
                    {bulkEmailSending
                      ? <><i className="fas fa-spinner fa-spin"></i> Sending…</>
                      : <><i className="fas fa-paper-plane"></i> Send to {leads.filter(l => selectedLeadIds.has(l.id) && l.email).length} Leads</>
                    }
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6B. BULK WHATSAPP BLAST MODAL */}
      {bulkWhatsAppModalOpen && selectedBrand && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '580px', width: '95%', maxHeight: '92vh', overflow: 'hidden', borderRadius: '16px' }}>
            <div className="modal-header" style={{ background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)', color: '#fff', borderRadius: '16px 16px 0 0', padding: '16px 20px' }}>
              <h3 style={{ margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: '700' }}>
                <i className="fab fa-whatsapp" style={{ fontSize: '17px' }}></i> WhatsApp Blast
              </h3>
              <button className="modal-close--on-accent" aria-label="Close" disabled={bulkWhatsAppSending} onClick={() => { if (!bulkWhatsAppSending) { setBulkWhatsAppModalOpen(false); setBulkWhatsAppProgress(null); } }}>&times;</button>
            </div>

            {(() => {
              const isDoNotContact = (lead: Lead) => (
                lead.custom_fields?.do_not_contact === true ||
                String(lead.custom_fields?.do_not_contact).toLowerCase() === 'true'
              );
              const targetLeads = leads.filter(l => selectedLeadIds.has(l.id));
              const withPhone = targetLeads.filter(l => l.phone && !isDoNotContact(l));
              const noPhone = targetLeads.filter(l => !l.phone);
              const blocked = targetLeads.filter(isDoNotContact);
              const apiReady = isWhatsAppCloudConfigured(getBrandIntegrationFor(selectedBrand.id), selectedBrand.id);
              return (
                <div style={{ padding: '12px 20px', background: 'rgba(34,197,94,0.07)', borderBottom: '1px solid rgba(34,197,94,0.2)', display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: '#16a34a' }}>
                    <i className="fas fa-users"></i> {targetLeads.length} selected
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: '#10b981' }}>
                    <i className="fas fa-check-circle"></i> {withPhone.length} will {apiReady ? 'receive' : 'be logged for'} WhatsApp
                  </div>
                  {noPhone.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '600', color: '#f59e0b' }}>
                      <i className="fas fa-exclamation-triangle"></i> {noPhone.length} skipped (no phone)
                    </div>
                  )}
                  {blocked.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '600', color: '#ef4444' }}>
                      <i className="fas fa-ban"></i> {blocked.length} skipped (do not contact)
                    </div>
                  )}
                  <div style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                    {apiReady ? 'API mode' : 'Manual log mode'} - <span style={{ color: selectedBrand.color }}>{selectedBrand.name}</span>
                  </div>
                </div>
              );
            })()}

            <form onSubmit={handleBulkWhatsAppSend} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto', maxHeight: '50vh' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Message <span style={{ fontWeight: '400', textTransform: 'none', color: 'var(--text-muted)' }}>Use lead fields like {'{name}'}</span>
                  </label>
                  <textarea
                    required
                    disabled={bulkWhatsAppSending}
                    value={bulkWhatsAppMessage}
                    onChange={e => setBulkWhatsAppMessage(e.target.value)}
                    placeholder="Write your WhatsApp message..."
                    rows={8}
                    style={{ width: '100%', padding: '12px 14px', border: '1.5px solid var(--border)', borderRadius: '10px', fontSize: '13px', background: 'var(--bg-base)', color: 'var(--text-primary)', resize: 'vertical', outline: 'none', fontFamily: 'inherit', lineHeight: 1.6 }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#22c55e'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                  />
                  <div style={{ marginTop: '6px', textAlign: 'right', fontSize: '11px', fontWeight: '700', color: bulkWhatsAppMessage.length >= 1500 ? '#ef4444' : 'var(--text-muted)' }}>
                    {bulkWhatsAppMessage.length} characters
                  </div>
                </div>

                {bulkWhatsAppProgress && (
                  <div style={{ padding: '14px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '700', marginBottom: '8px' }}>
                      <span style={{ color: '#16a34a' }}>Sending... {bulkWhatsAppProgress.sent + bulkWhatsAppProgress.failed} / {bulkWhatsAppProgress.total}</span>
                      <span>
                        <span style={{ color: '#10b981', marginRight: '10px' }}><i className="fas fa-check"></i> {bulkWhatsAppProgress.sent} done</span>
                        {bulkWhatsAppProgress.failed > 0 && <span style={{ color: '#ef4444' }}><i className="fas fa-times"></i> {bulkWhatsAppProgress.failed} failed</span>}
                      </span>
                    </div>
                    <div style={{ height: '6px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.round(((bulkWhatsAppProgress.sent + bulkWhatsAppProgress.failed) / bulkWhatsAppProgress.total) * 100)}%`, background: 'linear-gradient(90deg,#16a34a,#22c55e)', borderRadius: '99px', transition: 'width 0.3s ease' }} />
                    </div>
                    {!bulkWhatsAppSending && bulkWhatsAppProgress.failed === 0 && (
                      <div style={{ marginTop: '10px', fontSize: '12px', fontWeight: '700', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <i className="fas fa-check-circle"></i> All WhatsApp messages completed.
                      </div>
                    )}
                    {bulkWhatsAppProgress.errors.length > 0 && (
                      <div style={{ marginTop: '10px', maxHeight: '80px', overflowY: 'auto' }}>
                        {bulkWhatsAppProgress.errors.map((e, i) => (
                          <div key={i} style={{ fontSize: '11px', color: '#f87171', marginBottom: '2px' }}><i className="fas fa-exclamation-circle" style={{ marginRight: '4px' }}></i>{e}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={bulkWhatsAppSending}
                  onClick={() => { setBulkWhatsAppModalOpen(false); setBulkWhatsAppProgress(null); }}
                >
                  {bulkWhatsAppProgress && !bulkWhatsAppSending ? 'Close' : 'Cancel'}
                </button>
                {(!bulkWhatsAppProgress || bulkWhatsAppSending) && (
                  <button
                    type="submit"
                    disabled={bulkWhatsAppSending || !bulkWhatsAppMessage.trim()}
                    style={{ background: bulkWhatsAppSending ? '#888' : 'linear-gradient(135deg,#16a34a,#22c55e)', color: 'white', border: 'none', padding: '10px 22px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', cursor: bulkWhatsAppSending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '7px' }}
                  >
                    {bulkWhatsAppSending
                      ? <><i className="fas fa-spinner fa-spin"></i> Sending...</>
                      : <><i className="fab fa-whatsapp"></i> Send to {leads.filter(l => selectedLeadIds.has(l.id) && l.phone).length} Leads</>
                    }
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. MANUAL CALLS OUTCOME LOGGER MODAL */}
      {callModalOpen && activeLead && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px', width: '90%' }}>
            <div className="modal-header">
              <h3><i className="fas fa-clipboard-list"></i> Log simulated call outcome results</h3>
              <button className="modal-close" aria-label="Close" onClick={() => setCallModalOpen(false)}>&times;</button>
            </div>
            <form onSubmit={handleLogCallSubmit}>
              <div className="modal-body">
                <div style={{ padding: '8px 12px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px', marginBottom: '16px' }}>
                  Customer called: <strong>{activeLead.name}</strong>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Outcomes category</label>
                  <select value={callOutcome} onChange={e => setCallOutcome(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px', background: 'var(--bg-card)' }}>
                    <option value="Connected">Connected / Good Talk</option>
                    <option value="No Answer">No Answer / Left Voicemail</option>
                    <option value="Busy">Line Busy / Requested callback</option>
                    <option value="Wrong Number">Wrong number / Invalid Details</option>
                    <option value="Rescheduled">Meeting Scheduled</option>
                  </select>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Durations (seconds)</label>
                  <input type="number" value={callDuration} onChange={e => setCallDuration(parseInt(e.target.value) || 0)} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }}/>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Outcome summaries notes</label>
                  <textarea value={callNotes} onChange={e => setCallNotes(e.target.value)} placeholder="Provide short call metrics summary..." rows={3} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px' }}/>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setCallModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={callSaving} style={{ background: selectedBrand?.color || 'var(--accent)' }}>
                  {callSaving ? 'Saving...' : 'Save Call Outcome Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. DRIP WORKFLOW DESIGNER MODAL */}
      {seqModalIsOpen && selectedBrand && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '720px', width: '92%', maxHeight: '92vh', overflow: 'hidden' }}>
            <div className="modal-header">
              <h3><i className="fas fa-route"></i> Design cross-channel automation flow</h3>
              <button className="modal-close" aria-label="Close" onClick={() => setSeqModalIsOpen(false)}>&times;</button>
            </div>
            <form onSubmit={handleSaveSequenceSubmit} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1, overflow: 'hidden' }}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', minHeight: 0 }}>
                <div style={{ border: '1px solid var(--border)', background: 'var(--bg-base)', borderRadius: '12px', padding: '12px 14px', color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.5 }}>
                  Create a repeatable communication series for this brand. Choose a trigger stage if the CRM should start it automatically, or keep it manual if staff should enroll leads themselves. Each step waits after the previous step, then sends/logs the selected action.
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>Workflow Name</label>
                    <input type="text" required value={seqForm.name} onChange={e => setSeqForm({...seqForm, name: e.target.value})} placeholder="e.g. Trial nurture and call follow-up" style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px' }}/>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>Start when lead reaches</label>
                    <select value={seqForm.trigger_stage} onChange={e => setSeqForm({...seqForm, trigger_stage: e.target.value})} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', background: 'var(--bg-card)' }}>
                      <option value="">Manual enrollment only</option>
                      {getBrandStageOptions(selectedBrand.id).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>Brief description</label>
                  <input type="text" value={seqForm.description} onChange={e => setSeqForm({...seqForm, description: e.target.value})} placeholder="What should this workflow do, and when should staff intervene?" style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px' }}/>
                </div>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '600' }}>
                    <input type="checkbox" checked={seqForm.active} onChange={e => setSeqForm({...seqForm, active: e.target.checked})}/> Active workflow
                  </label>
                </div>

                {/* Workflow Drip stages loops */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>
                    <div>
                      <h5 style={{ fontSize: '12px', fontWeight: '700' }}>WORKFLOW STEPS BY CHANNEL</h5>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Use 0 days for immediate action. Later steps wait after the previous step.</p>
                    </div>
                    <button type="button" onClick={handleAddSequenceStep} className="btn-add" style={{ padding: '4px 10px', fontSize: '11px', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', borderRadius: '4px' }}>
                      <i className="fas fa-plus"></i> Add Step
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '280px', overflowY: 'auto', paddingRight: '4px' }}>
                    {seqForm.steps.length === 0 ? (
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>No steps added. Add step template above.</p>
                    ) : (
                      seqForm.steps.map((st, sIdx) => (
                        <div key={sIdx} style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.8fr auto', gap: '10px', alignItems: 'center' }}>
                            <input type="text" placeholder="Step title (e.g. Intro Email)" required value={st.name} onChange={e => handleUpdateStepField(sIdx, 'name', e.target.value)} style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '11px', background: 'var(--bg-card)' }}/>
                            <select value={st.channel || 'email'} onChange={e => handleUpdateStepField(sIdx, 'channel', e.target.value)} style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '11px', background: 'var(--bg-card)' }}>
                              <option value="email">Email</option>
                              <option value="whatsapp">WhatsApp</option>
                              <option value="call">Call task</option>
                              <option value="task">Internal task</option>
                            </select>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <input type="number" required value={st.delay_days} onChange={e => handleUpdateStepField(sIdx, 'delay_days', parseInt(e.target.value) || 0)} style={{ width: '45px', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '11px', background: 'var(--bg-card)' }}/>
                              <span style={{ fontSize: '11px' }}>days after previous</span>
                            </div>
                            <button type="button" onClick={() => handleRemoveSequenceStep(sIdx)} style={{ border: 'none', background: 'transparent', color: '#ff4d4d', cursor: 'pointer' }}><i className="fas fa-times-circle"></i></button>
                          </div>
                          
                          <input type="text" placeholder={(st.channel || 'email') === 'call' ? 'Call task title or outcome goal' : (st.channel || 'email') === 'task' ? 'Internal task title' : (st.channel || 'email') === 'whatsapp' ? 'WhatsApp template name optional' : 'Email subject heading line'} value={st.subject} onChange={e => handleUpdateStepField(sIdx, 'subject', e.target.value)} style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '11px', background: 'var(--bg-card)' }}/>
                          <textarea placeholder={(st.channel || 'email') === 'call' ? 'Call notes, talking points, and what should happen after the call...' : (st.channel || 'email') === 'task' ? 'Internal instructions for the team...' : (st.channel || 'email') === 'whatsapp' ? 'WhatsApp message text...' : 'HTML body email script content...'} value={st.html_content} onChange={e => handleUpdateStepField(sIdx, 'html_content', e.target.value)} rows={2} style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '11px', background: 'var(--bg-card)' }}/>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setSeqModalIsOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={seqSaving || seqForm.steps.length === 0} style={{ background: selectedBrand.color }}>
                  {seqSaving ? 'Saving...' : 'Save Sequence Workflow'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. BULK ENROLL LEADS TRIGGER MODAL */}
      {enrollModalOpen && selectedBrand && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px', width: '90%', maxHeight: '90vh', overflow: 'hidden' }}>
            <div className="modal-header">
              <h3><i className="fas fa-sign-in-alt"></i> Bulk Enroll records in workflow</h3>
              <button className="modal-close" aria-label="Close" onClick={() => setEnrollModalOpen(false)}>&times;</button>
            </div>
            <form onSubmit={handleBulkEnrollSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div className="modal-body">
                
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>Select Target drip sequence</label>
                  <select required value={enrollSequenceId} onChange={e => setEnrollSequenceId(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px', background: 'var(--bg-card)' }}>
                    <option value="">Choose sequence...</option>
                    {sequences.map(s => <option key={s.id} value={s.id}>{s.name} ({s.trigger_stage || 'Manual'})</option>)}
                  </select>
                </div>

                <h5 style={{ fontSize: '12px', fontWeight: '700', marginBottom: '8px' }}>Selected Records checklist ({selectedLeadsEnroll.size} leads)</h5>
                <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', background: 'var(--bg-base)' }}>
                  {leads.map(l => (
                    <label key={l.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', padding: '4px 0' }}>
                      <input type="checkbox" checked={selectedLeadsEnroll.has(l.id)} onChange={() => handleToggleLeadEnrollSelect(l.id)}/> <strong>{l.name}</strong> ({l.email})
                    </label>
                  ))}
                </div>

              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setEnrollModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={enrollSaving || selectedLeadsEnroll.size === 0} style={{ background: selectedBrand.color }}>
                  {enrollSaving ? 'Enrolling...' : 'Bulk Enroll Leads'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. STAFF USER ADDER FORM */}
      {addUserIsOpen && (
        <div className="modal-overlay">
          <div className="modal-content user-add-modal" style={{ maxWidth: '440px', width: '90%' }}>
            <div className="modal-header">
              <h3><i className="fas fa-users-cog"></i> Create new executive staff user</h3>
              <button className="modal-close" aria-label="Close" onClick={() => setAddUserIsOpen(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreateUserSubmit}>
              <div className="modal-body">
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>Staff Name</label>
                  <input type="text" required value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px' }}/>
                </div>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>Login Email</label>
                  <input type="email" required value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px' }}/>
                </div>
                 <div style={{ marginBottom: '14px', position: 'relative' }}>
                   <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>Security Password (6+ chars)</label>
                   <input type={showAddUserPassword ? 'text' : 'password'} required value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} style={{ width: '100%', padding: '8px 34px 8px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px' }}/>
                   <button
                     type="button"
                     onClick={() => setShowAddUserPassword(!showAddUserPassword)}
                     style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(calc(-50% + 9px))', width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px', padding: 0, lineHeight: 1 }}
                   >
                     <i className={showAddUserPassword ? 'fas fa-eye-slash' : 'fas fa-eye'}></i>
                   </button>
                 </div>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>Role Clearance</label>
                  {(() => {
                    const isSuperAdmin = ['superadmin', 'owner'].includes(String(user?.platform_role || '').toLowerCase())
                      || String(user?.email || '').toLowerCase() === 'superadmin@optimaviz.com';
                    const roleValue = isSuperAdmin ? userForm.role : 'user';
                    return (
                      <>
                        <select
                          value={roleValue}
                          onChange={e => setUserForm({ ...userForm, role: e.target.value })}
                          disabled={!isSuperAdmin}
                          style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', background: 'var(--bg-card)', opacity: isSuperAdmin ? 1 : 0.85 }}
                        >
                          <option value="user">Standard Agent</option>
                          {isSuperAdmin && <option value="admin">Platform Admin</option>}
                        </select>
                        {!isSuperAdmin && (
                          <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: '11px', lineHeight: 1.4 }}>
                            Only the platform superadmin can create platform admins. You can add staff (standard agents).
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px' }}>Brand access</label>
                  <p style={{ margin: '0 0 8px', color: 'var(--text-muted)', fontSize: '11px', lineHeight: 1.4 }}>
                    Admins can access every brand. For staff, choose the brands they should see and work on.
                  </p>
                  <div style={{ border: '1px solid var(--border)', borderRadius: '10px', background: 'var(--bg-base)', padding: '10px', maxHeight: '150px', overflowY: 'auto', opacity: userForm.role === 'admin' ? 0.55 : 1 }}>
                    {activeBrands.length === 0 ? (
                      <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '12px' }}>Create a brand first, then assign staff to it.</p>
                    ) : (
                      activeBrands.map(brand => (
                        <label key={brand.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', fontSize: '12px', cursor: userForm.role === 'admin' ? 'not-allowed' : 'pointer' }}>
                          <input
                            type="checkbox"
                            disabled={userForm.role === 'admin'}
                            checked={userForm.role === 'admin' || (userForm.allowed_brand_ids || []).includes(brand.id)}
                            onChange={() => {
                              setUserForm(prev => {
                                const selected = new Set(prev.allowed_brand_ids || []);
                                if (selected.has(brand.id)) selected.delete(brand.id);
                                else selected.add(brand.id);
                                return { ...prev, allowed_brand_ids: Array.from(selected) };
                              });
                            }}
                          />
                          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: brand.color || '#0f766e' }} />
                          <strong>{brand.name}</strong>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setAddUserIsOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={userSaving}>Create User Profile</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 10. ADMIN PASSWORD EMERGENCY CHANGE MODAL */}
      {pwdUser && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px', width: '90%' }}>
            <div className="modal-header">
              <h3><i className="fas fa-key"></i> Set password for {pwdUser.name}</h3>
              <button className="modal-close" aria-label="Close" onClick={() => setPwdUser(null)}>&times;</button>
            </div>
            <form onSubmit={handleChangePasswordSubmit}>
               <div className="modal-body">
                 <div style={{ marginBottom: '14px', position: 'relative' }}>
                   <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>New Security Password</label>
                   <input type={showAdminPwd ? 'text' : 'password'} required value={newPwdField} onChange={e => setNewPwdField(e.target.value)} placeholder="At least 6 characters" style={{ width: '100%', padding: '8px 34px 8px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px' }}/>
                   <button
                     type="button"
                     onClick={() => setShowAdminPwd(!showAdminPwd)}
                     style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(calc(-50% + 9px))', width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px', padding: 0, lineHeight: 1 }}
                   >
                     <i className={showAdminPwd ? 'fas fa-eye-slash' : 'fas fa-eye'}></i>
                   </button>
                 </div>
               </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setPwdUser(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Force Update Password</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {mergeGroup && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '720px', width: '94%', maxHeight: '88vh', overflow: 'hidden' }}>
            <div className="modal-header">
              <h3><i className="fas fa-code-merge"></i> Smart Duplicate Merge</h3>
              <button className="modal-close" aria-label="Close" onClick={() => setMergeGroup(null)}>&times;</button>
            </div>
            <div className="modal-body" style={{ overflowY: 'auto' }}>
              <p style={{ marginTop: 0, color: 'var(--text-secondary)', fontSize: '13px' }}>
                Choose the record to keep. Merge combines contact details, notes, tags, and custom fields. TaskGo service history is preserved.
              </p>
              <div style={{ display: 'grid', gap: '10px' }}>
                {mergeGroup.map(l => (
                  <label key={l.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '12px', alignItems: 'start', padding: '12px', border: mergePrimaryId === l.id ? '1.5px solid var(--accent)' : '1px solid var(--border)', borderRadius: '12px', background: mergePrimaryId === l.id ? 'oklch(from var(--accent) l c h / 0.08)' : 'var(--bg-base)' }}>
                    <input type="radio" checked={mergePrimaryId === l.id} onChange={() => setMergePrimaryId(l.id)} />
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                        <strong style={{ color: 'var(--text-primary)' }}>{l.name}</strong>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{l.brand_name || l.brand_id} | {l.funnel_stage}</span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>{l.email || 'No email'} | {l.phone || 'No phone'}</div>
                      {l.brand_id === 'taskgo' && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Service: {l.custom_fields?.service_category_name || 'General Platform'} | ABN: {hasValidAbn(l) ? 'Present' : 'Missing'}</div>}
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setMergeGroup(null)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleSmartMerge}><i className="fas fa-code-merge"></i> Merge Records</button>
            </div>
          </div>
        </div>
      )}

      {commandMetricModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px', width: '92%' }}>
            <div className="modal-header">
              <h3><i className="fas fa-gauge-high"></i> {editingCommandMetricId ? 'Edit Command Metric' : 'Add Command Metric'}</h3>
              <button className="modal-close" aria-label="Close" onClick={() => setCommandMetricModalOpen(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '5px' }}>Metric Label</label>
                  <input value={commandMetricForm.label} onChange={e => setCommandMetricForm(prev => ({ ...prev, label: e.target.value }))} placeholder="e.g. Hot Leads" style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '5px' }}>Metric Type</label>
                  <select value={commandMetricForm.kind} onChange={e => {
                    const kind = e.target.value as CommandMetricKind;
                    const opt = getCommandMetricOption(kind);
                    setCommandMetricForm(prev => ({
                      ...prev,
                      kind,
                      label: prev.label === 'New Metric' || !prev.label ? opt?.label || 'Metric' : prev.label,
                      icon: opt?.icon || prev.icon,
                      color: opt?.color || prev.color,
                      brandId: opt?.brandId || prev.brandId || 'all'
                    }));
                  }} style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    {getCommandMetricOptionsForScope(commandMetricForm.brandId).map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                  <small style={{ display: 'block', marginTop: '6px', color: 'var(--text-muted)', fontSize: '11px', lineHeight: 1.4 }}>
                    {getCommandMetricOption(commandMetricForm.kind)?.description || 'Choose the operational number this card should calculate.'}
                  </small>
                </div>
              </div>
              {(() => {
                const opt = getCommandMetricOption(commandMetricForm.kind);
                return (
                  <>
                    {(
                      <div style={{ marginBottom: '12px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '5px' }}>Brand Scope</label>
                        <select className="brand-aware-select" value={commandMetricForm.brandId || 'all'} onChange={e => {
                          const brandId = e.target.value;
                          const available = getCommandMetricOptionsForScope(brandId);
                          setCommandMetricForm(prev => {
                            const currentStillAvailable = available.some(item => item.value === prev.kind);
                            const nextOpt = currentStillAvailable ? getCommandMetricOption(prev.kind) : available[0];
                            return {
                              ...prev,
                              brandId,
                              kind: (nextOpt?.value || prev.kind) as CommandMetricKind,
                              label: prev.label === 'New Metric' || !currentStillAvailable ? nextOpt?.label || prev.label : prev.label,
                              icon: nextOpt?.icon || prev.icon,
                              color: nextOpt?.color || prev.color
                            };
                          });
                        }} style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                          <option value="all">All brands</option>
                          {activeBrands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                        <small style={{ display: 'block', marginTop: '6px', color: 'var(--text-muted)', fontSize: '11px', lineHeight: 1.4 }}>
                          All brands shows cross-brand health metrics plus the important brand-specific metrics for every brand.
                        </small>
                      </div>
                    )}
                    {opt?.needsStage && (
                      <div style={{ marginBottom: '12px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '5px' }}>{commandMetricForm.kind === 'custom_field_match' ? 'Field Value To Match' : 'Stage'}</label>
                        {commandMetricForm.kind === 'custom_field_match' ? (
                          <input value={commandMetricForm.stage || ''} onChange={e => setCommandMetricForm(prev => ({ ...prev, stage: e.target.value }))} placeholder="e.g. trial_leads" style={{ width: '100%' }} />
                        ) : (
                          <select value={commandMetricForm.stage || ''} onChange={e => setCommandMetricForm(prev => ({ ...prev, stage: e.target.value }))} style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                            <option value="">Choose stage...</option>
                            {getBrandStageOptions(commandMetricForm.brandId === 'all' ? undefined : commandMetricForm.brandId).map(stage => <option key={stage} value={stage}>{stage}</option>)}
                          </select>
                        )}
                      </div>
                    )}
                    {opt?.needsField && (
                      <div style={{ marginBottom: '12px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '5px' }}>Custom Field Key</label>
                        <input value={commandMetricForm.fieldKey || ''} onChange={e => setCommandMetricForm(prev => ({ ...prev, fieldKey: e.target.value }))} placeholder="e.g. country, service_category_name" style={{ width: '100%' }} />
                      </div>
                    )}
                  </>
                );
              })()}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '5px' }}>Icon</label>
                  <input value={commandMetricForm.icon} onChange={e => setCommandMetricForm(prev => ({ ...prev, icon: e.target.value }))} placeholder="fa-chart-simple" style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '5px' }}>Color</label>
                  <input type="color" value={commandMetricForm.color} onChange={e => setCommandMetricForm(prev => ({ ...prev, color: e.target.value }))} style={{ width: '100%', height: '40px' }} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setCommandMetricModalOpen(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={saveCommandMetric}>Save Metric</button>
            </div>
          </div>
        </div>
      )}

      {incomingTeamCall && !teamCallOpen && createPortal(
        <aside className="incoming-team-call" role="alert" aria-live="assertive">
          <span className="incoming-team-call__pulse"><i className="fas fa-phone"></i></span>
          <div className="incoming-team-call__copy">
            <span>Incoming team call</span>
            <strong>{incomingTeamCall.user_name || 'A team member'} is inviting you</strong>
            <small>{(incomingTeamCall.recipient_ids || []).includes('all') ? 'All staff meeting' : 'Direct meeting'}</small>
          </div>
          <button type="button" className="incoming-team-call__dismiss" onClick={() => dismissIncomingTeamCall(incomingTeamCall.id)}>
            Dismiss
          </button>
          <button type="button" className="incoming-team-call__join" onClick={() => joinIncomingTeamCall(incomingTeamCall)}>
            <i className="fas fa-video"></i> Join
          </button>
        </aside>,
        document.body
      )}

      {teamCallMovedToTab && !teamCallOpen && teamCallRoomSlug && (
        <aside className="team-call-external-bar" role="status" aria-live="polite">
          <span className="team-call-external-bar__pulse" aria-hidden="true"><i className="fas fa-video"></i></span>
          <div className="team-call-external-bar__copy">
            <strong>{teamCallTitle}</strong>
            <small>Meeting is live in another tab — keep reporting in the CRM</small>
          </div>
          <button type="button" className="team-call-external-bar__focus" onClick={focusTeamCallTab} title="Focus the meeting tab">
            <i className="fas fa-up-right-from-square"></i>
            Focus meeting
          </button>
          <button type="button" className="team-call-external-bar__end" onClick={() => endTeamCall(true)} title="End the meeting for everyone">
            End call
          </button>
        </aside>
      )}

      {teamCallOpen && (
        <div
          className={`team-call-overlay ${teamCallDocked ? 'is-docked' : ''}`}
          role="dialog"
          aria-modal={!teamCallDocked}
          aria-label={teamCallTitle}
          style={teamCallDocked ? teamCallDockStyle : undefined}
        >
          <section className="team-call-modal">
            <header
              className={`team-call-header ${teamCallDocked ? 'is-draggable' : ''}`}
              onMouseDown={teamCallDocked ? beginTeamCallDockMove : undefined}
              onTouchStart={teamCallDocked ? beginTeamCallDockMove : undefined}
              title={teamCallDocked ? 'Drag to move the docked meeting' : undefined}
            >
              <div>
                <span className="team-call-eyebrow">
                  <i className="fas fa-video"></i>
                  {teamCallDocked ? 'Docked meeting · drag to move' : 'Team meeting'}
                </span>
                <h3>{teamCallTitle}</h3>
                {!teamCallDocked && (
                  <p>Dock to keep the call while you work in the CRM (recommended on phone and desktop).</p>
                )}
              </div>
              <div className="team-call-header-actions">
                {teamCallRoomSlug && (
                  <>
                    <button
                      type="button"
                      className="team-call-external"
                      onClick={() => {
                        setTeamCallDocked(d => {
                          const next = !d;
                          // After dock/expand, force Jitsi to reflow so raise-hand / overlays clear correctly.
                          window.setTimeout(() => {
                            try {
                              window.dispatchEvent(new Event('resize'));
                              teamCallApiRef.current?.executeCommand?.('resizeLargeVideo');
                            } catch { /* ignore */ }
                          }, 80);
                          return next;
                        });
                      }}
                      title={teamCallDocked ? 'Expand the meeting to full size' : 'Dock the meeting and keep using the CRM'}
                    >
                      <i className={`fas ${teamCallDocked ? 'fa-expand' : 'fa-window-minimize'}`}></i>
                      {teamCallDocked ? 'Expand' : 'Dock call'}
                    </button>
                    {teamCallDocked && (
                      <button
                        type="button"
                        className="team-call-external"
                        onClick={resetTeamCallDockCorner}
                        title="Reset dock size and position"
                      >
                        <i className="fas fa-crosshairs"></i>
                        Reset
                      </button>
                    )}
                  </>
                )}
                <button type="button" className="team-call-close" onClick={() => endTeamCall(true)} aria-label="End team call">
                  <i className="fas fa-xmark"></i>
                </button>
              </div>
            </header>
            <div className="team-call-body">
              {teamCallLoading && (
                <div className="team-call-loading">
                  <i className="fas fa-spinner fa-spin"></i>
                  Preparing your meeting room...
                </div>
              )}
              {teamCallError && (
                <div className="team-call-error">
                  <strong>Meeting could not load</strong>
                  <span>{teamCallError}</span>
                  {teamCallRoomSlug && (
                    <a href={getTeamCallExternalUrl(teamCallRoomSlug)} target="_blank" rel="noreferrer">Open the fallback meeting link</a>
                  )}
                </div>
              )}
              <div ref={teamCallContainerRef} className="team-call-frame" />
            </div>
            {teamCallDocked && (
              <button
                type="button"
                className="team-call-resize-handle"
                aria-label="Resize docked meeting"
                title="Drag to resize"
                onMouseDown={beginTeamCallDockResize}
                onTouchStart={beginTeamCallDockResize}
              />
            )}
          </section>
        </div>
      )}


      <div className={`my-notes-dock ${userNotesOpen ? 'is-open' : ''}`}>
        {!userNotesOpen && (
          <button
            type="button"
            className="my-notes-launcher"
            onClick={() => { setUserNotesOpen(true); fetchTeamNotes(); }}
            aria-label="Open my notes"
            title="My Notes"
          >
            <i className="fas fa-note-sticky"></i>
            <span>My Notes</span>
          </button>
        )}
        {userNotesOpen && (
          <section className="my-notes-panel" aria-label="My notes">
            <header>
              <div>
                <strong>My Notes</strong>
                <small>Quick notes saved in the CRM.</small>
              </div>
              <div>
                <button type="button" onClick={() => openTeamNoteEditor()} title="Add note"><i className="fas fa-plus"></i></button>
                <button type="button" onClick={() => setUserNotesOpen(false)} title="Close" aria-label="Close notes"><i className="fas fa-xmark"></i></button>
              </div>
            </header>
            {teamNoteOpen && (
              <form className="my-note-editor-inline" onSubmit={handleSaveTeamNote}>
                <input value={teamNoteTitle} onChange={e => setTeamNoteTitle(e.target.value)} placeholder="Note title" />
                <textarea value={teamNoteContent} onChange={e => setTeamNoteContent(e.target.value)} placeholder="Write your note..." rows={4} />
                <label className="my-note-pin-toggle"><input type="checkbox" checked={teamNotePinned} onChange={e => setTeamNotePinned(e.target.checked)} /> <span><i className="fas fa-thumbtack"></i> Pin note</span></label>
                <div>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTeamNoteOpen(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={teamNoteSaving}>{teamNoteSaving ? 'Saving...' : 'Save'}</button>
                </div>
              </form>
            )}
            <div className="my-notes-list">
              {teamNotes.length === 0 && <p>No notes yet. Click + to save your first note.</p>}
              {teamNotes.slice(0, 8).map(note => (
                <article key={note.id} className={note.pinned ? 'pinned' : ''}>
                  <button type="button" onClick={() => openTeamNoteEditor(note)}>
                    <strong>{note.title}</strong>
                    <span>{note.content}</span>
                  </button>
                  <button type="button" onClick={() => handleDeleteTeamNote(note.id)} title="Delete note"><i className="fas fa-trash"></i></button>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>

      <QuickCallLog
        lead={lastViewedLead}
        open={quickCallOpen}
        saving={quickCallSaving}
        onOpenChange={setQuickCallOpen}
        onSubmit={handleQuickCallSubmit}
      />

      <CommandPalette
        open={commandPaletteOpen}
        leads={allCrmLeads.length ? allCrmLeads : leads}
        brands={activeBrands}
        activeLead={activeLead || lastViewedLead}
        onClose={() => setCommandPaletteOpen(false)}
        onOpenLead={jumpToLead}
        onOpenBrand={handleSelectBrand}
        onNavigate={handleCommandNavigate}
        onQuickCall={openQuickCallForLead}
        onPowerAction={handlePowerAction}
      />

      {keyboardHelpOpen && (
        <div className="keyboard-help-overlay" onMouseDown={() => setKeyboardHelpOpen(false)} role="dialog" aria-label="Keyboard shortcuts">
          <div className="keyboard-help" onMouseDown={e => e.stopPropagation()}>
            <div className="keyboard-help__head">
              <strong><i className="fas fa-keyboard"></i> Power-user shortcuts</strong>
              <button type="button" onClick={() => setKeyboardHelpOpen(false)} aria-label="Close"><i className="fas fa-times"></i></button>
            </div>
            <div className="keyboard-help__grid">
              <div><kbd>Ctrl</kbd><kbd>K</kbd><span>Command palette</span></div>
              <div><kbd>?</kbd><span>This help</span></div>
              <div><kbd>Esc</kbd><span>Close lead / help</span></div>
              <div><kbd>G</kbd> then <kbd>E</kbd><span>Email</span></div>
              <div><kbd>G</kbd> then <kbd>C</kbd><span>Communications</span></div>
              <div><kbd>G</kbd> then <kbd>T</kbd><span>Team chat</span></div>
              <div><kbd>G</kbd> then <kbd>D</kbd><span>Dashboard</span></div>
              <div><kbd>G</kbd> then <kbd>W</kbd><span>WhatsApp</span></div>
              <div><kbd>G</kbd> then <kbd>I</kbd><span>Integrations</span></div>
              <div><kbd>↑</kbd><kbd>↓</kbd><kbd>Enter</kbd><span>Palette navigate</span></div>
            </div>
            <p className="keyboard-help__hint">Palette also runs: Sync Gmail, Create task, Hand off to NestWise, product views.</p>
          </div>
        </div>
      )}

      {notificationDrawerOpen && (
        <div className="notification-drawer" role="dialog" aria-label="Notification Center">
          <div className="notification-drawer__header">
            <strong>Notification Center</strong>
            <div className="notification-drawer__actions">
              <button
                type="button"
                onClick={() => {
                  markAllNotificationsSeen();
                  setNotificationDrawerSnapshot([]);
                }}
                title="Clear current notifications"
              >
                Clear all
              </button>
              <button
                type="button"
                onClick={() => {
                  setNotificationDrawerOpen(false);
                  setNotificationDrawerSnapshot([]);
                }}
                aria-label="Close notifications"
              >
                <i className="fas fa-xmark"></i>
              </button>
            </div>
          </div>
          {(notificationDrawerSnapshot.length > 0 ? notificationDrawerSnapshot : visibleNotificationItems).length > 0 ? (notificationDrawerSnapshot.length > 0 ? notificationDrawerSnapshot : visibleNotificationItems).map(item => (
            <div key={getNotificationItemKey(item)} className="notification-row">
              <button
                type="button"
                className="notification-row__main"
                title={`Open ${item.label}`}
                onClick={() => {
                  dismissNotificationItem(item.label, item.value);
                  setNotificationDrawerSnapshot(prev => prev.filter(row => row.label !== item.label));
                  item.action();
                  setNotificationDrawerOpen(false);
                  setNotificationDrawerSnapshot([]);
                }}
              >
                <span style={{ color: item.tone || item.color }}><i className={`fas ${item.icon}`}></i></span>
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.value} item{item.value === 1 ? '' : 's'} need attention</small>
                  {isNotificationCategoryCritical(item.label) ? <em>Critical · stays until resolved</em> : <em>Open details</em>}
                </span>
              </button>
              <button
                type="button"
                className="notification-row__dismiss"
                title="Dismiss this alert"
                aria-label={`Dismiss ${item.label}`}
                onClick={(e) => {
                  e.stopPropagation();
                  dismissNotificationItem(item.label, item.value);
                  setNotificationDrawerSnapshot(prev => prev.filter(row => row.label !== item.label));
                }}
              >
                <i className="fas fa-xmark"></i>
              </button>
            </div>
          )) : (
            <div className="notification-empty">
              <i className="fas fa-check-circle"></i>
              <strong>All clear</strong>
              <span>No urgent CRM alerts right now.</span>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal (replaces window.confirm for destructive actions) */}
      <ConfirmModal config={confirmModalConfig} onClose={() => setConfirmModalConfig(null)} />

      {/* Custom Lead Tab Modal */}
      {showCustomTabModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        }} onClick={() => setShowCustomTabModal(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: '#ffffff', borderRadius: '16px', padding: '24px', width: '420px', maxWidth: '92vw', boxShadow: '0 25px 60px rgba(15,23,42,0.25)', border: '1px solid rgba(0,0,0,0.08)',
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>{editingCustomTabId ? 'Edit Custom Tab' : 'New Custom Tab'}</h3>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#334155' }}>Tab name</label>
              <input
                type="text"
                value={customTabName}
                onChange={(e) => setCustomTabName(e.target.value)}
                placeholder="e.g. Hot Leads"
                autoFocus
                style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #e7eaf0', background: '#f8fafc', color: '#0f172a', fontSize: '14px', outline: 'none' }}
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#334155' }}>Icon</label>
              <select
                value={customTabIcon}
                onChange={(e) => setCustomTabIcon(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #e7eaf0', background: '#f8fafc', color: '#0f172a', fontSize: '14px', outline: 'none' }}
              >
                {['fa-fire', 'fa-star', 'fa-bolt', 'fa-heart', 'fa-gem', 'fa-trophy', 'fa-flag', 'fa-bookmark', 'fa-tag', 'fa-filter'].map(icon => (
                  <option key={icon} value={icon}>{icon.replace('fa-', '')}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#334155' }}>Color</label>
              <select
                value={customTabColor}
                onChange={(e) => setCustomTabColor(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #e7eaf0', background: '#f8fafc', color: '#0f172a', fontSize: '14px', outline: 'none' }}
              >
                {['#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6'].map(color => (
                  <option key={color} value={color}>{color}</option>
                ))}
              </select>
            </div>
            {!editingCustomTabId && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: '#334155' }}>
                  <input
                    type="checkbox"
                    checked={useCurrentFiltersForTab}
                    onChange={(e) => setUseCurrentFiltersForTab(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: '#6366f1' }}
                  />
                  Use current filters
                </label>
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowCustomTabModal(false)} style={{ color: '#64748b' }}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={saveCustomTab} disabled={!customTabName.trim()} style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: '10px', padding: '8px 16px', fontWeight: '600', cursor: 'pointer', opacity: customTabName.trim() ? 1 : 0.6 }}>
                {editingCustomTabId ? 'Save changes' : 'Create tab'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Message Notification Banner */}
      {toastMessage && (
        <div className={`toast-notification ${toastMessage.isError ? 'is-error' : ''}`}>
          <i className={toastMessage.isError ? 'fas fa-exclamation-circle' : 'fas fa-check-circle'}></i>
          <span>{toastMessage.text}</span>
          <button onClick={() => setToastMessage(null)} aria-label="Dismiss notification">
            &times;
          </button>
        </div>
      )}

      <PremiumSelectOverlay />

      {/* User Profile Modal */}
      {profileModalOpen && createPortal(
        <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', zIndex: 10000, background: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)', padding: '16px' }}>
          <div className="profile-modal" role="dialog" aria-modal="true" aria-label="User profile settings" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>User Profile</h3>
              <button onClick={() => setProfileModalOpen(false)} aria-label="Close" style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '18px', padding: 0 }}>
                <i className="fas fa-xmark" aria-hidden="true"></i>
              </button>
            </div>

            <div className="profile-modal__body">
            {/* Left column */}
            <div className="profile-modal__col">
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: profilePicture ? 'transparent' : 'linear-gradient(135deg, var(--accent), var(--brand-optimaviz))', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '24px', overflow: 'hidden', border: '2px solid var(--border)', flexShrink: 0 }}>
                {profilePicture ? <img src={profilePicture} alt="Profile" onError={(e) => { e.currentTarget.style.display = 'none'; setProfilePicture(''); safeLocalStorage.removeItem(`crm_user_picture_${user.id}`); safeLocalStorage.removeItem('crm_user_picture'); }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : profileName.charAt(0)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>Profile Picture</label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '600', color: 'var(--accent)', cursor: 'pointer' }}>
                  <i className="fas fa-camera"></i> Upload
                  <input type="file" accept="image/*" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      try {
                        setProfilePicture(await prepareProfilePicture(file));
                      } catch (error) {
                        showToast(error instanceof Error ? error.message : 'Could not prepare this profile image.', true);
                      }
                    }
                  }} style={{ display: 'none' }} />
                </label>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>Full Name</label>
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="Your full name"
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: '13px', boxSizing: 'border-box' }}
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isDarkMode}
                onChange={(e) => setIsDarkMode(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <i className={isDarkMode ? 'fas fa-moon' : 'fas fa-sun'}></i>
                {isDarkMode ? 'Dark Mode' : 'Light Mode'}
              </span>
            </label>

            <div className="profile-theme-panel profile-notif-settings">
              <div>
                <strong>Notification alerts</strong>
                <span>Opened alerts stop re-badging unless marked critical. New activity (higher count) alerts again.</span>
              </div>
              <label className="profile-notif-settings__days">
                <span>
                  <strong>Follow-up reminder window</strong>
                  <small>Days before due date to start alerting (0 = due today / overdue only)</small>
                </span>
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={notificationPreferences.follow_up_remind_days}
                  onChange={(e) => updateNotificationPreferences({
                    ...notificationPreferences,
                    follow_up_remind_days: Number(e.target.value || 0),
                  })}
                />
              </label>
              <div className="profile-notif-settings__scroll" role="group" aria-label="Alert categories">
                {NOTIFICATION_CATEGORY_META.map((cat) => (
                  <div key={cat.id} className="profile-notif-settings__row">
                    <div>
                      <strong>{cat.label}</strong>
                      <small>{cat.description}</small>
                    </div>
                    <label title="Show this alert type">
                      <input
                        type="checkbox"
                        checked={notificationPreferences.enabled[cat.id]}
                        onChange={(e) => updateNotificationPreferences({
                          ...notificationPreferences,
                          enabled: { ...notificationPreferences.enabled, [cat.id]: e.target.checked },
                        })}
                      />
                      On
                    </label>
                    <label title="Keep alerting after the notification center is opened">
                      <input
                        type="checkbox"
                        checked={notificationPreferences.critical[cat.id]}
                        disabled={!notificationPreferences.enabled[cat.id]}
                        onChange={(e) => updateNotificationPreferences({
                          ...notificationPreferences,
                          critical: { ...notificationPreferences.critical, [cat.id]: e.target.checked },
                        })}
                      />
                      Critical
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="profile-theme-panel">
              <div>
                <strong>Sidebar theme</strong>
                <span>Choose a clearer workspace look for daily use.</span>
              </div>
              <div className="profile-theme-options">
                {[
                  ['frosted', 'Frosted'],
                  ['greyBlue', 'Blue Grey'],
                  ['warmGrey', 'Warm Grey'],
                  ['darkPro', 'Dark Pro'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={sidebarStyle === value ? 'active' : ''}
                    onClick={() => setSidebarStyle(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={async () => {
                  try {
                    const nextName = String(profileName || '').trim();
                    if (!nextName) {
                      showToast('Enter a display name.', true);
                      return;
                    }
                    const response = await axios.put(`/api/auth/users/${user.id}`, {
                      name: nextName,
                      profile_picture_url: profilePicture,
                    });
                    const updated = response.data || { ...user, name: nextName, profile_picture_url: profilePicture };
                    setUser(updated);
                    setUsersList(prev => prev.map(staff => staff.id === user.id ? { ...staff, name: updated.name || nextName, profile_picture_url: updated.profile_picture_url || profilePicture } : staff));
                    setProfileName(updated.name || nextName);
                    if (profilePicture) safeLocalStorage.setItem(`crm_user_picture_${user.id}`, profilePicture);
                    else safeLocalStorage.removeItem(`crm_user_picture_${user.id}`);
                    safeLocalStorage.removeItem('crm_user_picture');
                    showToast('Profile updated successfully!');
                    setProfileModalOpen(false);
                  } catch (error) {
                    showApiError(error, 'Failed to update profile');
                  }
                }}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: 'white', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}
              >
                <i className="fas fa-save"></i> Save
              </button>
              <button
                onClick={() => setProfileModalOpen(false)}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}
              >
                Cancel
              </button>
            </div>
            </div>

            {/* Right column: change password */}
            <div className="profile-modal__divider">
              <h4 style={{ fontSize: '13px', fontWeight: '700', margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}><i className="fas fa-lock" style={{ color: 'var(--accent)' }}></i> Change Password</h4>
              {pwError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', color: '#b91c1c', padding: '6px 8px', borderRadius: '6px', fontSize: '11px' }}>
                  <i className="fas fa-exclamation-circle" style={{ marginRight: '4px' }}></i> {pwError}
                </div>
              )}
              <div style={{ position: 'relative' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '3px' }}>Current Password</label>
                <input
                  type={showCurrentPw ? 'text' : 'password'}
                  value={currentPw}
                  onChange={e => setCurrentPw(e.target.value)}
                  placeholder="Enter current password"
                  style={{ width: '100%', padding: '7px 32px 7px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', background: 'var(--bg-base)', color: 'var(--text-primary)' }}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPw(!showCurrentPw)}
                  style={{ position: 'absolute', right: '5px', top: '50%', transform: 'translateY(calc(-50% + 8px))', width: '26px', height: '26px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px', padding: 0, lineHeight: 1 }}
                >
                  <i className={showCurrentPw ? 'fas fa-eye-slash' : 'fas fa-eye'}></i>
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '3px' }}>New Password</label>
                <input
                  type={showNewPw ? 'text' : 'password'}
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  placeholder="At least 6 characters"
                  style={{ width: '100%', padding: '7px 32px 7px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', background: 'var(--bg-base)', color: 'var(--text-primary)' }}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw(!showNewPw)}
                  style={{ position: 'absolute', right: '5px', top: '50%', transform: 'translateY(calc(-50% + 8px))', width: '26px', height: '26px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px', padding: 0, lineHeight: 1 }}
                >
                  <i className={showNewPw ? 'fas fa-eye-slash' : 'fas fa-eye'}></i>
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '3px' }}>Confirm New Password</label>
                <input
                  type={showConfirmNewPw ? 'text' : 'password'}
                  value={confirmNewPw}
                  onChange={e => setConfirmNewPw(e.target.value)}
                  placeholder="Re-enter new password"
                  style={{ width: '100%', padding: '7px 32px 7px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', background: 'var(--bg-base)', color: 'var(--text-primary)' }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmNewPw(!showConfirmNewPw)}
                  style={{ position: 'absolute', right: '5px', top: '50%', transform: 'translateY(calc(-50% + 8px))', width: '26px', height: '26px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px', padding: 0, lineHeight: 1 }}
                >
                  <i className={showConfirmNewPw ? 'fas fa-eye-slash' : 'fas fa-eye'}></i>
                </button>
              </div>
              <button
                type="button"
                disabled={pwSaving}
                onClick={async () => {
                  setPwError('');
                  if (!currentPw || !newPw || !confirmNewPw) { setPwError('All fields are required'); return; }
                  if (newPw !== confirmNewPw) { setPwError('New passwords do not match'); return; }
                  if (newPw.length < 6) { setPwError('Password must be at least 6 characters'); return; }
                  try {
                    setPwSaving(true);
                    await axios.post('/api/auth/me/change-password', { current_password: currentPw, new_password: newPw });
                    showToast('Password changed successfully!');
                    setCurrentPw('');
                    setNewPw('');
                    setConfirmNewPw('');
                  } catch (err: any) {
                    setPwError(toUserFacingError(err, 'Failed to change password'));
                  } finally {
                    setPwSaving(false);
                  }
                }}
                style={{ width: '100%', padding: '9px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: 'white', fontWeight: '600', cursor: 'pointer', fontSize: '12px', opacity: pwSaving ? 0.7 : 1 }}
              >
                <i className="fas fa-key"></i> {pwSaving ? 'Updating...' : 'Change Password'}
              </button>
            </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Mobile bottom navigation bar (visible below 768px) */}
      <MobileBottomNav
        activeTab={activeTab}
        selectedBrand={selectedBrand}
        onSelectDashboard={handleSelectDashboard}
        onSelectCommunications={handleSelectCommunications}
        onSelectTeamChat={() => openCommunicationTool('team-chat')}
        onSelectSocialHub={() => { setSelectedBrand(null); setActiveTab('social-hub'); }}
        onSelectIntegrations={() => openCommunicationTool('integrations')}
        onSelectBrands={() => setMobileBrandPickerOpen(true)}
        onOpenProfile={() => {
          setProfileName(user?.name || '');
          setCurrentPw('');
          setNewPw('');
          setConfirmNewPw('');
          setPwError('');
          setProfileModalOpen(true);
        }}
      />

      {mobileBrandPickerOpen && createPortal(
        <div className="mobile-brand-picker" role="dialog" aria-modal="true" aria-label="Choose brand">
          <div className="mobile-brand-picker__sheet">
            <header>
              <strong>Brands</strong>
              <button type="button" onClick={() => setMobileBrandPickerOpen(false)} aria-label="Close"><i className="fas fa-xmark"></i></button>
            </header>
            <p>Open a brand workspace for leads, pipeline, and brand tools.</p>
            <div className="mobile-brand-picker__list">
              {activeBrands.map(brand => (
                <button
                  key={brand.id}
                  type="button"
                  onClick={() => {
                    setMobileBrandPickerOpen(false);
                    handleSelectBrand(brand);
                  }}
                >
                  <img src={brand.logo} alt="" />
                  <span>{brand.name}</span>
                  <i className="fas fa-chevron-right" aria-hidden="true"></i>
                </button>
              ))}
              {activeBrands.length === 0 && <small>No brands yet. Create one from the desktop sidebar Brand Management.</small>}
            </div>
          </div>
          <button type="button" className="mobile-brand-picker__backdrop" aria-label="Dismiss" onClick={() => setMobileBrandPickerOpen(false)} />
        </div>,
        document.body
      )}
    </div>
  );
}





