import React from 'react';

export type CharacterMenuAction = {
  id: string;
  title: string;
  icon?: React.ReactNode;
  closeOnSelect?: boolean;
  onSelect: () => void;
};

interface DashboardCharacterHeroProps {
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

function CharacterImage() {
  return <img src="/images/parent-character.png" className="hh-character-hero__image" alt="HabitHero 角色" />;
}

export function DashboardCharacterHero({
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

  return (
    <header className="hh-character-dashboard-header">
      <div
        className="hh-character-hero-panel"
        onClick={(event) => {
          if (!activeMenuId || !onMenuClose) return;
          const target = event.target;
          if (target instanceof Element && target.closest('button')) return;
          onMenuClose();
        }}
      >
        <div className="hh-character-hero-copy">
          {eyebrow && <p>{eyebrow}</p>}
          <h1>{title}</h1>
          {subtitle && <span>{subtitle}</span>}
        </div>
        <div className="hh-character-hero-cloud hh-character-hero-cloud--one" aria-hidden="true" />
        <div className="hh-character-hero-cloud hh-character-hero-cloud--two" aria-hidden="true" />
        <div className="hh-character-hero-hill hh-character-hero-hill--back" aria-hidden="true" />
        <div className="hh-character-hero-hill" aria-hidden="true" />
        <CharacterImage />
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
                  type="button"
                  className={`hh-character-menu-action ${activeMenuId === action.id ? 'is-selected' : ''}`}
                  onClick={action.onSelect}
                >
                  {action.icon && <span aria-hidden="true">{action.icon}</span>}
                  <strong>{action.title}</strong>
                </button>
              ))}
            </div>
            {subActions.length > 0 && (
              <div className="hh-character-menu-submenu" aria-label="家長功能子選單">
                {subActions.map((action, index) => (
                  <button
                    key={`${action.id}-${index}`}
                    type="button"
                    className="hh-character-menu-action"
                    onClick={action.onSelect}
                  >
                    {action.icon && <span aria-hidden="true">{action.icon}</span>}
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
