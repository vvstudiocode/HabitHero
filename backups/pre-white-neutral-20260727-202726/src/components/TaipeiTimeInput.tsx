import { useEffect, useState } from 'react';

interface TaipeiTimeInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const hours = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'));
const minutes = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));

export function TaipeiTimeInput({ value, onChange, className = '' }: TaipeiTimeInputProps) {
  const [hour, setHour] = useState(value ? value.slice(0, 2) : '');
  const [minute, setMinute] = useState(value ? value.slice(3, 5) : '');

  useEffect(() => {
    setHour(value ? value.slice(0, 2) : '');
    setMinute(value ? value.slice(3, 5) : '');
  }, [value]);

  const updateTime = (nextHour: string, nextMinute: string) => {
    setHour(nextHour);
    setMinute(nextMinute);
    if (nextHour && nextMinute) onChange(`${nextHour}:${nextMinute}`);
    else if (!nextHour && !nextMinute) onChange('');
  };

  const selectClass = `min-h-12 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-base font-bold text-gray-800 outline-none focus:ring-2 focus:ring-teal-400 ${className}`;

  return (
    <div className="flex min-w-0 items-center gap-2" aria-label="開始時間">
      <select
        aria-label="小時"
        value={hour}
        onChange={(event) => updateTime(event.target.value, minute)}
        className={selectClass}
      >
        <option value="">--</option>
        {hours.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      <span className="font-black text-gray-500" aria-hidden="true">:</span>
      <select
        aria-label="分鐘"
        value={minute}
        onChange={(event) => updateTime(hour, event.target.value)}
        className={selectClass}
      >
        <option value="">--</option>
        {minutes.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
    </div>
  );
}
