/**
 * useBrandNormalization.ts
 *
 * Pure helper functions for normalizing Optimaviz and IDAO segment/stage values.
 * Extracted from AppCore.tsx to keep the coordination layer lean.
 * Import individual functions as needed — no React hook wrapping required.
 */

import type { Lead } from '../types';
import {
  OPTIMAVIZ_SEGMENT_STAGES,
  OPTIMAVIZ_FOLLOW_UP_RULES,
  OPTIMAVIZ_NEXT_ACTIONS,
  OPTIMAVIZ_TRIAL_DAYS,
  IDAO_SEGMENT_STAGES,
  IDAO_FOLLOW_UP_RULES,
  IDAO_NEXT_ACTIONS,
  IDAO_SERVICE_TYPES,
  BRAND_SEGMENTS,
} from '../config/crmConfig';

// ─── Optimaviz Segment Normalization ─────────────────────────────────────────

export const normalizeOptimavizSegmentValue = (value?: any): string => {
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
    annual_training: 'training_leads',
  };
  return map[normalized] || (OPTIMAVIZ_SEGMENT_STAGES[normalized] ? normalized : raw);
};

export const getOptimavizSegmentConfig = (segmentValue?: any) => {
  const normalized = normalizeOptimavizSegmentValue(segmentValue) || 'demo_leads';
  return (BRAND_SEGMENTS.optimaviz || []).find(s => s.value === normalized) || (BRAND_SEGMENTS.optimaviz || [])[0];
};

export const inferOptimavizSegmentFromStage = (stage?: string): string => {
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
    'quote sent': 'training_leads',
  };
  return stageMap[normalizedStage] || 'demo_leads';
};

export const normalizeOptimavizStageValue = (stage?: string, segmentValue?: any): string => {
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
    post_training_follow_up: 'Post-Training Follow-Up',
  };
  const mapped = stageMap[normalized] || raw;
  return stages.find(s => String(s || '').toLowerCase() === mapped.toLowerCase()) || stages[0] || mapped;
};

export const getOptimavizLeadSegment = (lead: Lead): string =>
  normalizeOptimavizSegmentValue(lead.custom_fields?.segment || inferOptimavizSegmentFromStage(lead.funnel_stage));

export const getOptimavizLeadStage = (lead: Lead): string =>
  normalizeOptimavizStageValue(lead.funnel_stage, getOptimavizLeadSegment(lead));

export const getOptimavizStageOptionsForSegment = (segmentValue?: any): string[] =>
  OPTIMAVIZ_SEGMENT_STAGES[normalizeOptimavizSegmentValue(segmentValue) || 'demo_leads'] || OPTIMAVIZ_SEGMENT_STAGES.demo_leads;

export const getOptimavizDefaultNextAction = (segmentValue?: any, stage?: string): string => {
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
    'Attended': 'Post-Training Follow-Up',
  };
  return actionsByStage[normalizedStage] || (OPTIMAVIZ_NEXT_ACTIONS[segment] || [])[0] || 'Follow Up';
};

export const getOptimavizFollowUpDateForStage = (segmentValue?: any, stage?: string): string => {
  const segment = normalizeOptimavizSegmentValue(segmentValue) || 'demo_leads';
  const normalizedStage = normalizeOptimavizStageValue(stage, segment);
  const rule = (OPTIMAVIZ_FOLLOW_UP_RULES[segment] || []).find(r => r.stage === normalizedStage);
  if (!rule) return '';
  const date = new Date();
  date.setDate(date.getDate() + rule.days);
  return date.toISOString().split('T')[0];
};

