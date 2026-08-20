import React from 'react';
import type { ThemeSettings } from '../types';

export type CharacterMenuTone = 'attention' | 'action' | 'explore' | 'reward' | 'growth' | 'neutral';

export type CharacterMenuAction = {
  id: string;
  title: string;
  icon?: React.ReactNode;
  tone?: CharacterMenuTone;
  hasNotification?: boolean;
  tour?: string;
  closeOnSelect?: boolean;
  onSelect: () => void;
};

interface DashboardCharacterHeroProps {
  sceneImage: string;
  sceneImageDesktop?: string;
  mobileSceneVideo?: string;
  sceneAlt?: string;
  theme?: ThemeSettings;
  title?: string;
  eyebrow?: string;
  subtitle?: string;
  stats?: Array<{ label: string; value: string | number; suffix?: string; icon?: React.ReactNode; target?: 'points' | 'scroll' }>;
  statsPulse?: boolean;
  sceneLayer?: React.ReactNode;
  firstStatLabel?: string;
  firstStatValue?: string | number;
  firstStatSuffix?: string;
  firstStatIcon?: React.ReactNode;
  secondStatLabel?: string;
  secondStatValue?: string | number;
  secondStatSuffix?: string;
  secondStatIcon?: React.ReactNode;
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
  mobileSceneVideo,
  sceneAlt = '',
  theme,
  title,
  eyebrow,
  subtitle,
  stats,
  sceneLayer,
  firstStatLabel,
  firstStatValue,
  firstStatSuffix,
  firstStatIcon,
  secondStatLabel,
  secondStatValue,
  secondStatSuffix,
  secondStatIcon,
  actions,
  menuActions,
  rootMenuActions,
  activeMenuId = null,
  menuVariant = 'parent',
  onMenuClose,
  menuOpen = true,
  statsPulse = false,
}: DashboardCharacterHeroProps) {
  const rootActions = rootMenuActions ?? menuActions ?? [];
  const subActions = rootMenuActions && activeMenuId ? (menuActions ?? []) : [];
  const hasMenu = rootActions.length > 0 || subActions.length > 0;
  const themeColor = theme?.accentColor ?? (menuVariant === 'parent' ? '#d99a24' : '#202124');
  const resolvedSceneImage = theme?.mobileBackgroundImageUrl ?? sceneImage;
  const resolvedSceneImageDesktop = theme?.desktopBackgroundImageUrl ?? sceneImageDesktop;
  const hasSceneLayer = Boolean(sceneLayer);
  const resolvedStats = stats ?? [
    firstStatLabel ? { label: firstStatLabel, value: firstStatValue ?? '', suffix: firstStatSuffix, icon: firstStatIcon } : null,
    secondStatLabel ? { label: secondStatLabel, value: secondStatValue ?? '', suffix: secondStatSuffix, icon: secondStatIcon } : null,
  ].filter((stat): stat is NonNullable<typeof stat> => Boolean(stat));

  return (
    <header className="hh-character-dashboard-header">
      <div
        className="hh-character-hero-panel"
        data-theme-color={menuVariant}
        style={{ '--hh-character-theme-color': themeColor } as React.CSSProperties}
        onClick={(event) => {
          if (!activeMenuId || !onMenuClose) return;
          const target = event.target;
          if (target instanceof Element && target.closest('button')) return;
          onMenuClose();
        }}
      >
        {sceneLayer && <div className="hh-character-scene-layer">{sceneLayer}</div>}
        {!hasSceneLayer && (
          <picture className={`hh-character-hero-picture${mobileSceneVideo ? ' has-mobile-video' : ''}`}>
            {resolvedSceneImageDesktop && <source media="(min-width: 760px)" srcSet={resolvedSceneImageDesktop} />}
            {resolvedSceneImage && <img className="hh-character-hero-image" src={resolvedSceneImage} alt={sceneAlt} aria-hidden={sceneAlt ? undefined : true} />}
          </picture>
        )}
        {!hasSceneLayer && mobileSceneVideo && (
          <video
            className="hh-character-hero-video"
            src={mobileSceneVideo}
            poster={resolvedSceneImage}
            autoPlay
            muted
            loop
            playsInline
            aria-hidden="true"
          />
        )}
        {(eyebrow || title || subtitle) && (
          <div className="hh-character-hero-copy">
            {eyebrow && <p>{eyebrow}</p>}
            {title && <h1>{title}</h1>}
            {subtitle && <span>{subtitle}</span>}
          </div>
        )}
        {hasMenu && (
          <div
            className={`hh-character-menu is-open ${activeMenuId ? 'has-submenu' : ''} ${menuOpen === false ? 'is-collapsed' : ''}`}
            data-active-menu={activeMenuId ?? undefined}
            data-menu-variant={menuVariant}
          >
            {rootActions.length > 0 && (
              <div className="hh-character-menu-root" aria-label={`${menuVariant === 'child' ? '孩子' : '家長'}功能主選單`}>
                {rootActions.map((action) => (
                  <button
                    key={action.id}
                    data-tour={action.tour}
                    data-menu-tone={action.tone}
                    type="button"
                    className={`hh-character-menu-action ${activeMenuId === action.id ? 'is-selected' : ''}`}
                    onClick={action.onSelect}
                  >
                    {action.icon && <span className="hh-character-menu-icon" style={action.tone ? { color: `var(--hh-menu-tone-${action.tone})` } : undefined} aria-hidden="true">{action.icon}</span>}
                    {action.hasNotification && <span className="hh-character-menu-notification" aria-label="有新項目" />}
                    <strong>{action.title}</strong>
                  </button>
                ))}
              </div>
            )}
            {subActions.length > 0 && (
              <div className="hh-character-menu-submenu" aria-label={`${menuVariant === 'child' ? '孩子' : '家長'}功能子選單`} aria-hidden={menuOpen === false}>
                {subActions.map((action, index) => (
                  <button
                    key={`${action.id}-${index}`}
                    data-tour={action.tour}
                    data-menu-tone={action.tone}
                    type="button"
                    className="hh-character-menu-action"
                    tabIndex={menuOpen === false ? -1 : 0}
                    onClick={action.onSelect}
                  >
                    {action.icon && <span className="hh-character-menu-icon" style={action.tone ? { color: `var(--hh-menu-tone-${action.tone})` } : undefined} aria-hidden="true">{action.icon}</span>}
                    {action.hasNotification && <span className="hh-character-menu-notification" aria-label="有新項目" />}
                    <strong>{action.title}</strong>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div className={`hh-character-stats${statsPulse ? ' is-reward-pulsing' : ''}`} data-stat-count={resolvedStats.length} aria-label="儀表板統計">
          {resolvedStats.map((stat) => (
            <div key={stat.label} data-hh-stat-target={stat.target} aria-label={`${stat.label}：${stat.value}${stat.suffix ?? ''}`}>
              <strong>
                {stat.icon && <span className="hh-character-stat-icon" aria-hidden="true">{stat.icon}</span>}
                <span>{stat.value}</span>
                {stat.suffix && <em>{stat.suffix}</em>}
              </strong>
            </div>
          ))}
        </div>
        <div className="hh-character-dashboard-actions">{actions}</div>
      </div>
    </header>
  );
}
