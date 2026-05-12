import {type DateRangePreset } from '../../types/dashboard.types';

interface DateFilterProps {
  value: DateRangePreset;
  onChange: (preset: DateRangePreset) => void;
}

export function DateFilter({ value, onChange }: DateFilterProps) {
  const options: { label: string; value: DateRangePreset }[] = [
    { label: 'Aujourd’hui', value: 'today' },
    { label: '7 derniers jours', value: 'last7days' },
    { label: '30 derniers jours', value: 'last30days' },
  ];

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            value === opt.value
              ? 'bg-blue-600 text-white shadow'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}