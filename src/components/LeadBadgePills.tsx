import React from 'react';
import { ResolvedLeadBadge, toneStyles } from '../utils/leadBadges';

type Props = {
  badges: ResolvedLeadBadge[];
  placement?: 'after_name' | 'detail_only';
  size?: 'sm' | 'md';
};

export default function LeadBadgePills({ badges, placement = 'after_name', size = 'sm' }: Props) {
  const visible = badges.filter(b => b.placement === placement);
  if (!visible.length) return null;

  const fontSize = size === 'sm' ? '10px' : '11.5px';
  const padding = size === 'sm' ? '2px 6px' : '3px 8px';
  const iconSize = size === 'sm' ? '9px' : '11px';

  return (
    <span
      style={{
        display: 'inline-flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '4px',
        marginLeft: size === 'sm' ? '8px' : 0,
      }}
    >
      {visible.map(badge => {
        const tone = toneStyles(badge.tone);
        return (
          <span
            key={badge.id}
            title={badge.detailTitle || badge.label}
            style={{
              fontSize,
              background: tone.bg,
              border: `1px solid ${tone.border}`,
              color: tone.color,
              padding,
              borderRadius: '6px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              whiteSpace: 'nowrap',
              lineHeight: 1.2,
            }}
          >
            <i className={`fas ${badge.icon || 'fa-tag'}`} style={{ fontSize: iconSize }}></i>
            {badge.label}
          </span>
        );
      })}
    </span>
  );
}

export function LeadBadgeDetailBanners({ badges }: { badges: ResolvedLeadBadge[] }) {
  const banners = badges.filter(b => b.detailBody || b.detailTitle);
  if (!banners.length) return null;

  return (
    <>
      {banners.map(badge => {
        const tone = toneStyles(badge.tone);
        return (
          <div
            key={`banner-${badge.id}`}
            style={{
              background: tone.bg,
              border: `1.5px dashed ${tone.border}`,
              borderRadius: '12px',
              padding: '12px 14px',
              color: tone.color,
              fontSize: '12.5px',
              marginBottom: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
              <i className={`fas ${badge.icon || 'fa-tag'}`} style={{ color: tone.color }}></i>
              <span>{badge.detailTitle || badge.label}</span>
            </div>
            {badge.detailBody ? (
              <span style={{ fontSize: '11.5px', opacity: 0.9 }}>{badge.detailBody}</span>
            ) : null}
          </div>
        );
      })}
    </>
  );
}
