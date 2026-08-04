import React from 'react';
import type { Lead } from '../types';
import type { ResolvedLeadBadge } from '../utils/leadBadges';
import { audienceMatchLabel, audienceMatchStyles, type AudienceMatchLevel } from '../utils/audienceMatch';
import LeadBadgePills from './LeadBadgePills';
import {
  buildLeadTableColumns,
  cellTitleText,
  getColumnFullLabel,
  getColumnShortLabel,
  getColumnSizeStyle,
  LEAD_TABLE_ACTIONS_WIDTH,
  LEAD_TABLE_CHECKBOX_WIDTH,
  type LeadTableColumnDef,
} from '../utils/brandColumns';

export type { LeadTableColumnDef };
export { buildLeadTableColumns, cellTitleText };

export type LeadTableCustomField = {
  id: string;
  field_name: string;
  field_type?: string;
};

export type LeadTableEditingCell = {
  leadId: string;
  field: string;
} | null;

export type LeadTableTrialInfo = {
  isTrialLead: boolean;
  status: string;
  color: string;
  daysRemaining: number;
};

export type LeadTableSegmentOption = {
  value: string;
  label: string;
};

/** Header cell props: short label + full title tooltip + fixed width. */
export function leadHeaderProps(
  columnKey: string,
  extraStyle?: React.CSSProperties,
): { title: string; style: React.CSSProperties } {
  return {
    title: getColumnFullLabel(columnKey),
    style: {
      ...getColumnSizeStyle(columnKey),
      cursor: 'pointer',
      ...extraStyle,
    },
  };
}

/** Body cell width style (height/truncation live in `.lead-data-table` CSS). */
export function leadColStyle(
  columnKey: string,
  extraStyle?: React.CSSProperties,
): React.CSSProperties {
  return {
    ...getColumnSizeStyle(columnKey),
    ...extraStyle,
  };
}

/** Ellipsis text with full value on hover. */
export function CellClip({
  value,
  children,
  className = 'cell-clip',
  style,
}: {
  value?: unknown;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const title = cellTitleText(value);
  return (
    <span className={className} title={title} style={style}>
      {children ?? (title || '—')}
    </span>
  );
}

function EditPencil() {
  return <i className="fas fa-pencil-alt cell-hover-edit" style={{ fontSize: '10px', color: 'var(--text-muted)' }} />;
}

function editControlStyle(brandColor: string, extra?: React.CSSProperties): React.CSSProperties {
  return {
    padding: '2px 6px',
    border: `1px solid ${brandColor}`,
    borderRadius: '4px',
    fontSize: '12px',
    background: 'var(--bg-card)',
    color: 'var(--text-primary)',
    width: '100%',
    outline: 'none',
    ...extra,
  };
}

function ActionIconButton({
  title,
  onClick,
  border,
  background,
  color,
  hoverBackground,
  hoverColor,
  iconClass,
}: {
  title: string;
  onClick: (e: React.MouseEvent) => void;
  border: string;
  background: string;
  color: string;
  hoverBackground: string;
  hoverColor: string;
  iconClass: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        width: '30px',
        height: '30px',
        borderRadius: '8px',
        border,
        background,
        color,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '11px',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = hoverBackground;
        e.currentTarget.style.color = hoverColor;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = background;
        e.currentTarget.style.color = color;
      }}
    >
      <i className={iconClass} />
    </button>
  );
}

export function LeadTableColGroup({ columns }: { columns: LeadTableColumnDef[] }) {
  return (
    <colgroup>
      <col
        className="lead-col-select"
        style={{ width: LEAD_TABLE_CHECKBOX_WIDTH, minWidth: LEAD_TABLE_CHECKBOX_WIDTH }}
      />
      {columns.map(col => (
        <col
          key={`col-${col.customFieldId || col.key}`}
          className={col.stickyName ? 'lead-col-name' : undefined}
          style={getColumnSizeStyle(col.key)}
        />
      ))}
      <col
        className="lead-col-actions"
        style={{ width: LEAD_TABLE_ACTIONS_WIDTH, minWidth: LEAD_TABLE_ACTIONS_WIDTH }}
      />
    </colgroup>
  );
}

type LeadTableHeaderProps = {
  columns: LeadTableColumnDef[];
  brandColor?: string;
  allSelected: boolean;
  onToggleSelectAll: (checked: boolean) => void;
  onSort: (sortKey: string) => void;
  onColumnReorder?: (draggedKey: string, targetKey: string) => void;
  renderSortIndicator: (sortKey: string) => React.ReactNode;
};

