import React, { useEffect, useState } from 'react';
import {
  BrandLeadBadgeSettings,
  LeadBadgeMatchMode,
  LeadBadgePlacement,
  LeadBadgeRule,
  LeadBadgeTone,
  createEmptyBadgeRule,
  getDefaultLeadBadgeRules,
  normalizeLeadBadgeSettings,
  newBadgeId,
  saveLeadBadgeSettings,
  toneStyles,
} from '../utils/leadBadges';

type Props = {
  brandId: string;
  brandName: string;
  brandColor: string;
  customFieldNames: string[];
  initialSettings: BrandLeadBadgeSettings;
  onClose: () => void;
  onSave: (settings: BrandLeadBadgeSettings) => void;
};

const PLACEMENTS: { value: LeadBadgePlacement; label: string }[] = [
  { value: 'after_name', label: 'Next to lead name' },
  { value: 'detail_only', label: 'Lead detail only' },
  { value: 'hidden', label: 'Hidden' },
];

const TONES: LeadBadgeTone[] = ['success', 'danger', 'warning', 'info', 'neutral'];

const MATCH_MODES: { value: LeadBadgeMatchMode; label: string; help: string }[] = [
  {
    value: 'field_equals',
    label: 'Field equals value(s)',
    help: 'Show when the field exactly matches any listed value (e.g. Business, Female, Male).',
  },
  {
    value: 'field_contains',
    label: 'Field contains text',
    help: 'Show when the field contains any listed text (e.g. “trial” → Started free trial).',
  },
  {
    value: 'field_has_multiple',
    label: 'Field has multiple values',
    help: 'Show when one lead has multiple values in a field (e.g. services: Cleaning, Plumbing). Use after merging multi-service data onto one row.',
  },
  {
    value: 'field_not_empty',
    label: 'Field is not empty',
    help: 'Show whenever this field has any value.',
  },
];

const BUILTIN_FIELDS = ['funnel_stage', 'name', 'email', 'phone'];

