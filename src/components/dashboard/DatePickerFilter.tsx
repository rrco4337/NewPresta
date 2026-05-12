import { type DateRangePreset } from '../../types/dashboard.types';

interface DatePickerFilterProps {
  preset: DateRangePreset;
  customDate: string | null;
  onPresetChange: (preset: DateRangePreset) => void;
  onCustomDateChange: (date: string | null) => void;
}

export function DatePickerFilter({ preset, customDate, onPresetChange, onCustomDateChange }: DatePickerFilterProps) {
  const presets: { label: string; value: DateRangePreset }[] = [
    { label: 'Aujourd’hui', value: 'today' },
    { label: '7 derniers jours', value: 'last7days' },
    { label: '30 derniers jours', value: 'last30days' },
    { label: 'Date précise', value: 'custom' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {presets.map(opt => (
          <button
            key={opt.value}
            onClick={() => onPresetChange(opt.value)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              preset === opt.value
                ? 'bg-blue-600 text-white shadow'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {preset === 'custom' && (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Choisir une date :</label>
          <input
            type="date"
            value={customDate || ''}
            onChange={(e) => onCustomDateChange(e.target.value || null)}
            className="px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      )}
    </div>
  );
}