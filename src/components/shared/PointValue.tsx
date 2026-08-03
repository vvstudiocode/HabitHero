import { Star } from 'lucide-react';

interface PointValueProps {
  value: number;
  className?: string;
  iconSize?: number;
}

export function PointValue({ value, className = '', iconSize = 15 }: PointValueProps) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} aria-label={`${value} 點數`}>
      <Star size={iconSize} className="fill-yellow-400 text-yellow-500" aria-hidden="true" />
      <span>{value}</span>
    </span>
  );
}
