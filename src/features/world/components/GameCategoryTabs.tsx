import { Crown, Flower2, PawPrint } from 'lucide-react';

export type GameCatalogSection = 'character' | 'pet' | 'decoration';

interface GameCategoryTabsProps {
  ariaLabel: string;
  selected: GameCatalogSection;
  onChange: (section: GameCatalogSection) => void;
}

export function GameCategoryTabs({ ariaLabel, selected, onChange }: GameCategoryTabsProps) {
  return (
    <div className="hh-game-category-tabs" role="tablist" aria-label={ariaLabel}>
      {([['character', '角色'], ['pet', '寵物'], ['decoration', '裝飾']] as const).map(([value, label]) => (
        <button key={value} type="button" role="tab" aria-label={label} title={label} aria-selected={selected === value} className={selected === value ? 'is-selected' : ''} onClick={() => onChange(value)}>
          {value === 'character' ? <Crown size={16} /> : value === 'pet' ? <PawPrint size={16} /> : <Flower2 size={16} />}
        </button>
      ))}
    </div>
  );
}