export default function LeadBadgesSettingsModal({
  brandId,
  brandName,
  brandColor,
  customFieldNames,
  initialSettings,
  onClose,
  onSave,
}: Props) {
  const [settings, setSettings] = useState<BrandLeadBadgeSettings>(() =>
    normalizeLeadBadgeSettings(brandId, initialSettings),
  );
  const [activeId, setActiveId] = useState(settings.rules[0]?.id || '');

  useEffect(() => {
    const next = normalizeLeadBadgeSettings(brandId, initialSettings);
    setSettings(next);
    setActiveId(next.rules[0]?.id || '');
  }, [brandId, initialSettings]);

  const active = settings.rules.find(r => r.id === activeId) || settings.rules[0];
  const fieldOptions = Array.from(new Set([...BUILTIN_FIELDS, ...customFieldNames].filter(Boolean))).sort();

  const updateRule = (id: string, patch: Partial<LeadBadgeRule>) => {
    setSettings(prev => ({
      ...prev,
      rules: prev.rules.map(r => (r.id === id ? { ...r, ...patch } : r)),
    }));
  };

  const addTag = () => {
    const rule = createEmptyBadgeRule({
      id: newBadgeId(),
      label: 'New tag',
      detailTitle: 'New tag',
      fieldName: customFieldNames[0] || 'lead_type',
      matchMode: 'field_equals',
      matchValues: [],
    });
    setSettings(prev => ({ ...prev, rules: [...prev.rules, rule] }));
    setActiveId(rule.id);
  };

  const deleteTag = (id: string) => {
    setSettings(prev => {
      const rules = prev.rules.filter(r => r.id !== id);
      return { ...prev, rules };
    });
    setActiveId(prev => {
      if (prev !== id) return prev;
      const remaining = settings.rules.filter(r => r.id !== id);
      return remaining[0]?.id || '';
    });
  };

  const resetDefaults = () => {
    const next = normalizeLeadBadgeSettings(brandId, {
      version: 2,
      rules: getDefaultLeadBadgeRules(brandId),
    });
    setSettings(next);
    setActiveId(next.rules[0]?.id || '');
  };

  const handleSave = () => {
    const normalized = normalizeLeadBadgeSettings(brandId, settings);
    saveLeadBadgeSettings(brandId, normalized);
    onSave(normalized);
    onClose();
  };

  const previewTone = active ? toneStyles(active.tone) : toneStyles('neutral');

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '760px', width: 'min(96vw, 760px)', maxHeight: '90vh', overflow: 'hidden' }}>
        <div className="modal-header">
          <h3>
            <i className="fas fa-tags" style={{ color: brandColor, marginRight: 8 }}></i>
            Lead tags · {brandName}
          </h3>
          <button className="modal-close" aria-label="Close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 220px) 1fr', gap: 16, minHeight: 0, maxHeight: 'min(70vh, 560px)' }}>
          <div style={{ borderRight: '1px solid var(--border)', paddingRight: 12, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 8px', lineHeight: 1.45 }}>
              Create any tags you need for this brand — Business, Female, free trial, multi-service, and more.
              Nothing is locked to TaskGo or multi-opportunity.
            </p>
            {settings.rules.map(rule => (
              <button
                key={rule.id}
                type="button"
                onClick={() => setActiveId(rule.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px',
                  borderRadius: 10,
                  border: activeId === rule.id ? `1.5px solid ${brandColor}` : '1px solid var(--border)',
                  background: activeId === rule.id ? `color-mix(in srgb, ${brandColor} 10%, var(--bg-card))` : 'var(--bg-base)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>{rule.label || 'Untitled'}</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>
                  {rule.enabled ? 'On' : 'Off'} · {rule.fieldName || 'no field'} · {rule.matchMode.replace(/_/g, ' ')}
                </div>
              </button>
            ))}
            {settings.rules.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: 8 }}>No tags yet. Add one for this brand.</div>
            )}
            <button type="button" className="btn btn-ghost btn-sm" onClick={addTag} style={{ marginTop: 8, justifyContent: 'center' }}>
              <i className="fas fa-plus"></i> Add tag
            </button>
          </div>

          <div style={{ overflowY: 'auto', minHeight: 0, paddingRight: 4 }}>
            {!active ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: 20, textAlign: 'center' }}>
                Add a tag to get started for {brandName}.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700 }}>
                    <input
                      type="checkbox"
                      checked={active.enabled}
                      onChange={e => updateRule(active.id, { enabled: e.target.checked })}
                    />
                    Show this tag when it matches
                  </label>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      background: previewTone.bg,
                      border: `1px solid ${previewTone.border}`,
                      color: previewTone.color,
                      padding: '3px 8px',
                      borderRadius: 6,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <i className={`fas ${active.icon || 'fa-tag'}`} style={{ fontSize: 9 }}></i>
                    {active.label || 'Tag'}
                  </span>
                </div>

                <label style={labelStyle}>
                  TAG LABEL (what appears on the lead)
                  <input
                    value={active.label}
                    onChange={e => updateRule(active.id, { label: e.target.value, detailTitle: active.detailTitle === active.label ? e.target.value : active.detailTitle })}
                    style={inputStyle}
                    placeholder="e.g. Business, Female, Started free trial, Offers multiple services"
                  />
                </label>

                <label style={labelStyle}>
                  WHEN TO SHOW
                  <select
                    value={active.matchMode}
                    onChange={e => updateRule(active.id, { matchMode: e.target.value as LeadBadgeMatchMode })}
                    style={inputStyle}
                  >
                    {MATCH_MODES.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  <span style={helpStyle}>{MATCH_MODES.find(m => m.value === active.matchMode)?.help}</span>
                </label>

                <label style={labelStyle}>
                  FIELD TO CHECK
                  <select
                    value={active.fieldName}
                    onChange={e => updateRule(active.id, { fieldName: e.target.value })}
                    style={inputStyle}
                  >
                    <option value="">Select a field…</option>
                    {fieldOptions.map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                  {!customFieldNames.length && (
                    <span style={helpStyle}>Tip: add brand columns first (Manage Columns), then map imports into them.</span>
                  )}
                </label>

                {(active.matchMode === 'field_equals' || active.matchMode === 'field_contains') && (
                  <label style={labelStyle}>
                    MATCH VALUES (comma-separated)
                    <input
                      value={(active.matchValues || []).join(', ')}
                      onChange={e =>
                        updateRule(active.id, {
                          matchValues: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                        })
                      }
                      style={inputStyle}
                      placeholder={
                        active.matchMode === 'field_contains'
                          ? 'e.g. trial, free trial'
                          : 'e.g. Business — or Female, Male — only the values you want'
                      }
                    />
                    <span style={helpStyle}>
                      Only these values trigger the tag. You can create separate tags for Business and Individual (or only Business).
                    </span>
                  </label>
                )}

                {active.matchMode === 'field_has_multiple' && (
                  <label style={labelStyle}>
                    MINIMUM DISTINCT VALUES
                    <input
                      type="number"
                      min={2}
                      value={active.minCount || 2}
                      onChange={e => updateRule(active.id, { minCount: Math.max(2, Number(e.target.value) || 2) })}
                      style={inputStyle}
                    />
                    <span style={helpStyle}>
                      For merged multi-service leads: put services in one field like <code>Cleaning, Plumbing, Electrical</code>.
                      When count ≥ this number, the tag shows. No separate rows required.
                    </span>
                  </label>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label style={labelStyle}>
                    WHERE
                    <select
                      value={active.placement}
                      onChange={e => updateRule(active.id, { placement: e.target.value as LeadBadgePlacement })}
                      style={inputStyle}
                    >
                      {PLACEMENTS.map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </label>
                  <label style={labelStyle}>
                    COLOUR
                    <select
                      value={active.tone}
                      onChange={e => updateRule(active.id, { tone: e.target.value as LeadBadgeTone })}
                      style={inputStyle}
                    >
                      {TONES.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <label style={labelStyle}>
                  ICON (Font Awesome class)
                  <input
                    value={active.icon}
                    onChange={e => updateRule(active.id, { icon: e.target.value })}
                    style={inputStyle}
                    placeholder="fa-tag, fa-building, fa-venus, fa-mars…"
                  />
                </label>

                <label style={labelStyle}>
                  DETAIL TITLE (optional)
                  <input
                    value={active.detailTitle}
                    onChange={e => updateRule(active.id, { detailTitle: e.target.value })}
                    style={inputStyle}
                  />
                </label>

                <label style={labelStyle}>
                  DETAIL HELP TEXT (optional)
                  <textarea
                    value={active.detailBody}
                    onChange={e => updateRule(active.id, { detailBody: e.target.value })}
                    rows={2}
                    style={{ ...inputStyle, height: 'auto', padding: '8px 10px', resize: 'vertical' }}
                  />
                </label>

                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => deleteTag(active.id)}
                  style={{ color: '#b91c1c', justifySelf: 'start' }}
                >
                  <i className="fas fa-trash"></i> Delete this tag
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-ghost" onClick={resetDefaults}>
            <i className="fas fa-rotate-left"></i> Load starter tags for this brand
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="button" className="btn btn-primary" style={{ background: brandColor }} onClick={handleSave}>
              Save tags
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'grid',
  gap: 4,
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-muted)',
};

const helpStyle: React.CSSProperties = {
  fontWeight: 500,
  fontSize: 10.5,
  color: 'var(--text-muted)',
  lineHeight: 1.4,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 36,
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '0 10px',
  fontSize: 12,
  fontWeight: 700,
  background: 'var(--bg-base)',
  color: 'var(--text-primary)',
  boxSizing: 'border-box',
};
