import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { User, Brand } from '../types';
import { SocialNetworkLogo, MetaAdsLogo } from './SocialBrandLogos';
import { toUserFacingError } from '../utils/userFacingError';

type SocialProvider = 'meta' | 'linkedin';

type SocialConnection = {
  id: string;
  provider: SocialProvider;
  connected_name?: string;
  connected_email?: string;
  status: string;
  expires_at?: string;
  last_error?: string;
};

type SocialPage = {
  id: string;
  provider: SocialProvider;
  page_id: string;
  page_name: string;
  brand_id?: string;
  instagram_business_account_id?: string;
  instagram_username?: string;
  status: string;
};

type SocialAdAccount = {
  id: string;
  provider: SocialProvider;
  ad_account_id: string;
  ad_account_name: string;
  brand_id?: string;
  currency?: string;
  status: string;
};

type SocialPost = {
  id: string;
  brand_id: string;
  provider: SocialProvider;
  page_id?: string;
  instagram_account_id?: string;
  linkedin_organization_id?: string;
  caption: string;
  media_urls: string[];
  publish_targets: string[];
  status: string;
  scheduled_for?: string;
  published_at?: string;
  failure_reason?: string;
  provider_post_id?: string;
  created_at: string;
  approval_requested_by_name?: string;
  approval_requested_at?: string;
  rejection_reason?: string;
};

type SocialTemplate = {
  id: string;
  brand_id: string;
  name: string;
  caption: string;
  hashtags: string[];
  created_by_name?: string;
  updated_at?: string;
};

type SocialBudget = {
  id: string;
  brand_id: string;
  monthly_budget: number;
  cpl_alert_threshold: number;
  currency?: string;
};

type AttributionSummary = {
  ad_spend: number;
  ad_leads: number;
  ad_cpl: number;
  crm_social_leads: number;
  crm_verified_social_leads: number;
  crm_cpl: number;
  lead_gap: number;
  note: string;
};

type SocialAlert = {
  type: string;
  severity: 'info' | 'warning' | 'critical';
  brand_id: string;
  message: string;
  spend?: number;
  budget?: number;
  pct?: number;
  cpl?: number;
  threshold?: number;
};

type SocialMetric = {
  id: string;
  brand_id?: string;
  provider: SocialProvider;
  ad_account_id: string;
  campaign_name: string;
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  leads: number;
  cost_per_lead: number;
};

type SocialSummary = {
  connections: SocialConnection[];
  pages: SocialPage[];
  ad_accounts: SocialAdAccount[];
  stats: Record<string, number>;
};

type ProviderSettings = {
  providers: Record<SocialProvider, {
    configured: boolean;
    redirect_uri: string;
    scopes: string[];
    organization_scopes_enabled?: boolean;
    organization_scopes_required?: string[];
  }>;
};

type Props = {
  user: User | null;
  brands: Brand[];
  showToast: (message: string, isError?: boolean) => void;
};

/** Phase 1 IA: fewer tabs — scheduled lives inside Calendar. */
const TABS = [
  { id: 'overview', label: 'Studio', icon: 'fa-chart-simple' },
  { id: 'accounts', label: 'Accounts', icon: 'fa-link' },
  { id: 'composer', label: 'Create', icon: 'fa-pen-to-square' },
  { id: 'calendar', label: 'Calendar', icon: 'fa-calendar-days' },
  { id: 'ads', label: 'Ads & spend', icon: 'fa-bullhorn' },
] as const;

const PROVIDERS: Array<{ id: SocialProvider; label: string; networks: Array<'facebook' | 'instagram' | 'linkedin' | 'meta'>; tone: string }> = [
  { id: 'meta', label: 'Meta (Facebook & Instagram)', networks: ['facebook', 'instagram'], tone: '#1877F2' },
  { id: 'linkedin', label: 'LinkedIn', networks: ['linkedin'], tone: '#0A66C2' },
];

const EMOJI_SHORTCUTS = ['✓', '💫', '✅', '📊', '🏢', '👍', '🚧', '💡'];
const POST_STARTERS = [
  'Quick update:',
  'New from our team:',
  'Here is what we are working on:',
  'For teams growing this month:',
];

function mediaLabelFromUrl(url: string, index: number) {
  try {
    const path = new URL(url).pathname;
    const name = decodeURIComponent(path.split('/').filter(Boolean).pop() || '');
    return name || `Media ${index + 1}`;
  } catch {
    const name = decodeURIComponent(String(url || '').split('/').filter(Boolean).pop() || '');
    return name || `Media ${index + 1}`;
  }
}

function isVideoMedia(url: string) {
  return /\.(mp4|mov|quicktime)(\?|#|$)/i.test(url);
}

function platformMeta(provider: string) {
  if (provider === 'linkedin') return { label: 'LinkedIn', network: 'linkedin' as const, tone: '#0A66C2' };
  return { label: 'Meta', network: 'meta' as const, tone: '#1877F2' };
}

function statusClass(status: string) {
  const value = String(status || '').toLowerCase();
  if (value === 'connected' || value === 'published') return 'good';
  if (value === 'scheduled' || value === 'draft' || value === 'publishing' || value === 'pending_approval') return 'warn';
  if (value === 'failed' || value === 'expired_token' || value === 'needs_attention' || value === 'error' || value === 'rejected') return 'bad';
  return '';
}

function money(value: number, currency = 'USD') {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value || 0));
  } catch {
    return `$${Number(value || 0).toFixed(2)}`;
  }
}

