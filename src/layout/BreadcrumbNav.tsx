import React from 'react';
import type { Brand } from '../types';

export interface BreadcrumbItem {
  label: string;
  icon?: string;
  color?: string;
  onClick?: () => void;
}

interface BreadcrumbNavProps {
  items: BreadcrumbItem[];
  brand?: Brand | null;
}

export default function BreadcrumbNav({ items, brand }: BreadcrumbNavProps) {
  if (!items.length) return null;
  return (
    <nav className="breadcrumb-nav" aria-label="Breadcrumb">
      <ol className="breadcrumb-nav__list">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="breadcrumb-nav__item">
              {index > 0 && (
                <i className="fas fa-chevron-right breadcrumb-nav__sep" aria-hidden="true" />
              )}
              {isLast || !item.onClick ? (
                <span
                  className={`breadcrumb-nav__current ${isLast ? 'is-current' : ''}`}
                  style={item.color ? { color: item.color } : undefined}
                >
                  {item.icon && <i className={`fas ${item.icon}`} aria-hidden="true" />}
                  {index === items.length - 1 && brand?.logo && (
                    <img src={brand.logo} alt="" className="breadcrumb-nav__brand-logo" />
                  )}
                  <span>{item.label}</span>
                </span>
              ) : (
                <button type="button" className="breadcrumb-nav__link" onClick={item.onClick}>
                  {item.icon && <i className={`fas ${item.icon}`} aria-hidden="true" />}
                  <span>{item.label}</span>
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
