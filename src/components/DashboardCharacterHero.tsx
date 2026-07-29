import React from 'react';
import { getCharacterByImageUrl } from '../features/characters/catalog';
import type { ThemeSettings } from '../types';

export type CharacterMenuAction = {
  id: string;
  title: string;
  icon?: React.ReactNode;
  hasNotification?: boolean;
  tour?: string;
  closeOnSelect?: boolean;
  onSelect: () => void;
};

interface DashboardCharacterHeroProps {
  sceneImage: string;
  sceneImageDesktop?: string;
  sceneAlt?: string;
  theme?: ThemeSettings;
  title: string;
  eyebrow: string;
  subtitle: string;
  firstStatLabel: string;
  firstStatValue: string | number;
  firstStatSuffix?: string;
  secondStatLabel: string;
  secondStatValue: string | number;
  secondStatSuffix?: string;
  actions?: React.ReactNode;
  menuActions?: CharacterMenuAction[];
  rootMenuActions?: CharacterMenuAction[];
  activeMenuId?: string | null;
  menuVariant?: 'parent' | 'child';
  onMenuClose?: () => void;
  menuOpen?: boolean;
  onMenuOpenChange?: (open: boolean) => void;
}

export function DashboardCharacterHero({
  sceneImage,
  sceneImageDesktop,
  sceneAlt = '',
  theme,
  title,
  eyebrow,
  subtitle,
  firstStatLabel,
  firstStatValue,
  firstStatSuffix,
  secondStatLabel,
  secondStatValue,
  secondStatSuffix,
  actions,
  menuActions,
  rootMenuActions,
  activeMenuId = null,
  menuVariant = 'parent',
  onMenuClose,
}: DashboardCharacterHeroProps) {
  const rootActions = rootMenuActions ?? menuActions ?? [];
  const subActions = rootMenuActions && activeMenuId ? (menuActions ?? []) : [];
  const hasMenu = rootActions.length > 0;
  const character = getCharacterByImageUrl(sceneImage);
  const themeColor = theme?.accentColor ?? character?.accentColor ?? (menuVariant === 'parent' ? '#d99a24' : '#f472b6');
  const resolvedSceneImage = theme?.mobileBackgroundImageUrl ?? sceneImage;
  const resolvedSceneImageDesktop = theme?.desktopBackgroundImageUrl ?? sceneImageDesktop;

  return (
    <header className="hh-character-dashboard-header">
      <div
        className="hh-character-hero-panel"
        data-theme-color={character?.id ?? menuVariant}
        style={{ '--hh-character-theme-color': themeColor } as React.CSSProperties}
        onClick={(event) => {
          if (!activeMenuId || !onMenuClose) return;
          const target = event.target;
          if (target instanceof Element && target.closest('button')) return;
          onMenuClose();
        }}
      >
        <picture className="hh-character-hero-picture">
          {resolvedSceneImageDesktop && <source media="(min-width: 760px)" srcSet={resolvedSceneImageDesktop} />}
          <img className="hh-character-hero-image" src={resolvedSceneImage} alt={sceneAlt} aria-hidden={sceneAlt ? undefined : true} />
        </picture>
        <div className="hh-character-hero-copy">
          {eyebrow && <p>{eyebrow}</p>}
          <h1>{title}</h1>
          {subtitle && <span>{subtitle}</span>}
        </div>
        {hasMenu && (
          <div
            className={`hh-character-menu is-open ${activeMenuId ? 'has-submenu' : ''}`}
            data-active-menu={activeMenuId ?? undefined}
            data-menu-variant={menuVariant}
          >
            <div className="hh-character-menu-root" aria-label="家長功能主選單">
              {rootActions.map((action) => (
                <button
                  key={action.id}
                  data-tour={action.tour}
                  type="button"
                  className={`hh-character-menu-action ${activeMenuId === action.id ? 'is-selected' : ''}`}
                  onClick={action.onSelect}
                >
                  {action.icon && <span aria-hidden="true">{action.icon}</span>}
                  {action.hasNotification && <span className="hh-character-menu-notification" aria-label="有新項目" />}
                  <strong>{action.title}</strong>
                </button>
              ))}
            </div>
            {subActions.length > 0 && (
              <div className="hh-character-menu-submenu" aria-label="家長功能子選單">
                {subActions.map((action, index) => (
                  <button
                    key={`${action.id}-${index}`}
                    data-tour={action.tour}
                    type="button"
                    className="hh-character-menu-action"
                    onClick={action.onSelect}
                  >
                    {action.icon && <span aria-hidden="true">{action.icon}</span>}
                    {action.hasNotification && <span className="hh-character-menu-notification" aria-label="有新項目" />}
                    <strong>{action.title}</strong>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="hh-character-stats" aria-label="儀表板統計">
          <div aria-label={firstStatLabel}><strong>{firstStatValue} <em>{firstStatSuffix}</em></strong></div>
          <div aria-label={secondStatLabel}><strong>{secondStatValue} <em>{secondStatSuffix}</em></strong></div>
        </div>
        <div className="hh-character-dashboard-actions">{actions}</div>
      </div>
    </header>
  );
}