export default function SocialHubPage({ user, brands, showToast }: Props) {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]['id']>('overview');
  const [scopeBrandId, setScopeBrandId] = useState<string>(''); // '' = all brands
  const [summary, setSummary] = useState<SocialSummary>({ connections: [], pages: [], ad_accounts: [], stats: {} });
  const [settings, setSettings] = useState<ProviderSettings | null>(null);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [metrics, setMetrics] = useState<SocialMetric[]>([]);
  const [loading, setLoading] = useState(false);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [postingMode, setPostingMode] = useState<'draft' | 'schedule' | 'publish' | ''>('');
  const [mediaUploadNames, setMediaUploadNames] = useState<string[]>([]);
  const [postFilter, setPostFilter] = useState({ provider: '', status: '' });
  const [postWindowDays, setPostWindowDays] = useState('30');
  const [clearPublishedArmed, setClearPublishedArmed] = useState(false);
  const [adsRangeDays, setAdsRangeDays] = useState('30');
  const [metricFilter, setMetricFilter] = useState({ provider: '', ad_account_id: '' });
  const [templates, setTemplates] = useState<SocialTemplate[]>([]);
  const [templateForm, setTemplateForm] = useState({ name: '', caption: '', hashtags: '' });
  const [templateSaving, setTemplateSaving] = useState(false);
  const [attribution, setAttribution] = useState<{ summary: AttributionSummary; by_brand: any[] } | null>(null);
  const [budgets, setBudgets] = useState<SocialBudget[]>([]);
  const [budgetForm, setBudgetForm] = useState({ monthly_budget: '', cpl_alert_threshold: '' });
  const [adsAlerts, setAdsAlerts] = useState<SocialAlert[]>([]);
  const [adAccountFilter, setAdAccountFilter] = useState<'all' | 'mapped' | 'unmapped'>('all');
  const [insightsSyncing, setInsightsSyncing] = useState(false);
  const [form, setForm] = useState({
    brand_id: brands[0]?.id || '',
    provider: 'meta' as SocialProvider,
    page_id: '',
    publish_targets: ['facebook'] as string[],
    caption: '',
    media_urls: '',
    scheduled_for: '',
  });

  const isAdmin = user?.role === 'admin' || user?.platform_role === 'superadmin' || user?.platform_role === 'owner';
  const providerSettings = settings?.providers || {
    meta: { configured: false, redirect_uri: '', scopes: [] },
    linkedin: { configured: false, redirect_uri: '', scopes: [] },
  };
  const linkedinOrgReady = Boolean(providerSettings.linkedin?.organization_scopes_enabled);
  const scopeBrand = brands.find(b => b.id === scopeBrandId) || null;

  const visiblePages = useMemo(
    () => {
      let list = summary.pages.filter(page => !String(page.page_id || ' ').startsWith('person:'));
      if (!isAdmin) {
        list = list.filter(p => Boolean(p.brand_id));
      }
      return list;
    },
    [summary.pages, isAdmin],
  );

  const brandPages = useMemo(
    () => (scopeBrandId ? visiblePages.filter(p => p.brand_id === scopeBrandId) : visiblePages),
    [visiblePages, scopeBrandId],
  );

  const visibleAdAccounts = useMemo(() => {
    let list = summary.ad_accounts;
    if (!isAdmin) {
      list = list.filter(a => Boolean(a.brand_id));
    }
    if (adAccountFilter === 'mapped') list = list.filter(a => Boolean(a.brand_id));
    if (adAccountFilter === 'unmapped') list = list.filter(a => !a.brand_id);
    if (scopeBrandId) {
      list = list.filter(a => !a.brand_id || a.brand_id === scopeBrandId);
    }
    return list;
  }, [summary.ad_accounts, adAccountFilter, scopeBrandId, isAdmin]);

  const brandAdAccounts = useMemo(
    () => (scopeBrandId
      ? summary.ad_accounts.filter(a => a.brand_id === scopeBrandId)
      : summary.ad_accounts.filter(a => Boolean(a.brand_id))),
    [summary.ad_accounts, scopeBrandId],
  );

  const mappedAdAccounts = useMemo(
    () => summary.ad_accounts.filter(a => Boolean(a.brand_id)),
    [summary.ad_accounts],
  );

  const selectedProvider = PROVIDERS.find(provider => provider.id === form.provider) || PROVIDERS[0];
  const mediaItems = form.media_urls.split('\n').map(item => item.trim()).filter(Boolean);
  const mediaCount = mediaItems.length;

  const pagesForProvider = useMemo(() => {
    const pool = scopeBrandId ? brandPages : visiblePages;
    return pool
      .filter(page => page.provider === form.provider && page.status !== 'not_connected')
      .sort((a, b) => a.page_name.localeCompare(b.page_name));
  }, [visiblePages, brandPages, form.provider, scopeBrandId]);

  const currentPage = pagesForProvider.find(page => page.page_id === form.page_id);
  const formBrand = brands.find(b => b.id === form.brand_id);

  const visiblePosts = useMemo(() => posts.filter(post =>
    (!scopeBrandId || post.brand_id === scopeBrandId) &&
    (!postFilter.provider || post.provider === postFilter.provider) &&
    (!postFilter.status || post.status === postFilter.status),
  ), [posts, postFilter, scopeBrandId]);

  const plannedPosts = useMemo(() => visiblePosts.filter(post =>
    ['scheduled', 'failed', 'draft', 'published', 'cancelled', 'publishing'].includes(post.status),
  ), [visiblePosts]);

  const upcomingPosts = useMemo(
    () => plannedPosts.filter(p => ['scheduled', 'draft', 'failed'].includes(p.status)),
    [plannedPosts],
  );

  const adsCutoff = useMemo(() => {
    const days = Number(adsRangeDays) || 30;
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  }, [adsRangeDays]);

  const visibleMetrics = useMemo(() => metrics.filter(row => {
    if (scopeBrandId && row.brand_id && row.brand_id !== scopeBrandId) return false;
    if (scopeBrandId && !row.brand_id) {
      const acc = summary.ad_accounts.find(a => a.ad_account_id === row.ad_account_id);
      if (acc?.brand_id && acc.brand_id !== scopeBrandId) return false;
      if (acc && !acc.brand_id && scopeBrandId) return false;
    }
    if (metricFilter.provider && row.provider !== metricFilter.provider) return false;
    if (metricFilter.ad_account_id && row.ad_account_id !== metricFilter.ad_account_id) return false;
    if (row.date && row.date < adsCutoff) return false;
    return true;
  }), [metrics, metricFilter, scopeBrandId, summary.ad_accounts, adsCutoff]);

  const adsScoreboard = useMemo(() => {
    const spend = visibleMetrics.reduce((s, r) => s + Number(r.spend || 0), 0);
    const leads = visibleMetrics.reduce((s, r) => s + Number(r.leads || 0), 0);
    const impressions = visibleMetrics.reduce((s, r) => s + Number(r.impressions || 0), 0);
    const clicks = visibleMetrics.reduce((s, r) => s + Number(r.clicks || 0), 0);
    const cpl = leads > 0 ? spend / leads : 0;
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    return { spend, leads, impressions, clicks, cpl, ctr };
  }, [visibleMetrics]);

  const brandAdsRows = useMemo(() => {
    const map = new Map<string, { brandId: string; spend: number; leads: number; impressions: number; clicks: number }>();
    for (const row of visibleMetrics) {
      const acc = summary.ad_accounts.find(a => a.ad_account_id === row.ad_account_id);
      const bid = row.brand_id || acc?.brand_id || '_unmapped';
      const cur = map.get(bid) || { brandId: bid, spend: 0, leads: 0, impressions: 0, clicks: 0 };
      cur.spend += Number(row.spend || 0);
      cur.leads += Number(row.leads || 0);
      cur.impressions += Number(row.impressions || 0);
      cur.clicks += Number(row.clicks || 0);
      map.set(bid, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.spend - a.spend);
  }, [visibleMetrics, summary.ad_accounts]);

  const scopedStats = useMemo(() => {
    const brandPostPool = scopeBrandId ? posts.filter(p => p.brand_id === scopeBrandId) : posts;
    return {
      scheduled: brandPostPool.filter(p => p.status === 'scheduled').length,
      published: brandPostPool.filter(p => p.status === 'published').length,
      failed: brandPostPool.filter(p => p.status === 'failed').length,
      drafts: brandPostPool.filter(p => p.status === 'draft').length,
      pages: brandPages.length,
      adAccounts: brandAdAccounts.length,
      spend: adsScoreboard.spend,
      cpl: adsScoreboard.cpl,
      adLeads: adsScoreboard.leads,
    };
  }, [posts, scopeBrandId, brandPages.length, brandAdAccounts.length, adsScoreboard]);

  const needsReconnect = summary.connections.some(c => {
    const status = String(c.status || '').toLowerCase();
    if (['expired_token', 'needs_attention', 'error'].includes(status)) return true;
    const err = String(c.last_error || '').toLowerCase();
    if (!err) return false;
    return /expired|invalid.?token|reconnect|revoked|unauthorized|needs.?attention/.test(err);
  });

  const unmappedPages = visiblePages.filter(p => !p.brand_id && p.status !== 'not_connected');
  const unmappedAds = visibleAdAccounts.filter(a => !a.brand_id);

  const appendCaptionText = (text: string) => {
    setForm(prev => ({
      ...prev,
      caption: `${prev.caption}${prev.caption && !prev.caption.endsWith(' ') ? ' ' : ''}${text}`,
    }));
  };

  const loadPhase2Extras = async (brandScope?: string) => {
    const brandParam = brandScope || scopeBrandId || undefined;
    try {
      const [tplRes, budgetRes, attrRes, alertRes] = await Promise.all([
        axios.get('/api/social/templates', { params: brandParam ? { brand_id: brandParam } : {} }),
        axios.get('/api/social/budgets', { params: brandParam ? { brand_id: brandParam } : {} }),
        axios.get('/api/social/ads/attribution', { params: { days: adsRangeDays, brand_id: brandParam || undefined } }),
        axios.get('/api/social/ads/alerts', { params: brandParam ? { brand_id: brandParam } : {} }),
      ]);
      setTemplates(tplRes.data.templates || []);
      setBudgets(budgetRes.data.budgets || []);
      setAttribution(attrRes.data ? { summary: attrRes.data.summary, by_brand: attrRes.data.by_brand || [] } : null);
      setAdsAlerts(alertRes.data.alerts || []);
      if (brandParam) {
        const b = (budgetRes.data.budgets || []).find((x: SocialBudget) => x.brand_id === brandParam);
        setBudgetForm({
          monthly_budget: b ? String(b.monthly_budget || '') : '',
          cpl_alert_threshold: b ? String(b.cpl_alert_threshold || '') : '',
        });
      }
    } catch {
      /* non-blocking */
    }
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const metricsSince = (() => {
        const days = Number(adsRangeDays) || 30;
        const d = new Date();
        d.setDate(d.getDate() - days);
        return d.toISOString().slice(0, 10);
      })();
      const [accountsRes, settingsRes, postsRes, metricsRes] = await Promise.all([
        axios.get('/api/social/accounts'),
        axios.get('/api/social/settings'),
        axios.get('/api/social/posts', { params: postWindowDays === 'all' ? {} : { since_days: postWindowDays } }),
        axios.get('/api/social/ads/metrics', {
          params: {
            since: metricsSince,
            until: new Date().toISOString().slice(0, 10),
            brand_id: scopeBrandId || undefined,
          },
        }),
      ]);
      setSummary(accountsRes.data);
      setSettings(settingsRes.data);
      setPosts(postsRes.data.posts || []);
      setMetrics(metricsRes.data.metrics || []);
      const pages = ([...(accountsRes.data.pages || [])] as SocialPage[])
        .filter(page => !String(page.page_id || '').startsWith('person:'))
        .sort((a, b) => a.page_name.localeCompare(b.page_name));
      setForm(prev => {
        const preferBrand = scopeBrandId || prev.brand_id || brands[0]?.id || '';
        const brandPage = pages.find(p => p.brand_id === preferBrand && p.provider === prev.provider)
          || pages.find(p => p.brand_id === preferBrand)
          || pages.find(p => p.provider === prev.provider)
          || pages[0];
        return {
          ...prev,
          brand_id: preferBrand || prev.brand_id,
          provider: brandPage?.provider || prev.provider,
          page_id: prev.page_id || brandPage?.page_id || '',
        };
      });
      await loadPhase2Extras(scopeBrandId);
    } catch (err: any) {
      showToast(toUserFacingError(err, 'Social Hub could not load.'), true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postWindowDays]);

  useEffect(() => {
    if (activeTab === 'ads') loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    if (scopeBrandId) {
      setForm(prev => ({ ...prev, brand_id: scopeBrandId }));
    }
    loadPhase2Extras(scopeBrandId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeBrandId, adsRangeDays]);

  useEffect(() => {
    setClearPublishedArmed(false);
  }, [scopeBrandId, postFilter.provider, postFilter.status, activeTab]);

  const connectProvider = async (provider: SocialProvider) => {
    try {
      const returnTo = `${window.location.origin}${window.location.pathname}${window.location.search || ''}`;
      const res = await axios.get(`/api/social/${provider}/connect`, { params: { return_to: returnTo } });
      if (res.data?.auth_url) window.location.href = res.data.auth_url;
    } catch (err: any) {
      showToast(toUserFacingError(err, `${provider === 'meta' ? 'Meta' : 'LinkedIn'} connection is not ready yet.`), true);
    }
  };

  const syncProvider = async (provider: SocialProvider) => {
    const connection = summary.connections.find(c => c.provider === provider);
    if (!connection) {
      showToast(`${provider === 'meta' ? 'Meta' : 'LinkedIn'} is not connected yet. Connect it under Accounts first.`, true);
      return;
    }
    try {
      const res = await axios.post(`/api/social/${provider}/sync`);
      setSummary(res.data);
      showToast(`${provider === 'meta' ? 'Meta' : 'LinkedIn'} accounts refreshed.`);
    } catch (err: any) {
      showToast(toUserFacingError(err, 'Accounts could not be refreshed.'), true);
    }
  };

  const mapPageBrand = async (pageId: string, brandId: string) => {
    try {
      const res = await axios.patch(`/api/social/pages/${encodeURIComponent(pageId)}/brand`, { brand_id: brandId });
      setSummary(prev => ({
        ...prev,
        pages: prev.pages.map(p => p.id === pageId || p.page_id === pageId ? { ...p, brand_id: res.data.brand_id || brandId } : p),
      }));
      showToast(brandId ? 'Page mapped to brand.' : 'Page unmapped.');
    } catch (err: any) {
      showToast(toUserFacingError(err, 'Could not map page to brand.'), true);
    }
  };

  const disconnectPage = async (pageId: string, pageIdentifier?: string) => {
    try {
      const targetId = pageIdentifier || pageId;
      await axios.delete(`/api/social/pages/${encodeURIComponent(targetId)}`).catch(async () => {
        // Fallback if primary id fails
        if (pageId !== targetId) {
          await axios.delete(`/api/social/pages/${encodeURIComponent(pageId)}`);
        }
      });
      setSummary(prev => ({
        ...prev,
        pages: prev.pages.filter(p => p.id !== pageId && p.page_id !== pageId && p.id !== targetId && p.page_id !== targetId),
      }));
      showToast('Page disconnected.');
    } catch (err: any) {
      // If backend record wasn't found, clean up local state anyway so it doesn't block the user
      setSummary(prev => ({
        ...prev,
        pages: prev.pages.filter(p => p.id !== pageId && p.page_id !== pageId),
      }));
      showToast('Page removed from view.');
    }
  };

  const mapAdBrand = async (accountId: string, brandId: string) => {
    try {
      const res = await axios.patch(`/api/social/ad-accounts/${encodeURIComponent(accountId)}/brand`, { brand_id: brandId });
      setSummary(prev => ({
        ...prev,
        ad_accounts: prev.ad_accounts.map(a => a.id === accountId || a.ad_account_id === accountId ? { ...a, brand_id: res.data.brand_id || brandId, status: brandId ? 'connected' : a.status } : a),
      }));
      if (brandId) {
        try {
          await axios.post(`/api/social/ad-accounts/${encodeURIComponent(accountId)}/connect`);
        } catch {
          /* non-blocking */
        }
      }
      setMetrics(prev => prev.map(m => {
        const acc = summary.ad_accounts.find(a => a.id === accountId || a.ad_account_id === accountId);
        if (acc && m.ad_account_id === acc.ad_account_id) return { ...m, brand_id: brandId || m.brand_id };
        return m;
      }));
      showToast(brandId ? 'Ad account mapped and connected automatically.' : 'Ad account unmapped.');
      loadAll();
    } catch (err: any) {
      showToast(toUserFacingError(err, 'Could not map ad account.'), true);
    }
  };

  const connectAdAccount = async (accountId: string) => {
    try {
      const res = await axios.post(`/api/social/ad-accounts/${encodeURIComponent(accountId)}/connect`);
      setSummary(prev => ({
        ...prev,
        ad_accounts: prev.ad_accounts.map(a => a.id === accountId || a.ad_account_id === accountId ? { ...a, status: res.data.status || 'connected' } : a),
      }));
      showToast('Ad account connected successfully.');
      loadAll();
    } catch (err: any) {
      showToast(toUserFacingError(err, 'Could not connect ad account.'), true);
    }
  };

  const disconnectAdAccount = async (accountId: string, accountIdentifier?: string) => {
    try {
      const targetId = accountIdentifier || accountId;
      await axios.delete(`/api/social/ad-accounts/${encodeURIComponent(targetId)}`).catch(async () => {
        if (accountId !== targetId) {
          await axios.delete(`/api/social/ad-accounts/${encodeURIComponent(accountId)}`);
        }
      });
      setSummary(prev => ({
        ...prev,
        ad_accounts: prev.ad_accounts.filter(a => a.id !== accountId && a.ad_account_id !== accountId && a.id !== targetId && a.ad_account_id !== targetId),
      }));
      showToast('Ad account disconnected.');
      loadAll();
    } catch (err: any) {
      setSummary(prev => ({
        ...prev,
        ad_accounts: prev.ad_accounts.filter(a => a.id !== accountId && a.ad_account_id !== accountId),
      }));
      showToast('Ad account removed from view.');
      loadAll();
    }
  };

  const submitPost = async (mode: 'draft' | 'schedule' | 'publish' | 'approval') => {
    if (postingMode) return;
    try {
      setPostingMode(mode === 'approval' ? 'publish' : mode);
      const targets = form.provider === 'linkedin'
        ? ['linkedin']
        : form.publish_targets.length ? form.publish_targets : ['facebook'];
      const payload = {
        ...form,
        brand_id: form.brand_id || scopeBrandId || brands[0]?.id || '',
        publish_targets: targets,
        media_urls: form.media_urls.split('\n').flatMap(line => line.split(',')).map(item => item.trim()).filter(Boolean),
        instagram_account_id: currentPage?.instagram_business_account_id || '',
      };
      if (!payload.caption.trim()) {
        showToast('Write a caption before saving or publishing.', true);
        return;
      }
      if (!payload.brand_id) {
        showToast('Choose a brand for this post.', true);
        return;
      }
      let path = mode === 'draft' ? 'draft' : mode === 'schedule' ? 'schedule' : mode === 'approval' ? 'submit-approval' : 'publish';
      const res = await axios.post(`/api/social/posts/${path}`, payload);
      const post = res.data as SocialPost;
      setPosts(prev => [post, ...prev.filter(item => item.id !== post.id)]);
      if (post.status === 'pending_approval') {
        showToast(isAdmin ? 'Submitted for approval.' : 'Sent to admin for approval before going live.');
      } else {
        showToast(mode === 'draft' ? 'Draft saved.' : mode === 'schedule' ? 'Post scheduled.' : 'Post published.');
      }
      if (mode !== 'draft' || !form.caption) setForm(prev => ({ ...prev, caption: '', media_urls: '', scheduled_for: '' }));
      if (mode !== 'draft' || !form.caption) setMediaUploadNames([]);
      loadAll();
    } catch (err: any) {
      showToast(toUserFacingError(err, 'Post could not be saved.'), true);
    } finally {
      setPostingMode('');
    }
  };

  const applyTemplate = (tpl: SocialTemplate) => {
    const tags = (tpl.hashtags || []).map(h => (h.startsWith('#') ? h : `#${h}`)).join(' ');
    const body = [tpl.caption || '', tags].filter(Boolean).join(tpl.caption && tags ? '\n\n' : '');
    setForm(prev => ({
      ...prev,
      brand_id: tpl.brand_id || prev.brand_id,
      caption: body || prev.caption,
    }));
    if (tpl.brand_id) setScopeBrandId(tpl.brand_id);
    showToast(`Template “${tpl.name}” applied.`);
  };

  const saveTemplate = async () => {
    const brandId = form.brand_id || scopeBrandId;
    if (!brandId) { showToast('Choose a brand before saving a template.', true); return; }
    if (!templateForm.name.trim() && !form.caption.trim()) {
      showToast('Add a template name or caption.', true);
      return;
    }
    setTemplateSaving(true);
    try {
      const res = await axios.post('/api/social/templates', {
        brand_id: brandId,
        name: templateForm.name.trim() || `Template ${new Date().toLocaleDateString()}`,
        caption: templateForm.caption.trim() || form.caption,
        hashtags: templateForm.hashtags,
      });
      setTemplates(prev => [res.data, ...prev.filter(t => t.id !== res.data.id)]);
      setTemplateForm({ name: '', caption: '', hashtags: '' });
      showToast('Content template saved for this brand.');
    } catch (err: any) {
      showToast(toUserFacingError(err, 'Could not save template.'), true);
    } finally {
      setTemplateSaving(false);
    }
  };

  const deleteTemplate = async (id: string) => {
    try {
      await axios.delete(`/api/social/templates/${encodeURIComponent(id)}`);
      setTemplates(prev => prev.filter(t => t.id !== id));
      showToast('Template removed.');
    } catch (err: any) {
      showToast(toUserFacingError(err, 'Could not delete template.'), true);
    }
  };

  const saveBudget = async () => {
    const brandId = scopeBrandId || form.brand_id;
    if (!brandId) { showToast('Select a brand chip first to set budget alerts.', true); return; }
    try {
      const res = await axios.put(`/api/social/budgets/${encodeURIComponent(brandId)}`, {
        monthly_budget: Number(budgetForm.monthly_budget || 0),
        cpl_alert_threshold: Number(budgetForm.cpl_alert_threshold || 0),
        currency: 'USD',
      });
      setBudgets(prev => {
        const rest = prev.filter(b => b.brand_id !== brandId);
        return [...rest, res.data];
      });
      showToast('Budget & CPL alerts saved.');
      loadPhase2Extras(brandId);
    } catch (err: any) {
      showToast(toUserFacingError(err, 'Could not save budget.'), true);
    }
  };

  const approvePost = async (post: SocialPost) => {
    try {
      const res = await axios.post(`/api/social/posts/${encodeURIComponent(post.id)}/approve`);
      setPosts(prev => prev.map(p => p.id === post.id ? res.data : p));
      showToast(res.data.status === 'published' ? 'Post approved and published.' : res.data.status === 'scheduled' ? 'Post approved and scheduled.' : 'Post approved.');
      loadAll();
    } catch (err: any) {
      showToast(toUserFacingError(err, 'Approve failed.'), true);
    }
  };

  const rejectPost = async (post: SocialPost) => {
    const reason = window.prompt('Rejection reason (optional):', 'Needs copy changes') || 'Needs changes';
    try {
      const res = await axios.post(`/api/social/posts/${encodeURIComponent(post.id)}/reject`, { reason });
      setPosts(prev => prev.map(p => p.id === post.id ? res.data : p));
      showToast('Post rejected — author can revise.');
    } catch (err: any) {
      showToast(toUserFacingError(err, 'Reject failed.'), true);
    }
  };

  const pendingApproval = useMemo(
    () => posts.filter(p => p.status === 'pending_approval' && (!scopeBrandId || p.brand_id === scopeBrandId)),
    [posts, scopeBrandId],
  );

  const uploadMediaFiles = async (files: FileList | null) => {
    const selected = Array.from(files || []);
    if (!selected.length) return;
    setMediaUploading(true);
    setMediaUploadNames(selected.map(file => file.name));
    try {
      const uploaded: string[] = [];
      for (const file of selected) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('Could not read the selected file.'));
          reader.readAsDataURL(file);
        });
        const res = await axios.post('/api/social/media/upload', {
          name: file.name,
          mime_type: file.type,
          data_url: dataUrl,
        });
        if (res.data?.url) uploaded.push(res.data.url);
      }
      setForm(prev => ({
        ...prev,
        media_urls: [...prev.media_urls.split('\n').map(item => item.trim()).filter(Boolean), ...uploaded].join('\n'),
      }));
      showToast(uploaded.length === 1 ? 'Media attached.' : `${uploaded.length} media files attached.`);
    } catch (err: any) {
      showToast(toUserFacingError(err, 'Media could not be attached.'), true);
      setMediaUploadNames([]);
    } finally {
      setMediaUploading(false);
    }
  };

  const cancelPost = async (post: SocialPost) => {
    try {
      await axios.delete(`/api/social/posts/${post.id}`);
      setPosts(prev => prev.map(item => item.id === post.id ? { ...item, status: 'cancelled' } : item));
      showToast('Post cancelled.');
    } catch (err: any) {
      showToast(toUserFacingError(err, 'Post could not be cancelled.'), true);
    }
  };

  const removePost = async (post: SocialPost) => {
    try {
      await axios.delete(`/api/social/posts/${post.id}`, { params: { mode: 'remove' } });
      setPosts(prev => prev.filter(item => item.id !== post.id));
      showToast('Post removed from the CRM library.');
    } catch (err: any) {
      showToast(toUserFacingError(err, 'Post could not be removed.'), true);
    }
  };

  const clearPublishedPosts = async () => {
    if (!clearPublishedArmed) {
      setClearPublishedArmed(true);
      showToast('Click Clear published again to confirm.');
      return;
    }
    try {
      const res = await axios.delete('/api/social/posts/clear', {
        params: {
          status: 'published',
          brand_id: scopeBrandId || undefined,
          provider: postFilter.provider || undefined,
        },
      });
      setPosts(prev => prev.filter(item => !(
        item.status === 'published' &&
        (!scopeBrandId || item.brand_id === scopeBrandId) &&
        (!postFilter.provider || item.provider === postFilter.provider)
      )));
      setClearPublishedArmed(false);
      showToast(`${res.data?.removed || 0} published post${res.data?.removed === 1 ? '' : 's'} cleared.`);
    } catch (err: any) {
      setClearPublishedArmed(false);
      showToast(toUserFacingError(err, 'Published posts could not be cleared.'), true);
    }
  };

  const retryPost = async (post: SocialPost) => {
    try {
      const res = await axios.post(`/api/social/posts/${post.id}/retry`);
      setPosts(prev => prev.map(item => item.id === post.id ? res.data : item));
      showToast(res.data.status === 'published' ? 'Post published.' : 'Retry completed with an error.', res.data.status !== 'published');
    } catch (err: any) {
      showToast(toUserFacingError(err, 'Post retry failed.'), true);
    }
  };

  const duplicatePost = (post: SocialPost) => {
    setForm({
      brand_id: post.brand_id,
      provider: post.provider,
      page_id: post.page_id || post.linkedin_organization_id || '',
      publish_targets: post.publish_targets || [post.provider === 'linkedin' ? 'linkedin' : 'facebook'],
      caption: post.caption,
      media_urls: (post.media_urls || []).join('\n'),
      scheduled_for: '',
    });
    setActiveTab('composer');
  };

  const checklist = [
    { label: 'Connect Meta account', done: summary.connections.some(c => c.provider === 'meta' && c.status === 'connected'), tab: 'accounts' as const },
    { label: linkedinOrgReady ? 'Connect LinkedIn company page' : 'Request LinkedIn company-page approval', done: linkedinOrgReady ? visiblePages.some(p => p.provider === 'linkedin') : false, tab: 'accounts' as const },
    { label: 'Map pages to CRM brands', done: visiblePages.some(p => p.brand_id), tab: 'accounts' as const },
    { label: 'Map ad accounts to brands', done: summary.ad_accounts.some(a => Boolean(a.brand_id)), tab: 'accounts' as const },
    { label: 'Create first post', done: posts.length > 0, tab: 'composer' as const },
    { label: 'Schedule first post', done: posts.some(p => p.status === 'scheduled'), tab: 'calendar' as const },
    { label: 'Pull ad insights', done: metrics.length > 0, tab: 'ads' as const },
  ];

  const shellStyle = scopeBrand
    ? { ['--social-brand' as string]: scopeBrand.color, ['--social-brand-soft' as string]: `${scopeBrand.color}18` }
    : { ['--social-brand' as string]: 'var(--accent)', ['--social-brand-soft' as string]: 'color-mix(in srgb, var(--accent) 12%, transparent)' };

  return (
    <div className="social-hub-page social-hub-page--v2" style={shellStyle as React.CSSProperties}>
      <div className="social-hub-hero social-hub-hero--v2">
        <div>
          <span className="social-eyebrow"><i className="fas fa-share-nodes"></i> Social studio</span>
          <h2>{scopeBrand ? `${scopeBrand.name} social` : 'Portfolio social studio'}</h2>
          <p>
            {scopeBrand
              ? `Plan content, map channels, and track ad spend for ${scopeBrand.name}.`
              : 'Brand-first publishing for Facebook, Instagram, LinkedIn — and Meta Ads performance by brand.'}
          </p>
        </div>
        <div className="social-hub-actions">
          {PROVIDERS.map(provider => (
            <button key={provider.id} className="btn btn-primary social-connect-btn" type="button" onClick={() => connectProvider(provider.id)} disabled={!isAdmin}>
              <span className="social-connect-btn__logos">
                {provider.networks.map(network => (
                  <SocialNetworkLogo key={network} network={network} size={18} />
                ))}
              </span>
              Connect {provider.id === 'meta' ? 'Meta' : 'LinkedIn'}
            </button>
          ))}
          <button className="btn btn-ghost" type="button" onClick={loadAll} disabled={loading}>
            <i className={`fas ${loading ? 'fa-circle-notch fa-spin' : 'fa-rotate'}`}></i> Refresh
          </button>
          <button className="btn btn-primary" type="button" onClick={() => setActiveTab('composer')}>
            <i className="fas fa-plus"></i> New post
          </button>
        </div>
      </div>

      <div className="social-brand-chips" role="tablist" aria-label="Brand scope">
        <button
          type="button"
          className={!scopeBrandId ? 'active' : ''}
          onClick={() => setScopeBrandId('')}
        >
          <i className="fas fa-layer-group"></i> All brands
        </button>
        {brands.map(brand => (
          <button
            key={brand.id}
            type="button"
            className={scopeBrandId === brand.id ? 'active' : ''}
            style={{ ['--chip-tone' as string]: brand.color }}
            onClick={() => setScopeBrandId(brand.id)}
          >
            {brand.logo ? <img src={brand.logo} alt="" /> : <span className="social-brand-chips__dot" style={{ background: brand.color }} />}
            {brand.name}
          </button>
        ))}
      </div>

      {needsReconnect && (
        <div className="social-banner social-banner--warn">
          <i className="fas fa-triangle-exclamation"></i>
          <div>
            <strong>A social connection needs attention</strong>
            <span>Reconnect Meta or LinkedIn under Accounts so publishing and insights keep working.</span>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setActiveTab('accounts')}>Fix accounts</button>
        </div>
      )}

      {isAdmin && (unmappedPages.length > 0 || unmappedAds.length > 0) && (
        <div className="social-banner social-banner--info">
          <i className="fas fa-link"></i>
          <div>
            <strong>Map channels to brands</strong>
            <span>
              {unmappedPages.length > 0 && `${unmappedPages.length} page${unmappedPages.length === 1 ? '' : 's'}`}
              {unmappedPages.length > 0 && unmappedAds.length > 0 && ' · '}
              {unmappedAds.length > 0 && `${unmappedAds.length} ad account${unmappedAds.length === 1 ? '' : 's'}`}
              {' '}not linked yet — map them so calendars and spend stay brand-clean.
            </span>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setActiveTab('accounts')}>Map now</button>
        </div>
      )}

      <div className="social-tabs social-tabs--v2">
        {TABS.map(tab => (
          <button key={tab.id} type="button" className={activeTab === tab.id ? 'active' : ''} onClick={() => setActiveTab(tab.id)}>
            {tab.id === 'ads' ? <MetaAdsLogo size={16} /> : <i className={`fas ${tab.icon}`}></i>}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="social-studio">
          <div className="social-grid social-grid--stats">
            {[
              { label: 'Pages', value: scopedStats.pages, icon: 'fa-flag', tone: '#1877F2' },
              { label: 'Scheduled', value: scopedStats.scheduled, icon: 'fa-clock', tone: '#f59e0b' },
              { label: 'Published', value: scopedStats.published, icon: 'fa-circle-check', tone: '#0f766e' },
              { label: 'Failed', value: scopedStats.failed, icon: 'fa-triangle-exclamation', tone: '#ef4444' },
              { label: `Ad spend (${adsRangeDays}d)`, value: money(scopedStats.spend), icon: 'fa-wallet', tone: '#155e75' },
              { label: 'Ad leads', value: scopedStats.adLeads, icon: 'fa-user-plus', tone: '#7c3aed' },
              { label: 'Cost / lead', value: money(scopedStats.cpl), icon: 'fa-bullseye', tone: '#0ea5e9' },
              { label: 'Drafts', value: scopedStats.drafts, icon: 'fa-file-lines', tone: '#64748b' },
            ].map(card => (
              <div className="social-metric-card social-metric-card--v2" key={card.label}>
                <span style={{ color: card.tone, background: `${card.tone}18` }} className="social-metric-card__icon">
                  <i className={`fas ${card.icon}`}></i>
                </span>
                <strong>{card.value}</strong>
                <small>{card.label}</small>
              </div>
            ))}
          </div>

          <div className="social-grid social-grid--two">
            <div className="social-panel social-setup-panel">
              <div className="social-panel-head social-setup-panel__head">
                <div>
                  <span>Launch progress</span>
                  <strong>Social setup</strong>
                </div>
                <div className="social-setup-panel__progress" aria-label={`${checklist.filter(i => i.done).length} of ${checklist.length} setup steps complete`}>
                  <strong>{checklist.filter(i => i.done).length}/{checklist.length}</strong>
                  <span>ready</span>
                </div>
              </div>
              <div className="social-setup-panel__bar" aria-hidden="true">
                <span style={{ width: `${(checklist.filter(i => i.done).length / checklist.length) * 100}%` }} />
              </div>
              <div className="social-checklist">
                {checklist.map((item, index) => (
                  <button
                    key={item.label}
                    type="button"
                    className={`social-checklist__item ${item.done ? 'done' : ''}`}
                    onClick={() => setActiveTab(item.tab)}
                  >
                    <i className={`fas ${item.done ? 'fa-check' : 'fa-circle'}`} aria-hidden="true"></i>
                    <span>{item.label}</span>
                    <em>{item.done ? 'Done' : `${index + 1}`}</em>
                  </button>
                ))}
              </div>
            </div>

            {pendingApproval.length > 0 && (
              <div className="social-panel social-panel--wide">
                <div className="social-panel-head">
                  <div>
                    <span>Approval queue</span>
                    <strong>{pendingApproval.length} waiting</strong>
                  </div>
                </div>
                <div className="social-upcoming-list">
                  {pendingApproval.slice(0, 6).map(post => {
                    const brand = brands.find(b => b.id === post.brand_id);
                    return (
                      <div key={post.id} className="social-upcoming-row">
                        <em className="social-status warn">pending</em>
                        <div>
                          <strong>{brand?.name || post.brand_id}</strong>
                          <span>
                            {(post.caption || '').slice(0, 80)}
                            {post.approval_requested_by_name ? ` · by ${post.approval_requested_by_name}` : ''}
                          </span>
                        </div>
                        {isAdmin ? (
                          <div className="social-post-card__actions">
                            <button type="button" className="btn btn-primary btn-sm" onClick={() => approvePost(post)}>Approve</button>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => rejectPost(post)}>Reject</button>
                          </div>
                        ) : (
                          <time>Awaiting admin</time>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="social-panel">
              <div className="social-panel-head">
                <div>
                  <span>Upcoming</span>
                  <strong>{upcomingPosts.length} in queue</strong>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setActiveTab('calendar')}>Open calendar</button>
              </div>
              <div className="social-upcoming-list">
                {upcomingPosts.slice(0, 5).map(post => {
                  const brand = brands.find(b => b.id === post.brand_id);
                  return (
                    <div key={post.id} className="social-upcoming-row">
                      <em className={`social-status ${statusClass(post.status)}`}>{post.status}</em>
                      <div>
                        <strong>{brand?.name || post.brand_id}</strong>
                        <span>{(post.caption || 'Untitled').slice(0, 72)}{(post.caption || '').length > 72 ? '…' : ''}</span>
                      </div>
                      <time>{post.scheduled_for ? new Date(post.scheduled_for).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}</time>
                    </div>
                  );
                })}
                {upcomingPosts.length === 0 && (
                  <div className="social-empty-state">
                    <i className="fas fa-calendar-plus"></i>
                    <strong>Nothing scheduled yet</strong>
                    <p>Create a post for {scopeBrand?.name || 'a brand'} and schedule it on the calendar.</p>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => setActiveTab('composer')}>
                      <i className="fas fa-pen"></i> Create post
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'accounts' && (
        <div className="social-grid social-grid--two">
          {PROVIDERS.map(provider => {
            const configured = providerSettings[provider.id]?.configured;
            const connection = summary.connections.find(item => item.provider === provider.id);
            const allProviderPages = (isAdmin ? visiblePages : visiblePages.filter(p => Boolean(p.brand_id))).filter(page => page.provider === provider.id);
            return (
              <div className="social-panel" key={provider.id}>
                <div className="social-panel-head">
                  <div className="social-panel-head__brand">
                    <span className="social-panel-head__logos">
                      {provider.networks.map(network => <SocialNetworkLogo key={network} network={network} size={22} />)}
                    </span>
                    <div>
                      <span>{provider.label}</span>
                      <strong>{isAdmin ? (connection?.connected_name || 'Not connected') : (connection ? 'Account connected' : 'Not connected')}</strong>
                    </div>
                  </div>
                  <em className={`social-status ${statusClass(connection?.status || 'not_connected')}`}>
                    {connection?.status || (configured ? 'not connected' : 'needs setup')}
                  </em>
                </div>
                {connection?.last_error && <p className="social-warning">{connection.last_error}</p>}
                <div className="social-map-list">
                  {allProviderPages.map(page => (
                    <div key={page.id || page.page_id} className="social-map-row">
                      <div>
                        <strong>{page.page_name}</strong>
                        <span>
                          {page.provider === 'meta' ? 'Facebook Page' : 'LinkedIn Page'}
                          {page.instagram_username ? ` · @${page.instagram_username}` : ''}
                        </span>
                      </div>
                      {isAdmin ? (
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <select
                            value={page.brand_id || ''}
                            onChange={e => mapPageBrand(page.id || page.page_id, e.target.value)}
                            aria-label={`Map ${page.page_name} to brand`}
                          >
                            <option value="">Unmapped brand (hidden from staff)</option>
                            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                          </select>
                          <button
                            className="btn btn-ghost btn-sm"
                            type="button"
                            onClick={() => disconnectPage(page.id, page.page_id)}
                            title="Disconnect page"
                          >
                            <i className="fas fa-trash-alt"></i>
                          </button>
                        </div>
                      ) : (
                        <span className="social-status good" style={{ fontSize: '12px', padding: '4px 10px' }}>
                          {brands.find(b => b.id === page.brand_id)?.name || 'Mapped'}
                        </span>
                      )}
                    </div>
                  ))}
                  {allProviderPages.length === 0 && (
                    <div className="social-empty-state social-empty-state--compact">
                      <i className="fas fa-plug"></i>
                      <p>No pages yet. Connect {provider.label}{!isAdmin ? ' (admin required)' : ''}.</p>
                    </div>
                  )}
                </div>
                {provider.id === 'linkedin' && !providerSettings.linkedin?.organization_scopes_enabled && (
                  <p className="social-help">LinkedIn company pages need organization approval before they appear for posting.</p>
                )}
                {isAdmin && (
                  <div className="social-panel-actions">
                    <button className="btn btn-primary btn-sm" type="button" onClick={() => connectProvider(provider.id)} disabled={!configured}>
                      Connect
                    </button>
                    <button className="btn btn-ghost btn-sm" type="button" onClick={() => syncProvider(provider.id)} disabled={!connection}>
                      Refresh
                    </button>
                  </div>
                )}
                {!configured && <p className="social-help">Add {provider.label} app credentials on the server to enable live connection.</p>}
              </div>
            );
          })}

           <div className="social-panel social-panel--wide">
            <div className="social-panel-head">
              <div>
                <span>Ad accounts</span>
                <strong>{visibleAdAccounts.length} connected · map each to a brand</strong>
              </div>
               <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                 {isAdmin && (
                   <select
                     value={adAccountFilter}
                     onChange={(e) => setAdAccountFilter(e.target.value as 'all' | 'mapped' | 'unmapped')}
                     aria-label="Filter ad accounts"
                     style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '12px' }}
                   >
                     <option value="all">All ad accounts</option>
                     <option value="mapped">Mapped only</option>
                     <option value="unmapped">Unmapped only</option>
                   </select>
                 )}
                 <button className="btn btn-ghost btn-sm" type="button" onClick={() => syncProvider('meta')} disabled={!summary.connections.find(c => c.provider === 'meta')} title="Refresh ad accounts">
                   <i className="fas fa-sync-alt"></i> Refresh
                 </button>
               </div>
            </div>
            {summary.connections.find(c => c.provider === 'meta')?.last_error && visibleAdAccounts.length === 0 && (
              <p className="social-warning">{summary.connections.find(c => c.provider === 'meta')?.last_error}</p>
            )}
             <div className="social-map-list">
               {visibleAdAccounts.map(account => {
                 const isUnmapped = !account.brand_id;
                 return (
                 <div key={account.id || account.ad_account_id} className="social-map-row">
                   <div>
                     <strong>{account.ad_account_name}</strong>
                     <span>{account.provider} · {account.currency || '—'} · {account.status}</span>
                   </div>
                   {isUnmapped && isAdmin ? (
                     <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                       <select
                         value={account.brand_id || ''}
                         onChange={e => mapAdBrand(account.id || account.ad_account_id, e.target.value)}
                         aria-label={`Map ${account.ad_account_name} to brand`}
                       >
                         <option value="">Select brand...</option>
                         {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                       </select>
                       <button
                         className="btn btn-sm"
                         type="button"
                         style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                         onClick={() => connectAdAccount(account.id || account.ad_account_id)}
                         disabled={!account.brand_id}
                         title="Connect this ad account"
                       >
                         <i className="fas fa-plug"></i> Connect
                       </button>
                       <button
                         className="btn btn-ghost btn-sm"
                         type="button"
                         onClick={() => disconnectAdAccount(account.id, account.ad_account_id)}
                         title="Disconnect ad account"
                       >
                         <i className="fas fa-trash-alt"></i>
                       </button>
                     </div>
                   ) : (
                     <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                       <span className="social-status good" style={{ fontSize: '12px', padding: '4px 10px' }}>
                         {brands.find(b => b.id === account.brand_id)?.name || 'Mapped'}
                       </span>
                       {isAdmin && (
                         <button
                           className="btn btn-ghost btn-sm"
                           type="button"
                           onClick={() => disconnectAdAccount(account.id, account.ad_account_id)}
                           title="Disconnect ad account"
                         >
                           <i className="fas fa-trash-alt"></i>
                         </button>
                       )}
                     </div>
                   )}
                 </div>
                 );
               })}
               {visibleAdAccounts.length === 0 && (
                 <div className="social-empty-state">
                   <MetaAdsLogo size={36} />
                   <strong>No ad accounts yet</strong>
                   <p>
                     {summary.connections.find(c => c.provider === 'meta')
                       ? 'Meta is connected but no ad accounts were found. Click Refresh to try again, or check that your Meta account has ads permissions.'
                       : 'Connect Meta with ads permissions, then refresh. Map each ad account to a CRM brand for spend dashboards.'}
                   </p>
                   {summary.connections.find(c => c.provider === 'meta') ? (
                     <button type="button" className="btn btn-primary btn-sm" onClick={() => syncProvider('meta')} disabled={!summary.connections.find(c => c.provider === 'meta')}>
                       Refresh ad accounts
                     </button>
                   ) : (
                     isAdmin ? (
                       <button type="button" className="btn btn-primary btn-sm" onClick={() => connectProvider('meta')}>
                         Connect Meta
                       </button>
                     ) : null
                   )}
                 </div>
               )}
             </div>
           </div>
        </div>
      )}

      {activeTab === 'composer' && (
        <div className="social-composer-layout">
          <div className="social-panel">
            <div className="social-compose-summary" aria-live="polite">
              <span><i className="fas fa-building"></i> {formBrand?.name || 'Brand'}</span>
              <span><i className="fas fa-flag"></i> {currentPage?.page_name || 'Page'}</span>
              <span>
                <SocialNetworkLogo network={form.provider === 'linkedin' ? 'linkedin' : 'facebook'} size={14} />
                {form.provider === 'linkedin' ? 'LinkedIn' : (form.publish_targets.join(' + ') || 'Meta')}
              </span>
              <span><i className="fas fa-clock"></i> {form.scheduled_for ? new Date(form.scheduled_for).toLocaleString() : 'Draft / now'}</span>
            </div>

            <div className="social-panel-head">
              <div><span>Create post</span><strong>Draft, publish, or schedule</strong></div>
              <em className={`social-status ${form.provider === 'linkedin' ? 'good' : 'warn'}`}>{selectedProvider.label}</em>
            </div>

            <div className="social-form-grid">
              <div className="social-compose-toolbar social-form-wide" aria-label="Choose publishing network">
                {PROVIDERS.map(provider => (
                  <button
                    key={provider.id}
                    type="button"
                    className={`social-platform-chip ${form.provider === provider.id ? 'active' : ''}`}
                    onClick={() => {
                      const pool = scopeBrandId ? brandPages : visiblePages;
                      const page = pool
                        .filter(item => item.provider === provider.id)
                        .sort((a, b) => a.page_name.localeCompare(b.page_name))[0];
                      setForm(prev => ({
                        ...prev,
                        provider: provider.id,
                        page_id: page?.page_id || '',
                        publish_targets: provider.id === 'linkedin' ? ['linkedin'] : ['facebook'],
                      }));
                    }}
                  >
                    <span className="social-connect-btn__logos">
                      {provider.networks.map(network => <SocialNetworkLogo key={network} network={network} size={16} />)}
                    </span>
                    {provider.id === 'meta' ? 'Facebook & Instagram' : provider.label}
                  </button>
                ))}
              </div>

              <label>
                Brand
                <select
                  value={form.brand_id}
                  onChange={e => {
                    const brand_id = e.target.value;
                    const page = visiblePages.find(p => p.brand_id === brand_id && p.provider === form.provider)
                      || visiblePages.find(p => p.brand_id === brand_id);
                    setForm(prev => ({
                      ...prev,
                      brand_id,
                      page_id: page?.page_id || prev.page_id,
                      provider: page?.provider || prev.provider,
                    }));
                    if (brand_id) setScopeBrandId(brand_id);
                  }}
                >
                  {brands.map(brand => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
                </select>
              </label>

              <label>
                {form.provider === 'linkedin' ? 'Company page' : 'Page / account'}
                <select value={form.page_id} onChange={e => setForm(prev => ({ ...prev, page_id: e.target.value }))}>
                  <option value="">{form.provider === 'linkedin' ? 'Choose company page' : 'Choose page'}</option>
                  {pagesForProvider.map(page => (
                    <option key={page.id || page.page_id} value={page.page_id}>
                      {page.page_name}{page.instagram_username ? ` + @${page.instagram_username}` : ''}
                      {!page.brand_id ? ' (unmapped)' : ''}
                    </option>
                  ))}
                </select>
              </label>

              {form.provider === 'meta' && (
                <label>
                  Publish to
                  <select
                    value={form.publish_targets.join(',')}
                    onChange={e => setForm(prev => ({ ...prev, publish_targets: e.target.value.split(',').filter(Boolean) }))}
                  >
                    <option value="facebook">Facebook only</option>
                    <option value="instagram">Instagram only</option>
                    <option value="facebook,instagram">Facebook and Instagram</option>
                  </select>
                </label>
              )}

              <div className="social-caption-box social-form-wide">
                <div className="social-caption-head">
                  <div>
                    <span>Post copy</span>
                    <strong style={{ color: formBrand?.color || undefined }}>
                      {formBrand ? `Voice of ${formBrand.name}` : 'Write caption'}
                    </strong>
                  </div>
                  <small>{form.caption.length} characters{form.provider === 'linkedin' ? '' : form.caption.length > 2200 ? ' · long for IG' : ''}</small>
                </div>
                <textarea
                  value={form.caption}
                  onChange={e => setForm(prev => ({ ...prev, caption: e.target.value }))}
                  placeholder={form.provider === 'linkedin' ? 'Share an update for your LinkedIn company page…' : 'Write the caption your audience will see…'}
                  rows={8}
                />
                <div className="social-caption-tools">
                  {EMOJI_SHORTCUTS.map(emoji => (
                    <button key={emoji} type="button" className="social-emoji-button" onClick={() => appendCaptionText(emoji)}>{emoji}</button>
                  ))}
                  {POST_STARTERS.map(starter => (
                    <button key={starter} type="button" className="social-starter-button" onClick={() => appendCaptionText(starter)}>{starter}</button>
                  ))}
                </div>
              </div>

              <div className="social-form-wide social-media-picker">
                <div>
                  <span>Media</span>
                  <small>Images or short video from your computer.</small>
                </div>
                <label className="social-upload-button">
                  <i className={`fas ${mediaUploading ? 'fa-circle-notch fa-spin' : mediaCount ? 'fa-check' : 'fa-cloud-arrow-up'}`}></i>
                  {mediaUploading ? 'Uploading…' : mediaCount ? 'Add more media' : 'Choose media'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime"
                    multiple
                    disabled={mediaUploading}
                    onChange={e => {
                      uploadMediaFiles(e.target.files);
                      e.currentTarget.value = '';
                    }}
                  />
                </label>
                {mediaCount > 0 && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => {
                    setForm(prev => ({ ...prev, media_urls: '' }));
                    setMediaUploadNames([]);
                  }}>
                    Remove media
                  </button>
                )}
                {(mediaUploading || mediaCount > 0) && (
                  <div className="social-media-attachments">
                    {mediaUploading && mediaUploadNames.map(name => (
                      <span key={name}><i className="fas fa-circle-notch fa-spin"></i>{name}</span>
                    ))}
                    {!mediaUploading && mediaItems.map((url, index) => (
                      <span key={`${url}-${index}`}><i className="fas fa-paperclip"></i>{mediaUploadNames[index] || mediaLabelFromUrl(url, index)}</span>
                    ))}
                  </div>
                )}
              </div>

              <label>
                Schedule time
                <input type="datetime-local" value={form.scheduled_for} onChange={e => setForm(prev => ({ ...prev, scheduled_for: e.target.value }))} />
              </label>
            </div>

            <div className="social-panel-actions">
              <button className="btn btn-ghost" type="button" disabled={Boolean(postingMode)} onClick={() => submitPost('draft')}>
                <i className={`fas ${postingMode === 'draft' ? 'fa-circle-notch fa-spin' : 'fa-file-lines'}`}></i>
                {postingMode === 'draft' ? 'Saving…' : 'Save draft'}
              </button>
              {isAdmin ? (
                <>
                  <button className="btn btn-primary" type="button" disabled={mediaUploading || Boolean(postingMode)} onClick={() => submitPost('publish')}>
                    <i className={`fas ${postingMode === 'publish' ? 'fa-circle-notch fa-spin' : 'fa-paper-plane'}`}></i>
                    {postingMode === 'publish' ? 'Publishing…' : 'Publish now'}
                  </button>
                  <button className="btn btn-primary" type="button" disabled={mediaUploading || Boolean(postingMode)} onClick={() => submitPost('schedule')}>
                    <i className={`fas ${postingMode === 'schedule' ? 'fa-circle-notch fa-spin' : 'fa-clock'}`}></i>
                    {postingMode === 'schedule' ? 'Scheduling…' : 'Schedule'}
                  </button>
                </>
              ) : (
                <button className="btn btn-primary" type="button" disabled={mediaUploading || Boolean(postingMode)} onClick={() => submitPost('approval')}>
                  <i className="fas fa-user-check"></i> Submit for approval
                </button>
              )}
            </div>

            <div className="social-template-box">
              <div className="social-panel-head">
                <div>
                  <span>Brand content library</span>
                  <strong>Templates & hashtag packs</strong>
                </div>
              </div>
              <div className="social-template-save">
                <input
                  placeholder="Template name"
                  value={templateForm.name}
                  onChange={e => setTemplateForm(prev => ({ ...prev, name: e.target.value }))}
                />
                <input
                  placeholder="Hashtags (growth, local, tip)"
                  value={templateForm.hashtags}
                  onChange={e => setTemplateForm(prev => ({ ...prev, hashtags: e.target.value }))}
                />
                <button type="button" className="btn btn-ghost btn-sm" disabled={templateSaving} onClick={saveTemplate}>
                  <i className="fas fa-bookmark"></i> Save current caption as template
                </button>
              </div>
              <div className="social-template-list">
                {templates.filter(t => !form.brand_id || t.brand_id === form.brand_id || t.brand_id === scopeBrandId).map(tpl => (
                  <div key={tpl.id} className="social-template-card">
                    <div>
                      <strong>{tpl.name}</strong>
                      <span>{(tpl.caption || '').slice(0, 90)}{(tpl.caption || '').length > 90 ? '…' : ''}</span>
                      {tpl.hashtags?.length > 0 && (
                        <small>{tpl.hashtags.map(h => (h.startsWith('#') ? h : `#${h}`)).join(' ')}</small>
                      )}
                    </div>
                    <div className="social-post-card__actions">
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => applyTemplate(tpl)}>Use</button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => deleteTemplate(tpl.id)}>Delete</button>
                    </div>
                  </div>
                ))}
                {templates.length === 0 && (
                  <p className="social-help">Save winning captions per brand so the team reuses on-brand copy.</p>
                )}
              </div>
            </div>
          </div>

          <div className="social-panel social-preview">
            <div className="social-panel-head">
              <div>
                <span>Live preview</span>
                <strong style={{ color: formBrand?.color }}>{formBrand?.name || 'Brand post'}</strong>
              </div>
            </div>
            <div
              className={`social-preview-card social-preview-card--${form.provider === 'linkedin' ? 'linkedin' : 'meta'}`}
              style={{ borderTopColor: formBrand?.color || selectedProvider.tone }}
            >
              <div className="social-preview-top">
                <div className="social-preview-avatar" style={{ background: formBrand ? `${formBrand.color}22` : undefined, color: formBrand?.color }}>
                  {formBrand?.logo
                    ? <img src={formBrand.logo} alt="" />
                    : <SocialNetworkLogo network={selectedProvider.id === 'linkedin' ? 'linkedin' : 'facebook'} size={20} />}
                </div>
                <div className="social-preview-meta">
                  <span>{currentPage?.page_name || formBrand?.name || 'Choose a page'}</span>
                  <small>
                    {form.provider === 'linkedin' ? 'LinkedIn' : form.publish_targets.join(' + ') || 'Facebook'}
                    {' · '}
                    {form.scheduled_for ? 'Scheduled' : 'Preview'}
                  </small>
                </div>
              </div>
              <p>{form.caption || 'Your caption preview will appear here.'}</p>
              {mediaCount > 0 && (
                <div className={`social-preview-media ${mediaCount > 1 ? 'multi' : ''}`}>
                  {mediaItems.slice(0, 4).map((url, index) => (
                    isVideoMedia(url)
                      ? <video key={`${url}-${index}`} src={url} muted playsInline controls={mediaCount === 1}></video>
                      : <img key={`${url}-${index}`} src={url} alt={mediaUploadNames[index] || `Attached media ${index + 1}`} />
                  ))}
                  {mediaCount > 4 && <span>+{mediaCount - 4}</span>}
                </div>
              )}
              <div className="social-preview-actions"><span>Like</span><span>Comment</span><span>Share</span></div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'calendar' && (
        <div className="social-panel">
          <div className="social-panel-head social-panel-head--planner">
            <div>
              <span><i className="fa-solid fa-calendar-days"></i> Content calendar</span>
              <strong>{scopeBrand ? `${scopeBrand.name} queue` : 'All brands queue'}</strong>
              <p className="social-help">Drafts, scheduled, published, and failed posts — filter by platform and status.</p>
            </div>
            <div className="social-planner-actions">
              <button className="btn btn-ghost" type="button" onClick={loadAll} disabled={loading}>
                <i className="fa-solid fa-rotate"></i> Refresh
              </button>
              <button className={`btn ${clearPublishedArmed ? 'btn-danger' : 'btn-ghost'}`} type="button" onClick={clearPublishedPosts}>
                <i className="fa-solid fa-broom"></i> {clearPublishedArmed ? 'Confirm clear' : 'Clear published'}
              </button>
              <button className="btn btn-primary" type="button" onClick={() => setActiveTab('composer')}>
                <i className="fa-solid fa-plus"></i> New post
              </button>
            </div>
          </div>

          <div className="social-filter-row social-filter-row--cards">
            <label>
              <span>Platform</span>
              <select value={postFilter.provider} onChange={e => setPostFilter(prev => ({ ...prev, provider: e.target.value }))}>
                <option value="">All platforms</option>
                <option value="meta">Meta</option>
                <option value="linkedin">LinkedIn</option>
              </select>
            </label>
            <label>
              <span>Status</span>
              <select value={postFilter.status} onChange={e => setPostFilter(prev => ({ ...prev, status: e.target.value }))}>
                <option value="">All statuses</option>
                <option value="draft">Draft</option>
                <option value="pending_approval">Pending approval</option>
                <option value="scheduled">Scheduled</option>
                <option value="published">Published</option>
                <option value="failed">Failed</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
            <label>
              <span>Time period</span>
              <select value={postWindowDays} onChange={e => setPostWindowDays(e.target.value)}>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="all">All saved posts</option>
              </select>
            </label>
          </div>

          <div className="social-post-grid">
            {plannedPosts.map(post => {
              const provider = platformMeta(post.provider);
              const brand = brands.find(b => b.id === post.brand_id);
              const brandName = brand?.name || post.brand_id || 'Brand';
              const displayDate = post.scheduled_for || post.published_at || post.created_at;
              const postMedia = Array.isArray(post.media_urls) ? post.media_urls.filter(Boolean) : [];
              return (
                <article
                  className={`social-post-card ${statusClass(post.status)}`}
                  key={post.id}
                  style={{ ['--provider-tone' as string]: provider.tone, borderLeftColor: brand?.color || provider.tone }}
                >
                  <div className="social-post-card__top">
                    <span className="social-platform-chip">
                      <SocialNetworkLogo network={provider.network} size={16} />
                      {provider.label}
                    </span>
                    <em className={`social-status ${statusClass(post.status)}`}>{post.status}</em>
                  </div>
                  <div className="social-post-card__body">
                    <div className="social-post-card__avatar" style={{ background: brand ? `${brand.color}22` : undefined, color: brand?.color }}>
                      {brandName.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <strong>{brandName}</strong>
                      <span>{displayDate ? new Date(displayDate).toLocaleString() : 'No date set'}</span>
                    </div>
                  </div>
                  <p>{post.caption || 'Untitled post'}</p>
                  {postMedia.length > 0 && (
                    <div className={`social-post-card__media ${postMedia.length > 1 ? 'multi' : ''}`}>
                      {postMedia.slice(0, 3).map((url, index) => (
                        isVideoMedia(url)
                          ? <video key={`${post.id}-${url}-${index}`} src={url} muted playsInline></video>
                          : <img key={`${post.id}-${url}-${index}`} src={url} alt={`Post media ${index + 1}`} />
                      ))}
                      {postMedia.length > 3 && <span>+{postMedia.length - 3}</span>}
                    </div>
                  )}
                  {post.failure_reason && <small className="social-post-card__error">{post.failure_reason}</small>}
                  {post.rejection_reason && <small className="social-post-card__error">Rejected: {post.rejection_reason}</small>}
                  <div className="social-post-card__actions">
                    <button className="btn btn-ghost btn-sm" type="button" onClick={() => duplicatePost(post)}>
                      <i className="fa-regular fa-copy"></i> Duplicate
                    </button>
                    {post.status === 'pending_approval' && isAdmin && (
                      <>
                        <button className="btn btn-primary btn-sm" type="button" onClick={() => approvePost(post)}>
                          <i className="fas fa-check"></i> Approve
                        </button>
                        <button className="btn btn-ghost btn-sm" type="button" onClick={() => rejectPost(post)}>
                          Reject
                        </button>
                      </>
                    )}
                    {post.status === 'failed' && (
                      <button className="btn btn-primary btn-sm" type="button" onClick={() => retryPost(post)}>
                        <i className="fa-solid fa-rotate-right"></i> Retry
                      </button>
                    )}
                    {['draft', 'scheduled', 'failed', 'rejected', 'pending_approval'].includes(post.status) && (
                      <button className="btn btn-ghost btn-sm" type="button" onClick={() => cancelPost(post)}>
                        <i className="fa-solid fa-xmark"></i> Cancel
                      </button>
                    )}
                    {['published', 'cancelled'].includes(post.status) && (
                      <button className="btn btn-ghost btn-sm" type="button" onClick={() => removePost(post)}>
                        <i className="fa-regular fa-trash-can"></i> Remove
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
            {plannedPosts.length === 0 && (
              <div className="social-empty-state social-empty-state--wide">
                <i className="fas fa-calendar-days"></i>
                <strong>No posts in this view</strong>
                <p>
                  {scopeBrand
                    ? `Nothing for ${scopeBrand.name} yet — create a post or widen filters.`
                    : 'Connect accounts, map brands, then create or schedule content.'}
                </p>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setActiveTab('composer')}>
                  <i className="fas fa-plus"></i> Create post
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'ads' && (
        <div className="social-ads">
          <div className="social-panel">
            <div className="social-panel-head" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <MetaAdsLogo size={28} />
                <div>
                  <span>Ads & spend</span>
                  <strong>{scopeBrand ? `${scopeBrand.name} performance` : 'Portfolio performance'}</strong>
                </div>
              </div>
            </div>

            <div className="social-filter-row">
              <select value={adsRangeDays} onChange={e => setAdsRangeDays(e.target.value)} aria-label="Date range">
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
              </select>
              <select value={metricFilter.provider} onChange={e => setMetricFilter(prev => ({ ...prev, provider: e.target.value }))}>
                <option value="">All platforms</option>
                <option value="meta">Meta</option>
                <option value="linkedin">LinkedIn</option>
              </select>
              <select value={metricFilter.ad_account_id} onChange={e => setMetricFilter(prev => ({ ...prev, ad_account_id: e.target.value }))}>
                <option value="">All ad accounts</option>
                {(scopeBrandId ? brandAdAccounts : summary.ad_accounts).map(account => (
                  <option key={account.id || account.ad_account_id} value={account.ad_account_id}>{account.ad_account_name}</option>
                ))}
              </select>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={async () => {
                  if (metricFilter.provider === 'linkedin') await syncProvider('linkedin');
                  else await syncProvider('meta');
                  await loadAll();
                }}
              >
                <i className="fas fa-rotate"></i> Refresh insights
              </button>
            </div>

             {(() => {
               const metaConnection = summary.connections.find(c => c.provider === 'meta');
               const metaError = metaConnection?.last_error;
               if (!metaError || visibleMetrics.length > 0) return null;
               return (
                 <div className="social-warning" style={{ marginBottom: 12 }}>
                   <i className="fas fa-triangle-exclamation"></i>
                   <span>{metaError}</span>
                 </div>
               );
             })()}

             {adsAlerts.length > 0 && (
              <div className="social-alert-stack">
                {adsAlerts.map((a, i) => (
                  <div key={`${a.type}-${a.brand_id}-${i}`} className={`social-banner social-banner--${a.severity === 'critical' ? 'warn' : 'info'}`}>
                    <i className={`fas ${a.severity === 'critical' ? 'fa-triangle-exclamation' : 'fa-bell'}`}></i>
                    <div>
                      <strong>{brands.find(b => b.id === a.brand_id)?.name || a.brand_id}</strong>
                      <span>{a.message}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="social-budget-bar">
              <div>
                <span>Budget & CPL alerts</span>
                <strong>{scopeBrand ? scopeBrand.name : 'Select a brand chip to edit budget'}</strong>
              </div>
              <div className="social-budget-bar__fields">
                <label>
                  Monthly budget ($)
                  <input
                    type="number"
                    min={0}
                    value={budgetForm.monthly_budget}
                    disabled={!scopeBrandId}
                    onChange={e => setBudgetForm(prev => ({ ...prev, monthly_budget: e.target.value }))}
                  />
                </label>
                <label>
                  CPL alert above ($)
                  <input
                    type="number"
                    min={0}
                    value={budgetForm.cpl_alert_threshold}
                    disabled={!scopeBrandId}
                    onChange={e => setBudgetForm(prev => ({ ...prev, cpl_alert_threshold: e.target.value }))}
                  />
                </label>
                <button type="button" className="btn btn-primary btn-sm" disabled={!scopeBrandId} onClick={saveBudget}>
                  Save alerts
                </button>
              </div>
            </div>

            <div className="social-ads-scoreboard">
              <div className="social-ads-score">
                <small>Spend</small>
                <strong>{money(adsScoreboard.spend)}</strong>
              </div>
              <div className="social-ads-score">
                <small>Ad leads</small>
                <strong>{adsScoreboard.leads}</strong>
              </div>
              <div className="social-ads-score">
                <small>Ad CPL</small>
                <strong>{money(adsScoreboard.cpl)}</strong>
              </div>
              <div className="social-ads-score">
                <small>Impressions</small>
                <strong>{adsScoreboard.impressions.toLocaleString()}</strong>
              </div>
              <div className="social-ads-score">
                <small>Clicks</small>
                <strong>{adsScoreboard.clicks.toLocaleString()}</strong>
              </div>
              <div className="social-ads-score">
                <small>CTR</small>
                <strong>{adsScoreboard.ctr.toFixed(2)}%</strong>
              </div>
            </div>

            {attribution?.summary && (
              <div className="social-attribution-panel">
                <div className="social-panel-head">
                  <div>
                    <span>Ads vs CRM truth</span>
                    <strong>Last {adsRangeDays} days attribution</strong>
                  </div>
                </div>
                <div className="social-ads-scoreboard social-ads-scoreboard--attr">
                  <div className="social-ads-score">
                    <small>Ad platform leads</small>
                    <strong>{attribution.summary.ad_leads}</strong>
                  </div>
                  <div className="social-ads-score">
                    <small>CRM social leads</small>
                    <strong>{attribution.summary.crm_social_leads}</strong>
                  </div>
                  <div className="social-ads-score">
                    <small>CRM verified</small>
                    <strong>{attribution.summary.crm_verified_social_leads}</strong>
                  </div>
                  <div className="social-ads-score">
                    <small>Lead gap</small>
                    <strong>{attribution.summary.lead_gap > 0 ? `+${attribution.summary.lead_gap}` : attribution.summary.lead_gap}</strong>
                  </div>
                  <div className="social-ads-score">
                    <small>CRM CPL</small>
                    <strong>{money(attribution.summary.crm_cpl)}</strong>
                  </div>
                  <div className="social-ads-score">
                    <small>Ad spend</small>
                    <strong>{money(attribution.summary.ad_spend)}</strong>
                  </div>
                </div>
                <p className="social-help">{attribution.summary.note}</p>
              </div>
            )}

            {!scopeBrandId && brandAdsRows.length > 0 && (
              <div className="social-brand-score-table">
                <div className="social-brand-score-table__head">
                  <span>Brand</span>
                  <span>Spend</span>
                  <span>Leads</span>
                  <span>CPL</span>
                </div>
                {brandAdsRows.map(row => {
                  const brand = brands.find(b => b.id === row.brandId);
                  const label = brand?.name || (row.brandId === '_unmapped' ? 'Unmapped accounts' : row.brandId);
                  const cpl = row.leads > 0 ? row.spend / row.leads : 0;
                  return (
                    <button
                      key={row.brandId}
                      type="button"
                      className="social-brand-score-table__row"
                      onClick={() => row.brandId !== '_unmapped' && setScopeBrandId(row.brandId)}
                    >
                      <strong style={{ color: brand?.color }}>{label}</strong>
                      <span>{money(row.spend)}</span>
                      <span>{row.leads}</span>
                      <span>{money(cpl)}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="social-insights-table">
              <div className="social-insights-head">
                <span>Campaign</span>
                <span>Spend</span>
                <span>Impressions</span>
                <span>Clicks</span>
                <span>CTR</span>
                <span>CPL</span>
                <span>Leads</span>
              </div>
              {visibleMetrics.map(row => (
                <div key={row.id}>
                  <strong>
                    {row.campaign_name}
                    <small>{row.provider} · {row.date}{row.brand_id ? ` · ${brands.find(b => b.id === row.brand_id)?.name || row.brand_id}` : ''}</small>
                  </strong>
                  <span>{money(row.spend)}</span>
                  <span>{row.impressions}</span>
                  <span>{row.clicks}</span>
                  <span>{Number(row.ctr || 0).toFixed(2)}%</span>
                  <span>{money(row.cost_per_lead || 0)}</span>
                  <span>{row.leads}</span>
                </div>
              ))}
              {visibleMetrics.length === 0 && (
                <div className="social-empty-state social-empty-state--wide social-ads-empty">
                  <span className="social-ads-empty__icon"><MetaAdsLogo size={28} /></span>
                  <div className="social-ads-empty__copy">
                    <strong>No ad metrics yet</strong>
                    <p>
                      Map an ad account to a brand, then sync insights.
                      {scopeBrand ? ` Scoped to ${scopeBrand.name}.` : ''}
                    </p>
                  </div>
                  <div className="social-ads-empty__actions">
                    {isAdmin && <button type="button" className="btn btn-primary btn-sm" onClick={() => setActiveTab('accounts')}><i className="fas fa-link"></i> Map accounts</button>}
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => syncProvider('meta')} aria-label="Refresh Meta insights"><i className="fas fa-rotate"></i> Sync</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