export const getOptimavizTrialInfo = (lead: Lead) => {
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

export const isOptimavizSubscriber = (lead: Lead): boolean =>
  getOptimavizLeadSegment(lead) === 'subscribed_platform_users' || !!lead.custom_fields?.subscription_plan;

export const isOptimavizDemoAttended = (lead: Lead): boolean =>
  getOptimavizLeadSegment(lead) === 'demo_leads' && getOptimavizLeadStage(lead) === 'Demo Attended';

// ─── IDAO Segment Normalization ───────────────────────────────────────────────

export const normalizeIdaoSegmentValue = (value?: any): string => {
  const raw = String(value || '').trim();
  const normalized = raw.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const map: Record<string, string> = {
    training: 'training_leads', training_lead: 'training_leads', training_leads: 'training_leads',
    three_day_training: 'training_leads', day_training: 'training_leads', day_3_training: 'training_leads',
    annual_training: 'training_leads', early_bird: 'training_leads', training_participant: 'training_leads',
    optimaviz: 'optimaviz_referrals', optimaviz_referral: 'optimaviz_referrals', optimaviz_referrals: 'optimaviz_referrals',
    optimaviz_demo: 'optimaviz_referrals', demo_referral: 'optimaviz_referrals', platform_referral: 'optimaviz_referrals',
    trial_interest: 'optimaviz_referrals',
    other: 'other_services', other_services: 'other_services', corporate_training: 'other_services',
    flotation: 'other_services', flotation_optimisation: 'other_services', flotation_optimization: 'other_services',
    consulting: 'other_services', advisory: 'other_services',
  };
  return map[normalized] || (IDAO_SEGMENT_STAGES[normalized] ? normalized : raw);
};

export const inferIdaoSegmentFromStage = (stage?: string): string => {
  const normalizedStage = String(stage || '').trim().toLowerCase();
  for (const [segment, stages] of Object.entries(IDAO_SEGMENT_STAGES)) {
    if (stages.some(s => String(s || '').toLowerCase() === normalizedStage)) return segment;
  }
  const stageMap: Record<string, string> = {
    'early bird': 'training_leads', 'quote sent': 'training_leads', 'email sent': 'training_leads',
    'training participant': 'training_leads', 'registration confirmed': 'training_leads', 'paid': 'training_leads',
    'demo requested': 'optimaviz_referrals', 'optimaviz referral': 'optimaviz_referrals',
    'referred to optimaviz': 'optimaviz_referrals', 'passed to optimaviz': 'optimaviz_referrals',
    'corporate training': 'other_services', 'flotation': 'other_services',
    'flotation optimisation': 'other_services', 'flotation optimization': 'other_services',
  };
  return stageMap[normalizedStage] || 'training_leads';
};

export const normalizeIdaoStageValue = (stage?: string, segmentValue?: any): string => {
  const segment = normalizeIdaoSegmentValue(segmentValue) || inferIdaoSegmentFromStage(stage);
  const stages = IDAO_SEGMENT_STAGES[segment] || IDAO_SEGMENT_STAGES.training_leads;
  const raw = String(stage || '').trim();
  const normalized = raw.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const stageMap: Record<string, string> = {
    enquiry: 'Training Enquiry', inquiry: 'Training Enquiry', training_enquiry: 'Training Enquiry', early_bird: 'Quote Sent',
    email: 'Email Sent', email_sent: 'Email Sent', quote_request: 'Quote Requested', quote_requested: 'Quote Requested',
    quote: 'Quote Sent', quote_sent: 'Quote Sent',
    follow_up: 'Follow-Up Due', follow_up_due: 'Follow-Up Due', called: 'Call Follow-Up', call: 'Call Follow-Up', call_follow_up: 'Call Follow-Up',
    paid: 'Registered', registration_confirmed: 'Registered', registered: 'Registered', confirmed: 'Registered',
    attended: 'Attended', post_training: 'Post-Training Follow-Up', post_training_follow_up: 'Post-Training Follow-Up',
    interested: 'Interested in Optimaviz', interested_in_optimaviz: 'Interested in Optimaviz',
    demo_request: 'Demo Requested', demo_requested: 'Demo Requested', optimaviz_demo_requested: 'Demo Requested',
    scheduled: 'Demo Scheduled', demo_scheduled: 'Demo Scheduled', demo_attended: 'Demo Attended',
    no_show: 'No Show / Did Not Attend', missed_demo: 'No Show / Did Not Attend', did_not_attend: 'No Show / Did Not Attend',
    passed: 'Passed to Optimaviz', referred_to_optimaviz: 'Passed to Optimaviz', passed_to_optimaviz: 'Passed to Optimaviz',
    trial: 'Trial Started', trial_started: 'Trial Started',
    closed: 'Closed / Not Interested', not_interested: 'Closed / Not Interested',
    service_enquiry: 'Service Enquiry', needs_discussion: 'Needs Discussion', discussion: 'Needs Discussion',
    won: 'Won', lost: 'Lost / Not Interested', lost_not_interested: 'Lost / Not Interested',
  };
  const mapped = stageMap[normalized] || raw;
  return stages.find(s => String(s || '').toLowerCase() === mapped.toLowerCase()) || stages[0] || mapped;
};

export const getIdaoLeadSegment = (lead: Lead): string =>
  normalizeIdaoSegmentValue(
    lead.custom_fields?.segment || lead.custom_fields?.service_type || lead.custom_fields?.service_focus || inferIdaoSegmentFromStage(lead.funnel_stage)
  );

export const getIdaoLeadStage = (lead: Lead): string =>
  normalizeIdaoStageValue(lead.funnel_stage, getIdaoLeadSegment(lead));

export const getIdaoStageOptionsForSegment = (segmentValue?: any): string[] =>
  IDAO_SEGMENT_STAGES[normalizeIdaoSegmentValue(segmentValue) || 'training_leads'] || IDAO_SEGMENT_STAGES.training_leads;

export const getIdaoDefaultNextAction = (segmentValue?: any, stage?: string): string => {
  const segment = normalizeIdaoSegmentValue(segmentValue) || 'training_leads';
  const normalizedStage = normalizeIdaoStageValue(stage, segment);
  const actionsByStage: Record<string, string> = {
    'Training Enquiry': 'Send Intro Email', 'Email Sent': 'Follow Up Quote', 'Quote Requested': 'Send Quote',
    'Quote Sent': 'Follow Up Quote', 'Follow-Up Due': 'Call Lead', 'Call Follow-Up': 'Call Lead',
    'Registered': 'Send Training Reminder', 'Attended': 'Post-Training Follow-Up',
    'Interested in Optimaviz': 'Qualify Interest', 'Demo Requested': 'Book Demo',
    'Demo Scheduled': 'Send Demo Reminder', 'Demo Attended': 'Pass to Optimaviz',
    'No Show / Did Not Attend': 'Rebook Demo', 'Passed to Optimaviz': 'Follow Up After Demo',
    'Trial Started': 'Mark Trial Started',
    'Service Enquiry': 'Send Intro Email', 'Needs Discussion': 'Book Discovery Call',
    'Won': 'Mark Won', 'Lost / Not Interested': 'Mark Lost',
  };
  return actionsByStage[normalizedStage] || (IDAO_NEXT_ACTIONS[segment] || [])[0] || 'Follow Up';
};

export const getIdaoFollowUpDateForStage = (segmentValue?: any, stage?: string): string => {
  const segment = normalizeIdaoSegmentValue(segmentValue) || 'training_leads';
  const normalizedStage = normalizeIdaoStageValue(stage, segment);
  const rule = (IDAO_FOLLOW_UP_RULES[segment] || []).find(r => r.stage === normalizedStage);
  if (!rule) return '';
  const date = new Date();
  date.setDate(date.getDate() + rule.days);
  return date.toISOString().split('T')[0];
};

export const getIdaoServiceTypeForSegment = (segment: string): string =>
  (IDAO_SERVICE_TYPES[segment] || [])[0] || '';

// ─── Lead normalization for display ──────────────────────────────────────────

export const normalizeOptimavizLeadsForDisplay = (items: Lead[]): Lead[] =>
  items.map(lead => {
    if (lead.brand_id !== 'optimaviz') return lead;
    const segment = getOptimavizLeadSegment(lead);
    const stage = normalizeOptimavizStageValue(lead.funnel_stage, segment);
    const custom_fields = {
      ...(lead.custom_fields || {}),
      segment,
      next_action: lead.custom_fields?.next_action || getOptimavizDefaultNextAction(segment, stage),
    };
    const follow_up_date = lead.follow_up_date || getOptimavizFollowUpDateForStage(segment, stage) || lead.follow_up_date;
    return { ...lead, funnel_stage: stage, follow_up_date, custom_fields };
  });

export const normalizeIdaoLeadsForDisplay = (items: Lead[]): Lead[] =>
  items.map(lead => {
    if (lead.brand_id !== 'idao') return lead;
    const segment = getIdaoLeadSegment(lead);
    const stage = normalizeIdaoStageValue(lead.funnel_stage, segment);
    const serviceType = lead.custom_fields?.service_type || lead.custom_fields?.service_focus || getIdaoServiceTypeForSegment(segment);
    const custom_fields = {
      ...(lead.custom_fields || {}),
      segment,
      service_type: serviceType,
      service_focus: serviceType,
      next_action: lead.custom_fields?.next_action || getIdaoDefaultNextAction(segment, stage),
    };
    const follow_up_date = lead.follow_up_date || getIdaoFollowUpDateForStage(segment, stage) || lead.follow_up_date;
    return { ...lead, funnel_stage: stage, follow_up_date, custom_fields };
  });

export const normalizeBrandLeadsForDisplay = (items: Lead[]): Lead[] =>
  normalizeIdaoLeadsForDisplay(normalizeOptimavizLeadsForDisplay(items));