export function LeadTableHeader({
  columns,
  brandColor,
  allSelected,
  onToggleSelectAll,
  onSort,
  onColumnReorder,
  renderSortIndicator,
}: LeadTableHeaderProps) {
  return (
    <thead>
      <tr>
        <th
          className="lead-col-select"
          style={{
            width: LEAD_TABLE_CHECKBOX_WIDTH,
            minWidth: LEAD_TABLE_CHECKBOX_WIDTH,
            maxWidth: LEAD_TABLE_CHECKBOX_WIDTH,
            textAlign: 'center',
            background: 'var(--bg-thead)',
          }}
        >
          <input
            type="checkbox"
            checked={allSelected}
            onChange={e => onToggleSelectAll(e.target.checked)}
            style={{ cursor: 'pointer', scale: '1.2' }}
            aria-label="Select all leads on this page"
          />
        </th>
        {columns.map(col => {
          const sortable = Boolean(col.sortKey);
          const sticky = col.stickyName
            ? {
                position: 'sticky' as const,
                left: `${LEAD_TABLE_CHECKBOX_WIDTH}px`,
                zIndex: 15,
                background: 'var(--bg-thead)',
                boxShadow: '3px 0 8px -2px rgba(0,0,0,0.12)',
                borderRight: '1px solid var(--border)',
              }
            : undefined;
          const customBg =
            col.isCustom && brandColor
              ? { background: `oklch(from ${brandColor} l c h / 0.03)` }
              : undefined;

          return (
            <th
              key={`th-${col.customFieldId || col.key}`}
              className={col.stickyName ? 'lead-col-name' : undefined}
              draggable={!col.stickyName}
              onDragStart={event => {
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', col.key);
              }}
              onDragOver={event => {
                if (!col.stickyName) event.preventDefault();
              }}
              onDrop={event => {
                event.preventDefault();
                const draggedKey = event.dataTransfer.getData('text/plain');
                if (draggedKey && draggedKey !== col.key) onColumnReorder?.(draggedKey, col.key);
              }}
              onClick={sortable && col.sortKey ? () => onSort(col.sortKey!) : undefined}
              {...leadHeaderProps(col.key, {
                cursor: sortable ? 'pointer' : 'default',
                ...sticky,
                ...customBg,
              })}
            >
              {getColumnShortLabel(col.key)}
              {sortable && col.sortKey ? renderSortIndicator(col.sortKey) : null}
            </th>
          );
        })}
        <th
          className="lead-col-actions"
          title="Actions"
          style={{
            width: LEAD_TABLE_ACTIONS_WIDTH,
            minWidth: LEAD_TABLE_ACTIONS_WIDTH,
            maxWidth: LEAD_TABLE_ACTIONS_WIDTH,
          }}
        >
          Actions
        </th>
      </tr>
    </thead>
  );
}

type LeadTableBodyContext = {
  brand: { id: string; name: string; color: string };
  selectedLeadIds: Set<string>;
  activeLeadId?: string | null;
  hoveredLeadId?: string | null;
  editingCell: LeadTableEditingCell;
  editingCellValue: string;
  customFieldByName: Map<string, LeadTableCustomField>;
  segmentOptions: LeadTableSegmentOption[];
  trialDays: number;
  onToggleLeadSelect: (leadId: string) => void;
  onEditingCellValueChange: (value: string) => void;
  onStartEditingCell: (e: React.MouseEvent, leadId: string, field: string, currentValue: string) => void;
  onSaveEditingCell: (leadId: string, field: string) => void;
  onCellKeyDown: (e: React.KeyboardEvent, leadId: string, field: string) => void;
  getLeadStage: (lead: Lead) => string;
  getLeadSegment: (lead: Lead) => string;
  getStageOptionsForLead: (lead: Lead) => string[];
  getStageColor: (stage?: string) => string;
  renderSegmentPill: (segment: string | undefined, lead: Lead) => React.ReactNode;
  getLeadBadges: (lead: Lead) => ResolvedLeadBadge[];
  getAudienceMatch?: (lead: Lead) => { level: AudienceMatchLevel; matchedTerms: string[] };
  getTrialInfo?: (lead: Lead) => LeadTableTrialInfo;
  getLeadDateLabel: (lead: Lead) => string;
  normalizeFieldValue: (val: unknown) => string;
  onOpenLead: (lead: Lead) => void;
  onEmailLead: (lead: Lead) => void;
  onWhatsAppLead: (lead: Lead) => void;
  onCallLead: (lead: Lead) => void;
};

function rowBg(
  leadId: string,
  brandColor: string,
  activeLeadId?: string | null,
  hoveredLeadId?: string | null,
  stickyCard = false,
): string {
  if (activeLeadId === leadId) return `oklch(from ${brandColor} l c h / 0.10)`;
  if (hoveredLeadId === leadId) return 'var(--row-hover-bg)';
  return stickyCard ? 'var(--bg-card)' : 'transparent';
}

