interface WorldDisplaySettingsProps {
  backgroundMusicEnabled: boolean;
  onBackgroundMusicChange: (enabled: boolean) => void;
  showPetNames: boolean;
  onShowPetNamesChange: (visible: boolean) => void;
  dayNightEnabled: boolean;
  onDayNightChange: (enabled: boolean) => void;
}

function ToggleCard({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="hh-game-settings-card hh-game-settings-card--toggle">
      <div><strong>{label}</strong></div>
      <label className="hh-game-setting-toggle">
        <span className="sr-only">{label}</span>
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span aria-hidden="true" />
      </label>
    </div>
  );
}

export function WorldDisplaySettings({
  backgroundMusicEnabled,
  onBackgroundMusicChange,
  showPetNames,
  onShowPetNamesChange,
  dayNightEnabled,
  onDayNightChange,
}: WorldDisplaySettingsProps) {
  return (
    <>
      <ToggleCard label="背景音樂" checked={backgroundMusicEnabled} onChange={onBackgroundMusicChange} />
      <ToggleCard label="顯示寵物名字" checked={showPetNames} onChange={onShowPetNamesChange} />
      <ToggleCard label="日夜效果" checked={dayNightEnabled} onChange={onDayNightChange} />
    </>
  );
}
