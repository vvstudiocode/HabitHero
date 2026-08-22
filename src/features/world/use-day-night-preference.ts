import { useEffect, useState } from 'react';
import { getDayNightPreference, setDayNightPreference } from './day-night-preference';

export function useDayNightPreference(childId: string | undefined) {
  const [dayNightEnabled, setDayNightEnabled] = useState(() => getDayNightPreference(childId ?? ''));

  useEffect(() => {
    setDayNightEnabled(getDayNightPreference(childId ?? ''));
  }, [childId]);

  const onDayNightChange = (enabled: boolean) => {
    if (!childId) return;
    setDayNightEnabled(enabled);
    setDayNightPreference(childId, enabled);
  };

  return { dayNightEnabled, onDayNightChange };
}