function isEditing(ctx: LeadTableBodyContext, leadId: string, field: string) {
  return ctx.editingCell?.leadId === leadId && ctx.editingCell?.field === field;
}

function TextInput({
  ctx,
  leadId,
  field,
  type = 'text',
  bold = false,
}: {
  ctx: LeadTableBodyContext;
  leadId: string;
  field: string;
  type?: string;
  bold?: boolean;
}) {
  return (
    <input
      autoFocus
      type={type}
      value={ctx.editingCellValue}
      onClick={e => e.stopPropagation()}
      onChange={e => ctx.onEditingCellValueChange(e.target.value)}
      onBlur={() => ctx.onSaveEditingCell(leadId, field)}
      onKeyDown={e => ctx.onCellKeyDown(e, leadId, field)}
      style={editControlStyle(ctx.brand.color, bold ? { fontWeight: '600' } : undefined)}
    />
  );
}

function TextSelect({
  ctx,
  leadId,
  field,
  children,
}: {
  ctx: LeadTableBodyContext;
  leadId: string;
  field: string;
  children: React.ReactNode;
}) {
  return (
    <select
      autoFocus
      value={ctx.editingCellValue}
      onClick={e => e.stopPropagation()}
      onChange={e => ctx.onEditingCellValueChange(e.target.value)}
      onBlur={() => ctx.onSaveEditingCell(leadId, field)}
      onKeyDown={e => ctx.onCellKeyDown(e, leadId, field)}
      style={editControlStyle(ctx.brand.color)}
    >
      {children}
    </select>
  );
}

function renderBooleanPill(fieldName: string, value: string) {
  const boolVal = value === 'true' || value === 'TRUE' || value === '1';
  const isQuote = String(fieldName || '')
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
    .includes('quote');
  return (
    <span
      style={{
        fontSize: '11px',
        fontWeight: '700',
        padding: '2px 8px',
        borderRadius: '20px',
        background: boolVal ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
        color: boolVal ? '#059669' : '#dc2626',
        border: `1px solid ${boolVal ? '#6ee7b7' : '#fca5a5'}`,
        whiteSpace: 'nowrap',
      }}
    >
      <i className={`fas ${boolVal ? 'fa-check' : 'fa-times'}`} style={{ marginRight: '4px' }} />
      {isQuote ? (boolVal ? 'Sent' : 'Not Sent') : boolVal ? 'Yes' : 'No'}
    </span>
  );
}

