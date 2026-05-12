// src/components/dashboard/DatePickerInput.tsx
interface DatePickerInputProps {
  selectedDate: string | null;
  onDateChange: (date: string | null) => void;
}

export function DatePickerInput({ selectedDate, onDateChange }: DatePickerInputProps) {
  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Filtrer par date précise :
      </label>
      <input
        type="date"
        value={selectedDate || ''}
        onChange={(e) => onDateChange(e.target.value || null)}
        className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
      />
      {selectedDate && (
        <button
          onClick={() => onDateChange(null)}
          className="ml-3 text-sm text-red-600 hover:text-red-800"
        >
          ✖ Effacer
        </button>
      )}
    </div>
  );
}