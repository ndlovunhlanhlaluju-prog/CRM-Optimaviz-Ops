import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import * as ScrollArea from '@radix-ui/react-scroll-area';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { User, Brand, BrandFunnel, CustomField, Lead, Note, CallLog, EmailLog, TeamMessage, TeamNote, WhatsAppLog, WhatsAppTemplate, MessageTemplate, BrandIntegration, Sequence, SequenceStep, Task } from './types';
import CommandPalette from './components/CommandPalette';
import FollowUpQueue from './components/FollowUpQueue';
import { parseDateOnly, isFollowUpDue, getFollowUpLabel, isDoNotContact, isFinalStage } from './utils/workflow';
import QuickCallLog, { QuickCallPayload } from './components/QuickCallLog';

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

// Set Axios default config
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

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('crm_dark_mode');
    if (saved !== null) return saved === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.dataset.theme = isDarkMode ? 'dark' : 'light';
    localStorage.setItem('crm_dark_mode', String(isDarkMode));
  }, [isDarkMode]);

  const [user, setUser] = useState<User | null>(() => {
    // Always show the login screen on a fresh app start/reload so access is not silently skipped.
    safeLocalStorage.removeItem('optima_user');
    return null;
  });

  // Synchronize user to localStorage and Authorization header
  useEffect(() => {
    if (user && user.id) {
      safeLocalStorage.setItem('optima_user', JSON.stringify(user));
      axios.defaults.headers.common['Authorization'] = `Bearer ${user.id}`;
    } else {
      safeLocalStorage.removeItem('optima_user');
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [user]);
  const [loading, setLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showForgotPw, setShowForgotPw] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotNewPw, setForgotNewPw] = useState('');
  const [forgotStep, setForgotStep] = useState<'email' | 'reset' | 'done'>('email');
  const [forgotError, setForgotError] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showForgotPwField, setShowForgotPwField] = useState(false);

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
  const [brandSubTab, setBrandSubTab] = useState<'leads' | 'sequences' | 'tasks'>('leads');
  const [leadWorkspaceView, setLeadWorkspaceView] = useState<'table' | 'kanban'>('table');
  const [kanbanSearchQuery, setKanbanSearchQuery] = useState('');
  const [kanbanColumnLimits, setKanbanColumnLimits] = useState<Record<string, number>>({});

  type ManagedBrand = Brand & { archived?: boolean };
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

  useEffect(() => {
    safeLocalStorage.setItem('crm_custom_brand_segments', JSON.stringify(customBrandSegments));
  }, [customBrandSegments]);

  useEffect(() => {
    safeLocalStorage.setItem('crm_brand_stage_overrides', JSON.stringify(brandStageOverrides));
  }, [brandStageOverrides]);
  const [snapshotCards, setSnapshotCards] = useState<Record<string, SnapshotCardConfig[]>>(() => {
    try {
      const stored = safeLocalStorage.getItem('crm_snapshot_cards');
      return stored ? JSON.parse(stored) : DEFAULT_SNAPSHOT_CARDS;
    } catch {
      return DEFAULT_SNAPSHOT_CARDS;
    }
  });
  const [snapshotForm, setSnapshotForm] = useState({ label: '', fieldKey: 'segment', matchValue: '', target: '10', unit: 'Leads', icon: 'fa-bullseye', color: '#8B5CF6' });
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

  // Brand-Specific Collections
  const [leads, setLeads] = useState<Lead[]>([]);
  const [allCrmLeads, setAllCrmLeads] = useState<Lead[]>([]);
  const [funnels, setFunnels] = useState<Record<string, BrandFunnel>>({});
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [sequences, setSequences] = useState<Sequence[]>([]);
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

  const getSnapshotCardValue = (card: SnapshotCardConfig, brandLeads: Lead[]) => {
    if (card.fieldKey === '__total__') return new Set(brandLeads.map(l => (l.email || l.id).toLowerCase().trim())).size;
    const matches = brandLeads.filter(l => {
      const val = card.fieldKey === 'funnel_stage' ? l.funnel_stage : l.custom_fields?.[card.fieldKey];
      if (!card.matchValue) return val !== undefined && val !== null && String(val).trim() !== '';
      return String(val || '').toLowerCase().trim() === card.matchValue.toLowerCase().trim();
    });
    if (card.fieldKey.toLowerCase().includes('abn')) {
      return new Set(matches.filter(l => String(l.custom_fields?.[card.fieldKey] || '').replace(/\s+/g, '').length >= 9).map(l => (l.email || l.id).toLowerCase().trim())).size;
    }
    return matches.length;
  };


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

  const buildSegmentsDraftForBrand = (brandId: string) => (getBrandSegmentOptions(brandId) || []).map(seg => seg.label).join('\n');
  const buildStagesDraftForBrand = (brandId: string) => getBrandStageOptions(brandId).join('\n');

  const syncWorkflowDesignerDrafts = (brandId: string) => {
    setWorkflowDesignerBrandId(brandId);
    setWorkflowSegmentsDraft(buildSegmentsDraftForBrand(brandId));
    setWorkflowStagesDraft(buildStagesDraftForBrand(brandId));
  };

  const handleSaveWorkflowDesigner = () => {
    const brand = managedBrands.find(b => b.id === workflowDesignerBrandId);
    if (!brand) return;
    const segmentNames = parseLineList(workflowSegmentsDraft, ['New Enquiries', 'Follow-Up Leads', 'Active Customers']);
    const stageNames = parseLineList(workflowStagesDraft, DEFAULT_STAGES);
    const segmentColors = [brand.color || '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#0EA5E9'];
    const segments = segmentNames.map((label, index) => ({
      label,
      value: slugifyValue(label),
      color: segmentColors[index % segmentColors.length],
      icon: index === 0 ? 'fas fa-bullseye' : index === 1 ? 'fas fa-phone-volume' : index === 2 ? 'fas fa-users' : 'fas fa-layer-group'
    }));
    setCustomBrandSegments(prev => ({ ...prev, [brand.id]: segments }));
    setBrandStageOverrides(prev => ({ ...prev, [brand.id]: stageNames }));
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
    const segmentNames = parseLineList(newBrandSegments, ['New Enquiries', 'Follow-Up Leads', 'Active Customers']);
    const stageNames = parseLineList(newBrandStages, ['New Lead', 'Contacted', 'Follow-Up Due', 'Proposal Sent', 'Won', 'Lost']);
    const segmentColors = [newBrandColor || '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444'];
    const segments = segmentNames.map((label, index) => ({
      label,
      value: slugifyValue(label),
      color: segmentColors[index % segmentColors.length],
      icon: index === 0 ? 'fas fa-bullseye' : index === 1 ? 'fas fa-phone-volume' : index === 2 ? 'fas fa-users' : 'fas fa-layer-group'
    }));
    const snapshotDefaults: SnapshotCardConfig[] = segments.slice(0, 3).map((seg, index) => ({
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
    setManagedBrands(prev => [...prev, { id, name, logo: newBrandLogo || '/logos/optima_crm_logo.png', color: newBrandColor || '#8B5CF6' }]);
    setCustomBrandSegments(prev => ({ ...prev, [id]: segments }));
    setBrandStageOverrides(prev => ({ ...prev, [id]: stageNames }));
    setSnapshotCards(prev => ({ ...prev, [id]: snapshotDefaults }));
    setCustomWidgets(prev => ({
      ...prev,
      [id]: segments.slice(0, 3).map((seg, index) => ({
        id: `${id}_widget_${seg.value}`,
        title: seg.label,
        criteriaType: 'segment',
        criteriaValue: seg.value,
        goal: 10,
        icon: seg.icon.replace('fas ', ''),
        color: seg.color,
        countMode: 'records'
      }))
    }));
    setNewBrandName('');
    setNewBrandLogo('/logos/optima_crm_logo.png');
    setNewBrandLogoFileName('');
    setNewBrandColor('#8B5CF6');
    setNewBrandSegments('New Enquiries\nFollow-Up Leads\nActive Customers');
    setNewBrandStages('New Lead\nContacted\nFollow-Up Due\nProposal Sent\nWon\nLost');
    showToast(`Brand ${name} added with editable segments, stages, and dashboard cards.`);
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

  const handleAddSnapshotCard = (brandId: string) => {
    const sourceKey = snapshotForm.fieldKey || 'segment';
    if (sourceKey !== '__total__' && !snapshotForm.matchValue.trim()) { showToast('Choose a segment or stage to track.', true); return; }
    const segmentMeta = sourceKey === 'segment'
      ? getBrandSegmentOptions(brandId).find(seg => seg.value === snapshotForm.matchValue || seg.label === snapshotForm.matchValue)
      : undefined;
    const cardLabel = snapshotForm.label.trim()
      || (sourceKey === '__total__' ? 'Total Leads' : segmentMeta?.label || snapshotForm.matchValue.trim());
    const card: SnapshotCardConfig = {
      id: `snapshot-${Date.now()}`,
      label: cardLabel,
      fieldKey: sourceKey,
      matchValue: sourceKey === '__total__' ? undefined : snapshotForm.matchValue.trim(),
      target: Number(snapshotForm.target) || 10,
      unit: snapshotForm.unit.trim() || 'Leads',
      icon: sourceKey === 'funnel_stage' ? 'fa-table-columns' : (segmentMeta?.icon || snapshotForm.icon || 'fa-bullseye').replace('fas ', ''),
      color: snapshotForm.color || segmentMeta?.color || '#8B5CF6',
      active: true
    };
    setSnapshotCards(prev => ({ ...prev, [brandId]: [...(prev[brandId] || []), card] }));
    setSnapshotForm({ label: '', fieldKey: 'segment', matchValue: '', target: '10', unit: 'Leads', icon: 'fa-bullseye', color: '#8B5CF6' });
    showToast('Snapshot item added.');
  };

  const handleDeleteSnapshotCard = (brandId: string, cardId: string) => {
    setSnapshotCards(prev => ({ ...prev, [brandId]: (prev[brandId] || []).filter(c => c.id !== cardId) }));
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

  const normalizeFieldValue = (val: any): string => {
    if (val === undefined || val === null) return 'Has not filled/blank';
    const s = String(val).trim();
    if (!s || s.toLowerCase() === 'general platform' || s.toLowerCase() === 'general support' || s.toLowerCase() === 'no abn supplied') {
      return 'Has not filled/blank';
    }
    return s;
  };

  const formatColumnLabel = (key: string): string => {
    if (key === 'segment') return 'Target Segment';
    return key
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, char => char.toUpperCase());
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
      if (stages.some(s => s.toLowerCase() === normalizedStage)) return segment;
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
    return stages.find(s => s.toLowerCase() === mapped.toLowerCase()) || stages[0] || mapped;
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
      if (stages.some(s => s.toLowerCase() === normalizedStage)) return segment;
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
    return stages.find(s => s.toLowerCase() === mapped.toLowerCase()) || stages[0] || mapped;
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
        const key = f.field_name.toLowerCase();
        return !OPTIMAVIZ_REMOVED_TABLE_FIELDS.has(key) && !OPTIMAVIZ_TRIAL_TABLE_FIELDS.has(key) && !OPTIMAVIZ_STANDARD_CUSTOM_FIELD_COLUMNS.has(key);
      });
    }
    if (selectedBrand?.id === 'idao') {
      return customFields.filter(f => {
        const key = f.field_name.toLowerCase();
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
    if (value.includes('quote') || value.includes('trial') || value.includes('demo')) return '#8b5cf6';
    return '#2563eb';
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
  const [selectedCustomFieldFilter, setSelectedCustomFieldFilter] = useState<{ field: string; value: string } | null>(null);
  const [skipDuplicatesOnImport, setSkipDuplicatesOnImport] = useState(false);
  const [confirmDuplicateImport, setConfirmDuplicateImport] = useState(false);
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [duplicatesAnalysis, setDuplicatesAnalysis] = useState<{
    fileDuplicates: Set<number>;
    crmDuplicates: Set<number>;
    duplicateCount: number;
    details: string[];
  }>({ fileDuplicates: new Set(), crmDuplicates: new Set(), duplicateCount: 0, details: [] });
  const [selectedImportColumns, setSelectedImportColumns] = useState<Set<string>>(new Set());
  const [columnVisibility, setColumnVisibility] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<{ col: string | null; dir: 'asc' | 'desc' }>({ col: 'created_at', dir: 'desc' });
  const [savedViews, setSavedViews] = useState<Record<string, SavedLeadView[]>>(() => {
    try { return JSON.parse(safeLocalStorage.getItem('crm_saved_views') || '{}'); } catch { return {}; }
  });
  const [savedViewName, setSavedViewName] = useState('');
  const [mergeGroup, setMergeGroup] = useState<Lead[] | null>(null);
  const [mergePrimaryId, setMergePrimaryId] = useState('');

  // Filtering Duplicates and Delete Confirmations
  const [showOnlyDuplicates, setShowOnlyDuplicates] = useState(false);
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
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const [seenNotificationSignature, setSeenNotificationSignature] = useState(() => safeLocalStorage.getItem('crm_seen_notification_signature') || '');
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState(() => {
    try {
      return new Set((safeLocalStorage.getItem('crm_dismissed_notification_ids') || '').split(',').filter(Boolean));
    } catch {
      return new Set();
    }
  });
  const [hoveredLeadId, setHoveredLeadId] = useState<string | null>(null);
  const getNotificationItemKey = (item: { label: string; value: number }) => `${item.label}:${Number(item.value || 0)}`;

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
  };

  const persistNotificationState = async (seenSignature = seenNotificationSignature, dismissedIds = dismissedNotificationIds) => {
    try {
      await axios.put('/api/auth/me/notification-state', {
        seen_signature: seenSignature,
        dismissed_ids: Array.from(dismissedIds),
      });
    } catch (err) {
      console.error('Failed to save notification state:', err);
    }
  };

  const markAllNotificationsSeen = useCallback(() => {
    setSeenNotificationSignature(notificationSignature);
    safeLocalStorage.setItem('crm_seen_notification_signature', notificationSignature);
    const currentNotificationKeys = communicationHealthItems.map(getNotificationItemKey);
    const newDismissed = new Set(dismissedNotificationIds);
    currentNotificationKeys.forEach(key => newDismissed.add(key));
    setDismissedNotificationIds(newDismissed);
    safeLocalStorage.setItem('crm_dismissed_notification_ids', Array.from(newDismissed).join(','));
    persistNotificationState(notificationSignature, newDismissed);
  }, [dismissedNotificationIds]);
  const markAllNotificationsSeenRef = useRef(markAllNotificationsSeen);
  markAllNotificationsSeenRef.current = markAllNotificationsSeen;
  const hasMarkedNotificationsSeenRef = useRef(false);
  const [leadNotes, setLeadNotes] = useState<Note[]>([]);
  const [leadCalls, setLeadCalls] = useState<CallLog[]>([]);
  const [allCallLogs, setAllCallLogs] = useState<CallLog[]>([]);
  const [leadEmails, setLeadEmails] = useState<EmailLog[]>([]);
  const [leadWhatsApp, setLeadWhatsApp] = useState<WhatsAppLog[]>([]);
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
  const [fileName, setFileName] = useState('');
  const [suggestedCols, setSuggestedCols] = useState<string[]>([]);
  const [selectedSuggestedCols, setSelectedSuggestedCols] = useState<Set<string>>(new Set());
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);

  // Custom Columns Manager
  const [manageColsIsOpen, setManageColsIsOpen] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColType, setNewColType] = useState<'text' | 'number' | 'boolean' | 'date'>('text');
  const [newColRequired, setNewColRequired] = useState(false);
  const [colSaving, setColSaving] = useState(false);

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
  const [addUserIsOpen, setAddUserIsOpen] = useState(false);
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'user' });
  const [showAddUserPassword, setShowAddUserPassword] = useState(false);
  const [userSaving, setUserSaving] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
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
  const [teamCallRoomSlug, setTeamCallRoomSlug] = useState('');
  const [teamCallTitle, setTeamCallTitle] = useState('Team call');
  const [teamCallLoading, setTeamCallLoading] = useState(false);
  const [teamCallError, setTeamCallError] = useState('');
  const [incomingTeamCall, setIncomingTeamCall] = useState<TeamMessage | null>(null);
  const teamTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const teamStreamRef = useRef<HTMLDivElement | null>(null);
  const teamEndRef = useRef<HTMLDivElement | null>(null);
  const teamCallContainerRef = useRef<HTMLDivElement | null>(null);
  const teamCallApiRef = useRef<any>(null);
  const incomingCallAudioRef = useRef<HTMLAudioElement | null>(null);

  // Email Campaign Tracking & Softsender
  const [selectedBrandForEmail, setSelectedBrandForEmail] = useState<Brand>(activeBrands[0] || BRANDS[0]);
  const [emailStageFilter, setEmailStageFilter] = useState<string>('all');
  const [activeEmailLead, setActiveEmailLead] = useState<Lead | null>(null);
  const [allSentEmails, setAllSentEmails] = useState<EmailLog[]>([]);
  const [emailTemplateSel, setEmailTemplateSel] = useState('');
  const [emailContent, setEmailContent] = useState('');
  const [selectedEmailLogId, setSelectedEmailLogId] = useState('');
  const [emailMailboxFilter, setEmailMailboxFilter] = useState<'all' | 'inbox' | 'sent' | 'drafts' | 'spam' | 'trash' | 'failed'>('all');
  const [emailSearchQuery, setEmailSearchQuery] = useState('');
  const [emailPage, setEmailPage] = useState(1);
  const [emailReplyBody, setEmailReplyBody] = useState('');
  const [emailProviderMode, setEmailProviderMode] = useState<'internal' | 'gmail' | 'outlook' | 'yahoo' | 'smtp'>('gmail');
  const [emailProviderFilter, setEmailProviderFilter] = useState<'all' | 'gmail' | 'outlook' | 'yahoo' | 'smtp' | 'internal'>('all');
  const [selectedEmailAccountId, setSelectedEmailAccountId] = useState('');
  const [brandIntegrations, setBrandIntegrations] = useState<BrandIntegration[]>([]);
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
  const [activeIntegrationChannel, setActiveIntegrationChannel] = useState<'email' | 'whatsapp' | 'call'>('whatsapp');
  const [gmailStatus, setGmailStatus] = useState<any>(null);
  const [outlookStatus, setOutlookStatus] = useState<any>(null);
  const [gmailConnecting, setGmailConnecting] = useState(false);
  const [gmailTesting, setGmailTesting] = useState(false);
  const [gmailSyncing, setGmailSyncing] = useState(false);
  const [outlookSyncing, setOutlookSyncing] = useState(false);
  const [gmailTestRecipient, setGmailTestRecipient] = useState('');
  const [messageTemplates, setMessageTemplates] = useState<MessageTemplate[]>([]);
  const [templateForm, setTemplateForm] = useState<{ id?: string; brand_id: string; channel: 'email' | 'whatsapp' | 'call'; name: string; subject: string; body: string }>({
    brand_id: (activeBrands[0] || BRANDS[0]).id,
    channel: 'email',
    name: '',
    subject: '',
    body: ''
  });
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
    color: '#3b82f6',
    brandId: 'all',
    stage: '',
    fieldKey: ''
  });

  const cloneProfileValue = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

  const getBrandWorkspaceProfiles = (brandId: string) => brandWorkspaceProfiles[brandId] || [];

  const captureBrandWorkspaceSnapshot = (brandId: string): BrandWorkspaceSnapshot => {
    const storedColumns = safeLocalStorage.getItem(`crm_cols_${brandId}`);
    return {
      snapshotCards: cloneProfileValue(snapshotCards[brandId] || []),
      customWidgets: cloneProfileValue(customWidgets[brandId] || DEFAULT_WIDGETS[brandId] || []),
      savedViews: cloneProfileValue(savedViews[brandId] || []),
      sectionVisibility: cloneProfileValue(dashboardSectionVisibility[brandId] || {}),
      sectionTitles: cloneProfileValue(dashboardSectionTitles[brandId] || {}),
      columnVisibility: storedColumns ? storedColumns.split(',').filter(Boolean) : Array.from(columnVisibility),
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
      setColumnVisibility(new Set(snapshot.columnVisibility));
      safeLocalStorage.setItem(`crm_cols_${brand.id}`, snapshot.columnVisibility.join(','));
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
  }, [activeLead?.id]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Switch Selected Brand & Update Theme Variable
  const handleSelectBrand = (brand: Brand) => {
    setSelectedBrand(brand);
    setActiveTab(brand.id);
    setBrandSubTab('leads');
    setSelectedStageFilter('all');
    setSelectedCityFilter('all');
    setSelectedServiceFilter('all');
    setSelectedAbnFilter('all');
    setActiveLead(null);
    setSelectedLeadIds(new Set());
    
    // Dynamically write color variables to Document Element Root
    const rgbColors: Record<string, string> = {
      optimaviz: 'olklch(52% .22 280)',
      taskgo: 'oklch(72% .15 65)',
      idao: 'oklch(58% .18 265)',
      optimaclean: 'oklch(65% .15 240)',
      nestwise: 'oklch(75% .12 85)'
    };
    
    document.documentElement.style.setProperty('--brand-accent', brand.color);
    document.documentElement.style.setProperty('--accent-hover', `oklch(from ${brand.color} l c h / 0.8)`);
  };

  const handleSelectDashboard = () => {
    setSelectedBrand(null);
    setActiveTab('dashboard');
    document.documentElement.style.setProperty('--accent', 'oklch(63% .24 285)');
    document.documentElement.style.setProperty('--accent-hover', 'oklch(58% .26 285)');
    fetchDashboardStats();
  };

  const handleSelectCalls = () => {
    setSelectedBrand(null);
    setActiveTab('calls');
    setCallStageFilter('all');
    setActiveCallLead(null);
    document.documentElement.style.setProperty('--accent', 'oklch(63% .24 285)');
    fetchDiallerLeads();
  };

  const handleSelectCommunications = () => {
    setSelectedBrand(null);
    setActiveTab('communications');
    document.documentElement.style.setProperty('--accent', 'oklch(63% .24 285)');
    fetchAllSentEmails();
    fetchAllWhatsAppMessages();
    fetchAllCallLogs();
    fetchTeamMessages();
  };

  const openCommunicationTool = (tab: 'email-tracking' | 'whatsapp-tracking' | 'calls' | 'team-chat' | 'integrations', brandId?: string) => {
    setSelectedBrand(null);
    setActiveTab(tab);
    document.documentElement.style.setProperty('--accent', tab === 'whatsapp-tracking' ? '#25D366' : 'oklch(63% .24 285)');
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
      setIntegrationBrandId(activeBrands[0]?.id || BRANDS[0].id);
      fetchBrandIntegrations();
      fetchMessageTemplates();
    }
  };

  const handleSelectUsers = () => {
    setSelectedBrand(null);
    setActiveTab('users');
    document.documentElement.style.setProperty('--accent', 'oklch(63% .24 285)');
    fetchUsersList();
  };

  // 2. Fetch Hooks
  const fetchBrandFunnels = async () => {
    try {
      const res = await axios.get('/api/brand-funnels');
      const map: Record<string, BrandFunnel> = {};
      res.data.forEach((item: BrandFunnel) => {
        map[item.brand_id] = item;
      });
      setFunnels(map);
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

  const handleCommandNavigate = (tab: 'dashboard' | 'communications' | 'calls' | 'email-tracking' | 'whatsapp-tracking' | 'team-chat' | 'integrations' | 'users') => {
    if (tab === 'dashboard') { handleSelectDashboard(); return; }
    if (tab === 'communications') { handleSelectCommunications(); return; }
    if (tab === 'calls') { handleSelectCalls(); return; }
    if (tab === 'users') { handleSelectUsers(); return; }
    setSelectedBrand(null);
    setActiveTab(tab);
    if (tab === 'email-tracking') {
      setSelectedBrandForEmail(activeBrands[0] || BRANDS[0]);
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

  const fetchDashboardStats = async () => {
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
        const stageDistribution: Record<string, number> = {};
        bl.forEach(item => {
          stageDistribution[item.funnel_stage] = (stageDistribution[item.funnel_stage] || 0) + 1;
        });

        statsObj[b.id] = {
          totalLeads: bl.length,
          emailsSent: 0, // Mock metric representing campaign success
          stages: stageDistribution
        };
      });
      setDashboardStats(statsObj);
    } catch (err) {
      console.error('Error fetching dashboard summaries:', err);
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

  const fetchLeadsForActiveBrand = async () => {
    if (!selectedBrand) return;
    const brandId = selectedBrand.id;
    const cached = leadsCacheRef.current[brandId];
    if (cached && Date.now() - cached.ts < LEADS_CACHE_TTL) {
      setLeads(cached.data);
      axios.get(`/api/leads?brand_id=${brandId}&limit=500`).then(res => {
        const freshRaw = Array.isArray(res.data) ? res.data : (res.data.items || []);
        const fresh = normalizeBrandLeadsForDisplay(freshRaw);
        leadsCacheRef.current[brandId] = { data: fresh, ts: Date.now() };
        setLeads(fresh);
      }).catch(() => {});
      return;
    }
    setLoading(true);
    try {
      const res = await axios.get(`/api/leads?brand_id=${brandId}&limit=500`);
      const rawLeadsData = Array.isArray(res.data) ? res.data : (res.data.items || []);
      const leadsData = normalizeBrandLeadsForDisplay(rawLeadsData);
      leadsCacheRef.current[brandId] = { data: leadsData, ts: Date.now() };
      setLeads(leadsData);
    } catch (err) {
      console.error('Error loading leads', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomFieldsForBrand = async () => {
    if (!selectedBrand) return;
    try {
      const res = await axios.get(`/api/brands/${selectedBrand.id}/custom-fields`);
      const fields: CustomField[] = res.data;
      
      const requiredFields = selectedBrand.id === 'optimaviz'
        ? [
            { field_name: 'organisation', field_type: 'text' as const, required: false },
            { field_name: 'segment', field_type: 'text' as const, required: false },
            { field_name: 'next_action', field_type: 'text' as const, required: false },
            { field_name: 'trial_start_date', field_type: 'date' as const, required: false },
            { field_name: 'trial_end_date', field_type: 'date' as const, required: false },
            { field_name: 'trial_status', field_type: 'text' as const, required: false },
            { field_name: 'trial_activity_status', field_type: 'text' as const, required: false },
            { field_name: 'subscription_plan', field_type: 'text' as const, required: false },
            { field_name: 'last_active_date', field_type: 'date' as const, required: false },
            { field_name: 'uploaded_datasets', field_type: 'number' as const, required: false },
            { field_name: 'analyses_completed', field_type: 'number' as const, required: false },
            { field_name: 'lead_category', field_type: 'text' as const, required: false },
            ...OPTIMAVIZ_USAGE_FIELDS.map(field_name => ({ field_name, field_type: 'text' as const, required: false }))
          ]
        : selectedBrand.id === 'taskgo'
          ? [
              { field_name: 'segment', field_type: 'text' as const, required: false },
              { field_name: 'service_category_name', field_type: 'text' as const, required: false },
              { field_name: 'abn_number', field_type: 'text' as const, required: false },
              { field_name: 'provider_status', field_type: 'text' as const, required: false },
              { field_name: 'verification_status', field_type: 'text' as const, required: false },
              { field_name: 'documents_status', field_type: 'text' as const, required: false },
              { field_name: 'coverage_area', field_type: 'text' as const, required: false },
              { field_name: 'availability_status', field_type: 'text' as const, required: false },
              { field_name: 'hourly_rate', field_type: 'number' as const, required: false },
              { field_name: 'support_issue_type', field_type: 'text' as const, required: false },
              { field_name: 'support_status', field_type: 'text' as const, required: false },
              { field_name: 'support_priority', field_type: 'text' as const, required: false },
              { field_name: 'last_follow_up_date', field_type: 'date' as const, required: false }
            ]
        : selectedBrand.id === 'idao'
          ? [
              { field_name: 'organisation', field_type: 'text' as const, required: false },
              { field_name: 'segment', field_type: 'text' as const, required: false },
              { field_name: 'service_type', field_type: 'text' as const, required: false },
              { field_name: 'service_focus', field_type: 'text' as const, required: false },
              { field_name: 'next_action', field_type: 'text' as const, required: false },
              { field_name: 'quote_status', field_type: 'text' as const, required: false },
              { field_name: 'quote_sent_date', field_type: 'date' as const, required: false },
              { field_name: 'follow_up_type', field_type: 'text' as const, required: false },
              { field_name: 'follow_up_status', field_type: 'text' as const, required: false },
              { field_name: 'outreach_segment', field_type: 'text' as const, required: false },
              { field_name: 'outreach_status', field_type: 'text' as const, required: false },
              { field_name: 'mine_type', field_type: 'text' as const, required: false },
              { field_name: 'country', field_type: 'text' as const, required: false },
              { field_name: 'job_title', field_type: 'text' as const, required: false }
            ]
          : selectedBrand.id === 'nestwise'
            ? [
                { field_name: 'segment', field_type: 'text' as const, required: false },
                { field_name: 'enquiry', field_type: 'text' as const, required: false },
                { field_name: 'service_interest', field_type: 'text' as const, required: false },
                { field_name: 'property_location', field_type: 'text' as const, required: false },
                { field_name: 'property_type', field_type: 'text' as const, required: false },
                { field_name: 'owner_location', field_type: 'text' as const, required: false },
                { field_name: 'owner_type', field_type: 'text' as const, required: false },
                { field_name: 'property_use', field_type: 'text' as const, required: false },
                { field_name: 'service_package', field_type: 'text' as const, required: false },
                { field_name: 'revenue_model', field_type: 'text' as const, required: false },
                { field_name: 'inspection_type', field_type: 'text' as const, required: false },
                { field_name: 'maintenance_category', field_type: 'text' as const, required: false },
                { field_name: 'security_frequency', field_type: 'text' as const, required: false },
                { field_name: 'emergency_type', field_type: 'text' as const, required: false },
                { field_name: 'reporting_requirement', field_type: 'text' as const, required: false },
                { field_name: 'owner_retains_control', field_type: 'text' as const, required: false },
                { field_name: 'preferred_contact_time', field_type: 'text' as const, required: false },
                { field_name: 'next_service_date', field_type: 'date' as const, required: false },
                { field_name: 'follow_up_status', field_type: 'text' as const, required: false }
              ]
            : [{ field_name: 'segment', field_type: 'text' as const, required: false }];

      const existingNames = new Set(fields.map(f => f.field_name.toLowerCase()));
      const missingFields = requiredFields.filter(f => !existingNames.has(f.field_name.toLowerCase()));
      if (missingFields.length > 0) {
        try {
          for (const field of missingFields) {
            await axios.post(`/api/brands/${selectedBrand.id}/custom-fields`, field);
          }
          const res2 = await axios.get(`/api/brands/${selectedBrand.id}/custom-fields`);
          setCustomFields(res2.data);
          return;
        } catch (err) {
          console.error('Failed to auto create required custom fields:', err);
        }
      }
      setCustomFields(fields);
    } catch (err) {
      console.error('Error fetching custom fields', err);
    }
  };

  const fetchSequencesForBrand = async () => {
    if (!selectedBrand) return;
    try {
      const res = await axios.get(`/api/sequences?brand_id=${selectedBrand.id}`);
      setSequences(res.data);
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
      setAllSentEmails(res.data);
    } catch (err) {
      console.error('Failed to load sent emails statistics:', err);
    }
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

  const getTeamThreadMessages = (threadId: string) => teamMessages.filter(message => getTeamMessageThreadId(message) === threadId);

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
    const roomSlug = sanitizeTeamCallRoom(`OptimaCRM-${roomSeed}-${Date.now()}`);
    const callUrl = getTeamCallExternalUrl(roomSlug);
    const targetName = activeTeamDmId === 'all' ? 'All staff' : usersList.find(staff => staff.id === activeTeamDmId)?.name || 'this DM';
    setTeamCallRoomSlug(roomSlug);
    setTeamCallTitle(activeTeamDmId === 'all' ? 'All staff call' : `${targetName} call`);
    setTeamCallError('');
    setTeamCallOpen(true);
    setTeamPosting(true);
    try {
      await axios.post('/api/team-chat', {
        content: `Team call started for ${targetName}\nJoin call: [Open call room](${callUrl})`,
        recipient_ids: [activeTeamDmId || 'all'],
        attachments: [],
      });
      await fetchTeamMessages();
      showToast('Team call started inside the CRM.');
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Call opened, but the chat link could not be shared.', true);
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
    setTeamCallTitle(isAllStaffCall ? 'All staff call' : `${message.user_name || 'Team member'} call`);
    setTeamCallError('');
    setTeamCallOpen(true);
    dismissIncomingTeamCall(message.id);
  };

  const moveTeamCallToTab = () => {
    if (!teamCallRoomSlug) return;
    const params = new URLSearchParams({
      appId: TEAM_CALL_JAAS_APP_ID,
      room: teamCallRoomSlug,
      name: user?.name || 'Optima CRM user',
      title: teamCallTitle,
    });
    const externalUrl = `${window.location.origin}/team-call.html?${params.toString()}`;
    const externalWindow = window.open('', '_blank');
    if (!externalWindow) {
      showToast('Your browser blocked the meeting tab. Allow pop-ups for Optima CRM and try again.', true);
      return;
    }
    externalWindow.opener = null;
    externalWindow.location.href = externalUrl;

    const transferChannel = 'BroadcastChannel' in window ? new BroadcastChannel('optima-team-call-transfer') : null;
    let transferFinished = false;
    const finishTransfer = () => {
      if (transferFinished) return;
      transferFinished = true;
      transferChannel?.close();
      try {
        teamCallApiRef.current?.dispose?.();
      } catch (e) {
        // ignore dispose errors
      }
      teamCallApiRef.current = null;
      setTeamCallOpen(false);
      showToast('The same meeting is now running in the separate tab.');
    };
    if (transferChannel) {
      transferChannel.onmessage = event => {
        if (event.data?.type === 'team-call-tab-ready' && event.data?.room === teamCallRoomSlug) finishTransfer();
      };
      window.setTimeout(() => {
        if (!transferFinished) showToast('The meeting tab is still connecting. This CRM call will stay open until it joins.', true);
      }, 12000);
    } else {
      window.setTimeout(finishTransfer, 2500);
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
    email_signature: `Best,\n${managedBrands.find(b => b.id === brandId)?.name || 'Optima CRM'} Team`,
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
      return res.data;
    } catch (err) {
      console.error('Failed to load Gmail status:', err);
      setGmailStatus(null);
      return null;
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
    }
  }, [activeIntegrationChannel, integrationBrandId]);

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
        showToast(statusRes.data?.whatsapp?.api_ready ? 'Integration saved and backend is ready.' : 'Integration saved. Setup check found missing items.', !statusRes.data?.whatsapp?.api_ready);
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
      const returnTo = `${window.location.origin}${window.location.pathname}`;
      const res = await axios.post(`/api/integrations/gmail/start/${integrationBrandId}`, { return_to: returnTo });
      if (res.data?.auth_url) {
        window.location.href = res.data.auth_url;
        return;
      }
      showToast('Could not start Gmail connection.', true);
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Could not start Gmail connection.';
      showToast(detail, true);
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
      const res = await axios.post(`/api/integrations/outlook/start/${integrationBrandId}`);
      if (res.data?.auth_url) {
        window.location.href = res.data.auth_url;
        return;
      }
      showToast('Could not start Outlook connection.', true);
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Could not start Outlook connection.', true);
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
      showToast(err?.response?.data?.detail || 'Could not send test email.', true);
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
        subject: `${providerName} test from Optima CRM`,
        html_content: `This is a ${providerName} SMTP test email from Optima CRM.`,
        template_name: `${providerName} Test Email`,
        email_account_id: (getEmailAccountsForIntegration(integrationForm).find(account => account.is_default) || getEmailAccountsForIntegration(integrationForm)[0])?.id
      }, { timeout: 30000 });
      showToast(`Test email sent to ${gmailTestRecipient.trim()}.`);
      await fetchAllSentEmails();
    } catch (err: any) {
      const message = err?.code === 'ECONNABORTED'
        ? 'Outlook test timed out after 30 seconds. Check the SMTP settings and Render password variable.'
        : err?.response?.data?.error_message || err?.response?.data?.detail || 'Could not send test email.';
      showToast(message, true);
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
      if (!silent || imported > 0) {
        showToast(imported > 0 ? `Imported ${imported} Gmail repl${imported === 1 ? 'y' : 'ies'}.` : 'Gmail checked. No new replies found.');
      }
    } catch (err: any) {
      if (!silent) showToast(err?.response?.data?.detail || 'Could not sync Gmail replies. Reconnect Gmail if reply access was just added.', true);
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
      if (!silent) showToast(err?.response?.data?.detail || 'Could not sync Outlook messages.', true);
    } finally {
      setOutlookSyncing(false);
    }
  };

  useEffect(() => {
    if (!user || activeTab !== 'email-tracking' || !selectedBrandForEmail?.id) return;
    const integration = getBrandIntegrationFor(selectedBrandForEmail.id);
    if (emailProviderMode !== 'gmail' && integration.email_provider !== 'gmail') return;

    syncGmailReplies(selectedBrandForEmail.id, true);
    const timer = window.setInterval(() => {
      syncGmailReplies(selectedBrandForEmail.id, true);
    }, 60000);
    return () => window.clearInterval(timer);
  }, [user, activeTab, selectedBrandForEmail?.id, emailProviderMode, brandIntegrations.length]);

  const disconnectGmail = async () => {
    try {
      await axios.delete(`/api/integrations/gmail/${integrationBrandId}`);
      await fetchBrandIntegrations();
      await fetchGmailStatus(integrationBrandId);
      showToast('Gmail disconnected for this brand.');
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
      showToast(ready ? 'WhatsApp setup is ready on the backend.' : 'Setup check completed. Some items still need attention.', !ready);
    } catch {
      showToast('Could not check integration setup.', true);
    } finally {
      setIntegrationChecking(false);
    }
  };

  const resetTemplateForm = () => {
    setTemplateForm({ brand_id: integrationBrandId, channel: activeIntegrationChannel, name: '', subject: '', body: '' });
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

  const hasValidAbn = (lead: Lead) => {
    const raw = String(lead.custom_fields?.abn_number || lead.custom_fields?.abn || '');
    const digits = raw.replace(/\D/g, '');
    return digits.length >= 9;
  };

  const countUniquePeople = (items: Lead[]) => new Set(items.map(getLeadIdentityKey)).size;

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
        tone: channel === 'WhatsApp' ? '#25d366' : channel === 'Email' ? '#6366f1' : '#0ea5e9',
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
        tone: '#6366f1',
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
        tone: '#6366f1',
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

  const todayCommand = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sourceLeads = allCrmLeads.length ? allCrmLeads : leads;
    const due = sourceLeads.filter(l => isFollowUpDue(l));
    const newLeads = sourceLeads.filter(l => String(l.funnel_stage || '').toLowerCase() === 'new lead');
    const missingPhone = sourceLeads.filter(l => !String(l.phone || '').replace(/\D/g, ''));
    const taskgoLeads = sourceLeads.filter(l => l.brand_id === 'taskgo');
    const taskgoMissingAbn = taskgoLeads.filter(l => !hasValidAbn(l));
    const untouched = sourceLeads.filter(l => getGlobalLeadActivityCount(l) === 0);
    return {
      due,
      newLeads,
      missingPhone,
      untouched,
      taskgo: {
        uniquePeople: countUniquePeople(taskgoLeads),
        withAbn: countUniquePeople(taskgoLeads.filter(hasValidAbn)),
        missingAbn: countUniquePeople(taskgoMissingAbn),
      }
    };
  }, [allCrmLeads, leads, allSentEmails, allWhatsAppMessages, allCallLogs]);

  const todayKey = new Date().toISOString().slice(0, 10);

  const portfolioLeaderboard = useMemo(() => {
    const sourceLeads = allCrmLeads.length ? allCrmLeads : leads;
    const max = Math.max(1, ...activeBrands.map(brand => sourceLeads.filter(l => l.brand_id === brand.id).length));
    return activeBrands.map(brand => {
      const rows = sourceLeads.filter(l => l.brand_id === brand.id);
      const due = rows.filter(l => isFollowUpDue(l)).length;
      const won = rows.filter(l => String(l.funnel_stage || '').toLowerCase().includes('won') || String(l.funnel_stage || '').toLowerCase().includes('subscribed') || String(l.funnel_stage || '').toLowerCase().includes('registered')).length;
      return { brand, total: rows.length, due, won, pct: Math.round((rows.length / max) * 100) };
    }).sort((a, b) => b.total - a.total);
  }, [allCrmLeads, leads, activeBrands]);

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
    const sourceLeads = allCrmLeads.length ? allCrmLeads : leads;
    const brandLeads = (brandId: string) => sourceLeads.filter(l => l.brand_id === brandId);
    const fieldEquals = (rows: Lead[], key: string, value: string) => rows.filter(l => String(l.custom_fields?.[key] || '').toLowerCase().trim() === value.toLowerCase()).length;
    const fieldIncludes = (rows: Lead[], key: string, value: string) => rows.filter(l => String(l.custom_fields?.[key] || '').toLowerCase().includes(value.toLowerCase())).length;
    const rows = activeBrands.map(brand => {
      const rowsForBrand = brandLeads(brand.id);
      let items: Array<{ label: string; value: number | string }> = [];
      if (brand.id === 'taskgo') {
        items = [
          { label: 'Registered contractors', value: countUniquePeople(rowsForBrand) },
          { label: 'ABN verified contractors', value: countUniquePeople(rowsForBrand.filter(hasValidAbn)) },
          { label: 'Missing ABN', value: countUniquePeople(rowsForBrand.filter(l => !hasValidAbn(l))) },
        ];
      } else if (brand.id === 'optimaviz') {
        items = [
          { label: 'Demo leads', value: rowsForBrand.filter(l => getOptimavizLeadSegment(l) === 'demo_leads').length },
          { label: 'Trial leads', value: rowsForBrand.filter(l => getOptimavizLeadSegment(l) === 'trial_leads').length },
          { label: 'Subscribers', value: rowsForBrand.filter(isOptimavizSubscriber).length },
        ];
      } else if (brand.id === 'nestwise') {
        items = [
          { label: 'Property owner leads', value: rowsForBrand.length },
          { label: 'Onboarded owners', value: rowsForBrand.filter(l => l.funnel_stage === 'Won' || String(l.custom_fields?.follow_up_status || '').toLowerCase().includes('onboard')).length },
          { label: 'Bulawayo properties', value: fieldIncludes(rowsForBrand, 'property_location', 'bulawayo') },
        ];
      } else if (brand.id === 'idao') {
        items = [
          { label: 'Training leads', value: fieldEquals(rowsForBrand, 'segment', 'training_leads') },
          { label: 'Quotes sent', value: fieldEquals(rowsForBrand, 'quote_status', 'Quote Sent') },
          { label: 'Follow-ups due', value: fieldIncludes(rowsForBrand, 'follow_up_status', 'follow') },
        ];
      } else if (brand.id === 'optimaclean') {
        items = [
          { label: 'Cleaning pipeline', value: rowsForBrand.length },
          { label: 'Proposal stage', value: rowsForBrand.filter(l => String(l.funnel_stage || '').toLowerCase().includes('proposal')).length },
          { label: 'Clients', value: fieldEquals(rowsForBrand, 'segment', 'clients') },
        ];
      } else {
        items = [
          { label: 'Total leads', value: rowsForBrand.length },
          { label: 'New leads', value: rowsForBrand.filter(l => String(l.funnel_stage || '').toLowerCase() === 'new lead').length },
          { label: 'Missing phones', value: rowsForBrand.filter(l => !String(l.phone || '').replace(/\D/g, '')).length },
        ];
      }
      return { brand, items };
    });
    return rows.filter(row => row.items.some(item => Number(item.value) > 0));
  }, [allCrmLeads, leads, activeBrands]);

  const pipelineHealthByBrand = useMemo(() => {
    const sourceLeads = allCrmLeads.length ? allCrmLeads : leads;
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
  }, [allCrmLeads, leads, activeBrands]);

  const notificationItems = useMemo(() => {
    const sourceLeads = allCrmLeads.length ? allCrmLeads : leads;
    const items = [
      { label: 'Follow-ups due', value: todayCommand.due.length, icon: 'fa-clock', color: '#f59e0b' },
      { label: 'Leads with no activity', value: todayCommand.untouched.length, icon: 'fa-inbox', color: '#8b5cf6' },
      { label: 'Missing phone numbers', value: todayCommand.missingPhone.length, icon: 'fa-phone-slash', color: '#ef4444' },
      { label: 'Duplicate people', value: globalDuplicateLeadGroups.length, icon: 'fa-clone', color: '#0ea5e9' },
      { label: 'Do-not-contact leads', value: sourceLeads.filter(l => l.custom_fields?.do_not_contact === true || String(l.custom_fields?.do_not_contact).toLowerCase() === 'true').length, icon: 'fa-ban', color: '#ef4444' },
    ];
    // Filter out dismissed aggregate notifications by label + current count, so new changes can reappear.
    return items.filter(i => i.value > 0 && !dismissedNotificationIds.has(getNotificationItemKey(i)));
  }, [allCrmLeads, leads, todayCommand, globalDuplicateLeadGroups, dismissedNotificationIds]);

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
        return (email && leadEmail === email) || (phone && leadPhone === phone) || (name && leadName === name);
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
    const sourceLeads = allCrmLeads.length ? allCrmLeads : leads;
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
      case 'duplicate_people': return metric.brandId && metric.brandId !== 'all'
        ? globalDuplicateLeadGroups.filter(group => group.some(l => l.brand_id === metric.brandId)).length
        : globalDuplicateLeadGroups.length;
      case 'do_not_contact': return scopedLeads.filter(l => l.custom_fields?.do_not_contact === true || String(l.custom_fields?.do_not_contact).toLowerCase() === 'true').length;
      case 'total_leads': return scopedLeads.length;
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
        color: '#3b82f6',
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
    const ok = window.confirm(`Delete ${count} selected lead${count !== 1 ? 's' : ''}? This cannot be undone.`);
    if (!ok) return;

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
    if (fieldKey === '__total__') return leads.length;
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
    const recentCutoff = Date.now() - (5 * 60 * 1000); // 5 minutes instead of 30 for fresh calls only
    const incoming = teamMessages
      .filter(message => {
        const recipients = Array.isArray(message.recipient_ids) ? message.recipient_ids : [];
        const isForCurrentUser = recipients.includes('all') || recipients.includes(user.id);
        const isRecent = new Date(message.created_at || 0).getTime() >= recentCutoff;
        const wasUserOnline = teamPresenceStatus === 'online'; // Only show if user is currently online
        return message.user_id !== user.id
          && isForCurrentUser
          && isRecent
          && wasUserOnline
          && !dismissed.has(message.id)
          && /Team call started for/i.test(String(message.content || ''))
          && /https:\/\/8x8\.vc\//i.test(String(message.content || ''));
      })
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0];
    setIncomingTeamCall(incoming || null);
  }, [teamMessages, teamCallOpen, user?.id, teamPresenceStatus]);

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
            displayName: user?.name || 'Optima CRM user',
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
        teamCallApiRef.current?.addListener?.('readyToClose', () => setTeamCallOpen(false));
      } catch (err: any) {
        if (!cancelled) {
          setTeamCallError(err?.message || 'Could not start the team call.');
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
    if (selectedBrand) {
      const std = ['optimaviz', 'idao'].includes(selectedBrand.id)
        ? ['name', 'organisation', 'email', 'phone', 'segment', ...(selectedBrand.id === 'idao' ? ['service_type'] : []), 'stage', 'next_action', 'follow_up_date', 'last_activity', 'assigned_to', 'tags', 'added']
        : selectedBrand.id === 'nestwise'
          ? ['name', 'email', 'phone', 'stage', 'tags', 'segment', 'service_interest', 'enquiry', 'property_location', 'property_type', 'property_use', 'owner_location', 'service_package', 'revenue_model', 'next_service_date', 'follow_up_status', 'added']
          : ['name', 'email', 'phone', 'stage', 'owner', 'added', 'tags'];
      const cfs = customFields.map(cf => cf.field_name);
      const saved = localStorage.getItem(`crm_cols_${selectedBrand.id}`);
      const nestwiseColumnVersion = localStorage.getItem('crm_cols_version_nestwise');
      if (selectedBrand.id === 'nestwise' && nestwiseColumnVersion !== NESTWISE_DASHBOARD_VERSION) {
        const nextCols = new Set([...std, ...cfs]);
        setColumnVisibility(nextCols);
        localStorage.setItem(`crm_cols_${selectedBrand.id}`, Array.from(nextCols).join(','));
        localStorage.setItem('crm_cols_version_nestwise', NESTWISE_DASHBOARD_VERSION);
      } else if (saved) {
        // Merge saved cols with any custom fields that arrived after the save
        // so newly-added custom field columns appear without requiring a manual toggle.
        const savedSet = new Set(saved.split(',').filter(Boolean));
        const merged = new Set([...std, ...savedSet, ...cfs]);
        setColumnVisibility(merged);
      } else {
        setColumnVisibility(new Set([...std, ...cfs]));
      }
      setSelectedSegmentFilter('all');
      setSelectedDateWindow('all');
      setSelectedDateFrom('');
      setSelectedDateTo('');
      setSortConfig({ col: 'created_at', dir: 'desc' });
    }
  }, [selectedBrand?.id, customFields]);

  useEffect(() => {
    if (csvPreview && selectedBrand) {
      const currentStdHeaders = [csvMapping.name, csvMapping.name_secondary, csvMapping.email, csvMapping.phone, csvMapping.created_at].filter(Boolean);
      const existingCfNames = customFields.map(cf => cf.field_name.toLowerCase());
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
        const hLower = h.toLowerCase();
        const compactHeader = hLower.replace(/[\s_/-]+/g, '');
        if (!h || hLower === 'id' || hLower === 'row-id' || hLower === 'rowid') return false;
        if (ignoredUploadHeaders.has(hLower)) return false;
        if (uploadAliasToField[compactHeader] && existingCfNames.includes(uploadAliasToField[compactHeader])) return false;
        if (currentStdHeaders.includes(h)) return false;
        if (existingCfNames.includes(hLower)) return false;
        return true;
      });
      
      setSuggestedCols(suggested);
      setSelectedSuggestedCols(prev => {
        const next = new Set<string>();
        suggested.forEach(col => {
          if (prev.has(col)) {
            next.add(col);
          } else if (!suggestedCols.includes(col)) {
            // New file or column we haven't seen in the current suggestions, check it by default
            next.add(col);
          }
        });
        return next;
      });
    } else {
      setSuggestedCols([]);
      setSelectedSuggestedCols(new Set());
    }
  }, [csvPreview, csvMapping.name, csvMapping.name_secondary, csvMapping.email, csvMapping.phone, csvMapping.created_at, customFields, selectedBrand?.id]);

  const handleToggleSuggestedCol = (col: string) => {
    setSelectedSuggestedCols(prev => {
      const next = new Set(prev);
      if (next.has(col)) {
        next.delete(col);
      } else {
        next.add(col);
      }
      return next;
    });

    // Mirror to selectedImportColumns of spreadsheet uploader too!
    setSelectedImportColumns(prev => {
      const next = new Set(prev);
      if (next.has(col)) {
        next.delete(col);
      } else {
        next.add(col);
      }
      return next;
    });
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
      const detailsList: string[] = [];

      const nameCol = csvMapping.name;
      const emailCol = csvMapping.email;
      const phoneCol = csvMapping.phone;

      const seenNames = new Map<string, number>();
      const seenEmails = new Map<string, number>();
      const seenPhones = new Map<string, number>();

      parsedRows.forEach((row, idx) => {
        const nameVal = nameCol ? getImportedRowName(row).toLowerCase() : '';
        const emailVal = emailCol && row[emailCol] ? String(row[emailCol]).trim().toLowerCase() : '';
        const phoneVal = phoneCol && row[phoneCol] ? String(row[phoneCol]).trim().replace(/\s+/g, '').toLowerCase() : '';

        // Spot intra-file duplicates
        let isFileDup = false;
        if (nameVal && seenNames.has(nameVal)) {
          isFileDup = true;
          detailsList.push(`Row ${idx + 2}: Duplicate Name "${getImportedRowName(row)}" already exists in Row ${seenNames.get(nameVal)! + 2} of the spreadsheet.`);
        } else if (nameVal) {
          seenNames.set(nameVal, idx);
        }

        if (emailVal && seenEmails.has(emailVal)) {
          isFileDup = true;
          detailsList.push(`Row ${idx + 2}: Duplicate Email "${row[emailCol]}" already exists in Row ${seenEmails.get(emailVal)! + 2} of the spreadsheet.`);
        } else if (emailVal) {
          seenEmails.set(emailVal, idx);
        }

        if (phoneVal && seenPhones.has(phoneVal)) {
          isFileDup = true;
          detailsList.push(`Row ${idx + 2}: Duplicate Phone "${row[phoneCol]}" already exists in Row ${seenPhones.get(phoneVal)! + 2} of the spreadsheet.`);
        } else if (phoneVal) {
          seenPhones.set(phoneVal, idx);
        }

        if (isFileDup) {
          fileDups.add(idx);
        }

        // Spot CRM duplicates across all brands, not only the active brand.
        const matchingLeads = (allCrmLeads.length ? allCrmLeads : leads).filter(l => {
          const leadName = String(l.name || '').trim().toLowerCase();
          const leadEmail = String(l.email || '').trim().toLowerCase();
          const leadPhone = String(l.phone || '').trim().replace(/\s+/g, '').toLowerCase();

          const matchName = nameVal && leadName === nameVal;
          const matchEmail = emailVal && leadEmail === emailVal;
          const matchPhone = phoneVal && leadPhone === phoneVal;

          return matchName || matchEmail || matchPhone;
        });

        if (matchingLeads.length > 0) {
          crmDups.add(idx);
          const matchNames = matchingLeads.map(l => `${l.name} (${l.brand_name || l.brand_id} / ${l.funnel_stage})`).join(', ');
          detailsList.push(`Row ${idx + 2}: "${getImportedRowName(row) || 'Unknown'}" conflicts with existing CRM Lead: ${matchNames}.`);
        }
      });

      setDuplicatesAnalysis({
        fileDuplicates: fileDups,
        crmDuplicates: crmDups,
        duplicateCount: fileDups.size + crmDups.size,
        details: detailsList
      });
    } else {
      setDuplicatesAnalysis({ fileDuplicates: new Set(), crmDuplicates: new Set(), duplicateCount: 0, details: [] });
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
        errors.push(`${lead.name} (${lead.email}): ${err?.response?.data?.error || err.message || 'Unknown error'}`);
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
        errors.push(`${lead.name} (${lead.phone || 'no phone'}): ${err?.response?.data?.error || err.message || 'Unknown error'}`);
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
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await axios.post('/api/auth/login', { email: loginEmail, password: loginPassword });
      setUser(res.data);
      applyRemoteNotificationState(res.data);
      if (res.data?.presence_status) setTeamPresenceStatus(res.data.presence_status);
      if (res.data?.role === 'admin') await axios.post('/api/admin/seed/nestwise').catch(() => null);
      fetchBrandFunnels();
    } catch (err: any) {
      setLoginError(err.response?.data?.detail || 'Invalid email or password.');
    }
  };

  const handleLogout = async () => {
    try {
      await axios.post('/api/auth/logout');
      setUser(null);
      setSelectedBrand(null);
      setActiveTab('dashboard');
    } catch (err) {
      console.error('Logout error:', err);
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
      const email = allSentEmails.find(e => e.id === emailId) || leadEmails.find(e => e.id === emailId);
      await axios.delete(`/api/emails/${emailId}`);
      if (email?.provider_message_id && (email.provider === 'gmail' || email.provider === 'cloud_api')) {
        try {
          await axios.delete('/api/integrations/gmail/message', {
            data: { provider_message_id: email.provider_message_id, brand_id: email.brand_id },
          });
        } catch (gmailErr) {
          console.warn('Deleted from CRM but Gmail delete failed:', gmailErr);
        }
      }
      setConfirmDeleteEmailId(null);
      if (activeLead) loadLeadDetailsHistory(activeLead.id);
      fetchAllSentEmails();
    } catch {
      alert('Could not delete email record.', 'error');
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
      showToast(err?.response?.data?.detail || 'Could not send team message.', true);
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
      showToast(err?.response?.data?.detail || 'Could not save team note.', true);
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
      showToast(err?.response?.data?.detail || 'Could not delete team note.', true);
    }
  };

  const handleDeleteTeamMessage = async (messageId: string) => {
    if (!confirm('Delete this team message?')) return;
    try {
      await axios.delete(`/api/team-chat/${messageId}`);
      await fetchTeamMessages();
      fetchTeamNotes();
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Could not delete team message.', true);
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
      alert('Failed to add lead: ' + (err.response?.data?.detail || err.message));
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
        await axios.post('/api/notes', { lead_id: lead.id, content: `Stage changed to ${normalizedStage}${(isOptimavizLead || isIdaoLead) ? ` · Next action: ${nextCustomFields.next_action}` : ''}` });
      } catch {}
    } catch (err) {
      console.error('Stage update failed:', err);
      showToast('Could not update lead stage.', true);
    }
  };

  const handleDeleteActiveLead = async () => {
    if (!activeLead) return;
    try {
      await axios.delete(`/api/leads/${activeLead.id}`);
      setLeads(prev => prev.filter(l => l.id !== activeLead.id));
      setActiveLead(null);
    } catch (err: any) {
      alert('Failed to delete lead: ' + (err.response?.data?.detail || err.message));
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
      const res = await axios.post(`/api/brands/${selectedBrand.id}/custom-fields`, {
        field_name: fieldName,
        field_type: newColType,
        required: newColRequired
      });
      const savedField = res.data?.field_name || fieldName;
      setColumnVisibility(prev => {
        const updated = new Set(prev);
        updated.add(savedField);
        localStorage.setItem(`crm_cols_${selectedBrand.id}`, Array.from(updated).join(','));
        return updated;
      });
      setNewColName('');
      setNewColType('text');
      setNewColRequired(false);
      await fetchCustomFieldsForBrand();
      showToast(`Column "${formatColumnLabel(savedField)}" added and shown in the table.`);
    } catch {
      alert('Failed to save custom column.', 'error');
    } finally {
      setColSaving(false);
    }
  };

  const handleDeleteColumn = async (colId: string) => {
    if (!colId) return;
    setConfirmDeleteCustomField(null);
    try {
      await axios.delete(`/api/custom-fields/${colId}`);
      fetchCustomFieldsForBrand();
    } catch {
      alert('failed to delete custom field.', 'error');
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
      setCsvMapping(buildAutoMapping(res.data.headers, customFields));
    } catch (err: any) {
      console.error(err.response?.data?.detail || err.message);
    }
  };

  // Shared CSV auto-mapping helper — used by processFile (CSV), processFile (XLSX),
  // and handleCsvTextChange so all three stay in sync automatically.
  const buildAutoMapping = (headers: string[], fields: typeof customFields): Record<string, string> => {
    const mapping: Record<string, string> = { name: '', name_secondary: '', email: '', phone: '', created_at: findLeadDateHeader(headers) };
    headers.forEach(h => {
      const hl = h.toLowerCase().trim();
      if (['first name', 'firstname', 'given name', 'givenname'].includes(hl)) mapping.name = h;
      else if (['last name', 'lastname', 'surname', 'family name', 'familyname'].includes(hl)) mapping.name_secondary = h;
      else if ((hl.includes('name') || hl.includes('full')) && !mapping.name) mapping.name = h;
      if (hl.includes('email') || hl.includes('mail'))                        mapping.email = h;
      if (hl.includes('phone') || hl.includes('tel') || hl.includes('num') || hl.includes('mobile')) mapping.phone = h;
      fields.forEach(cf => {
        const cfL = cf.field_name.toLowerCase().trim();
        const compactHeader = hl.replace(/[\s_/-]+/g, '');
        const compactField = cfL.replace(/[\s_-]+/g, '');
        const aliasMatch =
          (cfL === 'country' && ['countryregion', 'country'].includes(compactHeader)) ||
          (cfL === 'company' && ['companyname', 'organisation', 'organization', 'company'].includes(compactHeader)) ||
          (cfL === 'quote_status' && ['quotesentviaemail', 'quotesent', 'quotesentemail'].includes(compactHeader)) ||
          (cfL === 'registration_confirmed' && ['registrationconfirmed', 'registered', 'confirmed'].includes(compactHeader));
        if (cfL === hl || compactHeader === compactField || aliasMatch) {
          mapping[cf.field_name] = h;
        }
      });
    });
    return mapping;
  };

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
        setParsedRows(dataRows);
        setSelectedImportColumns(new Set(headers));
        setCsvPreview({
          headers,
          preview: dataRows.slice(0, 5),
          totalRows: dataRows.length
        });
        
        setCsvMapping(buildAutoMapping(headers, customFields));
      } else {
        setParsedRows([]);
        setCsvPreview(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const processFile = (file: File) => {
    setFileName(file.name);
    setImportError(null);
    setImportSuccessMessage(null);
    const fileLower = file.name.toLowerCase();
    const reader = new FileReader();
    
    if (fileLower.endsWith('.xlsx') || fileLower.endsWith('.xls')) {
      reader.onload = (evt) => {
        try {
          const data = new Uint8Array(evt.target?.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: 'array' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          
          const jsonResult: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
          if (jsonResult.length < 1) {
            setImportError('This Excel sheet appears empty.');
            return;
          }
          
          const rawHeaders = jsonResult[0] ? jsonResult[0].map(h => String(h || '').trim()) : [];
          const headers = rawHeaders.filter(Boolean);
          
          const dataRows = jsonResult.slice(1).map((row, i) => {
            const item: Record<string, string> = { id: `row-${i}` };
            rawHeaders.forEach((h, j) => {
              if (h) {
                item[h] = row[j] !== undefined && row[j] !== null ? String(row[j]).trim() : '';
              }
            });
            return item;
          }).filter(row => {
            return Object.values(row).some(v => v && v !== `row-${row.id}`);
          });

          setParsedRows(dataRows);
          setSelectedImportColumns(new Set(headers));

          setCsvPreview({
            headers,
            preview: dataRows.slice(0, 5),
            totalRows: dataRows.length
          });
          
          setCsvMapping(buildAutoMapping(headers, customFields));
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
          
          const dataRows = parseFullCsvText(csvTextResult);
          if (dataRows.length === 0) {
            setImportError('The CSV file does not contain any valid headers or rows.');
            return;
          }
          
          const headers = Object.keys(dataRows[0]).filter(k => k !== 'id');
          setParsedRows(dataRows);
          setSelectedImportColumns(new Set(headers));

          setCsvPreview({
            headers,
            preview: dataRows.slice(0, 5),
            totalRows: dataRows.length
          });

          setCsvMapping(buildAutoMapping(headers, customFields));
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
      processFile(file);
    }
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
    setImportError(null);
    setImportSuccessMessage(null);
  };

  const handleExportToExcel = () => {
    if (!selectedBrand || tableDisplayLeads.length === 0) return;

    const rows = tableDisplayLeads.map(l => {
      const row: Record<string, string> = {};
      if (columnVisibility.has('name')) row['Name'] = l.name || '';
      if (columnVisibility.has('email')) row['Email'] = l.email || '';
      if (columnVisibility.has('phone')) row['Phone'] = l.phone || '';
      if (columnVisibility.has('stage')) row['Stage'] = l.funnel_stage || '';
      getTableCustomFields().forEach(f => {
        if (columnVisibility.has(f.field_name)) {
          const val = l.custom_fields?.[f.field_name];
          row[f.field_name === 'segment' ? 'Target Segment' : f.field_name] = Array.isArray(val) ? val.join(', ') : (val != null ? String(val) : '');
        }
      });
      if (columnVisibility.has('tags')) row['Tags'] = (l.tags || []).join(', ');
      if (selectedBrand?.id === 'optimaviz') {
        const trial = getOptimavizTrialInfo(l);
        if (columnVisibility.has('trial_status_virtual')) row['Trial Status'] = trial.isTrialLead ? trial.status : '';
        if (columnVisibility.has('days_remaining_virtual')) row['Days Remaining'] = trial.isTrialLead ? `${trial.daysRemaining} days` : '';
      }
      if (columnVisibility.has('added')) row['Lead Date'] = getLeadDateLabel(l);
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, selectedBrand.name);
    const fileName = `${selectedBrand.name}_leads_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const handleCsvImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportError(null);
    setImportSuccessMessage(null);

    if (!selectedBrand || !csvPreview) {
      setImportError('No active brand or preview dataset found.');
      return;
    }

    if (duplicatesAnalysis.duplicateCount > 0 && !skipDuplicatesOnImport && !confirmDuplicateImport) {
      setConfirmDuplicateImport(true);
      setImportError('Possible duplicates were found. Tick "Skip possible duplicates" or press import again to continue with duplicates.');
      return;
    }

    setConfirmDuplicateImport(false);
    setCsvImporting(true);
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

      // Filter duplicate rows if skip preference is checked
      let dataRowsToImport = parsedRows;
      if (skipDuplicatesOnImport) {
        dataRowsToImport = parsedRows.filter((_, idx) => {
          return !duplicatesAnalysis.fileDuplicates.has(idx) && !duplicatesAnalysis.crmDuplicates.has(idx);
        });
      }

      if (dataRowsToImport.length === 0) {
        setImportError('No leads left to import after skipping duplicates.');
        setCsvImporting(false);
        return;
      }

      const payload = {
        brand_id: selectedBrand.id,
        brand_name: selectedBrand.name,
        funnel_stage: csvImportingStage || getBrandStageOptions(selectedBrand.id)[0],
        mappings: finalMappings,
        dataRows: dataRowsToImport,
        default_custom_fields: csvImportingSegment ? { segment: csvImportingSegment } : {}
      };
      
      const importRes = await axios.post('/api/leads/upload', payload);
      
      // Fetch custom fields to ensure our synced standard + custom columns display updated structures
      await fetchCustomFieldsForBrand();

      // Auto-enable newly created custom columns and mapped standard/custom ones in column visibility
      setColumnVisibility(prev => {
        const next = new Set(prev);
        (['optimaviz', 'idao'].includes(selectedBrand.id) ? ['name', 'organisation', 'email', 'phone', 'segment', ...(selectedBrand.id === 'idao' ? ['service_type'] : []), 'stage', 'next_action', 'follow_up_date', 'last_activity', 'assigned_to', 'tags', 'added'] : ['name', 'email', 'phone', 'stage', 'added', 'tags']).forEach(col => next.add(col));
        colsToCreate.forEach(col => next.add(col));
        customFields.forEach(cf => {
          if (finalMappings[cf.field_name]) {
            next.add(cf.field_name);
          }
        });
        localStorage.setItem(`crm_cols_${selectedBrand.id}`, Array.from(next).join(','));
        return next;
      });

      setImportSuccessMessage(`Import complete! Successfully digested ${importRes.data.count} leads.`);
      
      // Instantly refresh the active brand's leads list on the UI so it shows up immediately
      fetchLeadsForActiveBrand();
      
      // Reset upload uploader states after a short elegant delay
      setTimeout(() => {
        setUploadIsOpen(false);
        setCsvText('');
        setFileName('');
        setCsvPreview(null);
        setParsedRows([]);
        setCsvImportingSegment('');
        setImportSuccessMessage(null);
      }, 1000);

    } catch (err: any) {
      setImportError('Failed to import leads: ' + (err.response?.data?.detail || err.message));
    } finally {
      setCsvImporting(false);
    }
  };

  // Email sequences auto actions
  const handleAddSequenceStep = () => {
    setSeqForm(prev => ({
      ...prev,
      steps: [...prev.steps, { name: '', delay_days: 1, channel: 'email', subject: '', html_content: '' }]
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
    } catch {
      alert('Failed to save email sequence.', 'error');
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
    } catch {
      alert('Bulk enrollment failed.', 'error');
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
      const callsLeads = allLeads.filter((l: Lead) => l.phone && l.funnel_stage !== 'Won' && l.funnel_stage !== 'Lost');
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
    setDiallerLead(lead);
    setActiveCallLead(lead);
    setActiveLead(lead);
    loadLeadDetailsHistory(lead.id);
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
    setUserSaving(true);
    try {
      await axios.post('/api/auth/users', userForm);
      setUserForm({ name: '', email: '', password: '', role: 'user' });
      setAddUserIsOpen(false);
      fetchUsersList();
    } catch (err: any) {
      alert('Failed to register user: ' + (err.response?.data?.detail || err.message));
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
      alert(err.response?.data?.detail || 'Delete user failed.');
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
      alert(err.response?.data?.detail || 'Failed to update user password.');
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
    return sortConfig.dir === 'asc' ? ' ▴' : ' ▾';
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
      if (stage === 'Demo Attended') suffix = ' ✓ Attended';
      if (stage === 'No Show / Did Not Attend') suffix = ' · Rebook';
    }

    const colors: Record<string, string> = { demo_leads: '#8b5cf6', trial_leads: '#10b981', subscribed_platform_users: '#2563eb', training_leads: '#f59e0b', optimaviz_referrals: '#3b82f6', other_services: '#10b981' };
    const color = colors[rawVal] || seg.color || selectedBrand?.color || '#2563eb';
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

  const toggleColumnVis = (colKey: string) => {
    if (!selectedBrand) return;
    setColumnVisibility(prev => {
      const updated = new Set(prev);
      if (updated.has(colKey)) {
        updated.delete(colKey);
      } else {
        updated.add(colKey);
      }
      localStorage.setItem(`crm_cols_${selectedBrand.id}`, Array.from(updated).join(','));
      return updated;
    });
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
    return DATE_WINDOW_OPTIONS.reduce((acc, opt) => {
      acc[opt.value] = leads.filter(lead => isLeadInDateWindow(lead, opt.value)).length;
      return acc;
    }, {} as Record<DateWindowFilter, number>);
  }, [leads]);

  const hasCustomDateRange = Boolean(selectedDateFrom || selectedDateTo);

  // Apply filters on active brand leads
  const filteredSortedLeads = leads
    .filter(lead => {
      const s = searchQuery.toLowerCase();
      const matchesSearch =
        lead.name.toLowerCase().includes(s) ||
        lead.email.toLowerCase().includes(s) ||
        lead.phone.toLowerCase().includes(s) ||
        (lead.notes && lead.notes.toLowerCase().includes(s));
        
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
        const leadVal = lead.custom_fields && lead.custom_fields[field];
        matchesCustomField = leadVal !== undefined && leadVal !== null && normalizeFieldValue(leadVal).toLowerCase() === value.trim().toLowerCase();
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
    const emailAttention = Math.max(0, stats.emailInbox - stats.seenEmailInbox) + Math.max(0, stats.emailFailed - stats.seenEmailFailed);
    const whatsappAttention = Math.max(0, stats.whatsappUnread - stats.seenWhatsAppUnread) + Math.max(0, stats.whatsappFailed - stats.seenWhatsAppFailed);
    const dueCalls = allCallLogs.filter(call => {
      const lead = call.lead_id ? leadLookupById.get(call.lead_id) : null;
      const brandMatch = (call as any).brand_id === brand.id || lead?.brand_id === brand.id;
      if (!brandMatch) return false;
      const dueDate = String((call as any).follow_up_date || (call as any).next_follow_up_date || '').slice(0, 10);
      return dueDate && dueDate <= todayISO;
    }).length;
    return { brand, stats, emailAttention, whatsappAttention, dueCalls };
  }), [activeBrands, allCallLogs, getBrandCommunicationStats, leadLookupById, todayISO]);

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
      tone: '#2563eb',
      action: () => { markBrandCommunicationSeen(row.brand.id); openCommunicationTool('email-tracking'); }
    })),
    ...whatsappBrandRows.map(row => ({
      label: `${row.brand.name} WhatsApp attention`,
      value: row.whatsappAttention,
      icon: 'fa-comment-dots',
      tone: '#16a34a',
      action: () => { markBrandCommunicationSeen(row.brand.id); openCommunicationTool('whatsapp-tracking'); }
    })),
    ...callBrandRows.map(row => ({
      label: `${row.brand.name} call follow-ups`,
      value: row.dueCalls,
      icon: 'fa-phone',
      tone: '#7c3aed',
      action: () => openCommunicationTool('calls')
    })),
    { label: 'Unread team messages', value: teamGlobalUnreadCount, icon: 'fa-comments', tone: '#8b5cf6', action: () => openCommunicationTool('team-chat') },
    ...notificationItems.slice(0, 4).map(item => ({ ...item, tone: item.color, action: () => setActiveTab('dashboard') })),
  ].filter(item => item.value > 0);
  const visibleNotificationItems = communicationHealthItems.filter(item => !dismissedNotificationIds.has(getNotificationItemKey(item)));
  const totalNotificationCount = visibleNotificationItems.length;
  const notificationSignature = JSON.stringify(communicationHealthItems.map(item => [item.label, item.value]));
  const unreadNotificationCount = notificationSignature && notificationSignature !== seenNotificationSignature ? totalNotificationCount : 0;

  useEffect(() => {
    if (!notificationSignature) return;
    const baselineKey = `crm_notifications_baseline_v3_${user?.id || 'guest'}`;
    if (safeLocalStorage.getItem(baselineKey)) return;
    const currentKeys = communicationHealthItems.map(getNotificationItemKey);
    const nextDismissed = new Set(dismissedNotificationIds);
    currentKeys.forEach(key => nextDismissed.add(key));
    setSeenNotificationSignature(notificationSignature);
    setDismissedNotificationIds(nextDismissed);
    safeLocalStorage.setItem('crm_seen_notification_signature', notificationSignature);
    safeLocalStorage.setItem('crm_dismissed_notification_ids', Array.from(nextDismissed).join(','));
    safeLocalStorage.setItem(baselineKey, new Date().toISOString());
    persistNotificationState(notificationSignature, nextDismissed);
  // Run once per user/app version to clear historical aggregate notifications.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, notificationSignature]);


  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  // LOGIN SCREEN
  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', padding: '20px' }}>
        <div style={{ background: 'var(--bg-card)', padding: '40px', borderRadius: '20px', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)', maxWidth: '440px', width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ width: '80px', height: '80px', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <OptimaLogo size={80} />
            </div>
            <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>Optima CRM</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Sign in to access your administrative workspace</p>
          </div>
          
          <form onSubmit={handleLoginSubmit}>
            {loginError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', color: '#b91c1c', padding: '12px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
                <i className="fas fa-exclamation-circle" style={{ marginRight: '6px' }}></i> {loginError}
              </div>
            )}
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Email</label>
              <input 
                type="email" 
                value={loginEmail} 
                onChange={e => setLoginEmail(e.target.value)} 
                required 
                placeholder="you@luju.com" 
                style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '14px', outline: 'none' }}
              />
            </div>
            
            <div style={{ marginBottom: '24px', position: 'relative' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Password</label>
              <input 
                type={showLoginPassword ? 'text' : 'password'} 
                value={loginPassword} 
                onChange={e => setLoginPassword(e.target.value)} 
                required 
                placeholder="Enter your security credentials" 
                style={{ width: '100%', padding: '12px 42px 12px 14px', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '14px', outline: 'none' }}
              />
              <button
                type="button"
                onClick={() => setShowLoginPassword(!showLoginPassword)}
                style={{ position: 'absolute', right: '12px', top: '30px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px', padding: '4px' }}
              >
                <i className={showLoginPassword ? 'fas fa-eye-slash' : 'fas fa-eye'}></i>
              </button>
            </div>
            
            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '14px', fontSize: '14px', borderRadius: '10px' }}>
              Sign In
            </button>
          </form>

          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => { setShowForgotPw(true); setForgotStep('email'); setForgotEmail(''); setForgotNewPw(''); setForgotError(''); }}
              style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '13px', cursor: 'pointer', fontWeight: '600', textDecoration: 'underline' }}
            >
              Forgot Password?
            </button>
          </div>

          {showForgotPw && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div style={{ background: 'var(--bg-card)', padding: '32px', borderRadius: '16px', width: '100%', maxWidth: '400px', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)', margin: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>
                    <i className="fas fa-lock" style={{ marginRight: '8px', color: 'var(--accent)' }}></i>
                    Reset Password
                  </h3>
                  <button onClick={() => setShowForgotPw(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--text-muted)' }}>&times;</button>
                </div>

                {forgotError && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', color: '#b91c1c', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', marginBottom: '14px' }}>
                    <i className="fas fa-exclamation-circle" style={{ marginRight: '6px' }}></i> {forgotError}
                  </div>
                )}

                {forgotStep === 'done' ? (
                  <div style={{ textAlign: 'center', padding: '16px 0' }}>
                    <i className="fas fa-check-circle" style={{ fontSize: '40px', color: '#10B981', marginBottom: '12px', display: 'block' }}></i>
                    <p style={{ fontWeight: '600', marginBottom: '6px' }}>Password updated successfully!</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px' }}>You can now sign in with your new password.</p>
                    <button onClick={() => setShowForgotPw(false)} className="btn btn-primary" style={{ background: 'var(--accent)' }}>Back to Sign In</button>
                  </div>
                ) : forgotStep === 'email' ? (
                  <>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>Enter your account email address to reset your password.</p>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Email Address</label>
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={e => setForgotEmail(e.target.value)}
                        placeholder="you@example.com"
                        style={{ width: '100%', padding: '11px 14px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!forgotEmail.trim()) { setForgotError('Please enter your email address'); return; }
                        setForgotStep('reset');
                        setForgotError('');
                      }}
                      className="btn btn-primary"
                      style={{ width: '100%', background: 'var(--accent)' }}
                    >
                      Continue
                    </button>
                  </>
                ) : (
                  <>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>Set a new password for <strong>{forgotEmail}</strong>.</p>
                    <div style={{ marginBottom: '20px', position: 'relative' }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>New Password</label>
                      <input
                        type={showForgotPwField ? 'text' : 'password'}
                        value={forgotNewPw}
                        onChange={e => setForgotNewPw(e.target.value)}
                        placeholder="At least 6 characters"
                        style={{ width: '100%', padding: '11px 38px 11px 14px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowForgotPwField(!showForgotPwField)}
                        style={{ position: 'absolute', right: '10px', top: '26px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '15px', padding: '4px' }}
                      >
                        <i className={showForgotPwField ? 'fas fa-eye-slash' : 'fas fa-eye'}></i>
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button type="button" onClick={() => setForgotStep('email')} className="btn btn-ghost" style={{ flex: 1 }}>Back</button>
                      <button
                        type="button"
                        disabled={forgotLoading}
                        onClick={async () => {
                          if (!forgotNewPw || forgotNewPw.length < 6) { setForgotError('Password must be at least 6 characters'); return; }
                          setForgotLoading(true);
                          setForgotError('');
                          try {
                            await axios.post('/api/auth/forgot-password', { email: forgotEmail, newPassword: forgotNewPw });
                            setForgotStep('done');
                          } catch (err: any) {
                            setForgotError(err?.response?.data?.detail || 'Failed to reset password. Please try again.');
                          } finally {
                            setForgotLoading(false);
                          }
                        }}
                        className="btn btn-primary"
                        style={{ flex: 1, background: 'var(--accent)' }}
                      >
                        {forgotLoading ? 'Updating...' : 'Reset Password'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }


  return (
    <div className="App" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)' }}>
      
      {/* SIDEBAR NAVIGATION PANEL */}
      <div className="sidebar" style={{ width: '260px', background: 'var(--bg-card)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', padding: '24px 16px', flexShrink: 0 }}>
        <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px', paddingLeft: '8px' }}>
          <div className="sidebar-logo-icon" style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'transparent', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center' }}>
            <OptimaLogo size={36} />
          </div>
          <span style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>Optima CRM</span>
        </div>

        {/* Dashboard index */}
        <div className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={handleSelectDashboard} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '10px', color: activeTab === 'dashboard' ? 'var(--accent)' : 'var(--text-secondary)', background: activeTab === 'dashboard' ? 'oklch(from var(--accent) l c h / 0.08)' : 'transparent', fontWeight: '600', cursor: 'pointer', marginBottom: '8px', transition: 'all 0.2s' }}>
          <i className="fas fa-th-large"></i>
          <span>Dashboard</span>
        </div>

        {/* Brands Section */}
        <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', padding: '20px 16px 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Brands
        </div>
        {activeBrands.map(b => (
          <div key={b.id} className={`nav-item ${activeTab === b.id ? 'active' : ''}`} onClick={() => handleSelectBrand(b)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '10px', color: activeTab === b.id ? b.color : 'var(--text-secondary)', background: activeTab === b.id ? `oklch(from ${b.color} l c h / 0.08)` : 'transparent', fontWeight: '600', cursor: 'pointer', marginBottom: '4px', transition: 'all 0.2s' }}>
            <img src={b.logo} alt={b.name} onError={(e) => { e.currentTarget.style.display = 'none'; }} style={{ width: '18px', height: '18px', objectFit: 'contain' }} referrerPolicy="no-referrer" />
            <span>{b.name}</span>
          </div>
        ))}

        <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', padding: '20px 16px 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Operations
        </div>
        <div className={`nav-item ${['communications', 'calls', 'email-tracking', 'whatsapp-tracking'].includes(activeTab) ? 'active' : ''}`} onClick={handleSelectCommunications} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '10px', color: ['communications', 'calls', 'email-tracking', 'whatsapp-tracking'].includes(activeTab) ? 'var(--accent)' : 'var(--text-secondary)', background: ['communications', 'calls', 'email-tracking', 'whatsapp-tracking'].includes(activeTab) ? 'oklch(from var(--accent) l c h / 0.08)' : 'transparent', fontWeight: '600', cursor: 'pointer', marginBottom: '4px', transition: 'all 0.2s' }}>
          <i className="fas fa-tower-broadcast" style={{ width: '20px' }}></i>
          <span>Communications</span>
        </div>

        <div className={`nav-item ${activeTab === 'team-chat' ? 'active' : ''}`} onClick={() => { setSelectedBrand(null); setActiveTab('team-chat'); fetchTeamMessages(); fetchTeamNotes(); }} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '10px', color: activeTab === 'team-chat' ? 'var(--accent)' : 'var(--text-secondary)', background: activeTab === 'team-chat' ? 'oklch(from var(--accent) l c h / 0.08)' : 'transparent', fontWeight: '600', cursor: 'pointer', marginBottom: '4px', transition: 'all 0.2s' }}>
          <i className="fas fa-comments" style={{ width: '20px' }}></i>
          <span>Team Chat</span>
          {teamGlobalUnreadCount > 0 && (
            <strong className="nav-unread-badge">{teamGlobalUnreadCount > 9 ? '9+' : teamGlobalUnreadCount}</strong>
          )}
        </div>

        <div className={`nav-item ${activeTab === 'integrations' ? 'active' : ''}`} onClick={() => { setSelectedBrand(null); setActiveTab('integrations'); setIntegrationBrandId(activeBrands[0]?.id || BRANDS[0].id); if (user.role === 'admin') fetchBrandIntegrations(); fetchMessageTemplates(); }} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '10px', color: activeTab === 'integrations' ? 'var(--accent)' : 'var(--text-secondary)', background: activeTab === 'integrations' ? 'oklch(from var(--accent) l c h / 0.08)' : 'transparent', fontWeight: '600', cursor: 'pointer', marginBottom: '4px', transition: 'all 0.2s' }}>
          <i className={`fas ${user.role === 'admin' ? 'fa-plug' : 'fa-book-open'}`} style={{ width: '20px' }}></i>
          <span>{user.role === 'admin' ? 'Integrations' : 'Template Library'}</span>
        </div>

        {/* Admin settings */}
        {user.role === 'admin' && (
          <div className={`nav-item ${activeTab === 'users' ? 'active' : ''}`} onClick={handleSelectUsers} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '10px', color: activeTab === 'users' ? 'var(--accent)' : 'var(--text-secondary)', background: activeTab === 'users' ? 'oklch(from var(--accent) l c h / 0.08)' : 'transparent', fontWeight: '600', cursor: 'pointer', marginBottom: '4px', transition: 'all 0.2s' }}>
            <i className="fas fa-users-cog"></i>
            <span>User Management</span>
          </div>
        )}

        {/* User Footplate */}
        <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
          <div style={{ padding: '12px 8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: profilePicture ? 'transparent' : 'linear-gradient(135deg, var(--accent), var(--brand-optimaviz))', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '14px', overflow: 'hidden', flexShrink: 0 }}>
              {profilePicture ? <img src={profilePicture} alt={user.name} onError={(e) => { e.currentTarget.style.display = 'none'; setProfilePicture(''); safeLocalStorage.removeItem('crm_user_picture'); }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : user.name.charAt(0)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{user.role}</div>
            </div>
            <button
              onClick={() => {
                setProfileName(user.name);
                setCurrentPw('');
                setNewPw('');
                setConfirmNewPw('');
                setPwError('');
                setProfileModalOpen(true);
              }}
              title="User Profile Settings"
              style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '14px', padding: '8px', borderRadius: '6px' }}
            >
              <i className="fas fa-user-circle"></i>
            </button>
            <button onClick={handleLogout} className="btn-logout" title="Log Out" style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '14px', padding: '8px' }}>
              <i className="fas fa-sign-out-alt"></i>
            </button>
          </div>
        </div>
      </div>

      {/* MAIN CONTAINER FRAME */}
      <div className="main" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        
        {/* TOP COMPONENT STRIP */}
        <div style={{ height: '70px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', flexShrink: 0 }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>
            {activeTab === 'dashboard' && 'Dashboard Overview'}
            {activeTab === 'communications' && 'Communications Hub'}
            {activeTab === 'calls' && 'Communications · Calls'}
            {activeTab === 'users' && 'Staff Directory & Permissions'}
            {activeTab === 'email-tracking' && 'Communications · Email'}
            {activeTab === 'whatsapp-tracking' && 'Communications · WhatsApp'}
            {activeTab === 'team-chat' && 'Communications · Team Chat'}
            {activeTab === 'integrations' && (user.role === 'admin' ? 'Brand Integrations & Template Library' : 'Communication Template Library')}
            {selectedBrand && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <img src={selectedBrand.logo} alt={selectedBrand.name} style={{ width: '22px', height: '22px', objectFit: 'contain', verticalAlign: 'middle' }} referrerPolicy="no-referrer" />
                <span>{selectedBrand.name} Workspace</span>
              </span>
            )}
          </h2>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Global cross-brand search */}
            <div style={{ position: 'relative' }} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) { setShowGlobalSearch(false); } }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <i className="fas fa-search" style={{ position: 'absolute', left: '10px', fontSize: '13px', color: 'var(--text-muted)', pointerEvents: 'none' }}></i>
                <input
                  type="text"
                  placeholder="Search all brands..."
                  value={globalSearchQuery}
                  onChange={e => handleGlobalSearch(e.target.value)}
                  onFocus={() => globalSearchQuery && setShowGlobalSearch(true)}
                  style={{ paddingLeft: '32px', paddingRight: '12px', height: '36px', width: '220px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', color: 'var(--text-primary)', outline: 'none' }}
                />
              </div>
              {showGlobalSearch && globalSearchResults.length > 0 && (
                <div style={{ position: 'absolute', top: '42px', left: 0, width: '320px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', boxShadow: 'var(--shadow-lg)', zIndex: 9999, overflow: 'hidden' }}>
                  <div style={{ padding: '6px 12px', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Leads across all brands</div>
                  {globalSearchResults.map(lead => {
                    const b = managedBrands.find(br => br.id === lead.brand_id);
                    return (
                      <div key={lead.id} onMouseDown={() => jumpToLead(lead)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-base)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{lead.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{lead.email || lead.phone || 'No contact'}</div>
                        </div>
                        {b && <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '20px', background: b.color + '22', color: b.color }}>{b.name}</span>}
                      </div>
                    );
                  })}
                  {globalSearchResults.length === 0 && (
                    <div style={{ padding: '14px', fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center' }}>No leads found</div>
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              className="command-launcher"
              onClick={() => setCommandPaletteOpen(true)}
              title="Open command search"
            >
              <i className="fas fa-bolt"></i>
              <span>Ctrl K</span>
            </button>
            <div className="notification-shell">
              <button
                type="button"
                className={`notification-trigger ${notificationDrawerOpen ? 'active' : ''}`}
                onClick={() => {
                  setNotificationDrawerOpen(open => {
                    const nextOpen = !open;
                    if (nextOpen) {
                      setSeenNotificationSignature(notificationSignature);
                      safeLocalStorage.setItem('crm_seen_notification_signature', notificationSignature);
                      // Mark all current notification items as dismissed when drawer opens.
                      // Keys include the current count so future changes can show again.
                      const newDismissed = new Set(dismissedNotificationIds);
                      notificationItems.forEach(item => newDismissed.add(getNotificationItemKey(item)));
                      communicationHealthItems.forEach(item => newDismissed.add(getNotificationItemKey(item)));
                      setDismissedNotificationIds(newDismissed);
                      safeLocalStorage.setItem('crm_dismissed_notification_ids', Array.from(newDismissed).join(','));
                      persistNotificationState(notificationSignature, newDismissed);
                    }
                    return nextOpen;
                  });
                }}
                title="Open notifications"
              >
                <i className="fas fa-bell"></i>
                {unreadNotificationCount > 0 && <strong>{unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}</strong>}
              </button>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              <span style={{ color: '#25D366', fontWeight: '600' }}><i className="fas fa-circle" style={{ fontSize: '8px', marginRight: '4px' }}></i> ONLINE</span>
            </div>
          </div>
        </div>

        {/* CENTRAL VIEW CANVAS */}
        <div
          key={activeTab}
          className={`view-content ${activeTab === 'team-chat' ? 'view-content--team-chat' : ''}`}
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: activeTab === 'team-chat' ? 'hidden' : 'auto',
            padding: activeTab === 'team-chat' ? '32px 32px 16px' : '32px',
            animation: 'pageSlideIn 0.22s ease'
          }}
        >
          
          {/* =======================================================
               A. GENERAL DASHBOARD VIEW
             ======================================================= */}
{activeTab === 'communications' && (
             <div className="communications-hub">
               <section className="communications-hero">
                 <div>
                   <span>Unified workbench</span>
                   <h2>Communications by Brand</h2>
                   <p>Emails and WhatsApp messages organized by brand so you know exactly where to focus.</p>
                 </div>
                 <button type="button" className="btn btn-primary" onClick={() => openCommunicationTool('email-tracking')}>
                   <i className="fas fa-pen"></i> Compose Email
                 </button>
               </section>

                <div className="communications-grid">
                  {[
                    { id: 'email-tracking' as const, title: 'Email by Brand', icon: 'fa-envelope-open-text', tone: '#2563eb', value: emailAttentionCount, detail: emailBrandRows.length ? 'Replies/failed sends needing action' : 'No brand email actions due', rows: emailBrandRows.map(row => ({ name: row.brand.name, value: row.emailAttention })) },
                    { id: 'whatsapp-tracking' as const, title: 'WhatsApp by Brand', icon: 'fab fa-whatsapp', tone: '#16a34a', value: whatsappAttentionCount, detail: whatsappBrandRows.length ? 'Unread/failed chats by brand' : 'No WhatsApp actions due', rows: whatsappBrandRows.map(row => ({ name: row.brand.name, value: row.whatsappAttention })) },
                    { id: 'calls' as const, title: 'Call Follow-Ups', icon: 'fa-phone', tone: '#7c3aed', value: dueCallActionCount, detail: callBrandRows.length ? 'Due call actions by brand' : 'No call follow-ups due', rows: callBrandRows.map(row => ({ name: row.brand.name, value: row.dueCalls })) },
                    { id: 'team-chat' as const, title: 'Team Chat & Files', icon: 'fa-comments', tone: '#0ea5e9', value: teamGlobalUnreadCount, detail: `${teamGlobalUnreadCount} unread team item${teamGlobalUnreadCount === 1 ? '' : 's'}`, rows: [] },
                  ].map(card => (
                    <button key={card.id} type="button" className="communications-card communications-card--by-brand" onClick={() => openCommunicationTool(card.id)}>
                      <span className="communications-card__icon" style={{ background: `${card.tone}16`, color: card.tone }}>
                        <i className={card.icon.startsWith('fab ') ? card.icon : `fas ${card.icon}`}></i>
                      </span>
                      <span className="communications-card__content">
                        <strong>{card.title}</strong>
                        <small>{card.detail}</small>
                        {card.rows.length > 0 && (
                          <span className="brand-mini-breakdown">
                            {card.rows.slice(0, 3).map(row => <em key={row.name}>{row.name}<b>{row.value}</b></em>)}
                            {card.rows.length > 3 && <em>+{card.rows.length - 3}<b>more</b></em>}
                          </span>
                        )}
                      </span>
                      <em className="communications-card__count">{card.value}</em>
                    </button>
                  ))}
                </div>

               <div className="communications-layout">
                 <section className="communications-panel">
                   <div className="communications-panel__header">
                     <div>
                       <span>Attention queue</span>
                       <h3>What needs action</h3>
                     </div>
                     <button type="button" onClick={() => { fetchAllSentEmails(); fetchAllWhatsAppMessages(); fetchAllCallLogs(); fetchTeamMessages(); }}>
                       <i className="fas fa-arrows-rotate"></i> Refresh
                     </button>
                   </div>
                   <div className="communications-alert-list">
                     {visibleNotificationItems.length > 0 ? visibleNotificationItems.map(item => (
                       <button key={item.label} type="button" onClick={item.action}>
                         <i className={`fas ${item.icon}`} style={{ color: item.tone }}></i>
                         <span>
                           <strong>{item.label}</strong>
                           <small>{item.value} record{item.value === 1 ? '' : 's'} need review</small>
                         </span>
                         <i className="fas fa-arrow-right"></i>
                       </button>
                     )) : (
                      <div className="communications-empty-state">
                        <i className="fas fa-circle-check"></i>
                        <strong>No urgent communication alerts</strong>
                        <span>Failed sends, unread messages, and follow-ups will appear here.</span>
                      </div>
                    )}
                  </div>
                </section>

                <section className="communications-panel">
                  <div className="communications-panel__header">
                    <div>
                      <span>Brand readiness</span>
                      <h3>Connected accounts</h3>
                    </div>
                    <button type="button" onClick={() => openCommunicationTool('integrations')}>
                      <i className="fas fa-plug"></i> Setup
                    </button>
                  </div>
                  <div className="brand-readiness-list">
                    {activeBrands.map(brand => {
                      const integration = getBrandIntegrationFor(brand.id);
                      const emailAccounts = getEmailAccountsForIntegration(integration);
                      const hasWhatsApp = isWhatsAppCloudConfigured(integration, brand.id) || Boolean(whatsappNumbers[brand.id]);
                      return (
                        <div key={brand.id} className="brand-readiness-row">
                          <img src={brand.logo} alt={brand.name} />
                          <span>
                            <strong>{brand.name}</strong>
                            <small>{emailAccounts.length} email account{emailAccounts.length === 1 ? '' : 's'} · {hasWhatsApp ? 'WhatsApp ready' : 'WhatsApp not set'}</small>
                          </span>
                          <button type="button" onClick={() => { setSelectedBrand(null); setActiveTab('integrations'); setIntegrationBrandId(brand.id); fetchBrandIntegrations(); fetchMessageTemplates(); }}>Manage</button>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>
            </div>
          )}

          {activeTab === 'dashboard' && (
            <div style={{ animation: 'fadeIn 0.3s' }}>
              
              {/* Stats highlights */}
              <div className="dashboard-summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>
                <div className="executive-stat-card" style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span className="stat-label" style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '600' }}>Overall Leads Count</span>
                    <i className="fas fa-users" style={{ color: 'var(--accent)', fontSize: '18px' }}></i>
                  </div>
                  <div className="stat-value" style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text-primary)' }}>
                    {Object.values(dashboardStats).reduce((acc: number, curr: any) => acc + curr.totalLeads, 0)}
                  </div>
                </div>
                {user.role === 'admin' && <div className="executive-stat-card" style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span className="stat-label" style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '600' }}>Active System Users</span>
                    <i className="fas fa-user-shield" style={{ color: '#10b981', fontSize: '18px' }}></i>
                  </div>
                  <div className="stat-value" style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text-primary)' }}>
                    {usersList.length}
                  </div>
                </div>}
              </div>

              {/* Daily Command Center */}
              <div className="command-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '14px', marginBottom: '28px', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)' }}>Today Command Center</h3>
                    <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '13px' }}>Daily work queue across brands, communication activity, and data health. Fully editable.</p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => openCommandMetricModal()} style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}>
                      <i className="fas fa-plus"></i> Add Metric
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={resetCommandMetrics}>
                      <i className="fas fa-rotate-left"></i> Reset
                    </button>
                    <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
                      {(['comfortable', 'compact'] as const).map(mode => (
                        <button key={mode} onClick={() => setDashboardDensity(mode)} style={{ padding: '8px 12px', border: 'none', background: dashboardDensity === mode ? 'var(--accent)' : 'var(--bg-base)', color: dashboardDensity === mode ? '#fff' : 'var(--text-secondary)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize' }}>
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', marginBottom: '18px' }}>
                  {commandMetrics.map(card => (
                    <div key={card.id} style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '12px', padding: dashboardDensity === 'compact' ? '12px' : '16px', position: 'relative' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase' }}>{card.label}</span>
                        <span style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                          <button onClick={() => openCommandMetricModal(card)} title="Edit metric" style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}><i className="fas fa-pen"></i></button>
                          <button onClick={() => deleteCommandMetric(card.id)} title="Delete metric" style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', padding: 0 }}><i className="fas fa-trash"></i></button>
                          <i className={`fas ${card.icon}`} style={{ color: card.color }}></i>
                        </span>
                      </div>
                      <strong style={{ fontSize: dashboardDensity === 'compact' ? '22px' : '28px', color: 'var(--text-primary)' }}>{getCommandMetricValue(card)}</strong>
                    </div>
                  ))}
                  {commandMetrics.length === 0 && (
                    <button onClick={() => openCommandMetricModal()} style={{ minHeight: '110px', border: '1px dashed var(--border)', borderRadius: '12px', background: 'var(--bg-base)', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 700 }}>
                      <i className="fas fa-plus" style={{ marginRight: '6px' }}></i>Add your first metric
                    </button>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(280px, .8fr)', gap: '16px' }}>
                  <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px' }}>
                    <div style={{ fontWeight: 800, marginBottom: '10px', color: 'var(--text-primary)' }}>Next Best Actions</div>
                    <div style={{ display: 'grid', gap: dashboardDensity === 'compact' ? '6px' : '8px', maxHeight: '260px', overflowY: 'auto' }}>
                      {(allCrmLeads.length ? allCrmLeads : leads)
                        .map(l => ({ lead: l, action: getNextActionForLead(l) }))
                        .filter(({ action }) => action.priority > 10)
                        .sort((a, b) => b.action.priority - a.action.priority)
                        .slice(0, 10)
                        .map(({ lead: l, action }) => {
                        const brand = getLeadBrand(l);
                        return (
                          <div key={l.id} onClick={() => {
                            if (action.tab === 'email-tracking') { setSelectedBrand(null); setSelectedBrandForEmail(brand || activeBrands[0] || BRANDS[0]); setActiveEmailLead(l); setActiveTab('email-tracking'); }
                            else if (action.tab === 'whatsapp-tracking') { setSelectedBrand(null); setSelectedBrandForWhatsApp(brand || activeBrands[0] || BRANDS[0]); setActiveWhatsAppLead(l); setActiveTab('whatsapp-tracking'); }
                            else if (action.tab === 'calls') { setSelectedBrand(null); setSelectedBrandForCalls(brand || activeBrands[0] || BRANDS[0]); setActiveCallLead(l); setActiveTab('calls'); loadLeadDetailsHistory(l.id); }
                            else if (brand) { handleSelectBrand(brand); setTimeout(() => { setActiveLead(l); loadLeadDetailsHistory(l.id); }, 120); }
                          }} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '12px', alignItems: 'center', padding: dashboardDensity === 'compact' ? '8px 10px' : '11px 12px', border: '1px solid var(--border)', borderRadius: '10px', background: 'var(--bg-card)', cursor: 'pointer' }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.name}</div>
                              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{brand?.name || l.brand_name} | {l.funnel_stage}</div>
                              <div style={{ marginTop: '6px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '10.5px', fontWeight: 800, padding: '3px 7px', borderRadius: '999px', background: `${action.tone}14`, color: action.tone }}>Trigger: {action.trigger}</span>
                                <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>{action.reason}</span>
                              </div>
                            </div>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '7px 10px', borderRadius: '999px', background: `${action.tone}22`, color: action.tone, fontSize: '12px', fontWeight: 800 }}>
                              <i className={action.icon.startsWith('fa') && !action.icon.startsWith('fas') && !action.icon.startsWith('fab') ? `fas ${action.icon}` : action.icon}></i>{action.label}
                            </span>
                          </div>
                        );
                      })}
                      {(allCrmLeads.length ? allCrmLeads : leads).every(l => getNextActionForLead(l).priority <= 10) && (
                        <small style={{ color: 'var(--text-muted)', padding: '10px' }}>No trigger-based actions need attention right now.</small>
                      )}
                    </div>
                  </div>
                  <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px' }}>
                    <div style={{ fontWeight: 800, marginBottom: '10px', color: 'var(--text-primary)' }}>Brand Operating Metrics</div>
                    <div style={{ display: 'grid', gap: '10px', maxHeight: '260px', overflowY: 'auto' }}>
                      {brandOperatingMetrics.map(({ brand, items }) => (
                        <div key={brand.id} style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '10px', background: 'var(--bg-card)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <img src={brand.logo} alt={brand.name} style={{ width: '18px', height: '18px', objectFit: 'contain' }} />
                            <strong style={{ color: 'var(--text-primary)' }}>{brand.name}</strong>
                          </div>
                          <div style={{ display: 'grid', gap: '7px' }}>
                            {items.map(item => (
                              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '12.5px' }}>{item.label}</span>
                                <strong style={{ color: brand.color }}>{item.value}</strong>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                      {brandOperatingMetrics.length === 0 && <small style={{ color: 'var(--text-muted)' }}>Metrics appear here as brand data is added.</small>}
                      <small style={{ color: 'var(--text-muted)' }}>These summaries are automatic; the cards above remain fully editable.</small>
                    </div>
                  </div>
                </div>
              </div>

              {/* Portfolio Intelligence Strip */}
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(300px, .75fr)', gap: '16px', marginBottom: '28px' }}>
                <section style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '18px', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '14px' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: 'var(--text-primary)' }}>Cross-Brand Leaderboard</h3>
                      <p style={{ margin: '3px 0 0', color: 'var(--text-muted)', fontSize: '12px' }}>Lead volume, open follow-ups, and won/converted activity across the full portfolio.</p>
                    </div>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => { fetchDashboardStats(); fetchAllTasks(); fetchAllSentEmails(); fetchAllWhatsAppMessages(); fetchAllCallLogs(); }}>
                      <i className="fas fa-arrows-rotate"></i> Refresh
                    </button>
                  </div>
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {portfolioLeaderboard.map(({ brand, total, due, won, pct }) => (
                      <button key={brand.id} type="button" onClick={() => handleSelectBrand(brand)} style={{ display: 'grid', gridTemplateColumns: '150px minmax(0, 1fr) auto', gap: '12px', alignItems: 'center', border: '1px solid var(--border)', background: 'var(--bg-base)', borderRadius: '12px', padding: '10px 12px', cursor: 'pointer', textAlign: 'left' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                          <img src={brand.logo} alt={brand.name} style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
                          <strong style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{brand.name}</strong>
                        </span>
                        <span style={{ height: '11px', borderRadius: '999px', background: 'var(--border)', overflow: 'hidden', display: 'flex' }}>
                          <span style={{ width: `${pct}%`, background: brand.color, minWidth: total ? '8px' : 0 }} />
                        </span>
                        <span style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end', fontSize: '11px', color: 'var(--text-secondary)' }}>
                          <b style={{ color: 'var(--text-primary)' }}>{total}</b> leads
                          <b style={{ color: '#f59e0b' }}>{due}</b> due
                          <b style={{ color: '#10b981' }}>{won}</b> won/converted
                        </span>
                      </button>
                    ))}
                  </div>
                </section>

                <section style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '18px', boxShadow: 'var(--shadow-sm)' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: 'var(--text-primary)' }}>Tasks Due Today</h3>
                  <p style={{ margin: '3px 0 12px', color: 'var(--text-muted)', fontSize: '12px' }}>Lead follow-ups and team tasks scheduled for today.</p>
                  <div style={{ display: 'grid', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
                    {tasksDueToday.length > 0 ? tasksDueToday.map(item => {
                      const brand = managedBrands.find(b => b.id === item.brand_id);
                      return (
                        <button key={item.id} type="button" onClick={() => { if ('lead' in item && item.lead && brand) { handleSelectBrand(brand); setTimeout(() => { setActiveLead(item.lead as Lead); loadLeadDetailsHistory((item.lead as Lead).id); }, 120); } }} style={{ border: '1px solid var(--border)', background: 'var(--bg-base)', borderRadius: '11px', padding: '10px', cursor: 'pointer', textAlign: 'left' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                            <strong style={{ color: 'var(--text-primary)', fontSize: '13px' }}>{item.title}</strong>
                            {brand && <span style={{ color: brand.color, fontSize: '11px', fontWeight: 800 }}>{brand.name}</span>}
                          </div>
                          <small style={{ color: 'var(--text-muted)' }}>{item.type} · {item.detail}</small>
                        </button>
                      );
                    }) : (
                      <div style={{ border: '1px dashed var(--border)', borderRadius: '12px', padding: '18px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <i className="fas fa-circle-check" style={{ fontSize: '28px', color: '#10b981', display: 'block', marginBottom: '8px' }}></i>
                        No tasks due today.
                      </div>
                    )}
                  </div>
                </section>
              </div>

              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '18px', marginBottom: '28px', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: 'var(--text-primary)' }}>Last 10 Actions</h3>
                    <p style={{ margin: '3px 0 0', color: 'var(--text-muted)', fontSize: '12px' }}>Live activity trail from leads, emails, WhatsApp, calls, and team tasks.</p>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Portfolio feed</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
                  {recentActivityFeed.length > 0 ? recentActivityFeed.map(item => {
                    const brand = managedBrands.find(b => b.id === item.brand_id);
                    return (
                      <div key={item.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', border: '1px solid var(--border)', background: 'var(--bg-base)', borderRadius: '12px', padding: '11px' }}>
                        <span style={{ width: '34px', height: '34px', borderRadius: '10px', background: `${brand?.color || 'var(--accent)'}18`, color: brand?.color || 'var(--accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><i className={`fas ${item.icon}`}></i></span>
                        <span style={{ minWidth: 0 }}>
                          <strong style={{ display: 'block', color: 'var(--text-primary)', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</strong>
                          <small style={{ color: 'var(--text-muted)' }}>{item.type} · {item.detail}</small>
                          <small style={{ display: 'block', color: brand?.color || 'var(--accent)', marginTop: '3px', fontWeight: 800 }}>{brand?.name || 'General'} · {item.created_at ? new Date(item.created_at).toLocaleString() : 'Recently'}</small>
                        </span>
                      </div>
                    );
                  }) : <small style={{ color: 'var(--text-muted)' }}>Activity will appear here as your team sends emails, WhatsApps, logs calls, updates leads, and posts tasks.</small>}
                </div>
              </div>

              <FollowUpQueue
                leads={allCrmLeads.length ? allCrmLeads : leads}
                brands={activeBrands}
                onOpenLead={jumpToLead}
                onQuickCall={openQuickCallForLead}
              />

              {/* Overdue Follow-Up Widget */}
              {(() => {
                const today = new Date();
                today.setHours(0,0,0,0);
                const overdue = leads.filter(l => isFollowUpDue(l));
                if (overdue.length === 0) return null;
                return (
                  <div style={{ background: 'var(--bg-card)', border: '1px solid #f59e0b55', borderRadius: '12px', padding: '16px 20px', marginBottom: '28px', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                      <i className="fas fa-clock" style={{ color: '#f59e0b', fontSize: '16px' }}></i>
                      <span style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)' }}>Follow-Up Reminders Due</span>
                      <span style={{ background: '#ef444422', color: '#ef4444', fontWeight: '700', fontSize: '11px', padding: '2px 8px', borderRadius: '20px', marginLeft: 'auto' }}>{overdue.length} overdue</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                      {overdue.slice(0, 8).map(l => {
                        const d = parseDateOnly(l.follow_up_date!)!;
                        const diff = Math.ceil((d.getTime() - today.getTime()) / 86400000);
                        const brand = managedBrands.find(b => b.id === l.brand_id);
                        return (
                          <div key={l.id} onClick={() => { const b = managedBrands.find(br => br.id === l.brand_id); if (b) { handleSelectBrand(b); setTimeout(() => { setActiveLead(l); loadLeadDetailsHistory(l.id); }, 200); }}} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px', borderRadius: '8px', cursor: 'pointer', background: 'var(--bg-base)', border: '1px solid var(--border)' }}>
                            <div style={{ flex: 1 }}>
                              <span style={{ fontWeight: '600', fontSize: '13px', color: 'var(--text-primary)' }}>{l.name}</span>
                              {brand && <span style={{ fontSize: '11px', color: brand.color, fontWeight: '600', marginLeft: '8px' }}>{brand.name}</span>}
                            </div>
                            <span style={{ fontSize: '11px', fontWeight: '700', color: diff < 0 ? '#ef4444' : '#f59e0b' }}>
                              {diff < 0 ? `${Math.abs(diff)}d overdue` : 'Today'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Brands Highlights Grid */}
              <h3 className="dashboard-section-title" style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }}>Corporate Brand Portfolios</h3>
              <div className="brand-portfolio-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '24px' }}>
                {activeBrands.map(b => {
                  const stat = dashboardStats[b.id] || { totalLeads: 0, emailsSent: 0, stages: {} };
                  const stageEntries = Object.entries(stat.stages || {}).filter(([, count]) => Number(count) > 0).sort((a, b2) => Number(b2[1]) - Number(a[1])).slice(0, 5);
                  const stageTotal = Math.max(1, stageEntries.reduce((sum, [, count]) => sum + Number(count), 0));
                  return (
                    <div key={b.id} onClick={() => handleSelectBrand(b)} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: 'var(--shadow-sm)' }} className="brand-card">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
                        <img src={b.logo} alt={b.name} style={{ width: '40px', height: '40px', objectFit: 'contain' }} referrerPolicy="no-referrer" />
                        <h4 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', flex: 1 }}>{b.name}</h4>
                        <span style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '8px', background: `oklch(from ${b.color} l c h / 0.1)`, color: b.color, fontWeight: '700' }}>Active Segment</span>
                      </div>
                      
                      <div className="metric-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Total Contacts Digest</span>
                        <span style={{ fontWeight: '600' }}>{stat.totalLeads} leads</span>
                      </div>
                      <div className="metric-row" style={{ display: 'grid', gap: '8px', fontSize: '14px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Workflow Pipeline Health</span>
                        <div title="Pipeline stage mix" style={{ height: '12px', borderRadius: '999px', background: 'var(--border)', overflow: 'hidden', display: 'flex' }}>
                          {stageEntries.length > 0 ? stageEntries.map(([stage, count]) => (
                            <span key={stage} style={{ width: `${Math.max(6, Math.round((Number(count) / stageTotal) * 100))}%`, background: getStageColor(stage), opacity: 0.95 }} />
                          )) : <span style={{ width: '100%', background: 'var(--border)' }} />}
                        </div>
                        <div className="workflow-builder-actions">
                          {stageEntries.length > 0 ? stageEntries.slice(0, 4).map(([stage, count]) => (
                            <span key={stage} style={{ fontSize: '11px', color: getStageColor(stage), fontWeight: 800 }}>{stage}: {String(count)}</span>
                          )) : <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>No pipeline data yet</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          )}

          {/* =======================================================
               B. INTEGRATED DIALLER CALL CENTER
             ======================================================= */}
          {activeTab === 'calls' && (
            <div className="call-workspace" style={{ ['--call-accent' as any]: selectedBrandForCalls?.color || 'var(--accent)' }}>
              {(() => {
                const brandCallLeads = diallerLeadsList.filter(l => l.brand_id === selectedBrandForCalls?.id);
                const queueLeads = brandCallLeads.filter(l => callStageFilter === 'all' || l.funnel_stage === callStageFilter);
                const selectedCalls = activeCallLead ? leadCalls : [];
                return (
                  <>
                    <div className="call-command-bar">
                      <div className="call-title-block">
                        <div className="call-app-mark"><i className="fas fa-headset"></i></div>
                        <div>
                          <h3>Brand Call Desk</h3>
                          <p>Choose a brand, narrow by stage, call the right contacts, and log outcomes immediately.</p>
                        </div>
                      </div>
                      <select
                        value={selectedBrandForCalls?.id || ''}
                        onChange={e => {
                          const brand = managedBrands.find(b => b.id === e.target.value);
                          if (brand) {
                            setSelectedBrandForCalls(brand);
                            setCallStageFilter('all');
                            setActiveCallLead(null);
                            setDiallerLead(null);
                            setCallNotes('');
                            setCallFollowUpDate('');
                          }
                        }}
                      >
                        {activeBrands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </div>

                    <div className="call-stage-row">
                      <button type="button" className={callStageFilter === 'all' ? 'active' : ''} onClick={() => setCallStageFilter('all')}>All <span>{brandCallLeads.length}</span></button>
                      {getBrandStageOptions(selectedBrandForCalls?.id).map(stg => {
                        const count = brandCallLeads.filter(l => l.funnel_stage === stg).length;
                        return (
                          <button key={stg} type="button" className={callStageFilter === stg ? 'active' : ''} onClick={() => setCallStageFilter(stg)}>
                            {stg} <span>{count}</span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="call-client-shell">
                      <aside className="call-lead-rail">
                        <div className="call-rail-header">
                          <strong>Call Queue</strong>
                          <span>{queueLeads.length} contacts</span>
                        </div>
                        <div className="call-lead-list">
                          {queueLeads.length === 0 ? (
                            <div className="call-empty-state"><i className="fas fa-phone-slash"></i><span>No callable contacts in this stage.</span></div>
                          ) : queueLeads.map(l => {
                            const isSelected = activeCallLead?.id === l.id;
                            return (
                              <button
                                key={l.id}
                                type="button"
                                className={`call-lead-item ${isSelected ? 'active' : ''}`}
                                onClick={() => {
                                  setActiveCallLead(l);
                                  setActiveLead(l);
                                  setDiallerLead(l);
                                  setCallNotes('');
                                  setCallFollowUpDate('');
                                  loadLeadDetailsHistory(l.id);
                                }}
                              >
                                <span className="call-avatar">{l.name.charAt(0)}</span>
                                <span className="call-lead-copy">
                                  <strong>{l.name}</strong>
                                  <small>{l.phone || 'No phone'} | {l.funnel_stage}</small>
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </aside>

                      <main className="call-focus-panel">
                        {activeCallLead ? (
                          <div className="call-active-card">
                            <div className="call-active-header">
                              <div>
                                <span>Selected Contact</span>
                                <h4>{activeCallLead.name}</h4>
                                <p>{activeCallLead.phone || 'No phone number'} | {activeCallLead.email || 'No email'}</p>
                              </div>
                              <span className="pill pill-blue">{activeCallLead.funnel_stage}</span>
                            </div>

                            <div className={`call-ring-panel ${isCalling && diallerLead?.id === activeCallLead.id ? 'calling' : ''}`}>
                              <div className="call-ring-icon"><i className="fas fa-phone-volume"></i></div>
                              <div>
                                <strong>{isCalling && diallerLead?.id === activeCallLead.id ? 'Call in progress' : 'Ready to call'}</strong>
                                <span>{Math.floor(callSeconds / 60)}m {callSeconds % 60}s</span>
                              </div>
                              {isCalling && diallerLead?.id === activeCallLead.id ? (
                                <button type="button" className="call-hangup-btn" onClick={handleEndSimulatedCall}><i className="fas fa-phone-slash"></i> End call</button>
                              ) : (
                                <button type="button" className="call-start-btn" onClick={() => handleStartSimulatedCall(activeCallLead)}><i className="fas fa-phone"></i> Start call</button>
                              )}
                            </div>

                            <form className="call-notes-form" onSubmit={handleLogCallSubmit}>
                              <div className="call-form-grid">
                                <label>
                                  <span>Outcome</span>
                                  <select value={callOutcome} onChange={e => setCallOutcome(e.target.value)}>
                                    <option value="Connected">Connected</option>
                                    <option value="No Answer">No Answer</option>
                                    <option value="Left Voicemail">Left Voicemail</option>
                                    <option value="Busy">Busy / Requested Callback</option>
                                    <option value="Interested">Interested</option>
                                    <option value="Not Interested">Not Interested</option>
                                    <option value="Wrong Number">Wrong Number</option>
                                    <option value="Follow-Up Needed">Follow-Up Needed</option>
                                  </select>
                                </label>
                                <label>
                                  <span>Duration</span>
                                  <input type="number" value={callDuration} onChange={e => setCallDuration(parseInt(e.target.value) || 0)} />
                                </label>
                                <label>
                                  <span>Follow-up Date</span>
                                  <input type="date" value={callFollowUpDate} onChange={e => setCallFollowUpDate(e.target.value)} />
                                </label>
                              </div>
                              <label className="call-note-block">
                                <span>Call Notes</span>
                                <select
                                  value=""
                                  onChange={e => {
                                    const template = messageTemplates.find(t => t.id === e.target.value);
                                    if (template && activeCallLead) {
                                      setCallNotes(applyTemplateVars(template.body, activeCallLead, selectedBrandForCalls));
                                    }
                                  }}
                                  style={{ marginBottom: '8px', padding: '9px 11px', borderRadius: '9px', border: '1px solid var(--border)' }}
                                >
                                  <option value="">Use call script...</option>
                                  {messageTemplates
                                    .filter(t => t.brand_id === selectedBrandForCalls?.id && t.channel === 'call' && t.is_active !== false)
                                    .map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                                <textarea value={callNotes} onChange={e => setCallNotes(e.target.value)} placeholder="What happened on the call? Add objections, interest level, next step, or anything the team should know." rows={8} />
                              </label>
                              <div className="call-form-footer">
                                <span>Notes are saved to the lead timeline together with the call log.</span>
                                <button type="submit" className="btn btn-primary" disabled={callSaving} style={{ background: selectedBrandForCalls?.color }}>
                                  {callSaving ? 'Saving...' : <><i className="fas fa-clipboard-check"></i> Save call notes</>}
                                </button>
                              </div>
                            </form>
                          </div>
                        ) : (
                          <div className="call-empty-compose">
                            <i className="fas fa-headset"></i>
                            <h4>Select a contact to call</h4>
                            <p>Names are the main focus here. Pick a brand, choose a stage, then open a contact to start calling and logging notes.</p>
                          </div>
                        )}
                      </main>

                      <aside className="call-context-rail">
                        <div className="call-context-card">
                          <span>Brand Queue</span>
                          <strong>{selectedBrandForCalls?.name}</strong>
                          <p>{brandCallLeads.length} callable contacts, {queueLeads.length} in this stage.</p>
                        </div>
                        <div className="call-context-card">
                          <span>Recent Calls</span>
                          {selectedCalls.length > 0 ? (
                            <div className="call-history-list">
                              {selectedCalls.slice(0, 6).map(c => (
                                <div key={c.id}>
                                  <strong>{c.outcome || 'Call logged'}</strong>
                                  <small>{c.duration || 0}s | {c.created_at ? new Date(c.created_at).toLocaleString() : 'Recently'}</small>
                                  {c.notes && <p>{c.notes}</p>}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p>{activeCallLead ? 'No calls logged for this contact yet.' : 'Select a contact to see call history.'}</p>
                          )}
                        </div>
                      </aside>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* =======================================================
               EMAIL TRACKING SYSTEM
             ======================================================= */}
          {activeTab === 'email-tracking' && (
            <div className="email-workspace" style={{ ['--mail-accent' as any]: selectedBrandForEmail?.color || 'var(--accent)' }}>
              {(() => {
                const brandLeads = leads.filter(l => l.brand_id === selectedBrandForEmail?.id);
                const queueLeads = brandLeads.filter(l => emailStageFilter === 'all' || l.funnel_stage === emailStageFilter);
                const selectedHistory = activeEmailLead ? allSentEmails.filter(e => e.lead_id === activeEmailLead.id) : [];
                const emailIntegration = selectedBrandForEmail?.id ? getBrandIntegrationFor(selectedBrandForEmail.id) : null;
                const emailAccounts = emailIntegration ? getEmailAccountsForIntegration(emailIntegration).filter(account => account.id !== 'primary') : [];
                const selectedEmailAccount = emailAccounts.find(account => account.id === selectedEmailAccountId) || emailAccounts.find(account => account.is_default) || emailAccounts[0];
                const hasGmailAccount = emailAccounts.some(account => account.provider === 'gmail') || emailIntegration?.email_provider === 'gmail';
                const canSyncGmail = hasGmailAccount;
                const canSyncOutlook = Boolean(emailIntegration?.outlook_refresh_token);
                const hasWorkingEmailAccount = emailAccounts.some(account => (
                  account.provider === 'gmail' ||
                  (['outlook', 'yahoo', 'smtp'].includes(account.provider || '') && Boolean(account.email && account.smtp_host && account.smtp_port && account.smtp_password_env))
                ));
                const brandEmailActivity = allSentEmails
                  .filter(e => e.brand_id === selectedBrandForEmail?.id || brandLeads.some(l => l.id === e.lead_id))
                  .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
                const providerFilteredActivity = emailProviderFilter === 'all'
                  ? brandEmailActivity
                  : brandEmailActivity.filter(e => (e.provider || 'internal') === emailProviderFilter);
                const providerCounts = {
                  all: brandEmailActivity.length,
                  gmail: brandEmailActivity.filter(e => e.provider === 'gmail').length,
                  outlook: brandEmailActivity.filter(e => e.provider === 'outlook').length,
                  yahoo: brandEmailActivity.filter(e => e.provider === 'yahoo').length,
                  smtp: brandEmailActivity.filter(e => e.provider === 'smtp').length,
                  internal: brandEmailActivity.filter(e => !e.provider || e.provider === 'internal').length,
                };
                const inboxEmails = providerFilteredActivity.filter(e => (e.mailbox_folder === 'inbox') || ((e.status === 'received' || e.direction === 'inbound') && !['spam', 'trash'].includes(e.mailbox_folder || '')));
                const sentEmails = providerFilteredActivity.filter(e => e.mailbox_folder === 'sent' || (e.status !== 'received' && e.status !== 'failed' && e.direction !== 'inbound' && !['drafts', 'spam', 'trash'].includes(e.mailbox_folder || '')));
                const draftEmails = providerFilteredActivity.filter(e => e.mailbox_folder === 'drafts');
                const spamEmails = providerFilteredActivity.filter(e => e.mailbox_folder === 'spam');
                const trashEmails = providerFilteredActivity.filter(e => e.mailbox_folder === 'trash');
                const failedEmails = providerFilteredActivity.filter(e => e.status === 'failed');
                const folderMessages = (emailMailboxFilter === 'inbox'
                  ? inboxEmails
                  : emailMailboxFilter === 'sent'
                    ? sentEmails
                    : emailMailboxFilter === 'drafts'
                      ? draftEmails
                      : emailMailboxFilter === 'spam'
                        ? spamEmails
                        : emailMailboxFilter === 'trash'
                          ? trashEmails
                          : emailMailboxFilter === 'failed'
                            ? failedEmails
                            : brandEmailActivity);
                const query = emailSearchQuery.trim().toLowerCase();
                const mailboxMessages = query
                  ? folderMessages.filter(e => [
                      e.subject,
                      e.from_email,
                      e.to_email,
                      e.to_name,
                      e.template_name,
                      e.created_by
                    ].some(v => String(v || '').toLowerCase().includes(query)))
                  : folderMessages;
                const emailsPerPage = 15;
                const totalEmailPages = Math.max(1, Math.ceil(mailboxMessages.length / emailsPerPage));
                const safeEmailPage = Math.min(emailPage, totalEmailPages);
                const visibleMailboxMessages = mailboxMessages.slice((safeEmailPage - 1) * emailsPerPage, safeEmailPage * emailsPerPage);
                const selectedEmailLog = selectedEmailLogId ? brandEmailActivity.find(e => e.id === selectedEmailLogId) || null : null;
                const selectedEmailLead = selectedEmailLog?.lead_id ? brandLeads.find(l => l.id === selectedEmailLog.lead_id) : null;
                const replyToEmail = selectedEmailLog?.status === 'received' || selectedEmailLog?.direction === 'inbound'
                  ? selectedEmailLog?.from_email
                  : selectedEmailLog?.to_email;
                const forwardSubject = selectedEmailLog?.subject?.toLowerCase().startsWith('fwd:')
                  ? selectedEmailLog.subject
                  : `Fwd: ${selectedEmailLog?.subject || ''}`.trim();
                const replySubject = selectedEmailLog?.subject?.toLowerCase().startsWith('re:')
                  ? selectedEmailLog.subject
                  : `Re: ${selectedEmailLog?.subject || ''}`.trim();
                const totalBrandEmails = brandEmailActivity.length;
                const isEmailComposing = directEmailOpen || Boolean(activeEmailLead);
                const folderTitle = emailMailboxFilter === 'all'
                  ? 'All brand email'
                  : emailMailboxFilter === 'inbox'
                    ? 'Inbox'
                    : emailMailboxFilter === 'sent'
                      ? 'Sent mail'
                      : emailMailboxFilter === 'drafts'
                        ? 'Drafts'
                        : emailMailboxFilter === 'spam'
                          ? 'Spam'
                          : emailMailboxFilter === 'trash'
                            ? 'Trash'
                            : 'Failed sends';
                const selectedFolder = selectedEmailLog?.mailbox_folder || (selectedEmailLog?.status === 'failed' ? 'failed' : selectedEmailLog?.direction === 'inbound' || selectedEmailLog?.status === 'received' ? 'inbox' : 'sent');
                const selectedStatusText = selectedFolder === 'spam'
                  ? 'Spam'
                  : selectedFolder === 'trash'
                    ? 'Trash'
                    : selectedFolder === 'drafts'
                      ? 'Draft'
                      : selectedEmailLog?.status === 'received'
                        ? 'Reply received'
                        : selectedEmailLog?.status === 'failed'
                          ? 'Failed send'
                          : 'Sent';

                return (
                  <>
                    <div className="email-command-bar">
                      <div className="email-title-block">
                        <div className="email-app-mark">
                          <i className="fas fa-envelope-open-text"></i>
                        </div>
                        <div>
                          <h3>Brand Mail Desk</h3>
                          <p>Compose, track, and prepare provider-connected outbound email for every brand.</p>
                        </div>
                      </div>

                      <div className="email-command-actions">
                        <select
                          value={selectedBrandForEmail?.id || ''}
                          onChange={e => {
                            const brand = managedBrands.find(b => b.id === e.target.value);
                            if (brand) {
                              setSelectedBrandForEmail(brand);
                              setActiveEmailLead(null);
                              setEmailStageFilter('all');
                              setEmailSubject('');
                              setEmailContent('');
                              setEmailTemplateSel('');
                              setEmailAttachments([]);
                              setDirectEmailOpen(false);
                              setDirectEmailTo('');
                              setDirectEmailName('');
                              setSelectedEmailLogId('');
                              setEmailReplyBody('');
                              setSelectedEmailAccountId('');
                            }
                          }}
                        >
                          {activeBrands.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                          ))}
                        </select>
                        {emailAccounts.length > 0 && (
                          <select
                            value={selectedEmailAccount?.id || ''}
                            onChange={e => {
                              const account = emailAccounts.find(item => item.id === e.target.value);
                              setSelectedEmailAccountId(e.target.value);
                              if (account?.provider) setEmailProviderMode(account.provider as any);
                            }}
                            title="Choose which brand email account to use for sending"
                          >
                            {emailAccounts.map(account => (
                              <option key={account.id} value={account.id}>{account.label || account.email} ({account.provider})</option>
                            ))}
                          </select>
                        )}
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => {
                            setDirectEmailOpen(true);
                            setActiveEmailLead(null);
                            setEmailSubject('');
                            setEmailContent('');
                            setEmailTemplateSel('');
                            setEmailAttachments([]);
                            setDirectEmailTo('');
                            setDirectEmailName('');
                            setSelectedEmailLogId('');
                            setEmailReplyBody('');
                          }}
                          style={{ background: selectedBrandForEmail?.color, color: '#fff', border: 'none', whiteSpace: 'nowrap' }}
                        >
                          <i className="fas fa-pen"></i> New Email
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => canSyncOutlook ? syncOutlookMessages(selectedBrandForEmail?.id) : syncGmailReplies(selectedBrandForEmail?.id)}
                          disabled={(canSyncOutlook ? outlookSyncing : gmailSyncing) || (!canSyncOutlook && !canSyncGmail)}
                          title={canSyncOutlook ? 'Import recent Outlook messages for this brand' : canSyncGmail ? 'Import recent Gmail replies for this brand' : 'Connect Gmail or Outlook before syncing'}
                          style={{ whiteSpace: 'nowrap', padding: '9px 12px' }}
                        >
                          <i className={`fas ${(gmailSyncing || outlookSyncing) ? 'fa-spinner fa-spin' : 'fa-arrows-rotate'}`}></i> {(gmailSyncing || outlookSyncing) ? 'Syncing' : canSyncOutlook ? 'Sync Outlook' : 'Sync Gmail'}
                        </button>
                      </div>
                    </div>

                    {!isEmailComposing && (
                    <div className="email-readiness-strip">
                      <div>
                        <span>{hasWorkingEmailAccount ? 'Email account ready' : 'No working email connected'}</span>
                        <strong>{selectedEmailAccount?.label || selectedBrandForEmail?.name}</strong>
                      </div>
                      <div>
                        <span>Leads in scope</span>
                        <strong>{brandLeads.length}</strong>
                      </div>
                      <div>
                        <span>Tracked sends</span>
                        <strong>{totalBrandEmails}</strong>
                      </div>
                      <div>
                        <span>Backend handoff</span>
                        <strong>{hasWorkingEmailAccount ? 'brand + account' : 'setup required'}</strong>
                      </div>
                    </div>
                    )}

                    {!isEmailComposing && emailAccounts.length === 0 && (
                      <div className="email-setup-warning">
                        <i className="fas fa-circle-info"></i>
                        <span>No email accounts are connected for {selectedBrandForEmail?.name}. Add one under Integrations &gt; Email before sending or syncing.</span>
                      </div>
                    )}

                    {!isEmailComposing && (
                      <div className="mailbox-focus-strip">
                        <button type="button" onClick={() => { setEmailMailboxFilter('inbox'); setEmailPage(1); setSelectedEmailLogId(''); }}>
                          <i className="fas fa-inbox"></i><span>Inbox</span><strong>{inboxEmails.length}</strong>
                        </button>
                        <button type="button" onClick={() => { setEmailMailboxFilter('sent'); setEmailPage(1); setSelectedEmailLogId(''); }}>
                          <i className="fas fa-paper-plane"></i><span>Sent</span><strong>{sentEmails.length}</strong>
                        </button>
                        <button type="button" onClick={() => { setEmailMailboxFilter('failed'); setEmailPage(1); setSelectedEmailLogId(''); }}>
                          <i className="fas fa-triangle-exclamation"></i><span>Failed</span><strong>{failedEmails.length}</strong>
                        </button>
                        <button type="button" onClick={() => { setDirectEmailOpen(true); setActiveEmailLead(null); setSelectedEmailLogId(''); }}>
                          <i className="fas fa-pen"></i><span>Compose</span><strong>New</strong>
                        </button>
                      </div>
                    )}

                    {!isEmailComposing && (
                      selectedEmailLog ? (
                        <main className="mailbox-reader mailbox-reader--full">
                          <div className="mailbox-reader-toolbar">
                            <button type="button" onClick={() => { setSelectedEmailLogId(''); setEmailReplyBody(''); }}>
                              <i className="fas fa-arrow-left"></i>
                              Back
                            </button>
                            <button
                              type="button"
                              disabled={!replyToEmail}
                              onClick={() => {
                                const replyBox = document.querySelector('.mailbox-reply-box textarea') as HTMLTextAreaElement | null;
                                replyBox?.focus();
                              }}
                            >
                              <i className="fas fa-reply"></i>
                              Reply
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDirectEmailOpen(true);
                                setActiveEmailLead(null);
                                setDirectEmailTo('');
                                setDirectEmailName('');
                                setEmailSubject(forwardSubject);
                                setEmailContent(`<p></p><hr /><p><strong>Forwarded message</strong></p>${selectedEmailLog.html_content || selectedEmailLog.body || ''}`);
                                setEmailTemplateSel('');
                                setEmailReplyBody('');
                              }}
                            >
                              <i className="fas fa-share"></i>
                              Forward
                            </button>
                            <button
                              type="button"
                              className="mailbox-danger-action"
                              onClick={async () => {
                                if (!selectedEmailLog?.id || !confirm('Delete this email record from the CRM?')) return;
                                await handleDeleteEmail(selectedEmailLog.id);
                                setSelectedEmailLogId('');
                                setEmailReplyBody('');
                              }}
                            >
                              <i className="fas fa-trash"></i>
                              Delete
                            </button>
                          </div>
                            <>
                              <div className="mailbox-reader-header">
                                <div>
                                  <span className={`mailbox-status-pill ${selectedFolder === 'spam' || selectedFolder === 'trash' || selectedEmailLog.status === 'failed' ? 'failed' : selectedFolder === 'inbox' ? 'inbound' : 'sent'}`}>
                                    {selectedStatusText}
                                  </span>
                                  <h3>{selectedEmailLog.subject || '(No subject)'}</h3>
                                  <p>
                                    {selectedEmailLog.status === 'received' || selectedEmailLog.direction === 'inbound'
                                      ? `From ${selectedEmailLog.from_email || 'unknown sender'}`
                                      : `To ${selectedEmailLog.to_email || selectedEmailLead?.email || 'recipient'}`}
                                    {' | '}
                                    {selectedEmailLog.created_at ? new Date(selectedEmailLog.created_at).toLocaleString() : 'Recently'}
                                  </p>
                                </div>
                                {selectedEmailLead && (
                                  <button type="button" onClick={() => { setActiveLead(selectedEmailLead); handleSelectBrand(selectedBrandForEmail); loadLeadDetailsHistory(selectedEmailLead.id); }}>
                                    Open lead
                                  </button>
                                )}
                              </div>
                              {selectedEmailLog.error_message && (
                                <div className="mailbox-error">{selectedEmailLog.error_message}</div>
                              )}
                              <div className="mailbox-email-body" dangerouslySetInnerHTML={{ __html: selectedEmailLog.html_content || selectedEmailLog.body || '<p>No message body saved.</p>' }} />
                              {Array.isArray(selectedEmailLog.attachments) && selectedEmailLog.attachments.length > 0 && (
                                <div className="mailbox-attachments">
                                  <strong>Attachments</strong>
                                  <div>
                                    {selectedEmailLog.attachments.map((file: any) => {
                                      const attachmentUrl = `/api/emails/${encodeURIComponent(selectedEmailLog.id)}/attachments/${encodeURIComponent(file.id || file.name || '')}`;
                                      const canOpenFromCrm = Boolean(file.data_base64 || file.provider === 'outgoing');
                                      return (
                                        <span key={file.id || file.name} className="mailbox-attachment-chip">
                                          <i className={`fas ${String(file.mime_type || '').startsWith('image/') ? 'fa-image' : String(file.mime_type || '').includes('pdf') ? 'fa-file-pdf' : 'fa-paperclip'}`}></i>
                                          <strong>{file.name || 'Attachment'}</strong>
                                          {file.size ? <small>{Math.round(Number(file.size) / 1024)} KB</small> : null}
                                          {canOpenFromCrm ? (
                                            <>
                                              <a href={`${attachmentUrl}?inline=1`} target="_blank" rel="noreferrer" title="Open attachment">Open</a>
                                              <a href={attachmentUrl} title="Download attachment" download>Download</a>
                                            </>
                                          ) : (
                                            <em title="This attachment is from a connected provider and must be downloaded from that mailbox sync.">Provider file</em>
                                          )}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                              <form
                                className="mailbox-reply-box"
                                onSubmit={async e => {
                                  e.preventDefault();
                                  if (!replyToEmail) { showToast('This email does not have a reply address.', true); return; }
                                  if (!emailReplyBody.trim()) { showToast('Write a reply first.', true); return; }
                                  setEmailSending(true);
                                  try {
                                    await sendDirectBrandEmail(selectedBrandForEmail, replyToEmail, '', replySubject, emailReplyBody, 'CRM Email Reply');
                                    showToast(`Reply sent to ${replyToEmail}.`);
                                    setEmailReplyBody('');
                                    await fetchAllSentEmails();
                                  } catch (err: any) {
                                    showToast(err?.response?.data?.error_message || err?.response?.data?.detail || 'Could not send reply.', true);
                                  } finally {
                                    setEmailSending(false);
                                  }
                                }}
                              >
                                <div>
                                  <strong>Reply in CRM</strong>
                                  <span>{replyToEmail ? `To ${replyToEmail}` : 'No reply address found'}</span>
                                </div>
                                <textarea value={emailReplyBody} onChange={e => setEmailReplyBody(e.target.value)} placeholder="Write your reply..." />
                                <button type="submit" className="btn btn-primary" disabled={emailSending || !replyToEmail || !emailReplyBody.trim()} style={{ background: selectedBrandForEmail?.color }}>
                                  <i className="fas fa-reply"></i> {emailSending ? 'Sending...' : 'Send reply'}
                                </button>
                              </form>
                            </>
                        </main>
                      ) : (
                        <div className="mailbox-shell mailbox-shell--list">
                          <aside className="mailbox-folders">
                            <button type="button" className={emailMailboxFilter === 'all' ? 'active' : ''} onClick={() => { setEmailMailboxFilter('all'); setSelectedEmailLogId(''); setEmailReplyBody(''); setEmailPage(1); }}>
                              <i className="fas fa-inbox"></i>
                              <span>All Mail</span>
                              <strong>{brandEmailActivity.length}</strong>
                            </button>
                            <button type="button" className={emailMailboxFilter === 'inbox' ? 'active' : ''} onClick={() => { setEmailMailboxFilter('inbox'); setSelectedEmailLogId(''); setEmailReplyBody(''); setEmailPage(1); }}>
                              <i className="fas fa-reply"></i>
                              <span>Inbox</span>
                              <strong>{inboxEmails.length}</strong>
                            </button>
                            <button type="button" className={emailMailboxFilter === 'sent' ? 'active' : ''} onClick={() => { setEmailMailboxFilter('sent'); setSelectedEmailLogId(''); setEmailReplyBody(''); setEmailPage(1); }}>
                              <i className="fas fa-paper-plane"></i>
                              <span>Sent</span>
                              <strong>{sentEmails.length}</strong>
                            </button>
                            <button type="button" className={emailMailboxFilter === 'drafts' ? 'active' : ''} onClick={() => { setEmailMailboxFilter('drafts'); setSelectedEmailLogId(''); setEmailReplyBody(''); setEmailPage(1); }}>
                              <i className="fas fa-file-pen"></i>
                              <span>Drafts</span>
                              <strong>{draftEmails.length}</strong>
                            </button>
                            <button type="button" className={emailMailboxFilter === 'spam' ? 'active' : ''} onClick={() => { setEmailMailboxFilter('spam'); setSelectedEmailLogId(''); setEmailReplyBody(''); setEmailPage(1); }}>
                              <i className="fas fa-ban"></i>
                              <span>Spam</span>
                              <strong>{spamEmails.length}</strong>
                            </button>
                            <button type="button" className={emailMailboxFilter === 'trash' ? 'active' : ''} onClick={() => { setEmailMailboxFilter('trash'); setSelectedEmailLogId(''); setEmailReplyBody(''); setEmailPage(1); }}>
                              <i className="fas fa-trash"></i>
                              <span>Trash</span>
                              <strong>{trashEmails.length}</strong>
                            </button>
                            <button type="button" className={emailMailboxFilter === 'failed' ? 'active' : ''} onClick={() => { setEmailMailboxFilter('failed'); setSelectedEmailLogId(''); setEmailReplyBody(''); setEmailPage(1); }}>
                              <i className="fas fa-triangle-exclamation"></i>
                              <span>Failed</span>
                              <strong>{failedEmails.length}</strong>
                            </button>
                          </aside>

                          <section className="mailbox-list mailbox-list--wide">
                            <div className="mailbox-list-header mailbox-list-header--gmail">
                              <div>
                                <span>{selectedBrandForEmail?.name}</span>
                                <strong>{folderTitle}</strong>
                              </div>
                              <div className="mailbox-list-tools">
                                <div className="mailbox-search">
                                  <i className="fas fa-search"></i>
                                  <input
                                    value={emailSearchQuery}
                                    onChange={e => { setEmailSearchQuery(e.target.value); setEmailPage(1); }}
                                    placeholder="Search email address or subject"
                                  />
                                </div>
                                <button type="button" onClick={() => canSyncOutlook ? syncOutlookMessages(selectedBrandForEmail?.id) : syncGmailReplies(selectedBrandForEmail?.id)} disabled={(canSyncOutlook ? outlookSyncing : gmailSyncing) || (!canSyncOutlook && !canSyncGmail)}>
                                  <i className={`fas ${(gmailSyncing || outlookSyncing) ? 'fa-spinner fa-spin' : 'fa-arrows-rotate'}`}></i>
                                  Refresh
                                </button>
                              </div>
                            </div>
                            <div className="email-provider-filter-row">
                              {([
                                ['all', 'All providers', providerCounts.all],
                                ['gmail', 'Gmail', providerCounts.gmail],
                                ['outlook', 'Outlook', providerCounts.outlook],
                                ['yahoo', 'Yahoo', providerCounts.yahoo],
                                ['smtp', 'SMTP', providerCounts.smtp],
                                ['internal', 'CRM only', providerCounts.internal],
                              ] as const).map(([provider, label, count]) => (
                                <button
                                  key={provider}
                                  type="button"
                                  className={emailProviderFilter === provider ? 'active' : ''}
                                  onClick={() => { setEmailProviderFilter(provider); setEmailPage(1); setSelectedEmailLogId(''); setEmailReplyBody(''); }}
                                >
                                  {label}
                                  <strong>{count}</strong>
                                </button>
                              ))}
                            </div>
                            <div className="mailbox-pagination">
                              <span>
                                {mailboxMessages.length === 0
                                  ? '0 emails'
                                  : `${((safeEmailPage - 1) * emailsPerPage) + 1}-${Math.min(safeEmailPage * emailsPerPage, mailboxMessages.length)} of ${mailboxMessages.length}`}
                              </span>
                              <button type="button" disabled={safeEmailPage <= 1} onClick={() => setEmailPage(prev => Math.max(1, prev - 1))}>
                                <i className="fas fa-chevron-left"></i>
                                Newer
                              </button>
                              <button type="button" disabled={safeEmailPage >= totalEmailPages} onClick={() => setEmailPage(prev => Math.min(totalEmailPages, prev + 1))}>
                                Older
                                <i className="fas fa-chevron-right"></i>
                              </button>
                            </div>
                            <div className="mailbox-message-list mailbox-message-list--gmail">
                              {visibleMailboxMessages.length === 0 ? (
                                <div className="mailbox-empty">
                                  <i className="fas fa-envelope-open"></i>
                                  <span>No emails found.</span>
                                </div>
                              ) : visibleMailboxMessages.map(message => {
                                const isInbound = message.status === 'received' || message.direction === 'inbound';
                                return (
                                  <button
                                    key={message.id}
                                    type="button"
                                    className="mailbox-row"
                                    onClick={() => { setSelectedEmailLogId(message.id); setEmailReplyBody(''); }}
                                  >
                                    <span className="mailbox-row-check"><i className="far fa-square"></i></span>
                                    <span className="mailbox-row-star"><i className="far fa-star"></i></span>
                                    <strong className="mailbox-row-person">{isInbound ? (message.from_email || 'unknown sender') : (message.to_email || 'recipient')}</strong>
                                    <span className="mailbox-row-subject">{message.subject || '(No subject)'}</span>
                                    <span className="mailbox-row-snippet">{Array.isArray(message.attachments) && message.attachments.length > 0 ? '📎 ' : ''}{String(message.html_content || message.body || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 130)}</span>
                                    <time>{message.created_at ? new Date(message.created_at).toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</time>
                                  </button>
                                );
                              })}
                            </div>
                          </section>
                        </div>
                      )
                    )}

                    {isEmailComposing && (
                    <div className={`email-client-shell ${isEmailComposing ? 'email-client-shell--compose' : ''}`}>
                      {!isEmailComposing && (
                      <aside className="email-lead-rail">
                        <div className="email-rail-header">
                          <strong>Lead Queue</strong>
                          <span>{queueLeads.length} visible</span>
                        </div>
                        <div className="email-lead-list">
                          {queueLeads.length === 0 ? (
                            <div className="email-empty-state">
                              <i className="fas fa-inbox"></i>
                              <span>No leads in this filter</span>
                            </div>
                          ) : queueLeads.map(l => {
                            const sentCount = allSentEmails.filter(e => e.lead_id === l.id).length;
                            const isSelected = activeEmailLead?.id === l.id;
                            return (
                              <button
                                key={l.id}
                                type="button"
                                className={`email-lead-item ${isSelected ? 'active' : ''}`}
                                onClick={() => {
                                  setActiveEmailLead(l);
                                  setDirectEmailOpen(false);
                                  setDirectEmailTo('');
                                  setDirectEmailName('');
                                  setEmailSubject(`Hi ${l.name.split(' ')[0]} - Update from ${selectedBrandForEmail?.name}`);
                                  setEmailContent('');
                                  setEmailTemplateSel('');
                                  setEmailAttachments([]);
                                }}
                              >
                                <span className="email-avatar">{l.name.charAt(0)}</span>
                                <span className="email-lead-copy">
                                  <strong>{l.name}</strong>
                                  <small>{l.email || 'No email address'}</small>
                                </span>
                                <em>{sentCount}</em>
                              </button>
                            );
                          })}
                        </div>
                      </aside>
                      )}

                      <main className="email-compose-plane">
                        {directEmailOpen ? (
                          <form
                            className="email-compose-card"
                            onSubmit={async e => {
                              e.preventDefault();
                              if (!directEmailTo.trim() || !emailSubject.trim() || !emailContent.trim()) {
                                showToast('Recipient, subject, and email body are required.', true);
                                return;
                              }
                              setEmailSending(true);
                              try {
                                const outgoingAttachments = await prepareEmailAttachments();
                                await sendDirectBrandEmail(selectedBrandForEmail, directEmailTo, directEmailName, emailSubject, emailContent, emailTemplateSel || 'Direct Brand Email', outgoingAttachments);
                                showToast('Direct email sent from the brand mail desk.');
                                setDirectEmailTo('');
                                setDirectEmailName('');
                                setEmailSubject('');
                                setEmailContent('');
                                setEmailTemplateSel('');
                                setEmailAttachments([]);
                                setDirectEmailOpen(false);
                              } catch (err: any) {
                                showToast(err?.response?.data?.error_message || err?.response?.data?.detail || 'Failed to send direct email.', true);
                              } finally {
                                setEmailSending(false);
                              }
                            }}
                          >
                            <div className="email-compose-top">
                              <div className="email-compose-identity">
                                <div className="email-account-avatar">{(selectedBrandForEmail?.name || 'M').charAt(0)}</div>
                                <div>
                                  <span>New Email</span>
                                  <h4>{selectedBrandForEmail?.name} Mail Desk</h4>
                                  <p>{emailProviderMode === 'gmail' ? 'Connected Gmail mailbox' : emailProviderMode === 'internal' ? 'CRM tracked outbox' : `${emailProviderMode} mailbox slot`}</p>
                                </div>
                              </div>
                              <div className="email-compose-status email-compose-status--live">
                                <i className="fas fa-circle"></i>
                                {getEmailProviderLabel()}
                              </div>
                            </div>

                            <div className="email-mailbox-strip">
                              <div>
                                <span>From</span>
                                <strong>{selectedBrandForEmail?.name} Mail Desk</strong>
                                <small>{emailProviderMode === 'gmail' ? 'Gmail connector' : emailProviderMode === 'internal' ? 'tracked only' : `${emailProviderMode} connector slot`}</small>
                              </div>
                              <div>
                                <span>Draft</span>
                                <strong>Composer ready</strong>
                                <small>No send until confirmed</small>
                              </div>
                            </div>

                            <div className="email-recipient-grid">
                              <label className="premium-field">
                                <span>Recipient email</span>
                                <input
                                  type="email"
                                  placeholder="name@company.com"
                                  value={directEmailTo}
                                  onChange={e => setDirectEmailTo(e.target.value)}
                                />
                              </label>
                              <label className="premium-field">
                                <span>Recipient name</span>
                                <input
                                  type="text"
                                  placeholder="Optional"
                                  value={directEmailName}
                                  onChange={e => setDirectEmailName(e.target.value)}
                                />
                              </label>
                            </div>

                            {directEmailTo.trim() && (
                              <div className="email-recipient-chips">
                                <span className="recipient-chip">
                                  <i className="fas fa-user"></i>
                                  {directEmailName || directEmailTo}
                                  <small>{directEmailTo}</small>
                                </span>
                              </div>
                            )}

                            <div className="email-template-row">
                              <div>
                                <span>Template</span>
                                <strong>{emailTemplateSel || 'Custom email'}</strong>
                              </div>
                              <button type="button" className="email-ai-pill" title="Template preview">
                                <i className="fas fa-wand-magic-sparkles"></i> Preview
                              </button>
                            </div>

                            <select
                              className="email-template-picker"
                              value={emailTemplateSel}
                              onChange={e => {
                                const val = e.target.value;
                                setEmailTemplateSel(val);
                                if (val === 'custom') {
                                  setEmailTemplateSel('');
                                  return;
                                }
                                const savedEmailTemplates = messageTemplates
                                  .filter(t => t.brand_id === selectedBrandForEmail?.id && t.channel === 'email' && t.is_active !== false)
                                  .map(t => ({ id: t.id, name: t.name, subject: t.subject || '', body: t.body }));
                                const matched = [...savedEmailTemplates, ...(EMAIL_TEMPLATES[selectedBrandForEmail?.id || ''] || [])].find(tp => tp.name === val);
                                if (matched) {
                                  const tempLead = {
                                    id: 'direct-email',
                                    brand_id: selectedBrandForEmail.id,
                                    brand_name: selectedBrandForEmail.name,
                                    name: directEmailName || directEmailTo || 'there',
                                    email: directEmailTo,
                                    phone: '',
                                    funnel_stage: 'Direct Email',
                                    tags: [],
                                    custom_fields: {},
                                    created_at: new Date().toISOString()
                                  } as Lead;
                                  setEmailSubject(applyEmailTemplateVars(matched.subject, tempLead, selectedBrandForEmail));
                                  setEmailContent(applyEmailTemplateVars(matched.body, tempLead, selectedBrandForEmail));
                                }
                              }}
                            >
                              <option value="custom">Custom email</option>
                              <option value="" disabled>Use a saved template</option>
                              {[
                                ...messageTemplates
                                  .filter(t => t.brand_id === selectedBrandForEmail?.id && t.channel === 'email' && t.is_active !== false)
                                  .map(t => ({ id: t.id, name: t.name })),
                                ...(EMAIL_TEMPLATES[selectedBrandForEmail?.id || ''] || [])
                              ].map(tp => (
                                <option key={tp.id} value={tp.name}>{tp.name}</option>
                              ))}
                            </select>

                            <label className="premium-field premium-field--flat">
                              <span>Subject</span>
                              <input
                                type="text"
                                placeholder="Write a clear subject line"
                                value={emailSubject}
                                onChange={e => setEmailSubject(e.target.value)}
                              />
                            </label>

                            <div className="email-format-toolbar" aria-label="Email formatting shortcuts">
                              {['B', 'I', 'Link', 'List', 'Quote'].map(item => (
                                <button key={item} type="button" title={`${item} formatting placeholder`}>{item}</button>
                              ))}
                              <span></span>
                              <button type="button" title="Attach files" onClick={() => emailAttachmentInputRef.current?.click()}><i className="fas fa-paperclip"></i></button>
                              <button type="button" title="Insert template variable"><i className="fas fa-code"></i></button>
                              <button type="button" title="AI writing assist"><i className="fas fa-wand-magic-sparkles"></i></button>
                            </div>

                            <textarea
                              className="email-body-editor"
                              placeholder="Write a standalone email from this brand. If Gmail is connected, this will send through Gmail."
                              value={emailContent}
                              onChange={e => setEmailContent(e.target.value)}
                            />

                            <input
                              ref={emailAttachmentInputRef}
                              type="file"
                              multiple
                              className="email-file-input"
                              onChange={e => {
                                if (e.target.files) addEmailAttachmentFiles(e.target.files);
                                e.currentTarget.value = '';
                              }}
                            />

                            <div
                              className="email-attachment-zone"
                              onClick={() => emailAttachmentInputRef.current?.click()}
                              onDragOver={e => e.preventDefault()}
                              onDrop={e => {
                                e.preventDefault();
                                addEmailAttachmentFiles(e.dataTransfer.files);
                              }}
                            >
                              <i className="fas fa-paperclip"></i>
                              <div>
                                <strong>Attachments</strong>
                                <span>{emailAttachments.length ? `${emailAttachments.length} file${emailAttachments.length === 1 ? '' : 's'} selected` : 'Click to attach files or drag them here.'}</span>
                              </div>
                              <button type="button" onClick={e => { e.stopPropagation(); emailAttachmentInputRef.current?.click(); }}>Attach</button>
                            </div>

                            {emailAttachments.length > 0 && (
                              <div className="email-selected-attachments">
                                {emailAttachments.map(file => (
                                  <span key={`${file.name}-${file.size}-${file.lastModified}`}>
                                    <i className={`fas ${file.type.startsWith('image/') ? 'fa-image' : file.type.includes('pdf') ? 'fa-file-pdf' : 'fa-file-lines'}`}></i>
                                    <strong>{file.name}</strong>
                                    <small>{Math.ceil(file.size / 1024)} KB</small>
                                    <button type="button" onClick={() => setEmailAttachments(files => files.filter(item => item !== file))}>
                                      <i className="fas fa-xmark"></i>
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}

                            <div className="email-signature-preview">
                              <span>Signature preview</span>
                              <p>{selectedBrandForEmail?.name} Team</p>
                            </div>

                            <div className="email-compose-footer">
                              <div>
                                <strong>Standalone brand email</strong>
                                <span>This send will be tracked under {selectedBrandForEmail?.name} once sent.</span>
                              </div>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button type="button" className="btn btn-ghost" onClick={() => { setDirectEmailOpen(false); setEmailSubject(''); setEmailContent(''); setEmailTemplateSel(''); setEmailAttachments([]); }}>
                                  Cancel
                                </button>
                                <button type="button" className="btn btn-ghost">
                                  <i className="fas fa-clock"></i> Send later
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={emailSending || !directEmailTo.trim()} style={{ background: selectedBrandForEmail?.color }}>
                                  {emailSending ? 'Sending...' : <><i className="fas fa-paper-plane"></i> Send email</>}
                                </button>
                              </div>
                            </div>
                          </form>
                        ) : activeEmailLead ? (
                          <form
                            className="email-compose-card"
                            onSubmit={async e => {
                              e.preventDefault();
                              if (!emailSubject.trim() || !emailContent.trim()) {
                                showToast('Subject and email body are required.', true);
                                return;
                              }
                              setEmailSending(true);
                              try {
                                const outgoingAttachments = await prepareEmailAttachments();
                                await sendTrackedEmail(activeEmailLead, emailSubject, emailContent, selectedBrandForEmail, emailTemplateSel || 'Manual Ad-hoc Mail', outgoingAttachments);
                                showToast('Email logged in the brand outbox.');
                                setEmailSubject('');
                                setEmailContent('');
                                setEmailTemplateSel('');
                                setEmailAttachments([]);
                              } catch {
                                showToast('Failed to send mail.', true);
                              } finally {
                                setEmailSending(false);
                              }
                            }}
                          >
                            <div className="email-compose-top">
                              <div className="email-compose-identity">
                                <div className="email-account-avatar">{activeEmailLead.name.charAt(0)}</div>
                                <div>
                                  <span>Compose</span>
                                  <h4>{activeEmailLead.name}</h4>
                                  <p>{activeEmailLead.email || 'No email address'} · {activeEmailLead.funnel_stage}</p>
                                </div>
                              </div>
                              <div className="email-compose-status email-compose-status--live">
                                <i className="fas fa-circle"></i>
                                {getEmailProviderLabel()}
                              </div>
                            </div>

                            <div className="email-mailbox-strip">
                              <div>
                                <span>From</span>
                                <strong>{selectedBrandForEmail?.name} Mail Desk</strong>
                                <small>{emailProviderMode === 'internal' ? 'tracked only' : `${emailProviderMode} connector slot`}</small>
                              </div>
                              <div>
                                <span>To</span>
                                <strong>{activeEmailLead.email || 'Missing email'}</strong>
                                <small>{activeEmailLead.funnel_stage}</small>
                              </div>
                              <div>
                                <span>Draft</span>
                                <strong>Composer ready</strong>
                                <small>No send until confirmed</small>
                              </div>
                            </div>

                            <div className="email-recipient-chips">
                              <span className="recipient-chip">
                                <i className="fas fa-user"></i>
                                {activeEmailLead.name}
                                <small>{activeEmailLead.email || 'Missing email'}</small>
                              </span>
                            </div>

                            <div className="email-template-row">
                              <div>
                                <span>Template</span>
                                <strong>{emailTemplateSel || 'Custom email'}</strong>
                              </div>
                              <button type="button" className="email-ai-pill" title="Template preview">
                                <i className="fas fa-wand-magic-sparkles"></i> Preview
                              </button>
                            </div>

                            <select
                              className="email-template-picker"
                              value={emailTemplateSel}
                              onChange={e => {
                                const val = e.target.value;
                                setEmailTemplateSel(val);
                                if (val === 'custom') {
                                  setEmailTemplateSel('');
                                  return;
                                }
                                const savedEmailTemplates = messageTemplates
                                  .filter(t => t.brand_id === selectedBrandForEmail?.id && t.channel === 'email' && t.is_active !== false)
                                  .map(t => ({ id: t.id, name: t.name, subject: t.subject || '', body: t.body }));
                                const matched = [...savedEmailTemplates, ...(EMAIL_TEMPLATES[selectedBrandForEmail?.id || ''] || [])].find(tp => tp.name === val);
                                if (matched) {
                                  setEmailSubject(applyEmailTemplateVars(matched.subject, activeEmailLead, selectedBrandForEmail));
                                  setEmailContent(applyEmailTemplateVars(matched.body, activeEmailLead, selectedBrandForEmail));
                                }
                              }}
                            >
                              <option value="custom">Custom email</option>
                              <option value="" disabled>Use a saved template</option>
                              {[
                                ...messageTemplates
                                  .filter(t => t.brand_id === selectedBrandForEmail?.id && t.channel === 'email' && t.is_active !== false)
                                  .map(t => ({ id: t.id, name: t.name })),
                                ...(EMAIL_TEMPLATES[selectedBrandForEmail?.id || ''] || [])
                              ].map(tp => (
                                <option key={tp.id} value={tp.name}>{tp.name}</option>
                              ))}
                            </select>

                            <label className="premium-field premium-field--flat">
                              <span>Subject</span>
                              <input
                                type="text"
                                placeholder="Write a clear subject line"
                                value={emailSubject}
                                onChange={e => setEmailSubject(e.target.value)}
                              />
                            </label>

                            <div className="email-format-toolbar" aria-label="Email formatting shortcuts">
                              {['B', 'I', 'Link', 'List', 'Quote'].map(item => (
                                <button key={item} type="button" title={`${item} formatting placeholder`}>{item}</button>
                              ))}
                              <span></span>
                              <button type="button" title="Attach files" onClick={() => emailAttachmentInputRef.current?.click()}><i className="fas fa-paperclip"></i></button>
                              <button type="button" title="Insert template variable"><i className="fas fa-code"></i></button>
                            </div>

                            <textarea
                              className="email-body-editor"
                              placeholder="Write the email body here. Plain text and HTML snippets can both be logged now, then mapped to a real provider later."
                              value={emailContent}
                              onChange={e => setEmailContent(e.target.value)}
                            />

                            <input
                              ref={emailAttachmentInputRef}
                              type="file"
                              multiple
                              className="email-file-input"
                              onChange={e => {
                                if (e.target.files) addEmailAttachmentFiles(e.target.files);
                                e.currentTarget.value = '';
                              }}
                            />

                            <div
                              className="email-attachment-zone"
                              onClick={() => emailAttachmentInputRef.current?.click()}
                              onDragOver={e => e.preventDefault()}
                              onDrop={e => {
                                e.preventDefault();
                                addEmailAttachmentFiles(e.dataTransfer.files);
                              }}
                            >
                              <i className="fas fa-paperclip"></i>
                              <div>
                                <strong>Attachments</strong>
                                <span>{emailAttachments.length ? `${emailAttachments.length} file${emailAttachments.length === 1 ? '' : 's'} selected` : 'Click to attach files or drag them here.'}</span>
                              </div>
                              <button type="button" onClick={e => { e.stopPropagation(); emailAttachmentInputRef.current?.click(); }}>Attach</button>
                            </div>

                            {emailAttachments.length > 0 && (
                              <div className="email-selected-attachments">
                                {emailAttachments.map(file => (
                                  <span key={`${file.name}-${file.size}-${file.lastModified}`}>
                                    <i className={`fas ${file.type.startsWith('image/') ? 'fa-image' : file.type.includes('pdf') ? 'fa-file-pdf' : 'fa-file-lines'}`}></i>
                                    <strong>{file.name}</strong>
                                    <small>{Math.ceil(file.size / 1024)} KB</small>
                                    <button type="button" onClick={() => setEmailAttachments(files => files.filter(item => item !== file))}>
                                      <i className="fas fa-xmark"></i>
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}

                            <div className="email-signature-preview">
                              <span>Signature preview</span>
                              <p>{selectedBrandForEmail?.name} Team</p>
                            </div>

                            <div className="email-compose-footer">
                              <div>
                                <strong>Lead-linked email</strong>
                                <span>This message will be tracked on {activeEmailLead.name}'s timeline once sent.</span>
                              </div>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button type="button" className="btn btn-ghost" onClick={() => { setActiveEmailLead(null); setEmailSubject(''); setEmailContent(''); setEmailTemplateSel(''); setEmailAttachments([]); }}>
                                  Cancel
                                </button>
                                <button type="button" className="btn btn-ghost">
                                  <i className="fas fa-clock"></i> Send later
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={emailSending || !activeEmailLead.email} style={{ background: selectedBrandForEmail?.color }}>
                                  {emailSending ? 'Sending...' : <><i className="fas fa-paper-plane"></i> Send tracked email</>}
                                </button>
                              </div>
                            </div>
                          </form>
                        ) : (
                          <div className="email-compose-empty">
                            <i className="fas fa-pen-nib"></i>
                            <h4>Pick a lead to compose</h4>
                            <p>The lead list stays nearby, but the main area is reserved for writing and previewing the email.</p>
                          </div>
                        )}
                      </main>

                      {!isEmailComposing && (
                      <aside className="email-context-rail">
                        <div className="email-context-card">
                          <span>Selected Lead</span>
                          {directEmailOpen ? (
                            <>
                              <h4>Standalone Email</h4>
                              <p>{directEmailTo || 'No recipient yet'} | {selectedBrandForEmail?.name}</p>
                            </>
                          ) : activeEmailLead ? (
                            <>
                              <h4>{activeEmailLead.name}</h4>
                              <p>{activeEmailLead.owner_name || 'Unassigned'} | {activeEmailLead.funnel_stage}</p>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveLead(activeEmailLead);
                                  const brand = managedBrands.find(b => b.id === activeEmailLead.brand_id);
                                  if (brand) handleSelectBrand(brand);
                                  loadLeadDetailsHistory(activeEmailLead.id);
                                }}
                              >
                                Open full lead record
                              </button>
                            </>
                          ) : (
                            <p>No lead selected.</p>
                          )}
                        </div>

                        <div className="email-context-card">
                          <span>Email History</span>
                          {directEmailOpen ? (
                            <p>Standalone emails are tracked at brand level after sending.</p>
                          ) : selectedHistory.length > 0 ? (
                            <div className="email-history-list">
                              {selectedHistory.slice(0, 6).map(he => (
                                <div key={he.id} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                    <strong>{he.subject}</strong>
                                    {he.opened_at ? (
                                      <span title={`First opened: ${new Date(he.opened_at).toLocaleString()}${(he.open_count || 0) > 1 ? ` · opened ${he.open_count}×` : ''}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '1px 6px', borderRadius: '20px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', fontSize: '10px', fontWeight: '700', cursor: 'default' }}>
                                        <i className="fas fa-envelope-open" style={{ fontSize: '9px' }}></i>
                                        Opened{(he.open_count || 0) > 1 ? ` ×${he.open_count}` : ''}
                                      </span>
                                    ) : he.status !== 'failed' ? (
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '1px 6px', borderRadius: '20px', background: 'rgba(148,163,184,0.10)', border: '1px solid rgba(148,163,184,0.2)', color: 'var(--text-muted)', fontSize: '10px', fontWeight: '600', cursor: 'default' }}>
                                        <i className="fas fa-envelope" style={{ fontSize: '9px' }}></i>
                                        Not opened
                                      </span>
                                    ) : null}
                                  </div>
                                  <small>{he.template_name || 'Standard Email'} | {he.created_at ? new Date(he.created_at).toLocaleString() : 'Recently'}</small>
                                </div>
                              ))}
                            </div>
                          ) : !activeEmailLead && brandEmailActivity.length > 0 ? (
                            <div className="email-history-list">
                              {brandEmailActivity.slice(0, 8).map(he => (
                                <div key={he.id} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                    <strong>{he.subject || '(No subject)'}</strong>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '1px 6px', borderRadius: '20px', background: he.status === 'received' ? 'rgba(34,197,94,0.12)' : he.status === 'failed' ? 'rgba(239,68,68,0.12)' : 'rgba(99,102,241,0.10)', border: '1px solid rgba(148,163,184,0.22)', color: he.status === 'received' ? '#16a34a' : he.status === 'failed' ? '#ef4444' : '#6366f1', fontSize: '10px', fontWeight: '700' }}>
                                      <i className={`fas ${he.status === 'received' ? 'fa-reply' : he.status === 'failed' ? 'fa-triangle-exclamation' : 'fa-paper-plane'}`} style={{ fontSize: '9px' }}></i>
                                      {he.status === 'received' ? 'Reply' : he.status === 'failed' ? 'Failed' : 'Sent'}
                                    </span>
                                  </div>
                                  <small>
                                    {he.status === 'received'
                                      ? `From ${he.from_email || 'unknown sender'}`
                                      : `To ${he.to_email || 'lead email'}`}
                                    {' | '}
                                    {he.created_at ? new Date(he.created_at).toLocaleString() : 'Recently'}
                                  </small>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p>{activeEmailLead ? 'No previous emails logged for this lead.' : 'No brand email activity yet. Sent tests, direct emails, blasts, and synced replies will appear here.'}</p>
                          )}
                        </div>

                        <div className="email-context-card">
                          <span>Connector Notes</span>
                          <p>Each brand keeps its own sender context, so Gmail, Outlook, or SMTP credentials can be connected per brand without changing the composer.</p>
                        </div>
                      </aside>
                      )}
                    </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}


          {activeTab === 'whatsapp-tracking' && (
            (() => {
              const allBrandContacts = leads.filter(l => l.brand_id === selectedBrandForWhatsApp.id);
              const brandContacts = allBrandContacts
                .filter(contact => allWhatsAppMessages.some(m => m.lead_id === contact.id))
                .filter(l => {
                  const q = waContactSearch.trim().toLowerCase();
                  return !q || [l.name, l.phone, l.email, l.funnel_stage].some(value => String(value || '').toLowerCase().includes(q));
                });
              const pickerContacts = allBrandContacts.filter(l => {
                const q = waPickerSearch.trim().toLowerCase();
                return !q || [l.name, l.phone, l.email, l.funnel_stage, l.custom_fields?.property_location].some(value => String(value || '').toLowerCase().includes(q));
              });
              const brandMessages = allWhatsAppMessages.filter(m => m.brand_id === selectedBrandForWhatsApp.id || leads.some(l => l.brand_id === selectedBrandForWhatsApp.id && l.id === m.lead_id));
              const activeMessages = activeWhatsAppLead
                ? allWhatsAppMessages.filter(m => m.lead_id === activeWhatsAppLead.id).sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')))
                : [];
              const apiReady = isWhatsAppCloudConfigured(getBrandIntegrationFor(selectedBrandForWhatsApp.id), selectedBrandForWhatsApp.id);

              const sendActiveWhatsApp = async () => {
                if (!activeWhatsAppLead || !waDashboardMessage.trim() || !activeWhatsAppLead.phone) return;
                try {
                  const fromNum = whatsappNumbers[selectedBrandForWhatsApp.id] || '';
                  const toNum = activeWhatsAppLead.phone.replace(/[^0-9+]/g, '');
                  if (!apiReady) window.open(`https://wa.me/${toNum}?text=${encodeURIComponent(waDashboardMessage)}`, '_blank');
                  await axios.post('/api/whatsapp/send', {
                    lead_id: activeWhatsAppLead.id,
                    brand_id: selectedBrandForWhatsApp.id,
                    message: waDashboardMessage,
                    from_number: fromNum,
                    to_number: activeWhatsAppLead.phone,
                    template_name: 'Manual',
                    status: 'sent',
                    log_only: !apiReady
                  });
                  await fetchAllWhatsAppMessages(selectedBrandForWhatsApp.id);
                  setWaDashboardMessage('');
                  showToast(apiReady ? 'WhatsApp sent in CRM.' : 'WhatsApp opened and logged.');
                } catch {
                  showToast('Failed to send WhatsApp message.', true);
                }
              };

              return (
                <div className="wa-inbox-shell">
                  <aside className="wa-inbox-sidebar">
                    <div className="wa-inbox-title">
                      <div>
                        <h3>Chats</h3>
                        <span>{selectedBrandForWhatsApp.name} WhatsApp history</span>
                      </div>
                      <button type="button" onClick={() => { setWaContactPickerOpen(true); setWaPickerSearch(''); setWaPickerSelectedIds(new Set()); }}>
                        <i className="fas fa-plus"></i>
                      </button>
                    </div>
                    <select
                      className="wa-brand-select"
                      value={selectedBrandForWhatsApp.id}
                      onChange={e => {
                        const brand = managedBrands.find(b => b.id === e.target.value) || activeBrands[0] || BRANDS[0];
                        setSelectedBrandForWhatsApp(brand);
                        setActiveWhatsAppLead(null);
                        setDirectWhatsAppOpen(false);
                        setWaDashboardMessage('');
                        fetchAllWhatsAppMessages(brand.id);
                      }}
                    >
                      {activeBrands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                    <div className="wa-inbox-search">
                      <i className="fas fa-search"></i>
                      <input value={waContactSearch} onChange={e => setWaContactSearch(e.target.value)} placeholder="Search chats" />
                    </div>
                    <div className="wa-filter-row">
                      <span>Chats {brandContacts.length}</span>
                      <span>{brandMessages.length} messages</span>
                      <button type="button" onClick={() => { setWaContactPickerOpen(true); setWaPickerSearch(''); setWaPickerSelectedIds(new Set()); }} title="Open contacts">
                        <i className="fas fa-address-book"></i>
                      </button>
                      <button type="button" onClick={() => { fetchAllWhatsAppMessages(selectedBrandForWhatsApp.id); fetchLeadsForEmailBrand(selectedBrandForWhatsApp.id); }}>
                        <i className="fas fa-arrows-rotate"></i>
                      </button>
                    </div>
                    <div className="wa-chat-list">
                      <button type="button" className={`wa-chat-contact ${directWhatsAppOpen ? 'active' : ''}`} onClick={() => { setDirectWhatsAppOpen(true); setActiveWhatsAppLead(null); setDirectWhatsAppNumber(''); setDirectWhatsAppName(''); setWaDashboardMessage(''); }}>
                        <span className="wa-contact-avatar standalone"><i className="fas fa-plus"></i></span>
                        <span>
                          <strong>New number</strong>
                          <small>Send to a WhatsApp number</small>
                        </span>
                      </button>
                      {brandContacts.map(contact => {
                        const messages = allWhatsAppMessages.filter(m => m.lead_id === contact.id).sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
                        const latest = messages[0];
                        return (
                          <button
                            key={contact.id}
                            type="button"
                            className={`wa-chat-contact ${activeWhatsAppLead?.id === contact.id ? 'active' : ''}`}
                            onClick={() => {
                              setActiveWhatsAppLead(contact);
                              setDirectWhatsAppOpen(false);
                              setWaDashboardMessage('');
                            }}
                          >
                            <span className="wa-contact-avatar">{(contact.name || '?').charAt(0)}</span>
                            <span>
                              <strong>{contact.name}</strong>
                              <small>{latest?.message || contact.phone || 'No phone number'}</small>
                            </span>
                            <time>{latest?.created_at ? new Date(latest.created_at).toLocaleDateString() : contact.funnel_stage}</time>
                          </button>
                        );
                      })}
                      {brandContacts.length === 0 && <p className="wa-empty-list">No WhatsApp chats yet. Click + or Contacts to start from brand contacts.</p>}
                    </div>
                  </aside>

                  <section className="wa-conversation">
                    <div className="wa-conversation-header">
                      <div className="wa-contact-avatar">{directWhatsAppOpen ? '#' : activeWhatsAppLead ? activeWhatsAppLead.name.charAt(0) : selectedBrandForWhatsApp.name.charAt(0)}</div>
                      <div>
                        <h3>{directWhatsAppOpen ? 'New WhatsApp chat' : activeWhatsAppLead?.name || 'Select a contact'}</h3>
                        <span>{directWhatsAppOpen ? selectedBrandForWhatsApp.name : activeWhatsAppLead?.phone || 'Contacts are filtered by selected brand'}</span>
                      </div>
                      <div className={`wa-api-pill ${apiReady ? 'ready' : ''}`}>
                        <i className="fas fa-circle"></i>{apiReady ? 'API ready' : 'Manual mode'}
                      </div>
                    </div>

                    <div className="wa-conversation-body">
                      {directWhatsAppOpen ? (
                        <div className="wa-direct-card">
                          <input value={directWhatsAppNumber} onChange={e => setDirectWhatsAppNumber(e.target.value)} placeholder="WhatsApp number" />
                          <input value={directWhatsAppName} onChange={e => setDirectWhatsAppName(e.target.value)} placeholder="Contact name optional" />
                        </div>
                      ) : activeWhatsAppLead ? (
                        activeMessages.length > 0 ? activeMessages.map(message => (
                          <article key={message.id} className={`wa-message ${message.direction === 'inbound' ? 'received' : 'sent'}`}>
                            <p>{message.message}</p>
                            <time>{message.created_at ? new Date(message.created_at).toLocaleString() : 'Logged'} · {message.status || 'sent'}</time>
                          </article>
                        )) : (
                          <div className="wa-start-state">
                            <i className="fab fa-whatsapp"></i>
                            <strong>No messages with this contact yet</strong>
                            <span>Write below to start the conversation.</span>
                          </div>
                        )
                      ) : (
                        <div className="wa-start-state">
                          <i className="fab fa-whatsapp"></i>
                          <strong>Choose a contact</strong>
                          <span>Use the chat list to open a brand contact or start a new number.</span>
                        </div>
                      )}
                    </div>

                    <div className="wa-message-composer">
                      <textarea value={waDashboardMessage} onChange={e => setWaDashboardMessage(e.target.value)} placeholder={activeWhatsAppLead || directWhatsAppOpen ? 'Type a message' : 'Select a contact to message'} disabled={!activeWhatsAppLead && !directWhatsAppOpen} />
                      <button
                        type="button"
                        disabled={!waDashboardMessage.trim() || (!activeWhatsAppLead && (!directWhatsAppOpen || !directWhatsAppNumber.trim()))}
                        onClick={async () => {
                          if (directWhatsAppOpen) {
                            if (!directWhatsAppNumber.trim()) { showToast('Add a WhatsApp number first.', true); return; }
                            await sendDirectWhatsApp(selectedBrandForWhatsApp.id, directWhatsAppNumber, waDashboardMessage, 'Direct WhatsApp');
                            setDirectWhatsAppOpen(false);
                            setDirectWhatsAppNumber('');
                            setDirectWhatsAppName('');
                            setWaDashboardMessage('');
                            showToast(apiReady ? 'WhatsApp sent in CRM.' : 'WhatsApp opened and logged.');
                          } else {
                            await sendActiveWhatsApp();
                          }
                        }}
                      >
                        <i className="fas fa-paper-plane"></i>
                      </button>
                    </div>
                  </section>

                  {waContactPickerOpen && (
                    <div className="wa-contact-picker-backdrop">
                      <div className="wa-contact-picker">
                        <div className="wa-contact-picker-head">
                          <div>
                            <span>{selectedBrandForWhatsApp.name}</span>
                            <h3>Choose WhatsApp contacts</h3>
                          </div>
                          <button type="button" onClick={() => setWaContactPickerOpen(false)}>
                            <i className="fas fa-xmark"></i>
                          </button>
                        </div>
                        <div className="wa-picker-search">
                          <i className="fas fa-search"></i>
                          <input value={waPickerSearch} onChange={e => setWaPickerSearch(e.target.value)} placeholder="Search contacts by name, phone, email, or location" />
                        </div>
                        <div className="wa-picker-actions">
                          <button
                            type="button"
                            onClick={() => setWaPickerSelectedIds(new Set(pickerContacts.filter(l => l.phone).map(l => l.id)))}
                          >
                            Select all with phone
                          </button>
                          <button type="button" onClick={() => setWaPickerSelectedIds(new Set())}>Clear</button>
                          <strong>{waPickerSelectedIds.size} selected</strong>
                        </div>
                        <div className="wa-picker-list">
                          {pickerContacts.map(contact => {
                            const checked = waPickerSelectedIds.has(contact.id);
                            const hasChat = allWhatsAppMessages.some(m => m.lead_id === contact.id);
                            return (
                              <label key={contact.id} className={`wa-picker-contact ${checked ? 'checked' : ''} ${!contact.phone ? 'disabled' : ''}`}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={!contact.phone}
                                  onChange={e => setWaPickerSelectedIds(prev => {
                                    const next = new Set(prev);
                                    if (e.target.checked) next.add(contact.id); else next.delete(contact.id);
                                    return next;
                                  })}
                                />
                                <span className="wa-contact-avatar">{(contact.name || '?').charAt(0)}</span>
                                <span>
                                  <strong>{contact.name}</strong>
                                  <small>{contact.phone || 'No WhatsApp number'}{contact.custom_fields?.property_location ? ` · ${contact.custom_fields.property_location}` : ''}</small>
                                </span>
                                {hasChat && <em>Has chat</em>}
                              </label>
                            );
                          })}
                          {pickerContacts.length === 0 && <p className="wa-empty-list">No matching contacts.</p>}
                        </div>
                        <div className="wa-picker-footer">
                          <button type="button" className="btn btn-ghost" onClick={() => { setDirectWhatsAppOpen(true); setActiveWhatsAppLead(null); setWaContactPickerOpen(false); }}>
                            <i className="fas fa-hashtag"></i> New number
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            disabled={waPickerSelectedIds.size !== 1}
                            onClick={() => {
                              const contact = allBrandContacts.find(l => l.id === Array.from(waPickerSelectedIds)[0]);
                              if (!contact) return;
                              setActiveWhatsAppLead(contact);
                              setDirectWhatsAppOpen(false);
                              setWaDashboardMessage('');
                              setWaContactPickerOpen(false);
                            }}
                          >
                            <i className="fab fa-whatsapp"></i> Open chat
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={waPickerSelectedIds.size === 0}
                            onClick={() => {
                              const ids = new Set(Array.from(waPickerSelectedIds).filter(id => allBrandContacts.find(l => l.id === id)?.phone));
                              if (ids.size === 0) {
                                showToast('Select contacts with WhatsApp numbers first.', true);
                                return;
                              }
                              setSelectedBrand(selectedBrandForWhatsApp);
                              setSelectedLeadIds(ids);
                              setBulkWhatsAppMessage('');
                              setBulkWhatsAppProgress(null);
                              setWaContactPickerOpen(false);
                              setBulkWhatsAppModalOpen(true);
                            }}
                          >
                            <i className="fas fa-paper-plane"></i> Bulk message
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()
          )}

          {activeTab === 'whatsapp-tracking-legacy' && (
            <div style={{ animation: 'fadeIn 0.3s' }}>

              {/* Header bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(37,211,102,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="fab fa-whatsapp" style={{ fontSize: '22px', color: '#25D366' }}></i>
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)' }}>WhatsApp Business Centre</h3>
                    <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: 'var(--text-muted)' }}>Compose, track, and manage WhatsApp outreach per brand</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {(() => {
                    const integration = getBrandIntegrationFor(selectedBrandForWhatsApp.id);
                    const apiReady = isWhatsAppCloudConfigured(integration, selectedBrandForWhatsApp.id);
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: apiReady ? 'rgba(37,211,102,0.1)' : 'rgba(245,158,11,0.1)', border: apiReady ? '1px solid rgba(37,211,102,0.3)' : '1px solid rgba(245,158,11,0.3)', borderRadius: '8px', padding: '6px 12px' }}>
                        <i className="fas fa-circle" style={{ fontSize: '7px', color: apiReady ? '#25D366' : '#f59e0b' }}></i>
                        <span style={{ fontSize: '11.5px', fontWeight: 700, color: apiReady ? '#25D366' : '#f59e0b' }}>
                          {apiReady ? 'WhatsApp Business: API Ready' : 'WhatsApp Business: Manual Mode'}
                        </span>
                      </div>
                    );
                  })()}
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setDirectWhatsAppOpen(true);
                      setActiveWhatsAppLead(null);
                      setDirectWhatsAppNumber('');
                      setDirectWhatsAppName('');
                      setWaDashboardMessage('');
                      setWaTemplateSel('');
                    }}
                    style={{ background: '#25D366', border: 'none', color: '#fff', whiteSpace: 'nowrap' }}
                  >
                    <i className="fab fa-whatsapp"></i> New Chat
                  </button>
                  <select value={selectedBrandForWhatsApp.id} onChange={e => { const brand = managedBrands.find(b => b.id === e.target.value) || activeBrands[0] || BRANDS[0]; setSelectedBrandForWhatsApp(brand); setActiveWhatsAppLead(null); setDirectWhatsAppOpen(false); setDirectWhatsAppNumber(''); setDirectWhatsAppName(''); setWaDashboardMessage(''); setWaTemplateSel(''); fetchAllWhatsAppMessages(brand.id); }} style={{ padding: '8px 14px', borderRadius: '9px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 600, fontSize: '13px' }}>
                    {activeBrands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Stats row */}
              {!(directWhatsAppOpen || activeWhatsAppLead) && (() => {
                const brandLeads = leads.filter(l => l.brand_id === selectedBrandForWhatsApp.id);
                const brandMessages = allWhatsAppMessages.filter(m => m.brand_id === selectedBrandForWhatsApp.id || brandLeads.some(l => l.id === m.lead_id));
                const missingPhones = brandLeads.filter(l => !l.phone).length;
                const due = brandLeads.filter(l => getFollowUpStatus(l).urgent).length;
                const contacted = brandLeads.filter(l => allWhatsAppMessages.some(m => m.lead_id === l.id)).length;
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                      {[
                        { label: 'Total Leads', value: brandLeads.length, icon: 'fa-users', color: '#25D366' },
                        { label: 'Messages Sent', value: brandMessages.length, icon: 'fa-comment-dots', color: '#3b82f6' },
                        { label: 'Contacted', value: contacted, icon: 'fa-check-circle', color: '#10b981' },
                        { label: 'Follow-Up Due', value: due, icon: 'fa-bell', color: due > 0 ? '#ef4444' : 'var(--text-muted)' },
                      ].map(stat => (
                        <div key={stat.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${stat.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <i className={`fas ${stat.icon}`} style={{ color: stat.color, fontSize: '16px' }}></i>
                          </div>
                          <div>
                            <div style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>{stat.value}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, marginTop: '3px' }}>{stat.label}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {missingPhones > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '10px', padding: '8px 14px', fontSize: '12.5px', color: '#d97706', fontWeight: 600 }}>
                        <i className="fas fa-exclamation-triangle"></i> {missingPhones} lead{missingPhones !== 1 ? 's' : ''} missing phone numbers — they cannot receive WhatsApp messages.
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Main 3-column layout */}
              <div className={directWhatsAppOpen || activeWhatsAppLead ? 'wa-layout wa-layout--compose' : 'wa-layout'} style={{ display: 'grid', gridTemplateColumns: directWhatsAppOpen || activeWhatsAppLead ? 'minmax(0, 1fr)' : '290px 1fr 330px', gap: '20px', alignItems: 'start' }}>

                {/* LEFT: Settings panel */}
                {!(directWhatsAppOpen || activeWhatsAppLead) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Brand number */}
                  <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(37,211,102,0.3)', borderRadius: '14px', padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                      <i className="fas fa-phone-alt" style={{ color: '#25D366', fontSize: '13px' }}></i>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)' }}>Brand Number</span>
                    </div>
                    <input value={whatsappNumbers[selectedBrandForWhatsApp.id] || ''} onChange={e => setWhatsappNumbers(prev => ({ ...prev, [selectedBrandForWhatsApp.id]: e.target.value }))} placeholder="+27123456789" style={{ width: '100%', padding: '9px 12px', borderRadius: '9px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', marginBottom: '10px', fontSize: '13px' }} />
                    <button className="btn btn-primary" onClick={saveWhatsAppNumbers} disabled={waSavingSettings} style={{ background: '#25D366', border: 'none', color: '#fff', width: '100%', fontSize: '12px' }}>
                      <i className="fas fa-save"></i> {waSavingSettings ? 'Saving...' : 'Save Number'}
                    </button>
                  </div>

                  {/* Templates */}
                  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <i className="fas fa-layer-group" style={{ color: '#25D366', fontSize: '12px' }}></i>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)' }}>Message Templates</span>
                      </div>
                      <button className="btn btn-ghost btn-sm" onClick={resetWhatsAppTemplateForm} style={{ fontSize: '11px', padding: '4px 8px' }}>
                        <i className="fas fa-plus"></i> New
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', maxHeight: '180px', overflowY: 'auto', marginBottom: '12px' }}>
                      {getWhatsAppTemplatesForBrand(selectedBrandForWhatsApp.id).map(t => (
                        <div key={t.id} style={{ padding: '9px 11px', borderRadius: '10px', background: 'var(--bg-base)', border: '1px solid var(--border)', cursor: 'pointer', transition: 'border-color 0.15s' }}
                          onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(37,211,102,0.4)')}
                          onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)')}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                            <strong style={{ fontSize: '11.5px', color: 'var(--text-primary)' }}>{t.name}</strong>
                            <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                              <button className="btn btn-ghost btn-sm" onClick={() => startEditWhatsAppTemplate(t)} style={{ fontSize: '9.5px', padding: '3px 6px' }}>Edit</button>
                              {!String(t.id).startsWith('wa_') && <button className="btn btn-ghost btn-sm" onClick={() => deleteWhatsAppTemplate(t.id)} style={{ fontSize: '9.5px', padding: '3px 6px', color: '#ef4444' }}>Del</button>}
                            </div>
                          </div>
                          <p style={{ fontSize: '10.5px', color: 'var(--text-muted)', margin: '4px 0 0', lineHeight: 1.4 }}>{t.message.length > 60 ? t.message.substring(0, 60) + '…' : t.message}</p>
                        </div>
                      ))}
                      {getWhatsAppTemplatesForBrand(selectedBrandForWhatsApp.id).length === 0 && (
                        <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>No templates yet.</p>
                      )}
                    </div>
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                      <input value={waTemplateName} onChange={e => setWaTemplateName(e.target.value)} placeholder="Template name" style={{ width: '100%', padding: '9px 11px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', marginBottom: '7px', fontSize: '12px' }} />
                      <textarea rows={3} value={waTemplateMessage} onChange={e => setWaTemplateMessage(e.target.value)} placeholder="Message body…" style={{ width: '100%', resize: 'vertical', padding: '9px 11px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: '12px' }} />
                      <div style={{ display: 'flex', gap: '7px', marginTop: '8px' }}>
                        <button className="btn" onClick={saveWhatsAppTemplate} disabled={waSavingSettings} style={{ background: '#25D366', color: '#fff', border: 'none', flex: 1, fontSize: '12px' }}>{waTemplateEditingId ? 'Update' : 'Save Template'}</button>
                        <button className="btn btn-ghost" onClick={resetWhatsAppTemplateForm} style={{ fontSize: '12px' }}>Clear</button>
                      </div>
                    </div>
                  </div>
                </div>
                )}

                {/* CENTRE: Contact list */}
                {!(directWhatsAppOpen || activeWhatsAppLead) && (
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <i className="fas fa-address-book" style={{ color: '#25D366' }}></i> Contacts
                      <span style={{ fontSize: '11px', background: 'rgba(37,211,102,0.1)', color: '#25D366', padding: '2px 8px', borderRadius: '20px', fontWeight: 700 }}>
                        {leads.filter(l => l.brand_id === selectedBrandForWhatsApp.id).length}
                      </span>
                    </h3>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Click to compose →</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '520px', overflowY: 'auto', paddingRight: '2px' }}>
                    {leads.filter(l => l.brand_id === selectedBrandForWhatsApp.id).map(l => {
                      const isActive = activeWhatsAppLead?.id === l.id;
                      const msgCount = allWhatsAppMessages.filter(m => m.lead_id === l.id).length;
                      const reminder = getFollowUpStatus(l);
                      const initials = (l.name || '?').split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase();
                      return (
                        <div
                          key={l.id}
                          className={`wa-contact-card${isActive ? ' active' : ''}`}
                          onClick={() => { setActiveWhatsAppLead(l); setDirectWhatsAppOpen(false); setDirectWhatsAppNumber(''); setDirectWhatsAppName(''); setWaDashboardMessage(`Hi ${(l.name || '').split(' ')[0]}, `); setWaTemplateSel(''); }}
                        >
                          <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: isActive ? '#25D366' : 'rgba(37,211,102,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isActive ? '#fff' : '#25D366', fontWeight: 800, fontSize: '12px', flexShrink: 0 }}>
                            {initials}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <strong style={{ fontSize: '13px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px', display: 'block' }}>{l.name}</strong>
                              {msgCount > 0 && (
                                <span style={{ fontSize: '10px', background: 'rgba(37,211,102,0.15)', color: '#25D366', padding: '1px 6px', borderRadius: '10px', fontWeight: 700, flexShrink: 0 }}>{msgCount} msg</span>
                              )}
                            </div>
                            <div style={{ fontSize: '11px', color: l.phone ? 'var(--text-secondary)' : '#ef4444', marginTop: '2px' }}>
                              {l.phone || <span><i className="fas fa-exclamation-circle"></i> No phone</span>}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                              <span style={{ fontSize: '10px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '5px', padding: '1px 6px', color: 'var(--text-muted)', fontWeight: 600 }}>{l.funnel_stage}</span>
                              {reminder.urgent && <span style={{ fontSize: '10px', color: '#ef4444', fontWeight: 700 }}><i className="fas fa-bell"></i> Due</span>}
                            </div>
                          </div>
                          <i className="fas fa-chevron-right" style={{ color: isActive ? '#25D366' : 'var(--text-muted)', fontSize: '12px', flexShrink: 0 }}></i>
                        </div>
                      );
                    })}
                    {leads.filter(l => l.brand_id === selectedBrandForWhatsApp.id).length === 0 && (
                      <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
                        <i className="fab fa-whatsapp" style={{ fontSize: '40px', opacity: 0.25, marginBottom: '12px', display: 'block' }}></i>
                        <p style={{ fontSize: '13px' }}>No leads for {selectedBrandForWhatsApp.name} yet.</p>
                      </div>
                    )}
                  </div>
                </div>
                )}

                {/* RIGHT: Composer + Activity */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className={directWhatsAppOpen || activeWhatsAppLead ? 'wa-compose-card wa-compose-card--full' : 'wa-compose-card'} style={{ background: 'var(--bg-card)', border: activeWhatsAppLead || directWhatsAppOpen ? '1.5px solid rgba(37,211,102,0.35)' : '1px solid var(--border)', borderRadius: '16px', padding: directWhatsAppOpen || activeWhatsAppLead ? '0' : '20px', transition: 'all 0.2s', overflow: 'hidden' }}>
                    {directWhatsAppOpen ? (
                      <form
                        onSubmit={async e => {
                          e.preventDefault();
                          if (!directWhatsAppNumber.trim() || !waDashboardMessage.trim()) {
                            showToast('Phone number and message are required.', true);
                            return;
                          }
                          setWaSavingSettings(true);
                          try {
                            await sendDirectWhatsApp(selectedBrandForWhatsApp.id, directWhatsAppNumber, waDashboardMessage, waTemplateSel || 'Direct WhatsApp');
                            setDirectWhatsAppOpen(false);
                            setDirectWhatsAppNumber('');
                            setDirectWhatsAppName('');
                            setWaDashboardMessage('');
                            setWaTemplateSel('');
                            showToast(isWhatsAppCloudConfigured(getBrandIntegrationFor(selectedBrandForWhatsApp.id), selectedBrandForWhatsApp.id) ? 'WhatsApp sent in CRM.' : 'WhatsApp opened and message logged.');
                          } catch {
                            showToast('Failed to send WhatsApp message.', true);
                          } finally {
                            setWaSavingSettings(false);
                          }
                        }}
                      >
                        <div className="wa-compose-header">
                          <div>
                            <span>New WhatsApp Chat</span>
                            <h4>{selectedBrandForWhatsApp.name} WhatsApp Desk</h4>
                          </div>
                          <div className="wa-compose-status">
                            <i className="fas fa-circle"></i>
                            {isWhatsAppCloudConfigured(getBrandIntegrationFor(selectedBrandForWhatsApp.id), selectedBrandForWhatsApp.id) ? 'API ready' : 'Manual mode'}
                          </div>
                        </div>
                        <div className="wa-compose-row">
                          <span>From</span>
                          <strong>{whatsappNumbers[selectedBrandForWhatsApp.id] || `${selectedBrandForWhatsApp.name} number not set`}</strong>
                          <small>{selectedBrandForWhatsApp.name}</small>
                        </div>
                        <div className="wa-direct-grid">
                          <input className="compose-clean-input" value={directWhatsAppNumber} onChange={e => setDirectWhatsAppNumber(e.target.value)} placeholder="WhatsApp number" />
                          <input className="compose-clean-input" value={directWhatsAppName} onChange={e => setDirectWhatsAppName(e.target.value)} placeholder="Contact name optional" />
                        </div>
                        <select className="compose-clean-select" value={waTemplateSel} onChange={e => { const id = e.target.value; setWaTemplateSel(id); if (id === 'custom') { setWaTemplateSel(''); return; } const t = getWhatsAppTemplatesForBrand(selectedBrandForWhatsApp.id).find(x => x.id === id); if (t) setWaDashboardMessage(applyTemplateVars(t.message, { id: 'direct-wa', brand_id: selectedBrandForWhatsApp.id, name: directWhatsAppName || directWhatsAppNumber || 'there', email: '', phone: directWhatsAppNumber, funnel_stage: 'Direct WhatsApp', tags: [], custom_fields: {}, created_at: new Date().toISOString() } as Lead, selectedBrandForWhatsApp)); }}>
                          <option value="custom">Custom message</option>
                          <option value="" disabled>Use a saved template</option>
                          {getWhatsAppTemplatesForBrand(selectedBrandForWhatsApp.id).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                        <textarea className="compose-clean-textarea wa-full-message" value={waDashboardMessage} onChange={e => setWaDashboardMessage(e.target.value)} placeholder="Write a WhatsApp message..." />
                        <div className="wa-compose-footer">
                          <div>
                            <strong>Standalone WhatsApp chat</strong>
                            <span>Send to any number. It will be tracked at brand level.</span>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button type="button" className="btn btn-ghost" onClick={() => { setDirectWhatsAppOpen(false); setDirectWhatsAppNumber(''); setDirectWhatsAppName(''); setWaDashboardMessage(''); setWaTemplateSel(''); }}>Cancel</button>
                            <button type="submit" className="btn btn-primary" disabled={waSavingSettings || !directWhatsAppNumber.trim() || !waDashboardMessage.trim()} style={{ background: '#25D366', border: 'none' }}>
                              <i className="fab fa-whatsapp"></i> {waSavingSettings ? 'Sending...' : 'Send WhatsApp'}
                            </button>
                          </div>
                        </div>
                      </form>
                    ) : activeWhatsAppLead ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', paddingBottom: '14px', borderBottom: '1px solid var(--border)' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(37,211,102,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#25D366', fontWeight: 800, fontSize: '14px', flexShrink: 0 }}>
                            {(activeWhatsAppLead.name || '?').charAt(0)}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>To: {activeWhatsAppLead.name}</div>
                            <div style={{ fontSize: '11.5px', color: activeWhatsAppLead.phone ? '#25D366' : '#ef4444', fontWeight: 600 }}>
                              {activeWhatsAppLead.phone || 'No phone — cannot send'}
                            </div>
                          </div>
                          <button onClick={() => { setActiveWhatsAppLead(null); setWaDashboardMessage(''); setWaTemplateSel(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>×</button>
                        </div>
                        <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quick Template</label>
                        <select value={waTemplateSel} onChange={e => { const id = e.target.value; setWaTemplateSel(id); const t = getWhatsAppTemplatesForBrand(selectedBrandForWhatsApp.id).find(x => x.id === id); if (t) setWaDashboardMessage(applyTemplateVars(t.message, activeWhatsAppLead, selectedBrandForWhatsApp)); }} style={{ width: '100%', padding: '9px 12px', borderRadius: '9px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', marginBottom: '12px', fontSize: '12.5px' }}>
                          <option value="">Write custom message…</option>
                          {getWhatsAppTemplatesForBrand(selectedBrandForWhatsApp.id).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                        <div className="wa-chat-thread">
                          {allWhatsAppMessages.filter(m => m.lead_id === activeWhatsAppLead.id).length > 0 ? (
                            allWhatsAppMessages.filter(m => m.lead_id === activeWhatsAppLead.id).slice(0, 6).map(m => (
                              <div key={m.id} className={`wa-chat-bubble ${m.direction === 'inbound' ? 'received' : 'sent'}`}>
                                <p>{m.message}</p>
                                <span>{m.created_at ? new Date(m.created_at).toLocaleString() : 'Logged'} | {m.status || 'sent'}</span>
                              </div>
                            ))
                          ) : (
                            <div className="wa-chat-empty">
                              <i className="fab fa-whatsapp"></i>
                              <span>No WhatsApp messages logged for this lead yet.</span>
                            </div>
                          )}
                        </div>                        <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Message</label>
                        <textarea value={waDashboardMessage} onChange={e => setWaDashboardMessage(e.target.value)} rows={6} placeholder="Write your WhatsApp message…" style={{ width: '100%', resize: 'vertical', padding: '11px', borderRadius: '11px', border: '1.5px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', lineHeight: 1.55, marginBottom: '12px', fontSize: '13px' }} />
                        <div className="wa-compose-actions">
                          <button
                            className="wa-log-btn"
                            disabled={!waDashboardMessage.trim() || !activeWhatsAppLead.phone}
                            onClick={async () => {
                              try {
                                const fromNum = whatsappNumbers[selectedBrandForWhatsApp.id] || '';
                                await axios.post('/api/whatsapp/send', { lead_id: activeWhatsAppLead.id, brand_id: selectedBrandForWhatsApp.id, message: waDashboardMessage, from_number: fromNum, to_number: activeWhatsAppLead.phone, template_name: waTemplateSel || 'Manual', status: 'sent', log_only: true });
                                fetchAllWhatsAppMessages(selectedBrandForWhatsApp.id);
                                setWaDashboardMessage('');
                                setWaTemplateSel('');
                                setActiveWhatsAppLead(null);
                                showToast('Message logged in dashboard.');
                              } catch { showToast('Failed to log WhatsApp message.', true); }
                            }}
                          >
                            <i className="fas fa-comment-medical"></i>
                            Log in dashboard
                          </button>
                          <button
                            className="wa-open-btn"
                            disabled={!waDashboardMessage.trim() || !activeWhatsAppLead.phone}
                            onClick={async () => {
                              try {
                                const fromNum = whatsappNumbers[selectedBrandForWhatsApp.id] || '';
                                const integration = getBrandIntegrationFor(selectedBrandForWhatsApp.id);
                                const apiReady = isWhatsAppCloudConfigured(integration, selectedBrandForWhatsApp.id);
                                const toNum = activeWhatsAppLead.phone!.replace(/[^0-9+]/g, '');
                                const encodedMsg = encodeURIComponent(waDashboardMessage);
                                if (!apiReady) window.open(`https://wa.me/${toNum}?text=${encodedMsg}`, '_blank');
                                await axios.post('/api/whatsapp/send', { lead_id: activeWhatsAppLead.id, brand_id: selectedBrandForWhatsApp.id, message: waDashboardMessage, from_number: fromNum, to_number: activeWhatsAppLead.phone, template_name: waTemplateSel || 'Manual', status: 'sent', log_only: !apiReady });
                                fetchAllWhatsAppMessages(selectedBrandForWhatsApp.id);
                                setWaDashboardMessage('');
                                setWaTemplateSel('');
                                setActiveWhatsAppLead(null);
                                showToast(apiReady ? 'WhatsApp sent in CRM.' : 'WhatsApp opened and message logged.');
                              } catch { showToast('Failed to log WhatsApp message.', true); }
                            }}
                          >
                            <i className="fab fa-whatsapp"></i>
                            {isWhatsAppCloudConfigured(getBrandIntegrationFor(selectedBrandForWhatsApp.id), selectedBrandForWhatsApp.id) ? 'Send in CRM' : 'Open WhatsApp'}
                          </button>
                        </div>
                      </>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '36px 20px' }}>
                        <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(37,211,102,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                          <i className="fab fa-whatsapp" style={{ fontSize: '24px', color: '#25D366' }}></i>
                        </div>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '4px' }}>Select a Contact</p>
                        <p style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Click any contact to open the composer.</p>
                      </div>
                    )}
                  </div>
                  {!(directWhatsAppOpen || activeWhatsAppLead) && (
                  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '18px' }}>
                    <h4 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <i className="fas fa-history" style={{ color: '#25D366', fontSize: '11px' }}></i> Recent Activity
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
                      {allWhatsAppMessages
                        .filter(m => leads.filter(l => l.brand_id === selectedBrandForWhatsApp.id).some(l => l.id === m.lead_id))
                        .slice(0, 10)
                        .map(m => {
                          const lead = leads.find(l => l.id === m.lead_id);
                          return (
                            <div key={m.id} style={{ padding: '9px 11px', borderRadius: '10px', background: 'var(--bg-base)', border: '1px solid var(--border)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                                <strong style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{lead?.name || 'Unknown'}</strong>
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                  <span style={{ fontSize: '9.5px', background: 'rgba(37,211,102,0.12)', color: '#25D366', padding: '1px 7px', borderRadius: '10px', fontWeight: 800 }}>{m.status || 'sent'}</span>
                                  <span style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>{new Date(m.created_at).toLocaleDateString()}</span>
                                </div>
                              </div>
                              <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--text-muted)', lineHeight: 1.4 }}>{m.message.length > 80 ? m.message.substring(0, 80) + '…' : m.message}</p>
                            </div>
                          );
                        })}
                      {allWhatsAppMessages.filter(m => leads.filter(l => l.brand_id === selectedBrandForWhatsApp.id).some(l => l.id === m.lead_id)).length === 0 && (
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>No messages logged yet.</p>
                      )}
                    </div>
                  </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* =======================================================
               C. SELECTED CORPORATE WORKSPACE (LEADS/SEQUENCES)
             ======================================================= */}
          {activeTab === 'team-chat' && (
            (() => {
              const staffMembers = usersList.filter(staff => staff.id !== user.id);
              const buildDmOption = (id: string, name: string, role = '') => {
                const messages = getTeamThreadMessages(id).sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
                const latest = messages[0];
                const unread = getTeamThreadUnreadCount(id);
                const preview = latest
                  ? `${latest.user_id === user.id ? 'You: ' : ''}${latest.content || (latest.attachments?.length ? `${latest.attachments.length} file${latest.attachments.length === 1 ? '' : 's'} shared` : 'New message')}`
                  : 'No messages yet';
                return { id, name, role, latest, preview, unread };
              };
              const dmOptions = [
                buildDmOption('all', 'All staff', 'channel'),
                ...staffMembers.map(staff => buildDmOption(staff.id, staff.name, staff.role))
              ].filter(option => {
                const query = teamDmSearch.trim().toLowerCase();
                const matchesSearch = !query || option.name.toLowerCase().includes(query) || option.preview.toLowerCase().includes(query);
                const matchesUnread = !teamUnreadOnly || option.unread > 0;
                return matchesSearch && matchesUnread;
              });
              const activeDm = dmOptions.find(option => option.id === activeTeamDmId) || buildDmOption(activeTeamDmId, activeTeamDmId === 'all' ? 'All staff' : usersList.find(staff => staff.id === activeTeamDmId)?.name || 'Direct message');
              const activeThreadMessages = getTeamThreadMessages(activeTeamDmId).sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
              const activeThreadMessagesWithDates = activeThreadMessages.map((message, index) => ({
                message,
                showDateDivider: index === 0 || getTeamMessageDateKey(message.created_at) !== getTeamMessageDateKey(activeThreadMessages[index - 1]?.created_at),
              }));
              const activeThreadFiles = activeThreadMessages.flatMap(message => (message.attachments || []).map(file => ({ message, file }))).slice().reverse();
              const getDmPresence = (dmId: string) => {
                if (dmId === 'all') return { label: 'Channel', className: 'channel' };
                const staff = dmId === user.id ? user : usersList.find(item => item.id === dmId);
                const status = staff?.presence_status === 'online' || staff?.presence_status === 'away' || staff?.presence_status === 'offline'
                  ? staff.presence_status
                  : 'offline';
                return {
                  label: status === 'away' ? 'Away' : status === 'offline' ? 'Offline' : 'Online',
                  className: status
                };
              };
              const activePresence = getDmPresence(activeTeamDmId);

              return (
                <div className="team-slack-shell">
                  <aside className="team-dm-sidebar">
                    <div className="team-dm-title">
                      <div>
                        <h3>Direct messages</h3>
                        <span>{teamGlobalUnreadCount} unread</span>
                      </div>
                      <div className="team-dm-actions">
                        <label title="Show unread only">
                          <span>Unread</span>
                          <input type="checkbox" checked={teamUnreadOnly} onChange={e => setTeamUnreadOnly(e.target.checked)} />
                        </label>
                        <button type="button" onClick={fetchTeamMessages} title="Refresh messages">
                          <i className="fas fa-arrows-rotate"></i>
                        </button>
                      </div>
                    </div>

                    <div className="team-dm-search">
                      <i className="fas fa-search"></i>
                      <input value={teamDmSearch} onChange={e => setTeamDmSearch(e.target.value)} />
                    </div>

                    <div className="team-dm-list">
                      {dmOptions.map(option => (
                        <button
                          key={option.id}
                          type="button"
                          className={`team-dm-item ${activeTeamDmId === option.id ? 'active' : ''} ${option.unread ? 'unread' : ''}`}
                          onClick={() => {
                            setActiveTeamDmId(option.id);
                            setTeamRecipientId(option.id);
                            setTeamChatSubTab('messages');
                            setTeamMessageText('');
                            setTeamFiles([]);
                          }}
                        >
                          <span className={`team-dm-avatar ${option.id === 'all' ? 'all' : ''}`}>{option.id === 'all' ? '#' : option.name.charAt(0)}</span>
                          <span className="team-dm-copy">
                            <strong>{option.name}<span className={`team-presence-dot ${getDmPresence(option.id).className}`}></span></strong>
                            <small>{option.preview}</small>
                          </span>
                          <span className="team-dm-side">
                            {option.latest?.created_at && <time>{formatTeamPreviewTime(option.latest.created_at)}</time>}
                            {option.unread > 0 && <em>{option.unread > 9 ? '9+' : option.unread}</em>}
                          </span>
                        </button>
                      ))}
                      {dmOptions.length === 0 && <p className="team-dm-empty">No matching messages.</p>}
                    </div>
                  </aside>

                  <section className="team-chat-pane">
                    <div className="team-chat-header">
                      <div className={`team-dm-avatar ${activeTeamDmId === 'all' ? 'all' : ''}`}>{activeTeamDmId === 'all' ? '#' : activeDm.name.charAt(0)}</div>
                      <div>
                        <h3>{activeDm.name}</h3>
                        <span><span className={`team-presence-dot ${activePresence.className}`}></span>{activeTeamDmId === 'all' ? 'Messages everyone can see' : activePresence.label}</span>
                      </div>
                      <button type="button" className="team-call-button" onClick={startTeamCall} disabled={teamPosting} title="Start a team call and share the join link in this chat">
                        <i className="fas fa-phone"></i>
                        <span>Start call</span>
                      </button>
                      <label className="team-presence-control" title="Your chat availability">
                        <span>My status</span>
                        <select value={teamPresenceStatus} onChange={e => setTeamPresenceStatus(e.target.value as 'online' | 'away' | 'offline')}>
                          <option value="online">Online</option>
                          <option value="away">Away</option>
                          <option value="offline">Offline</option>
                        </select>
                      </label>
                      {activeDm.unread > 0 && <strong>{activeDm.unread} new</strong>}
                    </div>

                    <div className="team-chat-tabs">
                      <button type="button" className={teamChatSubTab === 'messages' ? 'active' : ''} onClick={() => setTeamChatSubTab('messages')}>
                        <i className="fas fa-comment"></i> Messages
                      </button>
                      <button type="button" className={teamChatSubTab === 'files' ? 'active' : ''} onClick={() => setTeamChatSubTab('files')}>
                        <i className="fas fa-folder-open"></i> Files and links
                        {activeThreadFiles.length > 0 && <span>{activeThreadFiles.length}</span>}
                      </button>
                      <button type="button" className="team-chat-open-notes" title="Open personal notes" onClick={() => { setUserNotesOpen(true); fetchTeamNotes(); }}>
                        <i className="fas fa-note-sticky"></i> My Notes
                      </button>
                      <label title="Attach files">
                        <i className="fas fa-plus"></i>
                        <input type="file" multiple onChange={e => setTeamFiles(Array.from(e.target.files || []))} />
                      </label>
                    </div>

                    {teamChatSubTab === 'messages' ? (
                      <div className="team-message-stream team-message-stream--slack" ref={teamStreamRef}>
                        {activeThreadMessages.length === 0 ? (
                          <div className="team-empty">
                            <i className="fas fa-comments"></i>
                            <strong>{activeTeamDmId === 'all' ? 'No all-staff messages yet' : `No conversation with ${activeDm.name} yet`}</strong>
                            <span>Send a message or attach files. They can read it later even when offline.</span>
                          </div>
                        ) : activeThreadMessagesWithDates.map(({ message, showDateDivider }) => {
                          const isMine = message.user_id === user.id;
                          const attachments = Array.isArray(message.attachments) ? message.attachments : [];
                          return (
                            <React.Fragment key={message.id}>
                              {showDateDivider && (
                                <div className="team-date-divider">
                                  <span>{formatTeamDateDivider(message.created_at)}</span>
                                </div>
                              )}
                              <article className={`team-message ${isMine ? 'mine' : ''}`}>
                                <div className="team-message-avatar">{(message.user_name || 'U').charAt(0)}</div>
                                <div className="team-message-bubble">
                                  <div className="team-message-meta">
                                    <strong>{message.user_name || 'Team member'}</strong>
                                    <time>{formatTeamTime(message.created_at)}</time>
                                    {(isMine || user.role === 'admin') && (
                                      <button type="button" onClick={() => handleDeleteTeamMessage(message.id)} title="Delete message">
                                        <i className="fas fa-trash"></i>
                                      </button>
                                    )}
                                  </div>
                                  {message.content && renderTeamMessageContent(message.content)}
                                  {attachments.length > 0 && attachments.map(file => {
                                    const isImage = file.mime_type?.startsWith('image/');
                                    return (
                                      <a className={`team-file-card ${isImage ? 'image' : ''}`} key={file.id} href={file.download_url} target="_blank" rel="noreferrer" download>
                                        {isImage ? <img src={file.download_url} alt={file.name || 'Shared image'} /> : <span><i className={`fas ${file.mime_type?.includes('zip') ? 'fa-file-zipper' : file.mime_type?.includes('video') ? 'fa-file-video' : 'fa-file-lines'}`}></i></span>}
                                        <div>
                                          <strong>{file.name || 'Shared file'}</strong>
                                          <small>{file.size ? `${Math.ceil(file.size / 1024)} KB` : 'Download file'} - {file.mime_type || 'file'}</small>
                                        </div>
                                      </a>
                                    );
                                  })}
                                </div>
                              </article>
                            </React.Fragment>
                          );
                        })}
                        <div ref={teamEndRef} />
                      </div>
                    ) : teamChatSubTab === 'files' ? (
                      <div className="team-files-panel">
                        {activeThreadFiles.length > 0 ? activeThreadFiles.map(({ message, file }) => (
                          <a key={`${message.id}-${file.id}`} className={file.mime_type?.startsWith('image/') ? 'image' : ''} href={file.download_url} target="_blank" rel="noreferrer" download>
                            {file.mime_type?.startsWith('image/') ? <img src={file.download_url} alt={file.name || 'Shared image'} /> : <i className={`fas ${file.mime_type?.includes('zip') ? 'fa-file-zipper' : file.mime_type?.includes('video') ? 'fa-file-video' : 'fa-file-lines'}`}></i>}
                            <span>
                              <strong>{file.name || 'Shared file'}</strong>
                              <small>{message.user_name || 'Team'} - {formatTeamDateDivider(message.created_at)} {formatTeamTime(message.created_at)}</small>
                            </span>
                          </a>
                        )) : (
                          <div className="team-empty">
                            <i className="fas fa-folder-open"></i>
                            <strong>No files shared here yet</strong>
                            <span>Attach files from the composer and they will stay available in this tab.</span>
                          </div>
                        )}
                      </div>
                    ) : null}

                    <form className="team-composer team-composer--slack" onSubmit={handleSendTeamMessage}>
                      <div className="team-composer-box">
                        <div className="team-format-row" aria-label="Message formatting">
                          <button type="button" title="Bold selected text" onClick={() => formatTeamDraft('bold')}>B</button>
                          <button type="button" title="Italic selected text" onClick={() => formatTeamDraft('italic')}>I</button>
                          <button type="button" title="Underline selected text" onClick={() => formatTeamDraft('underline')}>U</button>
                          <button type="button" title="Strikethrough selected text" onClick={() => formatTeamDraft('strike')}>S</button>
                          <span></span>
                          <button type="button" title="Add link" onClick={() => formatTeamDraft('link')}><i className="fas fa-link"></i></button>
                          <button type="button" title="Numbered list" onClick={() => formatTeamDraft('ol')}><i className="fas fa-list-ol"></i></button>
                          <button type="button" title="Bullet list" onClick={() => formatTeamDraft('ul')}><i className="fas fa-list-ul"></i></button>
                          <button type="button" title="Inline code" onClick={() => formatTeamDraft('code')}><i className="fas fa-code"></i></button>
                        </div>
                        <textarea ref={teamTextareaRef} value={teamMessageText} onChange={e => setTeamMessageText(e.target.value)} placeholder={`Message ${activeDm.name}`} />
                        <div className="team-share-row">
                          <div className="team-composer-actions">
                            <label className="team-file-picker" title="Attach files">
                              <i className="fas fa-plus"></i>
                              <input type="file" multiple onChange={e => setTeamFiles(Array.from(e.target.files || []))} />
                            </label>
                            <button type="button" title="Mention this conversation" onClick={() => formatTeamDraft('mention')}><i className="fas fa-at"></i></button>
                            <button type="button" title="Start a team call" onClick={startTeamCall} disabled={teamPosting}>
                              <i className="fas fa-phone"></i>
                            </button>
                          </div>
                          <button className="team-send-button" type="submit" disabled={teamPosting || (!teamMessageText.trim() && teamFiles.length === 0)}>
                            <i className={`fas ${teamPosting ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`}></i>
                            <span>{teamPosting ? 'Sending' : 'Send'}</span>
                          </button>
                        </div>
                      </div>
                      {teamFiles.length > 0 && (
                        <div className="team-selected-files">
                          {teamFiles.map(file => (
                            <span key={`${file.name}-${file.size}`}>
                              {file.type.startsWith('image/') ? <img src={URL.createObjectURL(file)} alt={file.name} /> : <i className="fas fa-file"></i>}
                              <strong>{file.name}</strong>
                              <button type="button" onClick={() => setTeamFiles(files => files.filter(f => f !== file))}>
                                <i className="fas fa-xmark"></i>
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </form>
                  </section>

                </div>
              );
            })()
          )}

          {activeTab === 'team-chat-legacy' && (
            <div className="team-hub">
              <section className="team-hub-main">
                <div className="team-hub-header">
                  <div>
                    <span>Internal workspace</span>
                    <h3>Team Chat</h3>
                  </div>
                  <button type="button" onClick={fetchTeamMessages}>
                    <i className="fas fa-arrows-rotate"></i>
                    Refresh
                  </button>
                </div>

                <div className="team-message-stream">
                  {teamMessages.length === 0 ? (
                    <div className="team-empty">
                      <i className="fas fa-comments"></i>
                      <strong>No team messages yet</strong>
                      <span>Start a quick internal thread or attach files for the CRM team.</span>
                    </div>
                  ) : teamMessages.map(message => {
                    const isMine = message.user_id === user.id;
                    const attachments = Array.isArray(message.attachments) ? message.attachments : [];
                    return (
                      <article key={message.id} className={`team-message ${isMine ? 'mine' : ''}`}>
                        <div className="team-message-avatar">{(message.user_name || 'U').charAt(0)}</div>
                        <div className="team-message-bubble">
                          <div className="team-message-meta">
                            <strong>{message.user_name || 'Team member'}</strong>
                            <span>{(message.recipient_names || []).length ? `to ${(message.recipient_names || []).join(', ')}` : 'to Everyone'}</span>
                            <time>{message.created_at ? new Date(message.created_at).toLocaleString() : ''}</time>
                            {(isMine || user.role === 'admin') && (
                              <button type="button" onClick={() => handleDeleteTeamMessage(message.id)} title="Delete message">
                                <i className="fas fa-trash"></i>
                              </button>
                            )}
                          </div>
                          {message.content && renderTeamMessageContent(message.content)}
                          {attachments.length > 0 && attachments.map(file => {
                            const isImage = String(file.mime_type || '').startsWith('image/');
                            return (
                              <a className="team-file-card" key={file.id} href={file.download_url} target="_blank" rel="noreferrer" download>
                                <span><i className={`fas ${isImage ? 'fa-image' : file.mime_type?.includes('zip') ? 'fa-file-zipper' : file.mime_type?.includes('video') ? 'fa-file-video' : 'fa-file-lines'}`}></i></span>
                                <div>
                                  <strong>{file.name || 'Shared file'}</strong>
                                  <small>{file.size ? `${Math.ceil(file.size / 1024)} KB` : 'Download file'} · {file.mime_type || 'file'}</small>
                                </div>
                              </a>
                            );
                          })}
                        </div>
                      </article>
                    );
                  })}
                </div>

                <form className="team-composer" onSubmit={handleSendTeamMessage}>
                  <div className="team-recipient-row">
                    <label>
                      <span>To</span>
                      <select value={teamRecipientId} onChange={e => setTeamRecipientId(e.target.value)}>
                        <option value="all">Everyone on staff</option>
                        {usersList.map(staff => (
                          <option key={staff.id} value={staff.id}>{staff.name} ({staff.role})</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <textarea
                    value={teamMessageText}
                    onChange={e => setTeamMessageText(e.target.value)}
                    placeholder="Message the team..."
                  />
                  <div className="team-share-row">
                    <label className="team-file-picker">
                      <i className="fas fa-paperclip"></i>
                      <span>{teamFiles.length ? `${teamFiles.length} file${teamFiles.length === 1 ? '' : 's'} selected` : 'Attach files'}</span>
                      <input
                        type="file"
                        multiple
                        onChange={e => setTeamFiles(Array.from(e.target.files || []))}
                      />
                    </label>
                    <button type="submit" disabled={teamPosting || (!teamMessageText.trim() && teamFiles.length === 0)}>
                      <i className={`fas ${teamPosting ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`}></i>
                      {teamPosting ? 'Sending' : 'Send'}
                    </button>
                  </div>
                  {teamFiles.length > 0 && (
                    <div className="team-selected-files">
                      {teamFiles.map(file => (
                        <span key={`${file.name}-${file.size}`}>
                          <i className="fas fa-file"></i>
                          {file.name}
                          <button type="button" onClick={() => setTeamFiles(files => files.filter(f => f !== file))}>
                            <i className="fas fa-xmark"></i>
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </form>
              </section>

              <aside className="team-sharepoint">
                <div>
                  <span>Organization Share Point</span>
                  <strong>{teamMessages.reduce((total, message) => total + (message.attachments?.length || 0), 0)} shared files</strong>
                </div>
                <div className="team-file-list">
                  {teamMessages.flatMap(message => (message.attachments || []).map(file => ({ message, file }))).slice().reverse().slice(0, 12).map(({ message, file }) => (
                    <a key={`${message.id}-${file.id}`} href={file.download_url} target="_blank" rel="noreferrer" download>
                      <i className={`fas ${file.mime_type?.startsWith('image/') ? 'fa-image' : file.mime_type?.includes('zip') ? 'fa-file-zipper' : file.mime_type?.includes('video') ? 'fa-file-video' : 'fa-file-lines'}`}></i>
                      <span>
                        <strong>{file.name || 'Shared file'}</strong>
                        <small>{message.user_name || 'Team'} · {message.created_at ? new Date(message.created_at).toLocaleDateString() : ''}</small>
                      </span>
                    </a>
                  ))}
                  {teamMessages.reduce((total, message) => total + (message.attachments?.length || 0), 0) === 0 && (
                    <p>No files shared yet.</p>
                  )}
                </div>
              </aside>
            </div>
          )}

          {activeTab === 'integrations' && (
            <div style={{ animation: 'fadeIn 0.3s' }}>
              {(() => {
                const selectedIntegrationBrand = activeBrands.find(b => b.id === integrationBrandId) || BRANDS[0];
                const integrationChannelOptions: Array<{ id: 'email' | 'whatsapp' | 'call'; title: string; summary: string; icon: string; tone: string }> = [
                  { id: 'email', title: 'Email', summary: 'Connect Gmail, Outlook, Yahoo, SMTP, or keep CRM-only email.', icon: 'fa-envelope', tone: '#2563eb' },
                  { id: 'whatsapp', title: 'WhatsApp', summary: 'Start with wa.me logging or WhatsApp Cloud API.', icon: 'fa-comment-dots', tone: '#25D366' },
                  { id: 'call', title: 'Calling', summary: 'Set up manual calls, Twilio Voice, or Aircall later.', icon: 'fa-phone', tone: '#7c3aed' },
                ];
                const activeIntegrationOption = integrationChannelOptions.find(option => option.id === activeIntegrationChannel) || integrationChannelOptions[0];
                const brandTemplates = messageTemplates.filter(t => t.brand_id === integrationBrandId && t.channel === activeIntegrationChannel);
                const emailAccounts = getEmailAccountsForIntegration(integrationForm).filter(account => account.id !== 'primary');
                return (
                  <div className="integration-workspace-redesign">
                    {user.role === 'admin' && <section style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '22px', boxShadow: 'var(--shadow-sm)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
                        <img src={selectedIntegrationBrand.logo} alt={selectedIntegrationBrand.name} style={{ width: '36px', height: '36px', objectFit: 'contain' }} />
                        <div>
                          <h3 style={{ margin: 0, fontSize: '17px', color: 'var(--text-primary)' }}>{selectedIntegrationBrand.name} {activeIntegrationOption.title} Setup</h3>
                          <p style={{ margin: '2px 0 0', color: 'var(--text-muted)', fontSize: '12px' }}>Choose one channel to start. The others can stay untouched until you need them.</p>
                        </div>
                      </div>
                      <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)' }}>Brand</label>
                      <select value={integrationBrandId} onChange={e => setIntegrationBrandId(e.target.value)} style={{ width: '100%', margin: '6px 0 16px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                        {activeBrands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px', marginBottom: '16px' }}>
                        {integrationChannelOptions.map(option => (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => {
                              setActiveIntegrationChannel(option.id);
                              setTemplateForm(prev => ({ ...prev, channel: option.id }));
                            }}
                            style={{
                              textAlign: 'left',
                              padding: '12px',
                              borderRadius: '10px',
                              border: activeIntegrationChannel === option.id ? `1.5px solid ${option.tone}` : '1px solid var(--border)',
                              background: activeIntegrationChannel === option.id ? `${option.tone}14` : 'var(--bg-base)',
                              color: 'var(--text-primary)',
                              cursor: 'pointer',
                              minHeight: '104px'
                            }}
                          >
                            <i className={`fas ${option.icon}`} style={{ color: option.tone, marginBottom: '10px' }}></i>
                            <strong style={{ display: 'block', fontSize: '12.5px', marginBottom: '4px' }}>{option.title}</strong>
                            <span style={{ display: 'block', fontSize: '11.2px', color: 'var(--text-muted)', lineHeight: 1.35 }}>{option.summary}</span>
                          </button>
                        ))}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
                        {activeIntegrationChannel === 'email' && (
                          <>
                        <div>
                          <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)' }}>Email Provider</label>
                          <select value={integrationForm.email_provider} onChange={e => applyEmailProviderPreset(e.target.value)} style={{ width: '100%', marginTop: '6px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                            <option value="internal">CRM outbox only</option>
                            <option value="gmail">Gmail</option>
                            <option value="outlook">Outlook</option>
                            <option value="yahoo">Yahoo</option>
                            <option value="smtp">SMTP</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)' }}>Sender Name</label>
                          <input value={integrationForm.email_sender_name || ''} onChange={e => setIntegrationForm(prev => ({ ...prev, email_sender_name: e.target.value }))} placeholder={`${selectedIntegrationBrand.name} Team`} style={{ width: '100%', marginTop: '6px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)' }} />
                        </div>
                        {false && (integrationForm.email_provider === 'outlook' || integrationForm.email_provider === 'yahoo' || integrationForm.email_provider === 'smtp') && (
                          <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1.2fr .5fr .9fr 1fr', gap: '10px', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-base)' }}>
                            <div>
                              <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)' }}>SMTP Host</label>
                              <input value={integrationForm.smtp_host || ''} onChange={e => setIntegrationForm(prev => ({ ...prev, smtp_host: e.target.value }))} placeholder="smtp-mail.outlook.com" style={{ width: '100%', marginTop: '6px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)' }} />
                            </div>
                            <div>
                              <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)' }}>Port</label>
                              <input value={integrationForm.smtp_port || ''} onChange={e => setIntegrationForm(prev => ({ ...prev, smtp_port: e.target.value }))} placeholder="587" style={{ width: '100%', marginTop: '6px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)' }} />
                            </div>
                            <div>
                              <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)' }}>Username</label>
                              <input value={integrationForm.smtp_username || ''} onChange={e => setIntegrationForm(prev => ({ ...prev, smtp_username: e.target.value }))} placeholder="outlook@email.com" style={{ width: '100%', marginTop: '6px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)' }} />
                            </div>
                            <div>
                              <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)' }}>Password Env Var</label>
                              <input value={integrationForm.smtp_password_env || ''} onChange={e => setIntegrationForm(prev => ({ ...prev, smtp_password_env: e.target.value }))} placeholder="OUTLOOK_SMTP_PASSWORD" style={{ width: '100%', marginTop: '6px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)' }} />
                            </div>
                            <label style={{ gridColumn: '1 / -1', display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 700 }}>
                              <input type="checkbox" checked={Boolean(integrationForm.smtp_secure)} onChange={e => setIntegrationForm(prev => ({ ...prev, smtp_secure: e.target.checked }))} />
                              Use SSL/TLS immediately, usually port 465. Leave off for Outlook.com STARTTLS on port 587.
                            </label>
                            <p style={{ gridColumn: '1 / -1', margin: 0, color: 'var(--text-muted)', fontSize: '11.5px', lineHeight: 1.45 }}>
                              Outlook.com default: smtp-mail.outlook.com, port 587, STARTTLS. Yahoo default: smtp.mail.yahoo.com, port 465, SSL/TLS. If password login is rejected, use an app password where available or we can add full provider OAuth next.
                            </p>
                          </div>
                        )}
                        {false && <div style={{ gridColumn: '1 / -1', padding: '12px', borderRadius: '12px', border: integrationForm.email_provider === 'internal' ? '1px solid rgba(59,130,246,0.24)' : gmailStatus?.connected ? '1px solid rgba(16,185,129,0.28)' : '1px solid rgba(245,158,11,0.30)', background: integrationForm.email_provider === 'internal' ? 'rgba(59,130,246,0.08)' : gmailStatus?.connected ? 'rgba(16,185,129,0.10)' : 'rgba(245,158,11,0.10)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div>
                            <strong style={{ display: 'block', color: 'var(--text-primary)', fontSize: '12.5px' }}>
                              {integrationForm.email_provider === 'gmail' && gmailStatus?.connected
                                ? `Gmail connected: ${gmailStatus.connected_email}`
                                : integrationForm.email_provider === 'gmail'
                                  ? 'Gmail is not connected yet'
                                  : integrationForm.email_provider === 'outlook'
                                    ? 'Outlook SMTP setup'
                                    : integrationForm.email_provider === 'yahoo'
                                      ? 'Yahoo SMTP setup'
                                    : integrationForm.email_provider === 'smtp'
                                      ? 'SMTP setup'
                                  : integrationForm.email_provider === 'internal'
                                    ? 'CRM outbox mode'
                                    : `${integrationForm.email_provider?.toUpperCase()} is not connected yet`}
                            </strong>
                            <span style={{ display: 'block', marginTop: '3px', color: 'var(--text-muted)', fontSize: '11.5px', lineHeight: 1.45 }}>
                              {integrationForm.email_provider === 'internal'
                                ? 'Emails are recorded inside the CRM only. They are not sent through an external inbox.'
                                : integrationForm.email_provider === 'outlook'
                                  ? 'Save these settings and add the password/app-password value to Render using the env var name above. Outlook.com defaults are prefilled from Microsoft support.'
                                  : integrationForm.email_provider === 'yahoo'
                                    ? 'Save these settings and add the Yahoo app-password value to Render using the env var name above.'
                                  : integrationForm.email_provider === 'smtp'
                                    ? 'Save these SMTP settings and add the password value to Render using the env var name above.'
                                : gmailStatus?.connected
                                  ? 'Messages for this brand will send through the connected Gmail account and should appear in Gmail Sent.'
                                  : gmailStatus?.configured === false
                                    ? `Add Google OAuth credentials in .env, then restart the CRM. Redirect URI: ${gmailStatus?.redirect_uri || '/api/integrations/gmail/callback'}`
                                    : 'Connect the Gmail account before sending real email through this provider.'}
                            </span>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto', gap: '8px', alignItems: 'center' }}>
                            <input
                              value={gmailTestRecipient}
                              onChange={e => setGmailTestRecipient(e.target.value)}
                              placeholder="test recipient email"
                              style={{ width: '100%', padding: '9px 11px', borderRadius: '9px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '12px' }}
                            />
                            {integrationForm.email_provider === 'gmail' && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={gmailStatus?.connected ? disconnectGmail : startGmailConnection}
                                disabled={gmailConnecting || (integrationForm.email_provider === 'gmail' && gmailStatus?.configured === false)}
                                style={{ whiteSpace: 'nowrap' }}
                              >
                                <i className={`fas ${gmailStatus?.connected ? 'fa-unlink' : 'fa-link'}`}></i> {gmailConnecting ? 'Opening...' : gmailStatus?.connected ? 'Disconnect' : `Connect ${integrationForm.email_provider === 'gmail' ? 'Gmail' : integrationForm.email_provider?.toUpperCase()}`}
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={integrationForm.email_provider === 'gmail' && gmailStatus?.connected ? sendGmailTestEmail : (integrationForm.email_provider === 'outlook' || integrationForm.email_provider === 'yahoo' || integrationForm.email_provider === 'smtp') ? sendSmtpProviderTestEmail : () => showToast('CRM outbox mode logs emails only. Choose Gmail, Outlook, Yahoo, or SMTP for a real send test.', true)}
                              disabled={gmailTesting || (integrationForm.email_provider === 'gmail' && !gmailStatus?.connected)}
                              style={{ whiteSpace: 'nowrap' }}
                            >
                              <i className="fas fa-paper-plane"></i> {gmailTesting ? 'Sending...' : 'Send test email'}
                            </button>
                          </div>
                        </div>}
                          </>
                        )}
                        {activeIntegrationChannel === 'whatsapp' && (
                          <>
                        <div>
                          <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)' }}>WhatsApp Provider</label>
                          <select value={integrationForm.whatsapp_provider || 'manual'} onChange={e => setIntegrationForm(prev => ({ ...prev, whatsapp_provider: e.target.value, whatsapp_access_token_env: prev.whatsapp_access_token_env || `WHATSAPP_${integrationBrandId.replace(/[^a-z0-9]/gi, '_').toUpperCase()}_ACCESS_TOKEN`, whatsapp_verify_token: prev.whatsapp_verify_token || `verify_${integrationBrandId.replace(/[^a-z0-9]/gi, '_').toLowerCase()}` }))} style={{ width: '100%', marginTop: '6px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                            <option value="manual">Manual / wa.me</option>
                            <option value="cloud_api">WhatsApp Cloud API</option>
                            <option value="twilio">Twilio WhatsApp</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)' }}>WhatsApp Number</label>
                          <input value={integrationForm.whatsapp_number || ''} onChange={e => setIntegrationForm(prev => ({ ...prev, whatsapp_number: e.target.value }))} placeholder="+27123456789" style={{ width: '100%', marginTop: '6px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)' }} />
                        </div>
                        <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '80px minmax(0, 1fr) minmax(0, 1fr)', gap: '12px', alignItems: 'center', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-base)' }}>
                          <div style={{ width: '64px', height: '64px', borderRadius: '50%', border: '1px solid var(--border)', background: '#fff', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
                            {integrationForm.whatsapp_profile_picture_url
                              ? <img src={integrationForm.whatsapp_profile_picture_url} alt="WhatsApp profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : <i className="fab fa-whatsapp" style={{ color: '#25D366', fontSize: '26px' }}></i>}
                          </div>
                          <div>
                            <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)' }}>Business Display Name</label>
                            <input value={integrationForm.whatsapp_profile_name || ''} onChange={e => setIntegrationForm(prev => ({ ...prev, whatsapp_profile_name: e.target.value }))} placeholder={`${selectedIntegrationBrand.name}`} style={{ width: '100%', marginTop: '6px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)' }} />
                          </div>
                          <div>
                            <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)' }}>Profile Photo URL</label>
                            <input value={integrationForm.whatsapp_profile_picture_url || ''} onChange={e => setIntegrationForm(prev => ({ ...prev, whatsapp_profile_picture_url: e.target.value }))} placeholder="https://..." style={{ width: '100%', marginTop: '6px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)' }} />
                          </div>
                          <div style={{ gridColumn: '2 / 4' }}>
                            <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)' }}>About</label>
                            <input value={integrationForm.whatsapp_profile_about || ''} onChange={e => setIntegrationForm(prev => ({ ...prev, whatsapp_profile_about: e.target.value }))} placeholder="Professional property management and owner support." style={{ width: '100%', marginTop: '6px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)' }} />
                          </div>
                          <div style={{ gridColumn: '1 / 3' }}>
                            <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)' }}>Category</label>
                            <input value={integrationForm.whatsapp_business_category || ''} onChange={e => setIntegrationForm(prev => ({ ...prev, whatsapp_business_category: e.target.value }))} placeholder="Property Management" style={{ width: '100%', marginTop: '6px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)' }} />
                          </div>
                          <div>
                            <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)' }}>Website</label>
                            <input value={integrationForm.whatsapp_business_website || ''} onChange={e => setIntegrationForm(prev => ({ ...prev, whatsapp_business_website: e.target.value }))} placeholder="https://..." style={{ width: '100%', marginTop: '6px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)' }} />
                          </div>
                          <p style={{ gridColumn: '1 / -1', margin: 0, color: 'var(--text-muted)', fontSize: '11.5px', lineHeight: 1.45 }}>
                            Saved now for WhatsApp Business profile management. When Cloud API permissions are connected, these fields can be pushed to Meta automatically.
                          </p>
                        </div>
                        {integrationForm.whatsapp_provider === 'cloud_api' && (
                          <>
                            <div>
                              <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)' }}>Phone Number ID</label>
                              <input value={integrationForm.whatsapp_phone_number_id || ''} onChange={e => setIntegrationForm(prev => ({ ...prev, whatsapp_phone_number_id: e.target.value }))} placeholder="Meta phone number ID" style={{ width: '100%', marginTop: '6px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)' }} />
                            </div>
                            <div>
                              <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)' }}>WhatsApp Business Account ID</label>
                              <input value={integrationForm.whatsapp_business_account_id || ''} onChange={e => setIntegrationForm(prev => ({ ...prev, whatsapp_business_account_id: e.target.value }))} placeholder="WABA ID" style={{ width: '100%', marginTop: '6px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)' }} />
                            </div>
                            <div>
                              <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)' }}>Access Token Env Name</label>
                              <input value={integrationForm.whatsapp_access_token_env || ''} onChange={e => setIntegrationForm(prev => ({ ...prev, whatsapp_access_token_env: e.target.value }))} placeholder={`WHATSAPP_${integrationBrandId.replace(/[^a-z0-9]/gi, '_').toUpperCase()}_ACCESS_TOKEN`} style={{ width: '100%', marginTop: '6px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)' }} />
                            </div>
                            <div>
                              <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)' }}>Webhook Verify Token</label>
                              <input value={integrationForm.whatsapp_verify_token || ''} onChange={e => setIntegrationForm(prev => ({ ...prev, whatsapp_verify_token: e.target.value }))} placeholder={`verify_${integrationBrandId}`} style={{ width: '100%', marginTop: '6px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)' }} />
                            </div>
                            <div style={{ gridColumn: '1 / -1', padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(37,211,102,0.25)', background: 'rgba(37,211,102,0.08)', color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.45 }}>
                              Webhook callback path: <strong style={{ color: 'var(--text-primary)' }}>/api/webhooks/whatsapp</strong>. Keep the real access token in the server .env, not inside this form.
                            </div>
                            <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-base)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                                <div>
                                  <strong style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-primary)' }}>Backend setup check</strong>
                                  <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Confirms the saved IDs and server token before you try sending.</span>
                                </div>
                                <button type="button" onClick={checkBrandIntegrationStatus} disabled={integrationChecking} className="btn btn-ghost btn-sm" style={{ whiteSpace: 'nowrap' }}>
                                  <i className="fas fa-plug"></i> {integrationChecking ? 'Checking...' : 'Check Setup'}
                                </button>
                              </div>
                              {integrationStatus?.brand_id === integrationBrandId && (
                                <div style={{ padding: '9px 10px', borderRadius: '10px', background: integrationStatus.whatsapp?.api_ready ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', border: integrationStatus.whatsapp?.api_ready ? '1px solid rgba(16,185,129,0.28)' : '1px solid rgba(245,158,11,0.28)', color: integrationStatus.whatsapp?.api_ready ? '#10b981' : '#d97706', fontSize: '12px', fontWeight: 700, lineHeight: 1.45 }}>
                                  {integrationStatus.whatsapp?.api_ready ? (
                                    <>Ready. Backend found the phone ID, token variable, and webhook token.</>
                                  ) : (
                                    <>Needs: {(integrationStatus.whatsapp?.missing || []).join(', ') || 'Cloud API provider not selected'}.</>
                                  )}
                                  <div style={{ marginTop: '4px', color: 'var(--text-muted)', fontWeight: 600 }}>
                                    Callback URL: {integrationStatus.whatsapp?.webhook_callback_url || '/api/webhooks/whatsapp'}
                                  </div>
                                </div>
                              )}
                            </div>
                          </>
                        )}
                          </>
                        )}
                        {activeIntegrationChannel === 'call' && (
                          <>
                        <div>
                          <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)' }}>Call Provider</label>
                          <select value={integrationForm.call_provider || 'manual'} onChange={e => setIntegrationForm(prev => ({ ...prev, call_provider: e.target.value }))} style={{ width: '100%', marginTop: '6px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                            <option value="manual">Manual dialler</option>
                            <option value="twilio">Twilio Voice</option>
                            <option value="aircall">Aircall</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)' }}>Call Number</label>
                          <input value={integrationForm.call_number || ''} onChange={e => setIntegrationForm(prev => ({ ...prev, call_number: e.target.value }))} placeholder="+27123456789" style={{ width: '100%', marginTop: '6px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)' }} />
                        </div>
                          </>
                        )}
                      </div>
                      {activeIntegrationChannel === 'email' && (
                        <div className="email-connection-guide">
                          <div className="email-connection-guide__header">
                            <div>
                              <span>Connection guide</span>
                              <strong>Set up Gmail or Outlook OAuth</strong>
                            </div>
                            <small>Use these before clicking Connect.</small>
                          </div>
                          <div className="email-connection-guide__grid">
                            <article>
                              <h4><i className="fab fa-google"></i> Gmail</h4>
                              <ol>
                                <li>Create a Google OAuth Web client in Google Cloud.</li>
                                <li>Add redirect URI <code>https://optima-crm.onrender.com/api/integrations/gmail/callback</code>.</li>
                                <li>Enable Gmail API in Google Cloud Library.</li>
                                <li>Add Render variables <code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code>, and optional <code>GOOGLE_REDIRECT_URI</code>.</li>
                                <li>Save, rebuild, deploy, then click Connect Gmail.</li>
                              </ol>
                              <p>Scopes used: Gmail send, Gmail read-only, and profile email.</p>
                            </article>
                            <article>
                              <h4><i className="fab fa-microsoft"></i> Outlook</h4>
                              <ol>
                                <li>Create an App Registration in Microsoft Entra ID.</li>
                                <li>Account type: any organization and personal Microsoft accounts.</li>
                                <li>Add redirect URI <code>https://optima-crm.onrender.com/api/integrations/outlook/callback</code>.</li>
                                <li>Add delegated Graph permissions: <code>User.Read</code>, <code>Mail.Read</code>, <code>Mail.Send</code>, <code>offline_access</code>, <code>openid</code>, <code>email</code>, <code>profile</code>.</li>
                                <li>Add Render variables <code>MICROSOFT_CLIENT_ID</code>, <code>MICROSOFT_CLIENT_SECRET</code>, <code>MICROSOFT_TENANT_ID=common</code>.</li>
                                <li>Save, rebuild, deploy, then click Connect Outlook.</li>
                              </ol>
                              <p>Outlook sync imports Inbox, Sent, Junk, Drafts, and Deleted folders.</p>
                            </article>
                          </div>
                        </div>
                      )}
                      {activeIntegrationChannel === 'email' && (
                        <div className="brand-email-accounts-panel">
                          <div className="brand-email-accounts-header">
                            <div>
                              <span>Email accounts for {selectedIntegrationBrand.name}</span>
                              <strong>{emailAccounts.length} account{emailAccounts.length === 1 ? '' : 's'} configured</strong>
                            </div>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={addEmailAccountToIntegration}>
                              <i className="fas fa-plus"></i> Add email account
                            </button>
                          </div>
                          {emailAccounts.length === 0 ? (
                            <div className="brand-email-empty">
                              Add each real inbox here, for example TaskGo Support and TaskGo Info. Each account can use its own Render password variable.
                            </div>
                          ) : (
                            <div className="brand-email-account-list">
                              {emailAccounts.map(account => (
                                <div key={account.id} className="brand-email-account-card">
                                  <div className="brand-email-account-card__top">
                                    <select value={account.provider} onChange={e => updateEmailAccountInIntegration(account.id, { provider: e.target.value })}>
                                      <option value="outlook">Outlook</option>
                                      <option value="yahoo">Yahoo</option>
                                      <option value="smtp">SMTP</option>
                                      <option value="gmail">Gmail</option>
                                    </select>
                                    <label>
                                      <input
                                        type="radio"
                                        checked={Boolean(account.is_default)}
                                        onChange={() => updateEmailAccountInIntegration(account.id, { is_default: true })}
                                      />
                                      Default
                                    </label>
                                    <button type="button" onClick={() => removeEmailAccountFromIntegration(account.id)} title="Remove account">
                                      <i className="fas fa-trash"></i>
                                    </button>
                                  </div>
                                  <div className="brand-email-account-grid">
                                    <label>
                                      Account label
                                      <input value={account.label || ''} onChange={e => updateEmailAccountInIntegration(account.id, { label: e.target.value })} placeholder="TaskGo Support" />
                                    </label>
                                    <label>
                                      Email address
                                      <input value={account.email || ''} onChange={e => updateEmailAccountInIntegration(account.id, { email: e.target.value, smtp_username: account.smtp_username || e.target.value })} placeholder="support@taskgo.com" />
                                    </label>
                                    <label>
                                      Reply-to
                                      <input value={account.reply_to || ''} onChange={e => updateEmailAccountInIntegration(account.id, { reply_to: e.target.value })} placeholder="optional" />
                                    </label>
                                    {account.provider !== 'gmail' && (
                                      <>
                                        <label>
                                          SMTP host
                                          <input value={account.smtp_host || ''} onChange={e => updateEmailAccountInIntegration(account.id, { smtp_host: e.target.value })} placeholder="smtp-mail.outlook.com" />
                                        </label>
                                        <label>
                                          Port
                                          <input value={account.smtp_port || ''} onChange={e => updateEmailAccountInIntegration(account.id, { smtp_port: e.target.value })} placeholder="587" />
                                        </label>
                                        <label>
                                          Username
                                          <input value={account.smtp_username || ''} onChange={e => updateEmailAccountInIntegration(account.id, { smtp_username: e.target.value })} placeholder={account.email || 'same as email'} />
                                        </label>
                                        <label>
                                          Render password variable
                                          <input value={account.smtp_password_env || ''} onChange={e => updateEmailAccountInIntegration(account.id, { smtp_password_env: e.target.value })} placeholder="TASKGO_SUPPORT_OUTLOOK_PASSWORD" />
                                        </label>
                                        <label className="brand-email-account-checkbox">
                                          <input type="checkbox" checked={Boolean(account.smtp_secure)} onChange={e => updateEmailAccountInIntegration(account.id, { smtp_secure: e.target.checked })} />
                                          SSL/TLS immediately
                                        </label>
                                      </>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {activeIntegrationChannel === 'email' && (
                        <div className="brand-email-test-panel">
                          <div>
                            <span>Test the saved email setup</span>
                            <strong>{emailAccounts.length ? 'Send from the default account' : 'Add an email account first'}</strong>
                            <p>After you add the matching password variable in Render and save this setup, send a test email here.</p>
                          </div>
                          <div className="brand-email-test-actions">
                            <input
                              value={gmailTestRecipient}
                              onChange={e => setGmailTestRecipient(e.target.value)}
                              placeholder="test recipient email"
                            />
                            {integrationForm.email_provider === 'gmail' && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={gmailStatus?.connected ? disconnectGmail : startGmailConnection}
                                disabled={gmailConnecting || (integrationForm.email_provider === 'gmail' && gmailStatus?.configured === false)}
                              >
                                <i className={`fas ${gmailStatus?.connected ? 'fa-unlink' : 'fa-link'}`}></i> {gmailConnecting ? 'Opening...' : gmailStatus?.connected ? 'Disconnect' : 'Connect Gmail'}
                              </button>
                            )}
                            {integrationForm.email_provider === 'outlook' && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={startOutlookConnection}
                                disabled={gmailConnecting || outlookStatus?.configured === false}
                              >
                                <i className="fas fa-link"></i> {gmailConnecting ? 'Opening...' : outlookStatus?.connected ? `Reconnect Outlook` : 'Connect Outlook'}
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={integrationForm.email_provider === 'gmail' && gmailStatus?.connected ? sendGmailTestEmail : (integrationForm.email_provider === 'outlook' && outlookStatus?.connected) || integrationForm.email_provider === 'yahoo' || integrationForm.email_provider === 'smtp' ? sendSmtpProviderTestEmail : () => showToast('Connect Gmail or Outlook first, or configure Yahoo/SMTP account settings.', true)}
                              disabled={gmailTesting || (integrationForm.email_provider === 'gmail' && !gmailStatus?.connected) || (integrationForm.email_provider === 'outlook' && !outlookStatus?.connected)}
                            >
                              <i className="fas fa-paper-plane"></i> {gmailTesting ? 'Sending...' : 'Send test email'}
                            </button>
                          </div>
                        </div>
                      )}
                      {activeIntegrationChannel === 'email' && (
                        <>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)', marginTop: '14px' }}>Email Signature</label>
                          <textarea value={integrationForm.email_signature || ''} onChange={e => setIntegrationForm(prev => ({ ...prev, email_signature: e.target.value }))} rows={4} placeholder="Best,\nBrand Team" style={{ width: '100%', marginTop: '6px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)', resize: 'vertical' }} />
                        </>
                      )}
                      {activeIntegrationChannel === 'email' && (
                        <div style={{ marginTop: '14px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.45 }}>
                          Automations are managed from the brand's Auto drip Sequences tab. Connect a real email provider before using automatic sending.
                        </div>
                      )}
                      <button onClick={saveBrandIntegration} disabled={integrationSaving} className="btn btn-primary" style={{ width: '100%', marginTop: '16px', background: selectedIntegrationBrand.color, border: 'none', color: '#fff' }}>
                        <i className="fas fa-save"></i> {integrationSaving ? 'Saving...' : `Save ${activeIntegrationOption.title} Setup`}
                      </button>
                    </section>}

                    {user.role !== 'admin' && (
                      <section style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                          <span style={{ width: '40px', height: '40px', display: 'grid', placeItems: 'center', borderRadius: '12px', background: `${selectedIntegrationBrand.color}18`, color: selectedIntegrationBrand.color }}>
                            <i className="fas fa-book-open"></i>
                          </span>
                          <div>
                            <h3 style={{ margin: 0, fontSize: '17px', color: 'var(--text-primary)' }}>Template Library</h3>
                            <p style={{ margin: '3px 0 0', color: 'var(--text-muted)', fontSize: '12px' }}>Browse approved communication templates. Integration setup is managed by administrators.</p>
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) repeat(3, minmax(120px, .55fr))', gap: '10px' }}>
                          <label>
                            <span style={{ display: 'block', marginBottom: '6px', fontSize: '11px', fontWeight: 850, color: 'var(--text-secondary)' }}>Brand</span>
                            <select value={integrationBrandId} onChange={e => setIntegrationBrandId(e.target.value)} style={{ width: '100%' }}>
                              {activeBrands.map(brand => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
                            </select>
                          </label>
                          {integrationChannelOptions.map(option => (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => setActiveIntegrationChannel(option.id)}
                              style={{ alignSelf: 'end', minHeight: '48px', borderRadius: '12px', border: activeIntegrationChannel === option.id ? `1.5px solid ${option.tone}` : '1px solid var(--border)', background: activeIntegrationChannel === option.id ? `${option.tone}14` : 'var(--bg-base)', color: activeIntegrationChannel === option.id ? option.tone : 'var(--text-secondary)', fontWeight: 850, cursor: 'pointer' }}
                            >
                              <i className={`fas ${option.icon}`} style={{ marginRight: '7px' }}></i>{option.title}
                            </button>
                          ))}
                        </div>
                      </section>
                    )}

                    <section style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '22px', boxShadow: 'var(--shadow-sm)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', gap: '12px' }}>
                        <div>
                          <h3 style={{ margin: 0, fontSize: '17px', color: 'var(--text-primary)' }}>{activeIntegrationOption.title} Templates</h3>
                          <p style={{ margin: '2px 0 0', color: 'var(--text-muted)', fontSize: '12px' }}>{user.role === 'admin' ? 'Create and manage reusable templates.' : 'Approved templates available for your communications.'} Variables: {'{{name}}'}, {'{{first_name}}'}, {'{{brand}}'}.</p>
                        </div>
                        {user.role === 'admin' && <button className="btn btn-ghost" onClick={resetTemplateForm}><i className="fas fa-plus"></i> New</button>}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: user.role === 'admin' ? '1fr 1fr' : '1fr', gap: '16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '510px', overflowY: 'auto' }}>
                          {brandTemplates.length === 0 && (
                            <div style={{ padding: '24px', border: '1px dashed var(--border)', borderRadius: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>No saved {activeIntegrationOption.title.toLowerCase()} templates yet for {selectedIntegrationBrand.name}.</div>
                          )}
                          {brandTemplates.map(t => (
                            <div key={t.id} style={{ padding: '12px', border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--bg-base)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                                <div>
                                  <strong style={{ color: 'var(--text-primary)' }}>{t.name}</strong>
                                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{t.channel}{t.subject ? ` | ${t.subject}` : ''}</div>
                                </div>
                                {user.role === 'admin' && <div style={{ display: 'flex', gap: '6px' }}>
                                  <button className="btn btn-ghost btn-sm" onClick={() => startEditMessageTemplate(t)} style={{ padding: '5px 8px' }}><i className="fas fa-pen"></i></button>
                                  <button className="btn btn-ghost btn-sm" onClick={() => deleteMessageTemplate(t.id)} style={{ padding: '5px 8px', color: '#ef4444' }}><i className="fas fa-trash"></i></button>
                                </div>}
                              </div>
                              <p style={{ margin: '8px 0 0', color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.5 }}>{t.body.slice(0, 140)}{t.body.length > 140 ? '...' : ''}</p>
                            </div>
                          ))}
                        </div>
                        {user.role === 'admin' && <div style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', background: 'var(--bg-base)' }}>
                          <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)' }}>Template Type</label>
                          <div style={{ width: '100%', margin: '6px 0 10px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontWeight: 700 }}>
                            <i className={`fas ${activeIntegrationOption.icon}`} style={{ color: activeIntegrationOption.tone, marginRight: '8px' }}></i>{activeIntegrationOption.title}
                          </div>
                          <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)' }}>Template Name</label>
                          <input value={templateForm.name} onChange={e => setTemplateForm(prev => ({ ...prev, name: e.target.value }))} placeholder="First follow-up" style={{ width: '100%', margin: '6px 0 10px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)' }} />
                          {templateForm.channel === 'email' && (
                            <>
                              <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)' }}>Subject</label>
                              <input value={templateForm.subject} onChange={e => setTemplateForm(prev => ({ ...prev, subject: e.target.value }))} placeholder="Hi {{first_name}}" style={{ width: '100%', margin: '6px 0 10px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)' }} />
                            </>
                          )}
                          <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)' }}>Body / Script</label>
                          <textarea value={templateForm.body} onChange={e => setTemplateForm(prev => ({ ...prev, body: e.target.value }))} rows={10} placeholder="Hi {{first_name}}, this is {{brand}}..." style={{ width: '100%', marginTop: '6px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)', resize: 'vertical' }} />
                          <button onClick={saveMessageTemplate} disabled={templateSaving} className="btn btn-primary" style={{ width: '100%', marginTop: '12px', background: selectedIntegrationBrand.color, border: 'none', color: '#fff' }}>
                            <i className="fas fa-save"></i> {templateSaving ? 'Saving...' : templateForm.id ? 'Update Template' : 'Save Template'}
                          </button>
                        </div>}
                      </div>
                    </section>
                  </div>
                );
              })()}
            </div>
          )}

          {selectedBrand && (
            <div style={{ animation: 'fadeIn 0.3s' }}>
              {/* Category Tab Selector */}
              <div style={{ display: 'flex', gap: '24px', marginBottom: '32px', borderBottom: '2px solid var(--border)' }}>
                <button onClick={() => setBrandSubTab('leads')} style={{ padding: '16px 8px', background: 'transparent', border: 'none', borderBottom: brandSubTab === 'leads' ? `3px solid ${selectedBrand.color}` : '3px solid transparent', color: brandSubTab === 'leads' ? selectedBrand.color : 'var(--text-secondary)', fontWeight: '700', fontSize: '15px', cursor: 'pointer', transition: 'all 0.2s', marginBottom: '-2px' }}>
                  <i className="fas fa-address-book" style={{ marginRight: '8px' }}></i> Leads Base ({leads.length})
                </button>
                <button onClick={() => setBrandSubTab('sequences')} style={{ padding: '16px 8px', background: 'transparent', border: 'none', borderBottom: brandSubTab === 'sequences' ? `3px solid ${selectedBrand.color}` : '3px solid transparent', color: brandSubTab === 'sequences' ? selectedBrand.color : 'var(--text-secondary)', fontWeight: '700', fontSize: '15px', cursor: 'pointer', transition: 'all 0.2s', marginBottom: '-2px' }}>
                  <i className="fas fa-envelope-open-text" style={{ marginRight: '8px' }}></i> Auto drip Sequences ({sequences.length})
                </button>
                <button onClick={() => { setBrandSubTab('tasks'); fetchTasksForActiveBrand(); }} style={{ padding: '16px 8px', background: 'transparent', border: 'none', borderBottom: brandSubTab === 'tasks' ? `3px solid ${selectedBrand.color}` : '3px solid transparent', color: brandSubTab === 'tasks' ? selectedBrand.color : 'var(--text-secondary)', fontWeight: '700', fontSize: '15px', cursor: 'pointer', transition: 'all 0.2s', marginBottom: '-2px' }}>
                  <i className="fas fa-tasks" style={{ marginRight: '8px' }}></i> Team Tasks Activity
                </button>
              </div>

              {/* C.1 WORKSPACE - LEADS CONTROL TAB */}
              {brandSubTab === 'leads' && (
                <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start' }}>
                  
                  {/* LEADS LIST PANEL & CONTROLS */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    
                    {/* Brand Snapshot Metrics - fully editable per brand */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
                        <h3 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-secondary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                          <i className="fas fa-bullseye" style={{ color: selectedBrand.color }}></i> Brand Snapshot
                        </h3>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { const el = document.getElementById('snapshot-editor-panel'); if (el) (el as HTMLDetailsElement).open = !(el as HTMLDetailsElement).open; }}><i className="fas fa-sliders"></i> Edit cards</button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                        {(snapshotCards[selectedBrand.id] || []).filter(c => c.active !== false).map(card => {
                          const current = getSnapshotCardValue(card, leads);
                          const pct = Math.min(100, Math.round((current / Math.max(1, card.target)) * 100));
                          return (
                            <div key={card.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px', boxShadow: 'var(--shadow-sm)', position: 'relative' }}>
                              <button title="Delete snapshot item" onClick={() => handleDeleteSnapshotCard(selectedBrand.id, card.id)} style={{ position: 'absolute', top: '10px', right: '10px', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><i className="fas fa-times"></i></button>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingRight: '20px' }}>
                                <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{card.label}</span>
                                <span style={{ display: 'inline-flex', width: '28px', height: '28px', borderRadius: '50%', background: `oklch(from ${card.color} l c h / 0.12)`, color: card.color, alignItems: 'center', justifyContent: 'center' }}>
                                  <i className={`fas ${card.icon}`} style={{ fontSize: '12px' }}></i>
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '8px' }}>
                                <span style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)' }}>{current}</span>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>/ {card.target} {card.unit}</span>
                                <span style={{ marginLeft: 'auto', fontSize: '12px', fontWeight: '700', color: card.color }}>{pct}%</span>
                              </div>
                              <div style={{ width: '100%', height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ width: `${pct}%`, height: '100%', background: card.color, borderRadius: '3px', transition: 'width 0.3s' }}></div>
                              </div>
                              <div style={{ marginTop: '8px', fontSize: '10px', color: 'var(--text-muted)' }}>Field: {card.fieldKey}{card.matchValue ? ` • Match: ${card.matchValue}` : ''}</div>
                            </div>
                          );
                        })}
                      </div>
                      {(() => {
                        const snapshotSource = snapshotForm.fieldKey || 'segment';
                        const segmentOptions = getBrandSegmentOptions(selectedBrand.id).map(seg => ({ label: seg.label, value: seg.value, color: seg.color, icon: seg.icon }));
                        const stageOptions = getBrandStageOptions(selectedBrand.id).map(stage => ({ label: stage, value: stage, color: getStageColor(stage), icon: 'fas fa-table-columns' }));
                        const valueOptions = snapshotSource === 'segment' ? segmentOptions : snapshotSource === 'funnel_stage' ? stageOptions : [];
                        return (
                          <details id="snapshot-editor-panel" className="snapshot-editor-panel snapshot-editor-panel--data">
                            <summary><i className="fas fa-plus-circle"></i> Add data snapshot <span>Track a real segment, stage, or total count.</span></summary>
                            <div className="snapshot-editor-grid snapshot-editor-grid--data">
                              <label>
                                Source
                                <select value={snapshotSource} onChange={e => setSnapshotForm(prev => ({ ...prev, fieldKey: e.target.value, matchValue: '', label: '' }))}>
                                  <option value="segment">Segment / lead type</option>
                                  <option value="funnel_stage">Pipeline stage</option>
                                  <option value="__total__">Total leads</option>
                                </select>
                              </label>
                              {snapshotSource !== '__total__' && (
                                <label>
                                  Track
                                  <select value={snapshotForm.matchValue} onChange={e => {
                                    const item = valueOptions.find(opt => opt.value === e.target.value);
                                    setSnapshotForm(prev => ({ ...prev, matchValue: e.target.value, label: prev.label || item?.label || '', color: item?.color || prev.color }));
                                  }}>
                                    <option value="">Choose {snapshotSource === 'segment' ? 'segment' : 'stage'}</option>
                                    {valueOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                                  </select>
                                </label>
                              )}
                              <label>
                                Label
                                <input value={snapshotForm.label} onChange={e => setSnapshotForm(prev => ({ ...prev, label: e.target.value }))} placeholder="Auto or custom label" />
                              </label>
                              <label>
                                Goal
                                <input value={snapshotForm.target} onChange={e => setSnapshotForm(prev => ({ ...prev, target: e.target.value }))} placeholder="10" />
                              </label>
                              <label>
                                Unit
                                <input value={snapshotForm.unit} onChange={e => setSnapshotForm(prev => ({ ...prev, unit: e.target.value }))} placeholder="Leads" />
                              </label>
                              <label>
                                Color
                                <input value={snapshotForm.color} onChange={e => setSnapshotForm(prev => ({ ...prev, color: e.target.value }))} placeholder="#8B5CF6" />
                              </label>
                              <button className="btn btn-primary btn-sm" onClick={() => handleAddSnapshotCard(selectedBrand.id)}><i className="fas fa-plus"></i> Add</button>
                            </div>
                          </details>
                        );
                      })()}
                    </div>

                    {selectedBrand.id === 'taskgo' && (() => {
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
                        { label: 'Contractor roster', value: uniquePeople, icon: 'fa-users', color: '#2563eb' },
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

                    {selectedBrand.id === 'idao' && (() => {
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


                    {['optimaviz', 'idao'].includes(selectedBrand.id) && (() => {
                      const segmentOptions = getBrandSegmentOptions(selectedBrand.id) || [];
                      const currentStages = getStageFilterOptions();
                      const segmentCount = (segValue: string) => leads.filter(l => selectedBrand.id === 'optimaviz' ? getOptimavizLeadSegment(l) === segValue : getIdaoLeadSegment(l) === segValue).length;
                      const stageCount = (stage: string) => leads.filter(l => {
                        const segment = selectedBrand.id === 'optimaviz' ? getOptimavizLeadSegment(l) : getIdaoLeadSegment(l);
                        const leadStage = selectedBrand.id === 'optimaviz' ? getOptimavizLeadStage(l) : getIdaoLeadStage(l);
                        return (selectedSegmentFilter === 'all' || segment === selectedSegmentFilter) && leadStage === stage;
                      }).length;
                      return (
                        <div className="compact-lead-workspace-toolbar">
                          <div className="compact-lead-workspace-toolbar__title">
                            <strong>{selectedBrand.id === 'idao' ? 'IDAO workflow' : 'Optimaviz workflow'}</strong>
                            <span>{leadWorkspaceView === 'kanban' ? 'Kanban' : 'Table'} view · {filteredSortedLeads.length} visible leads</span>
                          </div>
                          <label>
                            Segment
                            <select value={selectedSegmentFilter} onChange={e => { setSelectedSegmentFilter(e.target.value); setSelectedStageFilter('all'); }}>
                              <option value="all">All segments ({leads.length})</option>
                              {segmentOptions.map(seg => <option key={seg.value} value={seg.value}>{seg.label} ({segmentCount(seg.value)})</option>)}
                            </select>
                          </label>
                          <label>
                            Stage
                            <select value={selectedStageFilter} onChange={e => setSelectedStageFilter(e.target.value)}>
                              <option value="all">All stages</option>
                              {currentStages.map(stage => <option key={stage} value={stage}>{stage} ({stageCount(stage)})</option>)}
                            </select>
                          </label>
                          {leadWorkspaceView === 'kanban' && (
                            <label className="kanban-search-field">
                              Search Kanban
                              <input value={kanbanSearchQuery} onChange={e => setKanbanSearchQuery(e.target.value)} placeholder="Name, email, phone, action..." />
                            </label>
                          )}
                          <div className="compact-view-toggle">
                            {(['table', 'kanban'] as const).map(view => <button key={view} type="button" onClick={() => setLeadWorkspaceView(view)} className={`${view} ${leadWorkspaceView === view ? 'active' : ''}`}>{view}</button>)}
                          </div>
                        </div>
                      );
                    })()}


                    {['optimaviz', 'idao'].includes(selectedBrand.id) && leadWorkspaceView === 'kanban' && (() => {
                      const activeSegment = selectedSegmentFilter === 'all'
                        ? (selectedBrand.id === 'optimaviz' ? 'demo_leads' : 'training_leads')
                        : (selectedBrand.id === 'optimaviz' ? normalizeOptimavizSegmentValue(selectedSegmentFilter) : normalizeIdaoSegmentValue(selectedSegmentFilter));
                      const columns = selectedBrand.id === 'optimaviz' ? getOptimavizStageOptionsForSegment(activeSegment) : getIdaoStageOptionsForSegment(activeSegment);
                      const kanbanSearch = kanbanSearchQuery.trim().toLowerCase();
                      const kanbanLeads = filteredSortedLeads
                        .filter(l => selectedBrand.id === 'optimaviz' ? getOptimavizLeadSegment(l) === activeSegment : getIdaoLeadSegment(l) === activeSegment)
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
                        <div className="kanban-compact-shell">
                          <div className="kanban-compact-summary">
                            <span>{kanbanLeads.length} matching lead{kanbanLeads.length === 1 ? '' : 's'}</span>
                            {kanbanSearch && <button type="button" onClick={() => setKanbanSearchQuery('')}>Clear search</button>}
                          </div>
                          <div className="kanban-compact-board">
                          {columns.map(stage => {
                            const stageLeads = kanbanLeads.filter(l => selectedBrand.id === 'optimaviz' ? getOptimavizLeadStage(l) === stage : getIdaoLeadStage(l) === stage);
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

                     {/* TABLE FRAME */}
                    <div className="lead-table-frame" style={{ display: ['optimaviz', 'idao'].includes(selectedBrand.id) && leadWorkspaceView === 'kanban' ? 'none' : undefined }}>
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
                      <ScrollArea.Root className="ScrollAreaRoot">
                        <ScrollArea.Viewport 
                          className="ScrollAreaViewport" 
                          ref={leadTableScrollRef}
                        >
                        <table>
                        <thead>
                          <tr>
                            <th style={{ width: '40px', padding: '14px 10px', textAlign: 'center', background: 'var(--bg-thead)' }}>
                              <input 
                                type="checkbox" 
                                checked={tableDisplayLeads.length > 0 && tableDisplayLeads.every(l => selectedLeadIds.has(l.id))}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedLeadIds(new Set([...selectedLeadIds, ...tableDisplayLeads.map(l => l.id)]));
                                  } else {
                                    const next = new Set(selectedLeadIds);
                                    tableDisplayLeads.forEach(l => next.delete(l.id));
                                    setSelectedLeadIds(next);
                                  }
                                }}
                                style={{ cursor: 'pointer', scale: '1.2' }}
                              />
                            </th>
                            {columnVisibility.has('name') && (
                              <th
                                onClick={() => handleSortColToggle('name')}
                                style={{
                                  cursor: 'pointer',
                                  position: 'sticky',
                                  left: '40px',
                                  zIndex: 11,
                                  background: 'var(--bg-thead)',
                                  boxShadow: '3px 0 8px -2px rgba(0,0,0,0.12)',
                                  borderRight: '1px solid var(--border)',
                                }}
                              >
                                Lead Name{renderSortIndicator('name')}
                              </th>
                            )}
                            {columnVisibility.has('organisation') && <th onClick={() => handleSortColToggle('organisation')} style={{ cursor: 'pointer' }}>Organisation{renderSortIndicator('organisation')}</th>}
                            {columnVisibility.has('email') && <th onClick={() => handleSortColToggle('email')} style={{ cursor: 'pointer' }}>Email{renderSortIndicator('email')}</th>}
                            {columnVisibility.has('phone') && <th onClick={() => handleSortColToggle('phone')} style={{ cursor: 'pointer' }}>Phone{renderSortIndicator('phone')}</th>}
                            {columnVisibility.has('segment') && <th onClick={() => handleSortColToggle('segment')} style={{ cursor: 'pointer' }}>Segment{renderSortIndicator('segment')}</th>}
                            {columnVisibility.has('service_type') && <th onClick={() => handleSortColToggle('service_type')} style={{ cursor: 'pointer' }}>Service Type{renderSortIndicator('service_type')}</th>}
                            {columnVisibility.has('stage') && <th onClick={() => handleSortColToggle('funnel_stage')} style={{ cursor: 'pointer' }}>Stage{renderSortIndicator('funnel_stage')}</th>}
                            {columnVisibility.has('next_action') && <th onClick={() => handleSortColToggle('next_action')} style={{ cursor: 'pointer' }}>Next Action{renderSortIndicator('next_action')}</th>}
                            {columnVisibility.has('follow_up_date') && <th onClick={() => handleSortColToggle('follow_up_date')} style={{ cursor: 'pointer' }}>Follow-Up Date{renderSortIndicator('follow_up_date')}</th>}
                            {columnVisibility.has('last_activity') && <th onClick={() => handleSortColToggle('last_activity')} style={{ cursor: 'pointer' }}>Last Activity{renderSortIndicator('last_activity')}</th>}
                            {columnVisibility.has('assigned_to') && <th onClick={() => handleSortColToggle('assigned_to')} style={{ cursor: 'pointer' }}>Assigned To{renderSortIndicator('assigned_to')}</th>}
                            
                            {/* custom dynamic keys */}
                            {getTableCustomFields().map(f => {
                              if (!columnVisibility.has(f.field_name)) return null;
                              return (
                                <th key={f.id} onClick={() => handleSortColToggle(f.field_name)} style={{ cursor: 'pointer', background: `oklch(from ${selectedBrand.color} l c h / 0.03)` }}>
                                  {formatColumnLabel(f.field_name)}{renderSortIndicator(f.field_name)}
                                </th>
                              );
                            })}

                            {columnVisibility.has('tags') && <th>Tags</th>}
                            {columnVisibility.has('added') && <th onClick={() => handleSortColToggle('created_at')} style={{ cursor: 'pointer' }}>Lead Date{renderSortIndicator('created_at')}</th>}
                            <th style={{ minWidth: '130px' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tableDisplayLeads.length === 0 ? (
                            <tr>
                              <td colSpan={11} style={{ textAlign: 'center', padding: '64px' }}>
                                <i className="fas fa-users" style={{ fontSize: '48px', color: 'var(--text-muted)', opacity: 0.3, marginBottom: '16px', display: 'block' }}></i>
                                {leads.length === 0 ? (
                                  <>
                                    <h4 style={{ marginBottom: '8px', color: 'var(--text-primary)' }}>No leads yet</h4>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px' }}>Add your first lead manually or import a CSV to get started.</p>
                                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                                      <button onClick={() => setAddLeadIsOpen(true)} className="btn btn-primary btn-add-lead" style={{ background: selectedBrand.color }}>
                                        <i className="fas fa-plus"></i> Add lead
                                      </button>
                                      <button onClick={() => setUploadIsOpen(true)} className="btn btn-ghost" style={{ fontSize: '13px', padding: '8px 16px' }}>
                                        <i className="fas fa-upload"></i> Import CSV
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <h4 style={{ marginBottom: '8px', color: 'var(--text-primary)' }}>No leads match your filters</h4>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '16px' }}>Try adjusting your search or stage filter.</p>
                                    <button onClick={() => { setSearchQuery(''); setSelectedStageFilter('all'); setSelectedSegmentFilter('all'); setSelectedDateWindow('all'); setSelectedDateFrom(''); setSelectedDateTo(''); }} className="btn btn-ghost" style={{ fontSize: '13px', padding: '8px 16px' }}>
                                      Clear filters
                                    </button>
                                  </>
                                )}
                              </td>
                            </tr>
                          ) : (
                            tableDisplayLeads.map(l => (
                              <tr
                                key={l.id}
                                onMouseEnter={() => setHoveredLeadId(l.id)}
                                onMouseLeave={() => setHoveredLeadId(null)}
                                onClick={() => {
                                  setActiveLead(l);
                                  loadLeadDetailsHistory(l.id);
                                }}
                                style={{
                                  cursor: 'pointer',
                                  background: activeLead?.id === l.id
                                    ? `oklch(from ${selectedBrand.color} l c h / 0.10)`
                                    : hoveredLeadId === l.id
                                      ? 'var(--row-hover-bg)'
                                      : 'transparent',
                                  transition: 'background 0.1s ease',
                                }}
                              >
                                
                                <td 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const next = new Set(selectedLeadIds);
                                    if (next.has(l.id)) {
                                      next.delete(l.id);
                                    } else {
                                      next.add(l.id);
                                    }
                                    setSelectedLeadIds(next);
                                  }}
                                  style={{ 
                                    width: '40px', 
                                    padding: '14px 10px', 
                                    textAlign: 'center',
                                    background: activeLead?.id === l.id
                                      ? `oklch(from ${selectedBrand.color} l c h / 0.10)`
                                      : hoveredLeadId === l.id
                                        ? 'var(--row-hover-bg)'
                                        : 'var(--bg-card)',
                                    transition: 'background 0.1s ease',
                                  }}
                                >
                                  <input 
                                    type="checkbox" 
                                    checked={selectedLeadIds.has(l.id)}
                                    onChange={() => {}}
                                    style={{ cursor: 'pointer', scale: '1.2' }}
                                  />
                                </td>

                                {columnVisibility.has('name') && (
                                  <td 
                                    className="cell-hover-parent"
                                    onClick={(e) => startEditingCell(e, l.id, 'name', l.name)}
                                    style={{
                                      fontWeight: '600',
                                      position: 'sticky',
                                      left: '40px',
                                      zIndex: 10,
                                      background: activeLead?.id === l.id
                                        ? `oklch(from ${selectedBrand.color} l c h / 0.10)`
                                        : hoveredLeadId === l.id
                                          ? 'var(--row-hover-bg)'
                                          : 'var(--bg-card)',
                                      boxShadow: '3px 0 8px -2px rgba(0,0,0,0.10)',
                                      borderRight: '1px solid var(--border)',
                                      transition: 'background 0.1s ease',
                                    }}
                                  >
                                    {editingCell?.leadId === l.id && editingCell?.field === 'name' ? (
                                      <input
                                        autoFocus
                                        type="text"
                                        value={editingCellValue}
                                        onClick={e => e.stopPropagation()}
                                        onChange={e => setEditingCellValue(e.target.value)}
                                        onBlur={() => saveEditingCell(l.id, 'name')}
                                        onKeyDown={e => handleCellKeyDown(e, l.id, 'name')}
                                        style={{
                                          padding: '2px 6px',
                                          border: `1px solid ${selectedBrand.color}`,
                                          borderRadius: '4px',
                                          fontSize: '12px',
                                          background: 'var(--bg-card)',
                                          color: 'var(--text-primary)',
                                          width: '100%',
                                          fontWeight: '600',
                                          outline: 'none'
                                        }}
                                      />
                                    ) : (
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                          <div style={{ width: '30px', height: '30px', borderRadius: '6px', background: `oklch(from ${selectedBrand.color} l c h / 0.12)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: selectedBrand.color, fontWeight: '700', fontSize: '12px' }}>
                                            {l.name.charAt(0)}
                                          </div>
                                          <span>{l.name}</span>
                                          {duplicateLeadIds.has(l.id) && (
                                            <span 
                                              style={{ 
                                                marginLeft: '8px', 
                                                fontSize: '10px', 
                                                background: selectedBrand.id === 'taskgo' ? '#f0fdf4' : '#fef2f2', 
                                                border: `1px solid ${selectedBrand.id === 'taskgo' ? '#bbf7d0' : '#fecaca'}`, 
                                                color: selectedBrand.id === 'taskgo' ? '#16a34a' : '#ef4444', 
                                                padding: '2px 6px', 
                                                borderRadius: '6px', 
                                                fontWeight: '700',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                              }}
                                              title={selectedBrand.id === 'taskgo' ? `Offers multiple services: ${(l.custom_fields?._allServices || []).join(', ')}` : "Duplicate record (shares Name/Email/Phone with another CRM lead)"}
                                            >
                                              {selectedBrand.id === 'taskgo'
                                                ? <><i className="fas fa-layer-group" style={{ fontSize: '9px' }}></i> Offers Multiple Services</>
                                                : <><i className="fas fa-copy" style={{ fontSize: '9px' }}></i> Duplicate</>
                                              }
                                            </span>
                                          )}
                                        </div>
                                        <i className="fas fa-pencil-alt cell-hover-edit" style={{ fontSize: '10px', color: 'var(--text-muted)' }}></i>
                                      </div>
                                    )}
                                  </td>
                                )}
                                
                                {columnVisibility.has('email') && (
                                  <td 
                                    className="cell-hover-parent"
                                    onClick={(e) => startEditingCell(e, l.id, 'email', l.email)}
                                    style={{ fontSize: '13px', position: 'relative' }}
                                  >
                                    {editingCell?.leadId === l.id && editingCell?.field === 'email' ? (
                                      <input
                                        autoFocus
                                        type="email"
                                        value={editingCellValue}
                                        onClick={e => e.stopPropagation()}
                                        onChange={e => setEditingCellValue(e.target.value)}
                                        onBlur={() => saveEditingCell(l.id, 'email')}
                                        onKeyDown={e => handleCellKeyDown(e, l.id, 'email')}
                                        style={{
                                          padding: '2px 6px',
                                          border: `1px solid ${selectedBrand.color}`,
                                          borderRadius: '4px',
                                          fontSize: '12px',
                                          background: 'var(--bg-card)',
                                          color: 'var(--text-primary)',
                                          width: '100%',
                                          outline: 'none'
                                        }}
                                      />
                                    ) : (
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                        <span>{l.email}</span>
                                        <i className="fas fa-pencil-alt cell-hover-edit" style={{ fontSize: '10px', color: 'var(--text-muted)' }}></i>
                                      </div>
                                    )}
                                  </td>
                                )}

                                {columnVisibility.has('phone') && (
                                  <td 
                                    className="cell-hover-parent"
                                    onClick={(e) => startEditingCell(e, l.id, 'phone', l.phone)}
                                    style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', position: 'relative' }}
                                  >
                                    {editingCell?.leadId === l.id && editingCell?.field === 'phone' ? (
                                      <input
                                        autoFocus
                                        type="text"
                                        value={editingCellValue}
                                        onClick={e => e.stopPropagation()}
                                        onChange={e => setEditingCellValue(e.target.value)}
                                        onBlur={() => saveEditingCell(l.id, 'phone')}
                                        onKeyDown={e => handleCellKeyDown(e, l.id, 'phone')}
                                        style={{
                                          padding: '2px 6px',
                                          border: `1px solid ${selectedBrand.color}`,
                                          borderRadius: '4px',
                                          fontSize: '12px',
                                          background: 'var(--bg-card)',
                                          color: 'var(--text-primary)',
                                          width: '100%',
                                          outline: 'none'
                                        }}
                                      />
                                    ) : (
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                        <span>{l.phone || '—'}</span>
                                        <i className="fas fa-pencil-alt cell-hover-edit" style={{ fontSize: '10px', color: 'var(--text-muted)' }}></i>
                                      </div>
                                    )}
                                  </td>
                                )}

                                {columnVisibility.has('organisation') && (
                                  <td className="cell-hover-parent" onClick={(e) => startEditingCell(e, l.id, 'custom:organisation', l.custom_fields?.organisation || l.custom_fields?.organization || l.custom_fields?.company || '')} style={{ fontSize: '13px', position: 'relative' }}>
                                    {editingCell?.leadId === l.id && editingCell?.field === 'custom:organisation' ? (
                                      <input autoFocus type="text" value={editingCellValue} onClick={e => e.stopPropagation()} onChange={e => setEditingCellValue(e.target.value)} onBlur={() => saveEditingCell(l.id, 'custom:organisation')} onKeyDown={e => handleCellKeyDown(e, l.id, 'custom:organisation')} style={{ padding: '2px 6px', border: `1px solid ${selectedBrand.color}`, borderRadius: '4px', fontSize: '12px', background: 'var(--bg-card)', color: 'var(--text-primary)', width: '100%', outline: 'none' }} />
                                    ) : (
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}><span>{l.custom_fields?.organisation || l.custom_fields?.organization || l.custom_fields?.company || '—'}</span><i className="fas fa-pencil-alt cell-hover-edit" style={{ fontSize: '10px', color: 'var(--text-muted)' }}></i></div>
                                    )}
                                  </td>
                                )}

                                {columnVisibility.has('segment') && (
                                  <td className="cell-hover-parent" onClick={(e) => startEditingCell(e, l.id, 'custom:segment', selectedBrand.id === 'optimaviz' ? getOptimavizLeadSegment(l) : selectedBrand.id === 'idao' ? getIdaoLeadSegment(l) : (l.custom_fields?.segment || ''))} style={{ fontSize: '13px', position: 'relative' }}>
                                    {editingCell?.leadId === l.id && editingCell?.field === 'custom:segment' ? (
                                      <select autoFocus value={editingCellValue} onClick={e => e.stopPropagation()} onChange={e => setEditingCellValue(e.target.value)} onBlur={() => saveEditingCell(l.id, 'custom:segment')} onKeyDown={e => handleCellKeyDown(e, l.id, 'custom:segment')} style={{ padding: '2px 6px', border: `1px solid ${selectedBrand.color}`, borderRadius: '4px', fontSize: '12px', background: 'var(--bg-card)', color: 'var(--text-primary)', width: '100%', outline: 'none' }}>
                                        {(getBrandSegmentOptions(selectedBrand.id) || []).map(seg => <option key={seg.value} value={seg.value}>{seg.label}</option>)}
                                      </select>
                                    ) : (
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>{renderLeadSegmentPill(selectedBrand.id === 'optimaviz' ? getOptimavizLeadSegment(l) : selectedBrand.id === 'idao' ? getIdaoLeadSegment(l) : l.custom_fields?.segment, l)}<i className="fas fa-pencil-alt cell-hover-edit" style={{ fontSize: '10px', color: 'var(--text-muted)' }}></i></div>
                                    )}
                                  </td>
                                )}


                                {columnVisibility.has('service_type') && (
                                  <td className="cell-hover-parent" onClick={(e) => startEditingCell(e, l.id, 'custom:service_type', l.custom_fields?.service_type || l.custom_fields?.service_focus || '')} style={{ fontSize: '13px', position: 'relative' }}>
                                    {editingCell?.leadId === l.id && editingCell?.field === 'custom:service_type' ? (
                                      <input autoFocus type="text" value={editingCellValue} onClick={e => e.stopPropagation()} onChange={e => setEditingCellValue(e.target.value)} onBlur={() => saveEditingCell(l.id, 'custom:service_type')} onKeyDown={e => handleCellKeyDown(e, l.id, 'custom:service_type')} style={{ padding: '2px 6px', border: `1px solid ${selectedBrand.color}`, borderRadius: '4px', fontSize: '12px', background: 'var(--bg-card)', color: 'var(--text-primary)', width: '100%', outline: 'none' }} />
                                    ) : (
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}><span>{l.custom_fields?.service_type || l.custom_fields?.service_focus || '—'}</span><i className="fas fa-pencil-alt cell-hover-edit" style={{ fontSize: '10px', color: 'var(--text-muted)' }}></i></div>
                                    )}
                                  </td>
                                )}

                                {columnVisibility.has('stage') && (
                                  <td 
                                    className="cell-hover-parent"
                                    onClick={(e) => startEditingCell(e, l.id, 'funnel_stage', selectedBrand.id === 'optimaviz' ? getOptimavizLeadStage(l) : selectedBrand.id === 'idao' ? getIdaoLeadStage(l) : l.funnel_stage)}
                                    style={{ position: 'relative' }}
                                  >
                                    {editingCell?.leadId === l.id && editingCell?.field === 'funnel_stage' ? (
                                      <select
                                        autoFocus
                                        value={editingCellValue}
                                        onClick={e => e.stopPropagation()}
                                        onChange={e => setEditingCellValue(e.target.value)}
                                        onBlur={() => saveEditingCell(l.id, 'funnel_stage')}
                                        onKeyDown={e => handleCellKeyDown(e, l.id, 'funnel_stage')}
                                        style={{
                                          padding: '2px 6px',
                                          border: `1px solid ${selectedBrand.color}`,
                                          borderRadius: '4px',
                                          fontSize: '12px',
                                          background: 'var(--bg-card)',
                                          color: 'var(--text-primary)',
                                          width: '100%',
                                          outline: 'none'
                                        }}
                                      >
                                        {getStageOptionsForLead(l).map(st => (
                                          <option key={st} value={st}>{st}</option>
                                        ))}
                                      </select>
                                    ) : (
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                        <span className="pill" style={{ background: `${getStageColor(selectedBrand.id === 'optimaviz' ? getOptimavizLeadStage(l) : selectedBrand.id === 'idao' ? getIdaoLeadStage(l) : l.funnel_stage)}18`, color: getStageColor(selectedBrand.id === 'optimaviz' ? getOptimavizLeadStage(l) : selectedBrand.id === 'idao' ? getIdaoLeadStage(l) : l.funnel_stage), border: `1px solid ${getStageColor(selectedBrand.id === 'optimaviz' ? getOptimavizLeadStage(l) : selectedBrand.id === 'idao' ? getIdaoLeadStage(l) : l.funnel_stage)}44` }}>{selectedBrand.id === 'optimaviz' ? getOptimavizLeadStage(l) : selectedBrand.id === 'idao' ? getIdaoLeadStage(l) : l.funnel_stage}</span>
                                        <i className="fas fa-pencil-alt cell-hover-edit" style={{ fontSize: '10px', color: 'var(--text-muted)' }}></i>
                                      </div>
                                    )}
                                  </td>
                                )}

                                {columnVisibility.has('next_action') && (
                                  <td className="cell-hover-parent" onClick={(e) => startEditingCell(e, l.id, 'custom:next_action', l.custom_fields?.next_action || '')} style={{ fontSize: '13px', position: 'relative' }}>
                                    {editingCell?.leadId === l.id && editingCell?.field === 'custom:next_action' ? (
                                      <input autoFocus type="text" value={editingCellValue} onClick={e => e.stopPropagation()} onChange={e => setEditingCellValue(e.target.value)} onBlur={() => saveEditingCell(l.id, 'custom:next_action')} onKeyDown={e => handleCellKeyDown(e, l.id, 'custom:next_action')} style={{ padding: '2px 6px', border: `1px solid ${selectedBrand.color}`, borderRadius: '4px', fontSize: '12px', background: 'var(--bg-card)', color: 'var(--text-primary)', width: '100%', outline: 'none' }} />
                                    ) : (
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}><span style={{ color: l.custom_fields?.next_action ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: 700 }}>{l.custom_fields?.next_action || '—'}</span><i className="fas fa-pencil-alt cell-hover-edit" style={{ fontSize: '10px', color: 'var(--text-muted)' }}></i></div>
                                    )}
                                  </td>
                                )}

                                {columnVisibility.has('follow_up_date') && (
                                  <td className="cell-hover-parent" onClick={(e) => startEditingCell(e, l.id, 'follow_up_date', l.follow_up_date || '')} style={{ fontSize: '13px', position: 'relative' }}>
                                    {editingCell?.leadId === l.id && editingCell?.field === 'follow_up_date' ? (
                                      <input autoFocus type="date" value={editingCellValue} onClick={e => e.stopPropagation()} onChange={e => setEditingCellValue(e.target.value)} onBlur={() => saveEditingCell(l.id, 'follow_up_date')} onKeyDown={e => handleCellKeyDown(e, l.id, 'follow_up_date')} style={{ padding: '2px 6px', border: `1px solid ${selectedBrand.color}`, borderRadius: '4px', fontSize: '12px', background: 'var(--bg-card)', color: 'var(--text-primary)', width: '100%', outline: 'none' }} />
                                    ) : (
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}><span>{l.follow_up_date || '—'}</span><i className="fas fa-pencil-alt cell-hover-edit" style={{ fontSize: '10px', color: 'var(--text-muted)' }}></i></div>
                                    )}
                                  </td>
                                )}

                                {columnVisibility.has('last_activity') && (
                                  <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{l.custom_fields?.last_activity || (l.updated_at ? new Date(l.updated_at).toLocaleDateString() : '—')}</td>
                                )}

                                {columnVisibility.has('assigned_to') && (
                                  <td style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 700 }}>{l.owner_name || l.custom_fields?.assigned_to || '—'}</td>
                                )}

                                {/* Render custom field data */}
                                {getTableCustomFields().map(f => {
                                  if (!columnVisibility.has(f.field_name)) return null;
                                  const isEditing = editingCell?.leadId === l.id && editingCell?.field === `custom:${f.field_name}`;
                                  const value = l.custom_fields && l.custom_fields[f.field_name] !== undefined ? String(l.custom_fields[f.field_name]) : '';
                                  
                                  return (
                                    <td 
                                      key={f.id} 
                                      className="cell-hover-parent"
                                      onClick={(e) => startEditingCell(e, l.id, `custom:${f.field_name}`, value)}
                                      style={{ fontSize: '13px', color: 'var(--text-secondary)', position: 'relative' }}
                                    >
                                      {isEditing ? (
                                        f.field_name === 'segment' ? (
                                          <select
                                            autoFocus
                                            value={editingCellValue}
                                            onClick={e => e.stopPropagation()}
                                            onChange={e => {
                                              setEditingCellValue(e.target.value);
                                            }}
                                            onBlur={() => saveEditingCell(l.id, `custom:${f.field_name}`)}
                                            onKeyDown={e => handleCellKeyDown(e, l.id, `custom:${f.field_name}`)}
                                            style={{
                                              padding: '2px 6px',
                                              border: `1px solid ${selectedBrand.color}`,
                                              borderRadius: '4px',
                                              fontSize: '12px',
                                              background: 'var(--bg-card)',
                                              color: 'var(--text-primary)',
                                              width: '100%',
                                              outline: 'none'
                                            }}
                                          >
                                            <option value="">Unassigned</option>
                                            {(getBrandSegmentOptions(selectedBrand.id) || []).map(seg => (
                                              <option key={seg.value} value={seg.value}>{seg.label}</option>
                                            ))}
                                          </select>
                                        ) : f.field_type === 'boolean' ? (
                                          <select
                                            autoFocus
                                            value={editingCellValue}
                                            onClick={e => e.stopPropagation()}
                                            onChange={e => setEditingCellValue(e.target.value)}
                                            onBlur={() => saveEditingCell(l.id, `custom:${f.field_name}`)}
                                            onKeyDown={e => handleCellKeyDown(e, l.id, `custom:${f.field_name}`)}
                                            style={{
                                              padding: '2px 6px',
                                              border: `1px solid ${selectedBrand.color}`,
                                              borderRadius: '4px',
                                              fontSize: '12px',
                                              background: 'var(--bg-card)',
                                              color: 'var(--text-primary)',
                                              width: '100%',
                                              outline: 'none'
                                            }}
                                          >
                                            <option value="">Blank</option>
                                            <option value="true">Yes</option>
                                            <option value="false">No</option>
                                          </select>
                                        ) : (
                                          <input
                                            autoFocus
                                            type="text"
                                            value={editingCellValue}
                                            onClick={e => e.stopPropagation()}
                                            onChange={e => setEditingCellValue(e.target.value)}
                                            onBlur={() => saveEditingCell(l.id, `custom:${f.field_name}`)}
                                            onKeyDown={e => handleCellKeyDown(e, l.id, `custom:${f.field_name}`)}
                                            style={{
                                              padding: '2px 6px',
                                              border: `1px solid ${selectedBrand.color}`,
                                              borderRadius: '4px',
                                              fontSize: '12px',
                                              background: 'var(--bg-card)',
                                              color: 'var(--text-primary)',
                                              width: '100%',
                                              outline: 'none'
                                            }}
                                          />
                                        )
                                      ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', minHeight: '24px' }}>
                                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                            {f.field_name === 'segment'
                                              ? renderLeadSegmentPill(value, l)
                                              : (f.field_name === 'service_category_name' && l.custom_fields?._allServices && l.custom_fields._allServices.length > 1)
                                                ? l.custom_fields._allServices.map((svc: string, idx: number) => (
                                                    <span key={idx} style={{ fontSize: '11px', background: `oklch(from ${selectedBrand.color} l c h / 0.1)`, color: selectedBrand.color, borderRadius: '5px', padding: '2px 7px', fontWeight: '600', whiteSpace: 'nowrap' }}>{svc}</span>
                                                  ))
                                                : (f.field_type === 'boolean' || ['quote_sent', 'payment_received'].includes(f.field_name))
                                                  ? (() => {
                                                      const boolVal = value === 'true' || value === 'TRUE' || value === '1';
                                                      return (
                                                        <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px', background: boolVal ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: boolVal ? '#059669' : '#dc2626', border: `1px solid ${boolVal ? '#6ee7b7' : '#fca5a5'}`, whiteSpace: 'nowrap' }}>
                                                          <i className={`fas ${boolVal ? 'fa-check' : 'fa-times'}`} style={{ marginRight: '4px' }}></i>
                                                          {f.field_name.toLowerCase().replace(/[\s_-]+/g, '').includes('quote') ? (boolVal ? 'Sent' : 'Not Sent') : (boolVal ? 'Yes' : 'No')}
                                                        </span>
                                                      );
                                                    })()
                                                  : normalizeFieldValue(value)
                                            }
                                          </div>
                                          <i className="fas fa-pencil-alt cell-hover-edit" style={{ fontSize: '10px', color: 'var(--text-muted)' }}></i>
                                        </div>
                                      )}
                                    </td>
                                  );
                                })}

                                {columnVisibility.has('tags') && (
                                  <td>
                                    {l.tags.length === 0 ? '—' : l.tags.map(t => (
                                      <span key={t} className="pill pill-amber" style={{ marginRight: '4px', fontSize: '11px' }}>{t}</span>
                                    ))}
                                  </td>
                                )}

                                {selectedBrand.id === 'optimaviz' && columnVisibility.has('trial_status_virtual') && (() => {
                                  const trial = getOptimavizTrialInfo(l);
                                  if (!trial.isTrialLead) return <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}></td>;
                                  return <td style={{ fontSize: '12px' }}><span style={{ color: trial.color, fontWeight: 800 }}>{trial.status}</span></td>;
                                })()}
                                {selectedBrand.id === 'optimaviz' && columnVisibility.has('days_remaining_virtual') && (() => {
                                  const trial = getOptimavizTrialInfo(l);
                                  if (!trial.isTrialLead) return <td style={{ minWidth: '150px', color: 'var(--text-muted)' }}></td>;
                                  const pct = Math.min(100, Math.max(0, Math.round(((OPTIMAVIZ_TRIAL_DAYS - trial.daysRemaining) / OPTIMAVIZ_TRIAL_DAYS) * 100)));
                                  return <td style={{ minWidth: '150px' }}><div style={{ fontSize: '11px', fontWeight: 800, color: trial.color, marginBottom: '4px' }}>{trial.daysRemaining} days</div><div style={{ height: '6px', background: 'var(--border)', borderRadius: '999px', overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: trial.color }}></div></div></td>;
                                })()}

                                {columnVisibility.has('added') && (
                                  <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                    {getLeadDateLabel(l) || '-'}
                                  </td>
                                )}

                                <td
                                  style={{ whiteSpace: 'nowrap', padding: '8px 12px' }}
                                >
                                  <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    opacity: hoveredLeadId === l.id ? 1 : 0,
                                    transform: hoveredLeadId === l.id ? 'translateY(0)' : 'translateY(4px)',
                                    transition: 'opacity 0.15s ease, transform 0.15s ease',
                                    pointerEvents: hoveredLeadId === l.id ? 'auto' : 'none',
                                  }}>
                                    {/* Email */}
                                    <button
                                      type="button"
                                      title="Send Email"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveLead(l);
                                        setSelectedBrandForEmail(selectedBrand);
                                        setActiveEmailLead(l);
                                        setEmailSubject(`Hi ${l.name.split(' ')[0]} - Update from ${selectedBrand.name}`);
                                        setEmailContent('');
                                        setEmailTemplateSel('');
                                        loadLeadDetailsHistory(l.id);
                                        setActiveTab('email-tracking');
                                      }}
                                      style={{
                                        width: '30px', height: '30px',
                                        borderRadius: '8px',
                                        border: `1px solid ${selectedBrand.color}33`,
                                        background: `oklch(from ${selectedBrand.color} l c h / 0.08)`,
                                        color: selectedBrand.color,
                                        cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '11px',
                                        transition: 'all 0.15s',
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.background = selectedBrand.color;
                                        e.currentTarget.style.color = '#fff';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.background = `oklch(from ${selectedBrand.color} l c h / 0.08)`;
                                        e.currentTarget.style.color = selectedBrand.color;
                                      }}
                                    >
                                      <i className="fas fa-envelope" />
                                    </button>

                                    {/* WhatsApp */}
                                    <button
                                      type="button"
                                      title="Send WhatsApp"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveLead(l);
                                        loadLeadDetailsHistory(l.id);
                                        setTimeout(() => setWaModalOpen(true), 50);
                                      }}
                                      style={{
                                        width: '30px', height: '30px',
                                        borderRadius: '8px',
                                        border: '1px solid #25D36633',
                                        background: '#25D36614',
                                        color: '#25D366',
                                        cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '11px',
                                        transition: 'all 0.15s',
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.background = '#25D366';
                                        e.currentTarget.style.color = '#fff';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.background = '#25D36614';
                                        e.currentTarget.style.color = '#25D366';
                                      }}
                                    >
                                      <i className="fab fa-whatsapp" />
                                    </button>

                                    {/* Call */}
                                    <button
                                      type="button"
                                      title="Log Call"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveLead(l);
                                        loadLeadDetailsHistory(l.id);
                                        setTimeout(() => setCallModalOpen(true), 50);
                                      }}
                                      style={{
                                        width: '30px', height: '30px',
                                        borderRadius: '8px',
                                        border: '1px solid #3B82F633',
                                        background: '#3B82F614',
                                        color: '#3B82F6',
                                        cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '11px',
                                        transition: 'all 0.15s',
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.background = '#3B82F6';
                                        e.currentTarget.style.color = '#fff';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.background = '#3B82F614';
                                        e.currentTarget.style.color = '#3B82F6';
                                      }}
                                    >
                                      <i className="fas fa-phone" />
                                    </button>

                                    {/* View Lead */}
                                    <button
                                      type="button"
                                      title="Open Lead"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveLead(l);
                                        loadLeadDetailsHistory(l.id);
                                      }}
                                      style={{
                                        width: '30px', height: '30px',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border)',
                                        background: 'var(--bg-base)',
                                        color: 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '11px',
                                        transition: 'all 0.15s',
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.background = 'var(--text-primary)';
                                        e.currentTarget.style.color = 'var(--bg-card)';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'var(--bg-base)';
                                        e.currentTarget.style.color = 'var(--text-secondary)';
                                      }}
                                    >
                                      <i className="fas fa-arrow-right" />
                                    </button>
                                  </div>
                                </td>

                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </ScrollArea.Viewport>
                    <ScrollArea.Scrollbar className="ScrollAreaScrollbar" orientation="horizontal">
                      <ScrollArea.Thumb className="ScrollAreaThumb" style={{ backgroundColor: selectedBrand?.color || 'var(--accent)' }} />
                    </ScrollArea.Scrollbar>
                    <ScrollArea.Corner />
                  </ScrollArea.Root>



                </div>

              </div>

                  {/* RIGHT-HAND LEAD OUTLINE DETAILS DRAWER PANEL */}
                  {activeLead && (
                    <div style={{ width: '420px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px', boxShadow: 'var(--shadow-lg)', animation: 'slideInRight 0.25s' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                        <h4 style={{ fontSize: '16px', fontWeight: '700' }}>Active Lead details</h4>
                        <button onClick={() => setActiveLead(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--text-muted)' }}>&times;</button>
                      </div>

                      {/* Header Avatar and Basic Details */}
                      <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '24px' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: `oklch(from ${selectedBrand.color} l c h / 0.15)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: selectedBrand.color, fontWeight: '700', fontSize: '18px' }}>
                          {activeLead.name.charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontSize: '16px', fontWeight: '700' }}>{activeLead.name}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Lead date {getLeadDateLabel(activeLead) || 'Not set'}</div>
                        </div>
                      </div>

                      {/* Highlight if Duplicate */}
                      {duplicateLeadIds.has(activeLead.id) && (
                        <div style={{
                          background: '#fffbeb',
                          border: '1.5px dashed #f59e0b',
                          borderRadius: '12px',
                          padding: '12px 14px',
                          color: '#b45309',
                          fontSize: '12.5px',
                          marginBottom: '20px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
                            <i className="fas fa-exclamation-triangle" style={{ color: '#d97706' }}></i>
                            <span>Duplicate Contact Detected</span>
                          </div>
                          <span style={{ fontSize: '11.5px', color: '#b45309', opacity: 0.9 }}>
                            This record shares the same Name, Email, or Phone number as another lead in your CRM database. You can review or keep it, or delete it using the button below.
                          </span>
                        </div>
                      )}

                      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', background: (activeLead.custom_fields?.do_not_contact === true || String(activeLead.custom_fields?.do_not_contact).toLowerCase() === 'true') ? 'rgba(239,68,68,0.10)' : 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 12px', marginBottom: '16px' }}>
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
                      <div className="lead-details-actions" style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
                        <button className="btn btn-primary btn-sm" onClick={() => {
                          setSelectedBrandForEmail(selectedBrand);
                          setActiveEmailLead(activeLead);
                          setEmailSubject(`Hi ${activeLead.name.split(' ')[0]} - Update from ${selectedBrand.name}`);
                          setEmailContent('');
                          setEmailTemplateSel('');
                          setActiveTab('email-tracking');
                        }} style={{ background: selectedBrand.color, fontSize: '12px', padding: '8px 12px' }}>
                          <i className="fas fa-envelope"></i> Email
                        </button>
                        <button className="btn btn-sm" onClick={() => setWaModalOpen(true)} style={{ background: '#25D366', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', padding: '8px 12px' }}>
                          <i className="fab fa-whatsapp"></i> WhatsApp
                        </button>
                        {activeLead.phone && (
                          <button className="btn btn-sm" onClick={() => handleStartSimulatedCall(activeLead)} style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', padding: '8px 12px' }}>
                            <i className="fas fa-phone-alt"></i> Call Dialler
                          </button>
                        )}
                        <button className="btn btn-ghost btn-sm" onClick={() => setCallModalOpen(true)} style={{ fontSize: '12px', padding: '8px 12px' }}>
                          <i className="fas fa-history"></i> Log Outcome
                        </button>
                      </div>

                      <div className="lead-detail-tabs" role="tablist" aria-label="Lead details sections">
                        {([
                          ['overview', 'Overview', 'fa-address-card'],
                          ['activity', 'Activity', 'fa-stream'],
                          ['communication', 'Comms', 'fa-comments'],
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
                      <div className="lead-details-info" style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
                        
                        <div className="info-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                          <span className="info-label" style={{ fontWeight: '600', color: 'var(--text-secondary)', fontSize: '13px' }}>Funnel Stage</span>
                          <select 
                            value={activeLead.funnel_stage} 
                            onChange={e => ['optimaviz', 'idao'].includes(selectedBrand.id) ? updateLeadStageAndDefaults(activeLead, e.target.value) : handleUpdateLeadField('funnel_stage', e.target.value)}
                            style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '13px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                          >
                            {getStageOptionsForLead(activeLead).map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>

                        <div className="info-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                          <span className="info-label" style={{ fontWeight: '600', color: 'var(--text-secondary)', fontSize: '13px' }}>Phone</span>
                          <input 
                            type="text" 
                            value={activeLead.phone} 
                            onChange={e => handleUpdateLeadField('phone', e.target.value)}
                            style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '13px', background: 'var(--bg-card)', border: '1px solid var(--border)', width: '160px', textAlign: 'right' }}
                          />
                        </div>

                        <div className="info-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                          <span className="info-label" style={{ fontWeight: '600', color: 'var(--text-secondary)', fontSize: '13px' }}>Email</span>
                          <input 
                            type="email" 
                            value={activeLead.email} 
                            onChange={e => handleUpdateLeadField('email', e.target.value)}
                            style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '13px', background: 'var(--bg-card)', border: '1px solid var(--border)', width: '160px', textAlign: 'right' }}
                          />
                        </div>

                        <div className="info-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                          <span className="info-label" style={{ fontWeight: '600', color: 'var(--text-secondary)', fontSize: '13px' }}>Assignee Owner</span>
                          <select 
                            value={activeLead.owner_id || ''} 
                            onChange={e => {
                              const selId = e.target.value;
                              const selUser = usersList.find(u => u.id === selId);
                              handleUpdateLeadField('owner_id', selId);
                              handleUpdateLeadField('owner_name', selUser ? selUser.name : 'Unassigned');
                            }}
                            style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '13px', background: 'var(--bg-card)', border: '1px solid var(--border)', width: '160px' }}
                          >
                            <option value="">Unassigned</option>
                            {usersList.map(u => (
                              <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                          </select>
                        </div>

                        {/* Rendering dynamic custom fields inputs */}
                        {customFields.map(f => (
                          <div key={f.id} className="info-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                            <span className="info-label" style={{ fontWeight: '600', color: 'var(--text-secondary)', fontSize: '13px' }}>{f.field_name === 'segment' ? 'Target Segment' : f.field_name}</span>
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
                                style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '13px', background: 'var(--bg-card)', border: '1px solid var(--border)', width: '160px', cursor: 'pointer', fontWeight: '500' }}
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
                                style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '13px', background: 'var(--bg-card)', border: '1px solid var(--border)', width: '160px', textAlign: 'right' }}
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
                              }} style={{ padding: '8px', fontSize: '11px', fontWeight: '700', borderRadius: '8px', border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.08)', color: '#f59e0b', cursor: 'pointer' }}><i className="fas fa-file-invoice" style={{ marginRight: '5px' }}></i>Mark Quote Sent</button>
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
                              }} style={{ padding: '8px', fontSize: '11px', fontWeight: '700', borderRadius: '8px', border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.08)', color: '#3b82f6', cursor: 'pointer' }}><i className="fas fa-phone" style={{ marginRight: '5px' }}></i>Schedule Call</button>
                              <button type="button" onClick={async () => {
                                const segment = getIdaoLeadSegment(activeLead);
                                const pf = activeLead.custom_fields || {};
                                const nextFields = { ...pf, segment, follow_up_status: 'Closed', outreach_status: 'Registered', registration_status: 'Registered', next_action: getIdaoDefaultNextAction(segment, 'Registered') };
                                const res = await axios.put(`/api/leads/${activeLead.id}`, { funnel_stage: 'Registered', custom_fields: nextFields });
                                const updated = normalizeIdaoLeadsForDisplay([res.data])[0];
                                setLeads(prev => prev.map(l => l.id === updated.id ? updated : l));
                                setActiveLead(updated);
                                await axios.post(`/api/leads/${activeLead.id}/notes`, { content: 'Registration marked as confirmed.' });
                                showToast('Registration confirmed.');
                              }} style={{ padding: '8px', fontSize: '11px', fontWeight: '700', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.08)', color: '#10b981', cursor: 'pointer' }}><i className="fas fa-check-circle" style={{ marginRight: '5px' }}></i>Confirm Registration</button>
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
                                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Day {elapsed} of {TRIAL_DAYS} · Ends {endDate.toLocaleDateString()}</span>
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
                        {selectedBrand.id === 'optimaviz' && getOptimavizLeadSegment(activeLead) === 'demo_leads' && (
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
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '600' }}>📅 Follow-Up Reminder</div>
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

                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '2px' }}>
                                <button type="button" onClick={async () => { const pf = activeLead.custom_fields || {}; handleUpdateLeadField('custom_fields', { ...pf, follow_up_status: 'Email Sent', last_follow_up_date: new Date().toISOString().split('T')[0] }); await axios.post(`/api/leads/${activeLead.id}/notes`, { content: `Follow-up email sent to ${activeLead.email || activeLead.name}.` }); showToast('Email follow-up logged.'); }} style={{ padding: '7px', fontSize: '11px', fontWeight: '700', borderRadius: '8px', border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.08)', color: '#3b82f6', cursor: 'pointer' }}>
                                  <i className="fas fa-envelope" style={{ marginRight: '5px' }}></i>Log Email
                                </button>
                                <button type="button" onClick={async () => { const pf = activeLead.custom_fields || {}; handleUpdateLeadField('custom_fields', { ...pf, follow_up_status: 'WhatsApp Sent', last_follow_up_date: new Date().toISOString().split('T')[0] }); await axios.post(`/api/leads/${activeLead.id}/notes`, { content: `WhatsApp follow-up sent to ${activeLead.phone || activeLead.name}.` }); showToast('WhatsApp follow-up logged.'); const phone = (activeLead.phone || '').replace(/\D/g,''); if (phone) window.open(`https://wa.me/${phone}`, '_blank'); }} style={{ padding: '7px', fontSize: '11px', fontWeight: '700', borderRadius: '8px', border: '1px solid rgba(37,211,102,0.3)', background: 'rgba(37,211,102,0.08)', color: '#25d366', cursor: 'pointer' }}>
                                  <i className="fab fa-whatsapp" style={{ marginRight: '5px' }}></i>WhatsApp
                                </button>
                                <button type="button" onClick={async () => { try { const pf = activeLead.custom_fields || {}; const nowStr = new Date().toISOString().split('T')[0]; const next = { ...pf, segment: 'trial_leads', trial_start_date: nowStr, follow_up_status: 'Converted to Trial', next_action: 'Send Onboarding Email' }; await axios.put(`/api/leads/${activeLead.id}`, { funnel_stage: 'Trial Started', custom_fields: next }); await axios.post(`/api/leads/${activeLead.id}/notes`, { content: `Demo lead converted to Trial Lead. Trial starts ${nowStr}.` }); setLeads(prev => prev.map(l => l.id === activeLead.id ? { ...l, funnel_stage: 'Trial Started', custom_fields: next } : l)); setActiveLead(prev => prev ? { ...prev, funnel_stage: 'Trial Started', custom_fields: next } : null); showToast('Lead moved to Free Trial!'); } catch(e) { showToast('Failed to convert.', true); } }} style={{ padding: '7px', fontSize: '11px', fontWeight: '700', borderRadius: '8px', border: '1px solid rgba(236,72,153,0.3)', background: 'rgba(236,72,153,0.08)', color: '#ec4899', cursor: 'pointer' }}>
                                  <i className="fas fa-hourglass-half" style={{ marginRight: '5px' }}></i>→ Free Trial
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
                          <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px', marginBottom: '14px' }}>
                            <strong style={{ color: 'var(--text-primary)', fontSize: '13px', display: 'block', marginBottom: '4px' }}>Communication workspace</strong>
                            <span style={{ color: 'var(--text-muted)', fontSize: '11.5px', lineHeight: 1.5 }}>
                              Use the Email, WhatsApp, Call Dialler, or Log Outcome buttons above. Every message, note, and call stays attached to this lead.
                            </span>
                          </div>
                        )}
                        <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px' }}>
                          <i className="fas fa-history" style={{ marginRight: '6px' }}></i> Timeline Feed
                        </h4>

                        <div style={{ marginTop: '22px', marginBottom: '12px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                          <h5 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <i className="fas fa-stream" style={{ color: selectedBrand.color }}></i> Unified Lead Timeline
                          </h5>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '10px' }}>
                            {[
                              ['Notes', leadNotes.length],
                              ['Calls', leadCalls.length],
                              ['Emails', leadEmails.length],
                              ['WhatsApp', leadWhatsApp.length],
                            ].map(([label, value]) => (
                              <div key={String(label)} style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '8px', padding: '7px', textAlign: 'center' }}>
                                <strong style={{ display: 'block', color: 'var(--text-primary)' }}>{value}</strong>
                                <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{label}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Note Adder Box */}
                        <form onSubmit={handleAddNoteSubmit} style={{ marginBottom: '20px' }}>
                          <textarea 
                            value={newNoteText} 
                            onChange={e => setNewNoteText(e.target.value)} 
                            placeholder="Add a timeline note..." 
                            rows={2} 
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', display: 'block', outline: 'none', resize: 'vertical' }}
                          />
                          <button type="submit" disabled={noteSaving || !newNoteText.trim()} className="btn btn-primary" style={{ background: selectedBrand.color, fontSize: '11px', padding: '6px 12px', marginTop: '6px', float: 'right' }}>
                            {noteSaving ? 'Logging...' : 'Add Note'}
                          </button>
                          <div style={{ clear: 'both' }}></div>
                        </form>

                        {/* Combined chronological timeline elements feed */}
                        <div style={{ maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
                          {leadNotes.length === 0 && leadCalls.length === 0 && leadEmails.length === 0 && leadWhatsApp.length === 0 ? (
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '16px' }}>No events logged.</div>
                          ) : (
                            [
                              ...leadNotes.map(x => ({ ...x, type: 'note' })),
                              ...leadCalls.map(x => ({ ...x, type: 'call' })),
                              ...leadEmails.map(x => ({ ...x, type: 'email' })),
                              ...leadWhatsApp.map(x => ({ ...x, type: 'whatsapp' }))
                            ]
                            .sort((a,b) => b.created_at.localeCompare(a.created_at))
                            .map((item: any) => (
                              <div key={item.id} className="history-item" style={{ fontSize: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '10px', marginBottom: '10px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '10px', marginBottom: '4px' }}>
                                  <span>
                                    {item.type === 'note' && <strong style={{ color: selectedBrand.color }}>Note</strong>}
                                    {item.type === 'call' && <strong style={{ color: 'var(--accent)' }}>Call logged</strong>}
                                    {item.type === 'email' && <strong style={{ color: '#ec4899' }}>Email campaign</strong>}
                                    {item.type === 'whatsapp' && <strong style={{ color: '#25D366' }}>WhatsApp message</strong>}
                                    {item.created_by ? ` by ${item.created_by}` : ''}
                                  </span>
                                  <span>{new Date(item.created_at).toLocaleDateString()}</span>
                                </div>
                                <div style={{ color: 'var(--text-primary)' }}>
                                  {item.type === 'note' && item.content}
                                  {item.type === 'call' && `Outcome: "${item.outcome}". Duration: ${item.duration}s. Notes: ${item.notes || '—'}`}
                                  {item.type === 'email' && (
                                    <span>
                                      <strong>Subject:</strong> {item.subject}
                                      {item.status === 'failed' && <span style={{ color: '#ef4444', marginLeft: '6px', fontSize: '10px', fontWeight: '700' }}>(failed)</span>}
                                      {item.opened_at && (
                                        <span title={`First opened: ${new Date(item.opened_at).toLocaleString()}${item.open_count > 1 ? ` · opened ${item.open_count}×` : ''}`} style={{ marginLeft: '8px', display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '1px 7px', borderRadius: '20px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', fontSize: '10px', fontWeight: '700', cursor: 'default' }}>
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
                                {item.type === 'note' && (
                                  confirmDeleteNoteId === item.id ? (
                                    <span style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                                      <button type="button" onClick={() => { handleDeleteNote(item.id); setConfirmDeleteNoteId(null); }} style={{ color: '#fff', background: '#ef4444', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', padding: '2px 6px', fontWeight: '600' }}>Confirm delete</button>
                                      <button type="button" onClick={() => setConfirmDeleteNoteId(null)} style={{ color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '10px' }}>Cancel</button>
                                    </span>
                                  ) : (
                                    <button type="button" onClick={() => setConfirmDeleteNoteId(item.id)} style={{ color: '#ff4d4d', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '10px', padding: '2px 0 0', display: 'inline-block' }}>Delete</button>
                                  )
                                )}
                                {item.type === 'email' && (
                                  confirmDeleteEmailId === item.id ? (
                                    <span style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                                      <button type="button" onClick={() => handleDeleteEmail(item.id)} style={{ color: '#fff', background: '#ef4444', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', padding: '2px 6px', fontWeight: '600' }}>Confirm delete</button>
                                      <button type="button" onClick={() => setConfirmDeleteEmailId(null)} style={{ color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '10px' }}>Cancel</button>
                                    </span>
                                  ) : (
                                    <button type="button" onClick={() => setConfirmDeleteEmailId(item.id)} style={{ color: '#ff4d4d', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '10px', padding: '2px 0 0', display: 'inline-block' }}>Delete</button>
                                  )
                                )}
                                {item.type === 'whatsapp' && (
                                  confirmDeleteWaId === item.id ? (
                                    <span style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                                      <button type="button" onClick={() => handleDeleteWhatsApp(item.id)} style={{ color: '#fff', background: '#ef4444', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', padding: '2px 6px', fontWeight: '600' }}>Confirm delete</button>
                                      <button type="button" onClick={() => setConfirmDeleteWaId(null)} style={{ color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '10px' }}>Cancel</button>
                                    </span>
                                  ) : (
                                    <button type="button" onClick={() => setConfirmDeleteWaId(item.id)} style={{ color: '#ff4d4d', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '10px', padding: '2px 0 0', display: 'inline-block' }}>Delete</button>
                                  )
                                )}
                              </div>
                            ))
                          )}
                        </div>

                      </div>
                      )}

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
                      {sequences.map(seq => (
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
                      ))}
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
            <div style={{ animation: 'fadeIn 0.3s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '700' }}>Staff users roster directory</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Add security credentials or adjust executive permission definitions.</p>
                </div>
                <button className="btn btn-primary" onClick={() => setAddUserIsOpen(true)}>
                  <i className="fas fa-plus"></i> Add executive user
                </button>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Full name</th>
                      <th>Email link</th>
                      <th>Organization Role</th>
                      <th>Creation date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersList.map(u => (
                      <tr key={u.id}>
                        <td style={{ fontWeight: '600' }}>{u.name}</td>
                        <td style={{ fontSize: '13px' }}>{u.email}</td>
                        <td>
                          <span className={`pill ${u.role === 'admin' ? 'pill-purple' : 'pill-green'}`} style={{ textTransform: 'capitalize' }}>{u.role}</span>
                        </td>
                        <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                        <td style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => {
                            setPwdUser(u);
                            setNewPwdField('');
                            setShowAdminPwd(false);
                          }}><i className="fas fa-key"></i> Pass</button>
                          {confirmDeleteUserId === u.id ? (
                            <span style={{ display: 'inline-flex', gap: '5px', alignItems: 'center' }}>
                              <button className="btn btn-sm" onClick={() => { handleDeleteUser(u.id); setConfirmDeleteUserId(null); }} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '11px', padding: '3px 8px', fontWeight: '600', cursor: 'pointer' }}>Confirm remove</button>
                              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDeleteUserId(null)} style={{ fontSize: '11px' }}>Cancel</button>
                            </span>
                          ) : (
                            <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDeleteUserId(u.id)} style={{ color: '#ff4d4d' }}><i className="fas fa-trash"></i> Remove</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: '28px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>Brand Management</h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '6px 0 0' }}>Add, archive, restore, or remove brands as the business changes. Archiving hides a brand from the sidebar but keeps existing lead records.</p>
                  </div>
                </div>
                <div className="brand-create-panel">
                  <div className="brand-create-field">
                    <span>Brand name</span>
                    <input value={newBrandName} onChange={e => setNewBrandName(e.target.value)} placeholder="New brand name" />
                  </div>
                  <label className="brand-logo-picker">
                    <img src={newBrandLogo || '/logos/optima_crm_logo.png'} alt="Brand logo preview" />
                    <span>
                      <strong>{newBrandLogoFileName || 'Upload logo'}</strong>
                      <small>PNG, JPG, or SVG under 2 MB</small>
                    </span>
                    <input type="file" accept="image/*" onChange={e => handleNewBrandLogoUpload(e.target.files?.[0])} />
                  </label>
                  <div className="brand-color-picker">
                    <span>Brand color</span>
                    <div>
                      {BRAND_COLOR_PRESETS.map(color => (
                        <button
                          key={color}
                          type="button"
                          className={newBrandColor === color ? 'active' : ''}
                          onClick={() => setNewBrandColor(color)}
                          style={{ background: color }}
                          aria-label={`Use ${color}`}
                        />
                      ))}
                      <label style={{ background: newBrandColor }}>
                        <input type="color" value={newBrandColor} onChange={e => setNewBrandColor(e.target.value)} />
                      </label>
                    </div>
                  </div>
                  <div className="brand-create-field" style={{ minWidth: '240px' }}>
                    <span>Default segments</span>
                    <textarea value={newBrandSegments} onChange={e => setNewBrandSegments(e.target.value)} rows={4} placeholder={'New Enquiries\nFollow-Up Leads\nActive Customers'} style={{ width: '100%', minHeight: '92px', resize: 'vertical', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: '12px' }} />
                    <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>One segment per line. These become dashboard cards and lead filters.</small>
                  </div>
                  <div className="brand-create-field" style={{ minWidth: '240px' }}>
                    <span>Default pipeline stages</span>
                    <textarea value={newBrandStages} onChange={e => setNewBrandStages(e.target.value)} rows={4} placeholder={'New Lead\nContacted\nFollow-Up Due\nProposal Sent\nWon\nLost'} style={{ width: '100%', minHeight: '92px', resize: 'vertical', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: '12px' }} />
                    <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>One stage per line. Admins can later refine the process as the brand grows.</small>
                  </div>
                  <button className="btn btn-primary" onClick={handleAddBrand}><i className="fas fa-plus"></i> Add Brand</button>
                </div>
                <div className="table-wrap brand-management-table">
                  <table>
                    <thead><tr><th>Brand</th><th>Status</th><th>Logo path</th><th>Actions</th></tr></thead>
                    <tbody>
                      {managedBrands.map(b => (
                        <tr key={b.id}>
                          <td style={{ fontWeight: 700 }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', minWidth: 0 }}><img src={b.logo} style={{ width: '24px', height: '24px', objectFit: 'contain' }} /> {b.name}</span></td>
                          <td><span className={`pill ${b.archived ? 'pill-red' : 'pill-green'}`}>{b.archived ? 'Archived' : 'Active'}</span></td>
                          <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{b.logo}</td>
                          <td style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {b.archived ? <button className="btn btn-ghost btn-sm" onClick={() => handleRestoreBrand(b.id)}>Restore</button> : <button className="btn btn-ghost btn-sm" onClick={() => handleArchiveBrand(b.id)}>Archive</button>}
                            <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteManagedBrand(b.id)} style={{ color: '#ef4444' }}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <section className="compact-workflow-builder" style={{ marginTop: '18px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '16px', padding: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', alignItems: 'flex-start', marginBottom: '14px', flexWrap: 'wrap' }}>
                    <div>
                      <span style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.6px' }}>Universal Brand Dashboard Builder</span>
                      <h3 style={{ margin: '4px 0 4px', fontSize: '16px', fontWeight: 900 }}>Segments, stages, snapshots, and import template defaults</h3>
                      <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '13px' }}>Use this when you add a new business line or when a brand workflow changes. It works for every brand, not only IDAO or Optimaviz.</p>
                    </div>
                    <select
                      value={workflowDesignerBrandId}
                      onChange={e => syncWorkflowDesignerDrafts(e.target.value)}
                      style={{ minWidth: '220px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                    >
                      {managedBrands.map(brand => <option key={brand.id} value={brand.id}>{brand.archived ? 'Archived · ' : ''}{brand.name}</option>)}
                    </select>
                  </div>
                  <div className="workflow-builder-grid">
                    <label className="workflow-builder-field">
                      <span style={{ fontSize: '12px', fontWeight: 900, color: 'var(--text-secondary)' }}>Dashboard segments / lead types</span>
                      <textarea value={workflowSegmentsDraft} onChange={e => setWorkflowSegmentsDraft(e.target.value)} rows={6} placeholder={'New Enquiries\nFollow-Up Leads\nActive Customers'} style={{ width: '100%', resize: 'vertical', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '12px' }} />
                      <small style={{ color: 'var(--text-muted)' }}>One segment per line. These become quick filters, snapshot cards, and import template options.</small>
                    </label>
                    <label className="workflow-builder-field">
                      <span style={{ fontSize: '12px', fontWeight: 900, color: 'var(--text-secondary)' }}>Pipeline stages / Kanban columns</span>
                      <textarea value={workflowStagesDraft} onChange={e => setWorkflowStagesDraft(e.target.value)} rows={6} placeholder={'New Lead\nContacted\nFollow-Up Due\nProposal Sent\nWon\nLost'} style={{ width: '100%', resize: 'vertical', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '12px' }} />
                      <small style={{ color: 'var(--text-muted)' }}>One stage per line. This controls the workflow preview, table filters, and generic Kanban columns.</small>
                    </label>
                    <div className="workflow-builder-preview">
                      <div>
                        <strong style={{ display: 'block', color: 'var(--text-primary)', marginBottom: '8px' }}>Workflow preview</strong>
                        <div className="workflow-preview-pills">
                          {parseLineList(workflowStagesDraft, DEFAULT_STAGES).slice(0, 7).map((stage, index, arr) => (
                            <React.Fragment key={`${stage}-${index}`}>
                              <span style={{ padding: '6px 9px', borderRadius: '999px', background: `${getStageColor(stage)}14`, color: getStageColor(stage), border: `1px solid ${getStageColor(stage)}44`, fontSize: '11px', fontWeight: 900 }}>{stage}</span>
                              {index < arr.length - 1 && <i className="fas fa-arrow-right" style={{ color: 'var(--text-muted)', fontSize: '10px' }}></i>}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                      <div>
                        <strong style={{ display: 'block', color: 'var(--text-primary)', marginBottom: '8px' }}>Follow-up defaults</strong>
                        <div style={{ display: 'grid', gap: '5px' }}>
                          {getBrandFollowUpHints(workflowDesignerBrandId).map(hint => <small key={hint} style={{ color: 'var(--text-secondary)' }}><i className="fas fa-clock" style={{ color: 'var(--accent)', marginRight: '5px' }}></i>{hint}</small>)}
                        </div>
                      </div>
                      <div className="workflow-builder-actions">
                        <button type="button" className="btn btn-primary" onClick={handleSaveWorkflowDesigner}>
                          <i className="fas fa-save"></i> Save Workflow Setup
                        </button>
                        {(() => {
                          const brand = managedBrands.find(b => b.id === workflowDesignerBrandId);
                          return brand ? <button type="button" className="btn btn-ghost" onClick={() => handleDownloadBrandImportTemplate(brand)}><i className="fas fa-file-csv"></i> Download Template</button> : null;
                        })()}
                      </div>
                    </div>
                  </div>
                </section>

                {(() => {
                  const profileBrand = managedBrands.find(b => b.id === workspaceProfileBrandId) || activeBrands[0] || managedBrands[0];
                  if (!profileBrand) return null;
                  const profiles = getBrandWorkspaceProfiles(profileBrand.id);
                  const selectedProfile = profiles.find(profile => profile.id === selectedWorkspaceProfileId) || profiles.find(profile => profile.isDefault) || profiles[0];
                  return (
                    <section className="brand-profile-panel brand-profile-panel--management">
                      <div className="brand-profile-panel__copy">
                        <span>Workspace Profiles</span>
                        <h3>{profileBrand.name} saved layouts</h3>
                        <p>Save dashboard, column, widget, filter, and Command Center setups. Applying a profile never changes leads, emails, notes, calls, or WhatsApp records.</p>
                      </div>
                      <div className="brand-profile-panel__controls">
                        <select
                          value={profileBrand.id}
                          onChange={e => {
                            setWorkspaceProfileBrandId(e.target.value);
                            setSelectedWorkspaceProfileId('');
                            setWorkspaceProfileName('');
                          }}
                        >
                          {managedBrands.map(brand => (
                            <option key={brand.id} value={brand.id}>{brand.archived ? 'Archived · ' : ''}{brand.name}</option>
                          ))}
                        </select>
                        <input
                          value={workspaceProfileName}
                          onChange={e => setWorkspaceProfileName(e.target.value)}
                          placeholder="Profile name, e.g. Sales view"
                        />
                        <button type="button" className="btn btn-primary" style={{ background: profileBrand.color, border: 'none' }} onClick={() => saveBrandWorkspaceProfile(profileBrand)}>
                          <i className="fas fa-camera"></i> Save Current
                        </button>
                        <select value={selectedProfile?.id || ''} onChange={e => setSelectedWorkspaceProfileId(e.target.value)}>
                          <option value="">No saved profile</option>
                          {profiles.map(profile => (
                            <option key={profile.id} value={profile.id}>{profile.isDefault ? 'Default · ' : ''}{profile.name}</option>
                          ))}
                        </select>
                        <button type="button" className="btn btn-ghost" disabled={!selectedProfile} onClick={() => selectedProfile && applyBrandWorkspaceProfile(profileBrand, selectedProfile.id)}>
                          <i className="fas fa-rotate-left"></i> Apply
                        </button>
                        <button type="button" className="btn btn-ghost" disabled={!selectedProfile} onClick={() => selectedProfile && duplicateBrandWorkspaceProfile(profileBrand, selectedProfile.id)}>
                          <i className="fas fa-copy"></i> Duplicate
                        </button>
                        <button type="button" className="btn btn-ghost" disabled={!selectedProfile} onClick={() => selectedProfile && setDefaultBrandWorkspaceProfile(profileBrand, selectedProfile.id)}>
                          <i className="fas fa-star"></i> Set Default
                        </button>
                        <button type="button" className="btn btn-ghost brand-profile-delete" disabled={!selectedProfile} onClick={() => selectedProfile && deleteBrandWorkspaceProfile(profileBrand, selectedProfile.id)}>
                          <i className="fas fa-trash"></i> Delete
                        </button>
                      </div>
                      <div className="brand-profile-panel__meta">
                        {selectedProfile ? (
                          <>
                            <strong>{selectedProfile.name}</strong>
                            <span>Last saved {new Date(selectedProfile.updatedAt).toLocaleString()}</span>
                            {selectedProfile.isDefault && <em>Default</em>}
                          </>
                        ) : (
                          <>
                            <strong>No profiles yet</strong>
                            <span>Save the current setup before trying a new layout.</span>
                          </>
                        )}
                      </div>
                    </section>
                  );
                })()}
              </div>
            </div>
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
                    const segmentFields = customFields.filter(f => f.brand_id === selectedBrand.id && f.field_name !== 'segment' && !(selectedBrand.id === 'optimaviz' && OPTIMAVIZ_STANDARD_CUSTOM_FIELD_COLUMNS.has(f.field_name.toLowerCase())));
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
        <div className="modal-overlay">
          <div className="modal-content upload-modal" style={{ maxWidth: '760px', width: 'min(94vw, 760px)', maxHeight: '90vh', overflow: 'hidden' }}>
            <div className="modal-header">
              <h3><i className="fas fa-file-excel"></i> Excel & CSV bulk leads importer</h3>
              <button className="modal-close" aria-label="Close" onClick={() => {
                setUploadIsOpen(false);
                setFileName('');
                setCsvText('');
                setCsvPreview(null);
                setImportError(null);
                setImportSuccessMessage(null);
              }}>&times;</button>
            </div>
            <form onSubmit={handleCsvImportSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div ref={importModalBodyRef} className="modal-body" style={{ overflowY: 'auto', flex: 1, paddingRight: '8px', maxHeight: '65vh' }}>
                
                {/* Visual inline error and success feedback banners */}
                {importError && (
                  <div style={{ backgroundColor: 'oklch(95% 0.05 20 / 0.1)', border: '1px solid var(--error)', borderRadius: '8px', padding: '12px 14px', marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <i className="fas fa-exclamation-circle" style={{ color: 'var(--error)', fontSize: '16px' }}></i>
                    <p style={{ margin: 0, fontSize: '12px', fontWeight: '600', color: 'var(--error)', lineHeight: '1.4' }}>{importError}</p>
                  </div>
                )}
                {importSuccessMessage && (
                  <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', padding: '12px 14px', marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <i className="fas fa-check-circle" style={{ color: '#10b981', fontSize: '16px' }}></i>
                    <p style={{ margin: 0, fontSize: '12px', fontWeight: '600', color: '#065f46', lineHeight: '1.4' }}>{importSuccessMessage}</p>
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
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>Supports Microsoft Excel (.xlsx, .xls) & CSV (.csv) formats</p>
                    <input 
                      id="excel-file-input"
                      type="file" 
                      accept=".xlsx, .xls, .csv" 
                      onChange={handleFileChange} 
                      style={{ display: 'none' }}
                    />
                  </div>
                  {fileName && (
                    <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-primary)', background: 'rgba(16, 124, 65, 0.08)', padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(16, 124, 65, 0.2)' }}>
                      <i className="fas fa-file-alt" style={{ color: selectedBrand.color }}></i>
                      <span style={{ fontWeight: '600', flex: 1 }}>{fileName}</span>
                      <button type="button" onClick={handleClearFile} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '14px', padding: '0 4px' }}>&times;</button>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '16px 0' }}>
                  <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>or paste raw text content</span>
                  <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
                </div>

                <textarea 
                  value={csvText} 
                  onChange={handleCsvTextChange} 
                  placeholder="name,email,phone&#10;Alice Smith,alice@domain.co,55539201&#10;Bob Smith,bob@domain.co,5553902"
                  rows={4}
                  style={{ width: '100%', padding: '12px', border: '1px solid var(--border)', borderRadius: '8px', fontFamily: 'var(--font-mono)', fontSize: '12px', background: 'var(--bg-card)' }}
                />

                {csvPreview && (
                  <div style={{ marginTop: '20px' }}>
                    <h5 style={{ fontSize: '12.5px', fontWeight: '700', marginBottom: '8px', color: 'var(--text-primary)' }}>
                      Column mapping configuration ({csvPreview.totalRows} records found)
                    </h5>

                    {/* PRESET CRM DASHBOARD COLUMNS VIEW CARD */}
                    <div style={{ background: 'oklch(from var(--text-muted) l c h / 0.04)', borderRadius: '12px', padding: '14px', border: '1px solid var(--border)', marginBottom: '20px' }}>
                      <h6 style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <i className="fas fa-th-list" style={{ color: selectedBrand.color }}></i> Preset CRM Dashboard Columns Reference
                      </h6>
                      <p style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                        These columns are currently setup for <strong>{selectedBrand.name}</strong> in your CRM. You can map your spreadsheet headers to them:
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        <span style={{ fontSize: '10.5px', background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '3px 8px', borderRadius: '6px', color: 'var(--text-secondary)' }}>
                          <strong>Name</strong> (Standard)
                        </span>
                        <span style={{ fontSize: '10.5px', background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '3px 8px', borderRadius: '6px', color: 'var(--text-secondary)' }}>
                          <strong>Email</strong> (Standard)
                        </span>
                        <span style={{ fontSize: '10.5px', background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '3px 8px', borderRadius: '6px', color: 'var(--text-secondary)' }}>
                          <strong>Phone</strong> (Standard)
                        </span>
                        <span style={{ fontSize: '10.5px', background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '3px 8px', borderRadius: '6px', color: 'var(--text-secondary)' }}>
                          <strong>Lead Date</strong> (Standard)
                        </span>
                        {customFields.map(cf => (
                          <span key={cf.id} style={{ fontSize: '10.5px', background: 'oklch(from var(--brand-color) l c h / 0.08)', border: `1px solid ${selectedBrand.color}`, padding: '3px 8px', borderRadius: '6px', color: 'var(--text-primary)' }}>
                            <strong>{cf.field_name}</strong> ({cf.field_type})
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '14px', marginBottom: '16px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '4px', color: 'var(--text-secondary)' }}>First / Full Name Column</label>
                        <select value={csvMapping.name || ''} onChange={e => {
                          const val = e.target.value;
                          setCsvMapping({...csvMapping, name: val});
                          if(val) setSelectedImportColumns(prev => { const n = new Set(prev); n.add(val); return n; });
                        }} style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '11px', background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                          <option value="">None / Auto Detect</option>
                          {csvPreview.headers.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '4px', color: 'var(--text-secondary)' }}>Last Name Column</label>
                        <select value={csvMapping.name_secondary || ''} onChange={e => {
                          const val = e.target.value;
                          setCsvMapping({...csvMapping, name_secondary: val});
                          if(val) setSelectedImportColumns(prev => { const n = new Set(prev); n.add(val); return n; });
                        }} style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '11px', background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                          <option value="">None / Ignore</option>
                          {csvPreview.headers.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                        <p style={{ margin: '4px 0 0', fontSize: '10px', color: 'var(--text-muted)' }}>
                          Optional. CRM will join first + last name.
                        </p>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '4px', color: 'var(--text-secondary)' }}>Email Column</label>
                        <select value={csvMapping.email || ''} onChange={e => {
                          const val = e.target.value;
                          setCsvMapping({...csvMapping, email: val});
                          if(val) setSelectedImportColumns(prev => { const n = new Set(prev); n.add(val); return n; });
                        }} style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '11px', background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                          <option value="">None / Ignore</option>
                          {csvPreview.headers.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '4px', color: 'var(--text-secondary)' }}>Phone Column</label>
                        <select value={csvMapping.phone || ''} onChange={e => {
                          const val = e.target.value;
                          setCsvMapping({...csvMapping, phone: val});
                          if(val) setSelectedImportColumns(prev => { const n = new Set(prev); n.add(val); return n; });
                        }} style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '11px', background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                          <option value="">None / Ignore</option>
                          {csvPreview.headers.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '4px', color: 'var(--text-secondary)' }}>Lead Date Column</label>
                        <select value={csvMapping.created_at || ''} onChange={e => {
                          const val = e.target.value;
                          setCsvMapping({...csvMapping, created_at: val});
                          if(val) setSelectedImportColumns(prev => { const n = new Set(prev); n.add(val); return n; });
                        }} style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '11px', background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                          <option value="">Use import date</option>
                          {csvPreview.headers.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                        <p style={{ margin: '4px 0 0', fontSize: '10px', color: 'var(--text-muted)' }}>
                          Used for newest-to-oldest sorting and day/week/month tracking.
                        </p>
                      </div>
                    </div>

                    {importCleanup && (
                      <div style={{ marginBottom: '20px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px' }}>
                        <h6 style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: '7px' }}>
                          <i className="fas fa-broom" style={{ color: selectedBrand.color }}></i> Import Cleanup Wizard
                        </h6>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                          {[
                            ['Missing names', importCleanup.missingName, '#ef4444'],
                            ['Missing emails', importCleanup.missingEmail, '#f59e0b'],
                            ['Missing phones', importCleanup.missingPhone, '#f59e0b'],
                            ['File duplicates', importCleanup.fileDuplicateRows, '#8b5cf6'],
                            ['CRM duplicates', importCleanup.crmDuplicateRows, '#0ea5e9'],
                            ...(selectedBrand.id === 'taskgo' ? [['TaskGo no ABN', importCleanup.taskgoMissingAbn, '#f97316']] : []),
                          ].map(([label, value, color]) => (
                            <div key={String(label)} style={{ padding: '9px', borderRadius: '9px', border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                              <strong style={{ display: 'block', color: value ? String(color) : 'var(--text-primary)', fontSize: '17px' }}>{value}</strong>
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{label}</span>
                            </div>
                          ))}
                        </div>
                        <p style={{ margin: '10px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                          Duplicate checks compare against all CRM brands. ABN warnings appear only for TaskGo imports.
                        </p>
                        {duplicatesAnalysis.duplicateCount > 0 && (
                          <div className="import-duplicate-warning">
                            <div>
                              <strong>{duplicatesAnalysis.duplicateCount} possible duplicate{duplicatesAnalysis.duplicateCount !== 1 ? 's' : ''} found</strong>
                              <span>Review conflicts before importing, or skip them automatically.</span>
                            </div>
                            <label>
                              <input
                                type="checkbox"
                                checked={skipDuplicatesOnImport}
                                onChange={e => {
                                  setSkipDuplicatesOnImport(e.target.checked);
                                  setConfirmDuplicateImport(false);
                                  setImportError(null);
                                }}
                              />
                              Skip possible duplicates
                            </label>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Selective Spreadsheet Columns to Import Checklist */}
                    <div style={{ marginBottom: '20px', background: 'var(--bg-base)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <h6 style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <i className="fas fa-check-square" style={{ color: selectedBrand.color }}></i> Choose spreadsheet columns to import
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
                            None (Only Standard)
                          </button>
                        </div>
                      </div>
                      <p style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                        Unchecked columns will be completely ignored and excluded during import.
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {csvPreview.headers.map(h => {
                          const isChecked = selectedImportColumns.has(h);
                          const isRequired = h === csvMapping.name || h === csvMapping.name_secondary || h === csvMapping.email || h === csvMapping.phone || h === csvMapping.created_at;
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
                                opacity: isRequired ? 0.8 : 1
                              }}
                            >
                              <input 
                                type="checkbox" 
                                checked={isChecked} 
                                disabled={isRequired}
                                onChange={() => {
                                  setSelectedImportColumns(prev => {
                                    const next = new Set(prev);
                                    if (next.has(h)) {
                                      next.delete(h);
                                    } else {
                                      next.add(h);
                                    }
                                    return next;
                                  });
                                  if (suggestedCols.includes(h)) {
                                    setSelectedSuggestedCols(prev => {
                                      const next = new Set(prev);
                                      if (next.has(h)) {
                                        next.delete(h);
                                      } else {
                                        next.add(h);
                                      }
                                      return next;
                                    });
                                  }
                                }}
                                style={{ accentColor: '#10B981' }}
                              />
                              {h} {isRequired && <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>(Required Mapping)</span>}
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Auto-Suggest Checkboxes for new Brand Columns / Custom Fields */}
                    {suggestedCols.length > 0 && (
                      <div style={{ marginTop: '16px', marginBottom: '16px', background: 'var(--bg-base)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        <h6 style={{ fontSize: '11.5px', fontWeight: '700', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
                          <i className="fas fa-magic" style={{ color: '#f59e0b' }}></i> Auto-Suggest: New Brand Columns
                        </h6>
                        <p style={{ fontSize: '10.5px', color: 'var(--text-secondary)', marginBottom: '10px', lineHeight: '1.4' }}>
                          CRM auto-detected columns in this file that are not in your currently defined CRM fields. Select the ones you want to add as permanent brand columns in the CRM:
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
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
                                  onChange={() => handleToggleSuggestedCol(col)}
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
                            <i className="fas fa-plus"></i> {colSaving ? 'Saving columns...' : `Create Selected CRM Custom Column(s)`}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Map Existing Custom CRM Fields */}
                    {customFields.length > 0 && (
                      <div style={{ marginTop: '16px', marginBottom: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                        <h5 style={{ fontSize: '11.5px', fontWeight: '700', marginBottom: '8px', color: 'var(--text-primary)' }}>Map Existing Custom CRM Fields</h5>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
                          {customFields.map(cf => (
                            <div key={cf.id}>
                              <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '4px', color: 'var(--text-secondary)' }}>{cf.field_name}</label>
                              <select 
                                value={csvMapping[cf.field_name] || ''} 
                                onChange={e => {
                                  setCsvMapping({
                                    ...csvMapping,
                                    [cf.field_name]: e.target.value
                                  });
                                }} 
                                style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '11px', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                              >
                                <option value="">Ignore</option>
                                {csvPreview.headers.map(h => <option key={h} value={h}>{h}</option>)}
                              </select>
                            </div>
                          ))}
                        </div>
                      </div>
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
              </div>
              <div className="modal-footer" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {importError && (
                  <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid var(--error)', borderRadius: '8px', padding: '10px 12px', display: 'flex', gap: '8px', alignItems: 'center', width: '100%', textAlign: 'left' }}>
                    <i className="fas fa-exclamation-circle" style={{ color: 'var(--error)', fontSize: '14px' }}></i>
                    <p style={{ margin: 0, fontSize: '12px', fontWeight: '600', color: 'var(--error)', lineHeight: '1.4', flex: 1 }}>{importError}</p>
                  </div>
                )}
                {importSuccessMessage && (
                  <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid #10b981', borderRadius: '8px', padding: '10px 12px', display: 'flex', gap: '8px', alignItems: 'center', width: '100%', textAlign: 'left' }}>
                    <i className="fas fa-check-circle" style={{ color: '#10b981', fontSize: '14px' }}></i>
                    <p style={{ margin: 0, fontSize: '12px', fontWeight: '600', color: '#10b981', lineHeight: '1.4', flex: 1 }}>{importSuccessMessage}</p>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', width: '100%' }}>
                  <button type="button" className="btn btn-ghost" onClick={() => {
                    setUploadIsOpen(false);
                    setFileName('');
                    setCsvText('');
                    setCsvPreview(null);
                    setImportError(null);
                    setImportSuccessMessage(null);
                  }}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={csvImporting || !csvPreview} style={{ background: selectedBrand.color }}>
                    {csvImporting
                      ? 'Digesting...'
                      : duplicatesAnalysis.duplicateCount > 0 && skipDuplicatesOnImport
                        ? 'Import Clean Data'
                        : duplicatesAnalysis.duplicateCount > 0 && confirmDuplicateImport
                          ? 'Import Including Duplicates'
                          : 'Import Spreadsheet Data'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
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
              
              <div className="dynamic-column-section">
                <h5 style={{ fontSize: '13px', fontWeight: '700', marginBottom: '12px' }}>Add New Column</h5>
                <p style={{ margin: '-4px 0 12px', fontSize: '11px', color: 'var(--text-muted)' }}>
                  Add any brand-specific column here. New columns are shown in the table automatically.
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
                      {colSaving ? 'Saving...' : 'Add Column'}
                    </button>
                  </div>
                </form>
              </div>

              <div className="dynamic-column-section">
                <h5 style={{ fontSize: '13px', fontWeight: '700', marginBottom: '12px' }}>Visible Columns</h5>
                <div className="dynamic-column-list">
                  {(['optimaviz', 'idao'].includes(selectedBrand.id) ? ['name', 'organisation', 'email', 'phone', 'segment', ...(selectedBrand.id === 'idao' ? ['service_type'] : []), 'stage', 'next_action', 'follow_up_date', 'last_activity', 'assigned_to', 'tags', 'added'] : ['name', 'email', 'phone', 'stage', 'added', 'tags']).map(c => (
                    <label key={c} className="dynamic-column-row">
                      <input type="checkbox" checked={columnVisibility.has(c)} onChange={() => toggleColumnVis(c)}/> Show Standard: <span style={{ fontWeight: '500' }}>{formatColumnLabel(c)}</span>
                    </label>
                  ))}
                  {customFields.map(cf => {
                    const isVisible = columnVisibility.has(cf.field_name);
                    return (
                      <div key={cf.id} className="dynamic-column-row">
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', flex: 1, cursor: 'pointer' }}>
                          <input 
                            type="checkbox" 
                            checked={isVisible} 
                            onChange={() => toggleColumnVis(cf.field_name)}
                          /> 
                          <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                            <i className="fas fa-tag" style={{ color: selectedBrand.color, marginRight: '4px', fontSize: '10px' }}></i> 
                            {formatColumnLabel(cf.field_name)}
                          </span>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>({cf.field_type})</span>
                        </label>
                        <button 
                          onClick={() => handleDeleteColumn(cf.id)} 
                          style={{ background: 'transparent', border: 'none', color: '#ff4d4d', cursor: 'pointer', fontSize: '11px', padding: '4px 8px' }}
                          title={`Delete "${cf.field_name}" permanently`}
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
            <div className="modal-footer">
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
      {bulkEmailModalOpen && selectedBrand && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '580px', width: '95%', maxHeight: '92vh', overflow: 'hidden', borderRadius: '16px' }}>
            <div className="modal-header" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', color: '#fff', borderRadius: '16px 16px 0 0', padding: '16px 20px' }}>
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
                <div style={{ padding: '12px 20px', background: 'rgba(99,102,241,0.06)', borderBottom: '1px solid rgba(99,102,241,0.18)', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: '#6366f1' }}>
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
                    onFocus={e => { e.currentTarget.style.borderColor = '#6366f1'; }}
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
                    onFocus={e => { e.currentTarget.style.borderColor = '#6366f1'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                  />
                </div>

                {/* Progress bar */}
                {bulkEmailProgress && (
                  <div style={{ padding: '14px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '700', marginBottom: '8px' }}>
                      <span style={{ color: '#6366f1' }}>Sending… {bulkEmailProgress.sent + bulkEmailProgress.failed} / {bulkEmailProgress.total}</span>
                      <span>
                        <span style={{ color: '#10b981', marginRight: '10px' }}><i className="fas fa-check"></i> {bulkEmailProgress.sent} sent</span>
                        {bulkEmailProgress.failed > 0 && <span style={{ color: '#ef4444' }}><i className="fas fa-times"></i> {bulkEmailProgress.failed} failed</span>}
                      </span>
                    </div>
                    <div style={{ height: '6px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.round(((bulkEmailProgress.sent + bulkEmailProgress.failed) / bulkEmailProgress.total) * 100)}%`, background: 'linear-gradient(90deg,#6366f1,#8b5cf6)', borderRadius: '99px', transition: 'width 0.3s ease' }} />
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
                    style={{ background: bulkEmailSending ? '#888' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', border: 'none', padding: '10px 22px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', cursor: bulkEmailSending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '7px' }}
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
          <div className="modal-content" style={{ maxWidth: '640px', width: '90%' }}>
            <div className="modal-header">
              <h3><i className="fas fa-route"></i> Design cross-channel automation flow</h3>
              <button className="modal-close" aria-label="Close" onClick={() => setSeqModalIsOpen(false)}>&times;</button>
            </div>
            <form onSubmit={handleSaveSequenceSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>Workflow Name</label>
                    <input type="text" required value={seqForm.name} onChange={e => setSeqForm({...seqForm, name: e.target.value})} placeholder="e.g. Trial nurture and call follow-up" style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px' }}/>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>Trigger Stage</label>
                    <select value={seqForm.trigger_stage} onChange={e => setSeqForm({...seqForm, trigger_stage: e.target.value})} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', background: 'var(--bg-card)' }}>
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
                    <h5 style={{ fontSize: '12px', fontWeight: '700' }}>WORKFLOW STEPS BY CHANNEL</h5>
                    <button type="button" onClick={handleAddSequenceStep} className="btn-add" style={{ padding: '4px 10px', fontSize: '11px', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', borderRadius: '4px' }}>
                      <i className="fas fa-plus"></i> Add Step
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
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
                              <span style={{ fontSize: '11px' }}>days delay</span>
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
                <button type="submit" className="btn btn-primary" disabled={seqSaving} style={{ background: selectedBrand.color }}>
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
          <div className="modal-content" style={{ maxWidth: '440px', width: '90%' }}>
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
                     style={{ position: 'absolute', right: '8px', top: '22px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px', padding: '4px' }}
                   >
                     <i className={showAddUserPassword ? 'fas fa-eye-slash' : 'fas fa-eye'}></i>
                   </button>
                 </div>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>Role Clearance</label>
                  <select value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value})} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', background: 'var(--bg-card)' }}>
                    <option value="user">Standard Agent</option>
                    <option value="admin">Platform Admin</option>
                  </select>
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
                     style={{ position: 'absolute', right: '8px', top: '22px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px', padding: '4px' }}
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
                        <select value={commandMetricForm.brandId || 'all'} onChange={e => {
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

      {teamCallOpen && (
        <div className="team-call-overlay" role="dialog" aria-modal="true" aria-label={teamCallTitle}>
          <section className="team-call-modal">
            <header className="team-call-header">
              <div>
                <span className="team-call-eyebrow">
                  <i className="fas fa-video"></i>
                  Team meeting
                </span>
                <h3>{teamCallTitle}</h3>
              </div>
              <div className="team-call-header-actions">
                {teamCallRoomSlug && (
                  <button type="button" className="team-call-external" onClick={moveTeamCallToTab} title="Move this same meeting to a separate tab">
                    <i className="fas fa-up-right-from-square"></i>
                    Move to tab
                  </button>
                )}
                <button type="button" className="team-call-close" onClick={() => setTeamCallOpen(false)} aria-label="Close team call">
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
          </section>
        </div>
      )}


      <div className="my-notes-dock">
        <button type="button" className="my-notes-launcher" onClick={() => { setUserNotesOpen(prev => !prev); fetchTeamNotes(); }}>
          <i className="fas fa-note-sticky"></i>
          <span>My Notes</span>
        </button>
        {userNotesOpen && (
          <section className="my-notes-panel" aria-label="My notes">
            <header>
              <div>
                <strong>My Notes</strong>
                <small>Quick notes saved in the CRM.</small>
              </div>
              <div>
                <button type="button" onClick={() => openTeamNoteEditor()} title="Add note"><i className="fas fa-plus"></i></button>
                <button type="button" onClick={() => setUserNotesOpen(false)} title="Close"><i className="fas fa-xmark"></i></button>
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
        onClose={() => setCommandPaletteOpen(false)}
        onOpenLead={jumpToLead}
        onOpenBrand={handleSelectBrand}
        onNavigate={handleCommandNavigate}
        onQuickCall={openQuickCallForLead}
      />

      {notificationDrawerOpen && (
        <div className="notification-drawer" role="dialog" aria-label="Notification Center">
          <div className="notification-drawer__header">
            <strong>Notification Center</strong>
            <div className="notification-drawer__actions">
              <button type="button" onClick={markAllNotificationsSeen} title="Clear current notifications">Clear all</button>
              <button type="button" onClick={() => setNotificationDrawerOpen(false)} aria-label="Close notifications"><i className="fas fa-xmark"></i></button>
            </div>
          </div>
          {visibleNotificationItems.length > 0 ? visibleNotificationItems.map(item => (
            <button
              key={item.label}
              type="button"
              className="notification-row"
              onClick={() => {
                item.action();
                setNotificationDrawerOpen(false);
              }}
            >
              <span style={{ color: item.tone }}><i className={`fas ${item.icon}`}></i></span>
              <span>
                <strong>{item.label}</strong>
                <small>{item.value} item{item.value === 1 ? '' : 's'} need attention</small>
              </span>
            </button>
          )) : (
            <div className="notification-empty">
              <i className="fas fa-check-circle"></i>
              <strong>All clear</strong>
              <span>No urgent CRM alerts right now.</span>
            </div>
          )}
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
                {profilePicture ? <img src={profilePicture} alt="Profile" onError={(e) => { e.currentTarget.style.display = 'none'; setProfilePicture(''); safeLocalStorage.removeItem('crm_user_picture'); }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : profileName.charAt(0)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>Profile Picture</label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '600', color: 'var(--accent)', cursor: 'pointer' }}>
                  <i className="fas fa-camera"></i> Upload
                  <input type="file" accept="image/*" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const base64 = event.target?.result as string;
                        setProfilePicture(base64);
                      };
                      reader.readAsDataURL(file);
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

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={async () => {
                  try {
                    if (profileName !== user.name) {
                      const response = await axios.put(`/api/auth/users/${user.id}`, {
                        name: profileName
                      });
                      setUser(response.data);
                    }
                    safeLocalStorage.setItem('crm_user_picture', profilePicture);
                    showToast('Profile updated successfully!');
                    setProfileModalOpen(false);
                  } catch (error) {
                    showToast('Failed to update profile', true);
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
                  style={{ position: 'absolute', right: '6px', top: '19px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px', padding: '3px' }}
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
                  style={{ position: 'absolute', right: '6px', top: '19px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px', padding: '3px' }}
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
                  style={{ position: 'absolute', right: '6px', top: '19px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px', padding: '3px' }}
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
                    setPwError(err?.response?.data?.detail || 'Failed to change password');
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

      {/* ── Mobile bottom navigation bar (visible below 768px) ───────────────── */}
      <div className="mobile-bottom-nav" style={{ display: 'none' }}>
        {[
          { id: 'dashboard', icon: 'fa-home', label: 'Dashboard', action: () => handleSelectDashboard() },
          { id: 'communications', icon: 'fa-comments', label: 'Comms', action: () => handleSelectCommunications() },
          { id: 'integrations', icon: 'fa-plug', label: 'Setup', action: () => openCommunicationTool('integrations') },
          ...(BRANDS.slice(0, 2).map(b => ({ id: b.id, icon: 'fa-building', label: b.name.split(' ')[0], action: () => handleSelectBrand(b) }))),
          { id: 'users', icon: 'fa-users', label: 'Team', action: () => { setActiveTab('users'); setSelectedBrand(null); } },
        ].map(item => (
          <button key={item.id} onClick={item.action} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', padding: '8px 4px', background: 'transparent', border: 'none', cursor: 'pointer', color: (activeTab === item.id || selectedBrand?.id === item.id) ? 'var(--accent)' : 'var(--text-secondary)' }}>
            <i className={`fas ${item.icon}`} style={{ fontSize: '18px' }}></i>
            <span style={{ fontSize: '10px', fontWeight: '500' }}>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