function renderDataCell(col: LeadTableColumnDef, lead: Lead, ctx: LeadTableBodyContext): React.ReactNode {
  const { brand } = ctx;
  const stickyBg = rowBg(lead.id, brand.color, ctx.activeLeadId, ctx.hoveredLeadId, true);

  switch (col.key) {
    case 'name': {
      const field = 'name';
      return (
        <td
          key={col.key}
          className="cell-hover-parent lead-col-name"
          onClick={e => ctx.onStartEditingCell(e, lead.id, field, lead.name)}
          style={leadColStyle('name', {
            fontWeight: '600',
            position: 'sticky',
            left: `${LEAD_TABLE_CHECKBOX_WIDTH}px`,
            zIndex: 13,
            background: stickyBg,
            boxShadow: '3px 0 8px -2px rgba(0,0,0,0.10)',
            borderRight: '1px solid var(--border)',
            transition: 'background 0.1s ease',
          })}
        >
          {isEditing(ctx, lead.id, field) ? (
            <TextInput ctx={ctx} leadId={lead.id} field={field} bold />
          ) : (
            <div className="cell-row">
              <div
                className="lead-name-cell"
                onClick={e => {
                  e.stopPropagation();
                  ctx.onOpenLead(lead);
                }}
                style={{ cursor: 'pointer' }}
                title={lead.name}
              >
                <div
                  className="lead-name-avatar"
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '6px',
                    background: `oklch(from ${brand.color} l c h / 0.12)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: brand.color,
                    fontWeight: '700',
                    fontSize: '11px',
                  }}
                >
                  {lead.name.charAt(0)}
                </div>
                <CellClip className="lead-name-text" value={lead.name} style={{ fontWeight: '600' }}>
                  {lead.name}
                </CellClip>
                <LeadBadgePills badges={ctx.getLeadBadges(lead)} placement="after_name" size="sm" />
              </div>
              <EditPencil />
            </div>
          )}
        </td>
      );
    }
    case 'email': {
      const field = 'email';
      return (
        <td
          key={col.key}
          className="cell-hover-parent"
          onClick={e => ctx.onStartEditingCell(e, lead.id, field, lead.email || '')}
          style={leadColStyle('email', { position: 'relative' })}
        >
          {isEditing(ctx, lead.id, field) ? (
            <TextInput ctx={ctx} leadId={lead.id} field={field} type="email" />
          ) : (
            <div className="cell-row">
              <CellClip value={lead.email}>{lead.email || '—'}</CellClip>
              <EditPencil />
            </div>
          )}
        </td>
      );
    }
    case 'phone': {
      const field = 'phone';
      return (
        <td
          key={col.key}
          className="cell-hover-parent"
          onClick={e => ctx.onStartEditingCell(e, lead.id, field, lead.phone || '')}
          style={leadColStyle('phone', { fontFamily: 'var(--font-mono)', position: 'relative' })}
        >
          {isEditing(ctx, lead.id, field) ? (
            <TextInput ctx={ctx} leadId={lead.id} field={field} />
          ) : (
            <div className="cell-row">
              <CellClip value={lead.phone}>{lead.phone || '—'}</CellClip>
              <EditPencil />
            </div>
          )}
        </td>
      );
    }
    case 'organisation': {
      const field = 'custom:organisation';
      const value =
        lead.custom_fields?.organisation ||
        lead.custom_fields?.organization ||
        lead.custom_fields?.company ||
        '';
      return (
        <td
          key={col.key}
          className="cell-hover-parent"
          onClick={e => ctx.onStartEditingCell(e, lead.id, field, String(value))}
          style={leadColStyle('organisation', { position: 'relative' })}
        >
          {isEditing(ctx, lead.id, field) ? (
            <TextInput ctx={ctx} leadId={lead.id} field={field} />
          ) : (
            <div className="cell-row">
              <CellClip value={value}>{value || '—'}</CellClip>
              <EditPencil />
            </div>
          )}
        </td>
      );
    }
    case 'segment': {
      const field = 'custom:segment';
      const value = ctx.getLeadSegment(lead);
      return (
        <td
          key={col.key}
          className="cell-hover-parent"
          onClick={e => ctx.onStartEditingCell(e, lead.id, field, value || '')}
          style={leadColStyle('segment', { position: 'relative' })}
        >
          {isEditing(ctx, lead.id, field) ? (
            <TextSelect ctx={ctx} leadId={lead.id} field={field}>
              {ctx.segmentOptions.map(seg => (
                <option key={seg.value} value={seg.value}>
                  {seg.label}
                </option>
              ))}
            </TextSelect>
          ) : (
            <div className="cell-row cell-multi">
              {ctx.renderSegmentPill(value, lead)}
              <EditPencil />
            </div>
          )}
        </td>
      );
    }
    case 'service_type': {
      const field = 'custom:service_type';
      const value = lead.custom_fields?.service_type || lead.custom_fields?.service_focus || '';
      return (
        <td
          key={col.key}
          className="cell-hover-parent"
          onClick={e => ctx.onStartEditingCell(e, lead.id, field, String(value))}
          style={leadColStyle('service_type', { position: 'relative' })}
        >
          {isEditing(ctx, lead.id, field) ? (
            <TextInput ctx={ctx} leadId={lead.id} field={field} />
          ) : (
            <div className="cell-row">
              <CellClip value={value}>{value || '—'}</CellClip>
              <EditPencil />
            </div>
          )}
        </td>
      );
    }
    case 'stage': {
      const field = 'funnel_stage';
      const stage = ctx.getLeadStage(lead);
      const stageColor = ctx.getStageColor(stage);
      return (
        <td
          key={col.key}
          className="cell-hover-parent"
          onClick={e => ctx.onStartEditingCell(e, lead.id, field, stage)}
          style={leadColStyle('stage', { position: 'relative' })}
        >
          {isEditing(ctx, lead.id, field) ? (
            <TextSelect ctx={ctx} leadId={lead.id} field={field}>
              {ctx.getStageOptionsForLead(lead).map(st => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </TextSelect>
          ) : (
            <div className="cell-row">
              <span
                className="pill"
                title={stage}
                style={{
                  background: `${stageColor}18`,
                  color: stageColor,
                  border: `1px solid ${stageColor}44`,
                }}
              >
                {stage}
              </span>
              <EditPencil />
            </div>
          )}
        </td>
      );
    }
    case 'next_action': {
      const field = 'custom:next_action';
      const value = lead.custom_fields?.next_action || '';
      return (
        <td
          key={col.key}
          className="cell-hover-parent"
          onClick={e => ctx.onStartEditingCell(e, lead.id, field, String(value))}
          style={leadColStyle('next_action', { position: 'relative' })}
        >
          {isEditing(ctx, lead.id, field) ? (
            <TextInput ctx={ctx} leadId={lead.id} field={field} />
          ) : (
            <div className="cell-row">
              <CellClip
                value={value}
                style={{
                  color: value ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontWeight: 700,
                }}
              >
                {value || '—'}
              </CellClip>
              <EditPencil />
            </div>
          )}
        </td>
      );
    }
    case 'follow_up_date': {
      const field = 'follow_up_date';
      return (
        <td
          key={col.key}
          className="cell-hover-parent"
          onClick={e => ctx.onStartEditingCell(e, lead.id, field, lead.follow_up_date || '')}
          style={leadColStyle('follow_up_date', { position: 'relative' })}
        >
          {isEditing(ctx, lead.id, field) ? (
            <TextInput ctx={ctx} leadId={lead.id} field={field} type="date" />
          ) : (
            <div className="cell-row">
              <CellClip value={lead.follow_up_date}>{lead.follow_up_date || '—'}</CellClip>
              <EditPencil />
            </div>
          )}
        </td>
      );
    }
    case 'last_activity': {
      const value =
        lead.custom_fields?.last_activity ||
        (lead.updated_at ? new Date(lead.updated_at).toLocaleDateString() : '');
      return (
        <td key={col.key} style={leadColStyle('last_activity', { color: 'var(--text-secondary)' })}>
          <CellClip value={value}>{value || '—'}</CellClip>
        </td>
      );
    }
    case 'assigned_to': {
      const value = lead.owner_name || lead.custom_fields?.assigned_to || '';
      return (
        <td
          key={col.key}
          style={leadColStyle('assigned_to', { color: 'var(--text-secondary)', fontWeight: 700 })}
        >
          <CellClip value={value}>{value || '—'}</CellClip>
        </td>
      );
    }
    case 'tags': {
      const tags = Array.isArray(lead.tags)
        ? lead.tags.map(String)
        : String(lead.tags || '')
            .split(',')
            .map(t => t.trim())
            .filter(Boolean);
      return (
        <td key={col.key} style={leadColStyle('tags')}>
          <div className="cell-multi" title={tags.length ? tags.join(', ') : undefined}>
            {tags.length === 0
              ? '—'
              : tags.map(t => (
                  <span key={t} className="pill pill-amber" style={{ fontSize: '11px' }}>
                    {t}
                  </span>
                ))}
          </div>
        </td>
      );
    }
    case 'trial_status_virtual': {
      const trial = ctx.getTrialInfo?.(lead);
      if (!trial?.isTrialLead) {
        return <td key={col.key} style={leadColStyle('trial_status_virtual', { color: 'var(--text-muted)' })} />;
      }
      return (
        <td key={col.key} style={leadColStyle('trial_status_virtual')}>
          <CellClip value={trial.status} style={{ color: trial.color, fontWeight: 800 }}>
            {trial.status}
          </CellClip>
        </td>
      );
    }
    case 'days_remaining_virtual': {
      const trial = ctx.getTrialInfo?.(lead);
      if (!trial?.isTrialLead) {
        return (
          <td key={col.key} style={leadColStyle('days_remaining_virtual', { color: 'var(--text-muted)' })} />
        );
      }
      const pct = Math.min(
        100,
        Math.max(0, Math.round(((ctx.trialDays - trial.daysRemaining) / ctx.trialDays) * 100)),
      );
      return (
        <td key={col.key} style={leadColStyle('days_remaining_virtual')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0, maxWidth: '100%' }}>
            <CellClip
              value={`${trial.daysRemaining} days remaining`}
              style={{ fontSize: '11px', fontWeight: 800, color: trial.color }}
            >
              {trial.daysRemaining} days
            </CellClip>
            <div style={{ height: '4px', background: 'var(--border)', borderRadius: '999px', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: trial.color }} />
            </div>
          </div>
        </td>
      );
    }
    case 'added': {
      const label = ctx.getLeadDateLabel(lead);
      return (
        <td key={col.key} style={leadColStyle('added', { color: 'var(--text-secondary)' })}>
          <CellClip value={label}>{label || '-'}</CellClip>
        </td>
      );
    }
    default: {
      // Brand custom fields
      const fieldName = col.key;
      const meta = ctx.customFieldByName.get(fieldName);
      const editField = `custom:${fieldName}`;
      const raw =
        lead.custom_fields && lead.custom_fields[fieldName] !== undefined
          ? String(lead.custom_fields[fieldName])
          : '';
      const editing = isEditing(ctx, lead.id, editField);

      return (
        <td
          key={col.customFieldId || col.key}
          className="cell-hover-parent"
          onClick={e => ctx.onStartEditingCell(e, lead.id, editField, raw)}
          style={leadColStyle(fieldName, { color: 'var(--text-secondary)', position: 'relative' })}
        >
          {editing ? (
            fieldName === 'segment' ? (
              <TextSelect ctx={ctx} leadId={lead.id} field={editField}>
                <option value="">Unassigned</option>
                {ctx.segmentOptions.map(seg => (
                  <option key={seg.value} value={seg.value}>
                    {seg.label}
                  </option>
                ))}
              </TextSelect>
            ) : meta?.field_type === 'boolean' ? (
              <TextSelect ctx={ctx} leadId={lead.id} field={editField}>
                <option value="">Blank</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </TextSelect>
            ) : (
              <TextInput ctx={ctx} leadId={lead.id} field={editField} />
            )
          ) : (
            <div className="cell-row">
              <div className="cell-multi" title={raw || undefined}>
                {fieldName === 'segment' ? (
                  ctx.renderSegmentPill(raw, lead)
                ) : fieldName === 'service_category_name' &&
                  lead.custom_fields?._allServices &&
                  Array.isArray(lead.custom_fields._allServices) &&
                  lead.custom_fields._allServices.length > 1 ? (
                  lead.custom_fields._allServices.map((svc: string, idx: number) => (
                    <span
                      key={idx}
                      style={{
                        fontSize: '11px',
                        background: `oklch(from ${brand.color} l c h / 0.1)`,
                        color: brand.color,
                        borderRadius: '5px',
                        padding: '2px 7px',
                        fontWeight: '600',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {svc}
                    </span>
                  ))
                ) : meta?.field_type === 'boolean' ||
                  ['quote_sent', 'payment_received'].includes(fieldName) ? (
                  renderBooleanPill(fieldName, raw)
                ) : (
                  <CellClip value={raw || ctx.normalizeFieldValue(raw)}>
                    {ctx.normalizeFieldValue(raw)}
                  </CellClip>
                )}
              </div>
              <EditPencil />
            </div>
          )}
        </td>
      );
    }
  }
}

function LeadTableRow({
  lead,
  columns,
  ctx,
  onHoverLead,
}: {
  lead: Lead;
  columns: LeadTableColumnDef[];
  ctx: LeadTableBodyContext;
  onHoverLead: (id: string | null) => void;
}) {
  const { brand } = ctx;
  const bg = rowBg(lead.id, brand.color, ctx.activeLeadId, ctx.hoveredLeadId);
  const selectBg = rowBg(lead.id, brand.color, ctx.activeLeadId, ctx.hoveredLeadId, true);
  const audienceMatch = ctx.getAudienceMatch?.(lead) || { level: 'none' as AudienceMatchLevel, matchedTerms: [] as string[] };
  const audienceStyles = audienceMatchStyles(audienceMatch.level, brand.color);
  const audienceLabel = audienceMatchLabel(audienceMatch.level);

  return (
    <tr
      onMouseEnter={() => onHoverLead(lead.id)}
      onMouseLeave={() => onHoverLead(null)}
      title={audienceLabel ? `${audienceLabel}: ${audienceMatch.matchedTerms.join(', ')}` : undefined}
      style={{ cursor: 'default', background: bg === 'transparent' ? audienceStyles.rowBackground || bg : bg, borderLeft: audienceStyles.borderLeft, boxShadow: audienceStyles.boxShadow, transition: 'background 0.1s ease, box-shadow 0.1s ease' }}
    >
      <td
        className="lead-col-select"
        onClick={e => {
          e.stopPropagation();
          ctx.onToggleLeadSelect(lead.id);
        }}
        style={{
          width: LEAD_TABLE_CHECKBOX_WIDTH,
          minWidth: LEAD_TABLE_CHECKBOX_WIDTH,
          maxWidth: LEAD_TABLE_CHECKBOX_WIDTH,
          textAlign: 'center',
          background: selectBg,
          transition: 'background 0.1s ease',
        }}
      >
        {audienceLabel && <span aria-label={`${audienceLabel}: ${audienceMatch.matchedTerms.join(', ')}`} title={`${audienceLabel}: ${audienceMatch.matchedTerms.join(', ')}`} style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', marginRight: 5, verticalAlign: 'middle', background: audienceStyles.accentColor }} />}
        <input
          type="checkbox"
          checked={ctx.selectedLeadIds.has(lead.id)}
          onChange={() => {}}
          style={{ cursor: 'pointer', scale: '1.2' }}
          aria-label={`Select ${lead.name}`}
        />
      </td>

      {columns.map(col => renderDataCell(col, lead, ctx))}

      <td
        className="lead-col-actions"
        style={{
          width: LEAD_TABLE_ACTIONS_WIDTH,
          minWidth: LEAD_TABLE_ACTIONS_WIDTH,
          maxWidth: LEAD_TABLE_ACTIONS_WIDTH,
          whiteSpace: 'nowrap',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            opacity: 1,
            transform: 'translateY(0)',
            transition: 'opacity 0.15s ease, transform 0.15s ease',
            pointerEvents: 'auto',
          }}
        >
          <ActionIconButton
            title="Send Email"
            onClick={e => {
              e.stopPropagation();
              ctx.onEmailLead(lead);
            }}
            border={`1px solid ${brand.color}33`}
            background={`oklch(from ${brand.color} l c h / 0.08)`}
            color={brand.color}
            hoverBackground={brand.color}
            hoverColor="#fff"
            iconClass="fas fa-envelope"
          />
          <ActionIconButton
            title="Send WhatsApp"
            onClick={e => {
              e.stopPropagation();
              ctx.onWhatsAppLead(lead);
            }}
            border="1px solid #25D36633"
            background="#25D36614"
            color="#25D366"
            hoverBackground="#25D366"
            hoverColor="#fff"
            iconClass="fab fa-whatsapp"
          />
          <ActionIconButton
            title="Log Call"
            onClick={e => {
              e.stopPropagation();
              ctx.onCallLead(lead);
            }}
            border="1px solid #3B82F633"
            background="#3B82F614"
            color="#3B82F6"
            hoverBackground="#3B82F6"
            hoverColor="#fff"
            iconClass="fas fa-phone"
          />
          <ActionIconButton
            title="Open Lead"
            onClick={e => {
              e.stopPropagation();
              ctx.onOpenLead(lead);
            }}
            border="1px solid var(--border)"
            background="var(--bg-base)"
            color="var(--text-secondary)"
            hoverBackground="var(--text-primary)"
            hoverColor="var(--bg-card)"
            iconClass="fas fa-arrow-right"
          />
        </div>
      </td>
    </tr>
  );
}

function LeadTableEmptyState({
  columns,
  brandColor,
  totalLeadCount,
  onAddLead,
  onImport,
  onClearFilters,
}: {
  columns: LeadTableColumnDef[];
  brandColor: string;
  totalLeadCount: number;
  onAddLead: () => void;
  onImport: () => void;
  onClearFilters: () => void;
}) {
  const empty = totalLeadCount === 0;
  return (
    <tr>
      <td colSpan={Math.max(3, columns.length + 2)} style={{ textAlign: 'center', padding: '40px 24px' }}>
        <div className="empty-state empty-state--inline">
          <div
            className="empty-state__icon"
            style={{
              background: `color-mix(in srgb, ${brandColor} 12%, var(--bg-base))`,
              color: brandColor,
            }}
          >
            <i className={`fas ${empty ? 'fa-user-plus' : 'fa-filter-circle-xmark'}`} />
          </div>
          <p className="empty-state__title">{empty ? 'No leads yet' : 'No leads match your filters'}</p>
          <p className="empty-state__desc">
            {empty
              ? 'Add your first lead manually or import a CSV to get started.'
              : 'Try adjusting search, segment, or stage — or clear filters to see more results.'}
          </p>
          <div className="empty-state__actions">
            {empty ? (
              <>
                <button
                  type="button"
                  onClick={onAddLead}
                  className="btn btn-primary btn-add-lead"
                  style={{ background: brandColor }}
                >
                  <i className="fas fa-plus" /> Add lead
                </button>
                <button type="button" onClick={onImport} className="btn btn-ghost">
                  <i className="fas fa-upload" /> Import CSV
                </button>
              </>
            ) : (
              <button type="button" onClick={onClearFilters} className="btn btn-ghost">
                <i className="fas fa-filter-circle-xmark" /> Clear filters
              </button>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

export type LeadDataTableProps = {
  columns: LeadTableColumnDef[];
  brand: { id: string; name: string; color: string };
  leads: Lead[];
  /** Unfiltered brand lead count (for empty-state copy). */
  totalLeadCount: number;
  customFields?: LeadTableCustomField[];
  selectedLeadIds: Set<string>;
  activeLeadId?: string | null;
  hoveredLeadId?: string | null;
  onHoverLead: (id: string | null) => void;
  onToggleLeadSelect: (leadId: string) => void;
  allSelected: boolean;
  onToggleSelectAll: (checked: boolean) => void;
  editingCell: LeadTableEditingCell;
  editingCellValue: string;
  onEditingCellValueChange: (value: string) => void;
  onStartEditingCell: (e: React.MouseEvent, leadId: string, field: string, currentValue: string) => void;
  onSaveEditingCell: (leadId: string, field: string) => void;
  onCellKeyDown: (e: React.KeyboardEvent, leadId: string, field: string) => void;
  onSort: (sortKey: string) => void;
  onColumnReorder?: (draggedKey: string, targetKey: string) => void;
  renderSortIndicator: (sortKey: string) => React.ReactNode;
  getLeadStage: (lead: Lead) => string;
  getLeadSegment: (lead: Lead) => string;
  getStageOptionsForLead: (lead: Lead) => string[];
  getStageColor: (stage?: string) => string;
  segmentOptions: LeadTableSegmentOption[];
  renderSegmentPill: (segment: string | undefined, lead: Lead) => React.ReactNode;
  getLeadBadges: (lead: Lead) => ResolvedLeadBadge[];
  getAudienceMatch?: (lead: Lead) => { level: AudienceMatchLevel; matchedTerms: string[] };
  getTrialInfo?: (lead: Lead) => LeadTableTrialInfo;
  trialDays?: number;
  getLeadDateLabel: (lead: Lead) => string;
  normalizeFieldValue: (val: unknown) => string;
  onOpenLead: (lead: Lead) => void;
  onEmailLead: (lead: Lead) => void;
  onWhatsAppLead: (lead: Lead) => void;
  onCallLead: (lead: Lead) => void;
  onAddLead: () => void;
  onImport: () => void;
  onClearFilters: () => void;
};

/**
 * Compact leads grid: colgroup + header + body driven by one column list.
 * AppCore owns data/state; this component owns all cell markup.
 */
export default function LeadDataTable(props: LeadDataTableProps) {
  const {
    columns,
    brand,
    leads,
    totalLeadCount,
    customFields = [],
    selectedLeadIds,
    activeLeadId,
    hoveredLeadId,
    onHoverLead,
    onToggleLeadSelect,
    allSelected,
    onToggleSelectAll,
    editingCell,
    editingCellValue,
    onEditingCellValueChange,
    onStartEditingCell,
    onSaveEditingCell,
    onCellKeyDown,
    onSort,
    onColumnReorder,
    renderSortIndicator,
    getLeadStage,
    getLeadSegment,
    getStageOptionsForLead,
    getStageColor,
    segmentOptions,
    renderSegmentPill,
    getLeadBadges,
    getAudienceMatch,
    getTrialInfo,
    trialDays = 14,
    getLeadDateLabel,
    normalizeFieldValue,
    onOpenLead,
    onEmailLead,
    onWhatsAppLead,
    onCallLead,
    onAddLead,
    onImport,
    onClearFilters,
  } = props;

  const customFieldByName = React.useMemo(() => {
    const map = new Map<string, LeadTableCustomField>();
    for (const f of customFields) map.set(f.field_name, f);
    return map;
  }, [customFields]);

  const ctx: LeadTableBodyContext = {
    brand,
    selectedLeadIds,
    activeLeadId,
    hoveredLeadId,
    editingCell,
    editingCellValue,
    customFieldByName,
    segmentOptions,
    trialDays,
    onToggleLeadSelect,
    onEditingCellValueChange,
    onStartEditingCell,
    onSaveEditingCell,
    onCellKeyDown,
    getLeadStage,
    getLeadSegment,
    getStageOptionsForLead,
    getStageColor,
    renderSegmentPill,
    getLeadBadges,
    getAudienceMatch,
    getTrialInfo,
    getLeadDateLabel,
    normalizeFieldValue,
    onOpenLead,
    onEmailLead,
    onWhatsAppLead,
    onCallLead,
  };

  return (
    <table className="lead-data-table">
      <LeadTableColGroup columns={columns} />
      <LeadTableHeader
        columns={columns}
        brandColor={brand.color}
        allSelected={allSelected}
        onToggleSelectAll={onToggleSelectAll}
        onSort={onSort}
        onColumnReorder={onColumnReorder}
        renderSortIndicator={renderSortIndicator}
      />
      <tbody>
        {leads.length === 0 ? (
          <LeadTableEmptyState
            columns={columns}
            brandColor={brand.color}
            totalLeadCount={totalLeadCount}
            onAddLead={onAddLead}
            onImport={onImport}
            onClearFilters={onClearFilters}
          />
        ) : (
          leads.map(lead => (
            <LeadTableRow
              key={lead.id}
              lead={lead}
              columns={columns}
              ctx={ctx}
              onHoverLead={onHoverLead}
            />
          ))
        )}
      </tbody>
    </table>
  );
}
