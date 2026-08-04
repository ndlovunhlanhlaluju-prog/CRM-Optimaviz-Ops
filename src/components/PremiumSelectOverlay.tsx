import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

type OverlayOption = {
  value: string;
  label: string;
  disabled: boolean;
  group?: string;
};

type OverlayState = {
  select: HTMLSelectElement;
  rect: DOMRect;
  options: OverlayOption[];
  selectedIndex: number;
  activeIndex: number;
};

const readOptions = (select: HTMLSelectElement): OverlayOption[] =>
  Array.from(select.options)
    .filter(option => !option.hidden)
    .map(option => ({
      value: option.value,
      label: option.textContent?.trim() || option.label || option.value,
      disabled: option.disabled,
      group: option.parentElement?.tagName === 'OPTGROUP'
        ? (option.parentElement as HTMLOptGroupElement).label
        : undefined,
    }));

const readSelectedIndex = (select: HTMLSelectElement, options: OverlayOption[]) => {
  const selected = options.findIndex(option => option.value === select.value);
  return selected >= 0 ? selected : options.findIndex(option => !option.disabled);
};

export default function PremiumSelectOverlay() {
  const [overlay, setOverlay] = useState<OverlayState | null>(null);

  const close = () => setOverlay(null);

  const openForSelect = (select: HTMLSelectElement) => {
    if (select.disabled || select.multiple) return;
    const options = readOptions(select);
    if (!options.length) return;
    const selectedIndex = readSelectedIndex(select, options);
    setOverlay({
      select,
      rect: select.getBoundingClientRect(),
      options,
      selectedIndex,
      activeIndex: selectedIndex >= 0 ? selectedIndex : 0,
    });
  };

  const chooseOption = (option: OverlayOption) => {
    if (!overlay || option.disabled) return;
    overlay.select.value = option.value;
    overlay.select.dispatchEvent(new Event('input', { bubbles: true }));
    overlay.select.dispatchEvent(new Event('change', { bubbles: true }));
    overlay.select.focus({ preventScroll: true });
    close();
  };

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      const select = target?.closest?.('select') as HTMLSelectElement | null;
      if (!select || select.dataset.nativeDropdown === 'true') return;
      event.preventDefault();
      event.stopPropagation();
      openForSelect(select);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const select = target?.closest?.('select') as HTMLSelectElement | null;
      if (!select || select.dataset.nativeDropdown === 'true' || select.disabled || select.multiple) return;
      if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'ArrowDown') return;
      event.preventDefault();
      openForSelect(select);
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, []);

  useEffect(() => {
    if (!overlay) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest?.('.premium-select-overlay')) return;
      close();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!overlay) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Enter') return;
      event.preventDefault();
      if (event.key === 'Enter') {
        chooseOption(overlay.options[overlay.activeIndex]);
        return;
      }
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      let next = overlay.activeIndex;
      for (let i = 0; i < overlay.options.length; i += 1) {
        next = (next + direction + overlay.options.length) % overlay.options.length;
        if (!overlay.options[next].disabled) break;
      }
      setOverlay(prev => prev ? { ...prev, activeIndex: next } : prev);
    };

    const closeOnLayoutChange = (event: Event) => {
      const target = event.target as HTMLElement | Document | null;
      if (target instanceof HTMLElement && target.closest('.premium-select-overlay')) return;
      close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', closeOnLayoutChange, true);
    window.addEventListener('resize', closeOnLayoutChange);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', closeOnLayoutChange, true);
      window.removeEventListener('resize', closeOnLayoutChange);
    };
  }, [overlay]);

  const style = useMemo(() => {
    if (!overlay) return {};
    const margin = 10;
    const viewportPadding = 12;
    const width = Math.max(overlay.rect.width, 220);
    const left = Math.min(Math.max(viewportPadding, overlay.rect.left), window.innerWidth - width - viewportPadding);
    const belowSpace = window.innerHeight - overlay.rect.bottom - viewportPadding;
    const aboveSpace = overlay.rect.top - viewportPadding;
    const openAbove = belowSpace < 260 && aboveSpace > belowSpace;
    const maxHeight = Math.max(180, Math.min(360, openAbove ? aboveSpace - margin : belowSpace - margin));
    return {
      left,
      width,
      maxHeight,
      top: openAbove ? undefined : overlay.rect.bottom + margin,
      bottom: openAbove ? window.innerHeight - overlay.rect.top + margin : undefined,
    } as React.CSSProperties;
  }, [overlay]);

  if (!overlay) return null;

  return createPortal(
    <div
      className="premium-select-overlay"
      style={style}
      role="listbox"
      aria-label="Dropdown options"
      onWheel={event => event.stopPropagation()}
      onTouchMove={event => event.stopPropagation()}
    >
      <div className="premium-select-overlay__surface">
        {overlay.options.map((option, index) => {
          const selected = option.value === overlay.select.value;
          const active = index === overlay.activeIndex;
          const previous = overlay.options[index - 1];
          const showGroup = option.group && option.group !== previous?.group;
          return (
            <React.Fragment key={`${option.value}-${index}`}>
              {showGroup && <div className="premium-select-overlay__group">{option.group}</div>}
              <button
                type="button"
                role="option"
                aria-selected={selected}
                disabled={option.disabled}
                className={`${selected ? 'selected' : ''} ${active ? 'active' : ''}`}
                onMouseEnter={() => setOverlay(prev => prev ? { ...prev, activeIndex: index } : prev)}
                onPointerDown={event => event.preventDefault()}
                onClick={() => chooseOption(option)}
              >
                <span>{option.label}</span>
                {selected && <i className="fas fa-check" aria-hidden="true" />}
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </div>,
    document.body
  );
}
