// components/TaxSelector.tsx
import React from 'react';
import { type TaxRuleGroup } from '../services/taxApi';

interface TaxSelectorProps {
  taxGroups: TaxRuleGroup[];
  selectedId: string;
  onChange: (id: string, rate: number) => void;
  error?: string;
}

const TaxSelector: React.FC<TaxSelectorProps> = ({ 
  taxGroups, 
  selectedId, 
  onChange, 
  error 
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    const group = taxGroups.find(g => g.id === id);
    const rate = group?.rate || 20;
    onChange(id, rate);
  };

  return (
    <div className={`form-group ${error ? 'error' : ''}`}>
      <label>📊 Règle de taxe (TVA)</label>
      <select value={selectedId} onChange={handleChange}>
        <option value="">-- Sélectionner --</option>
        {taxGroups.map(group => (
          <option key={group.id} value={group.id}>
            {group.name} ({group.rate || 0}%)
          </option>
        ))}
      </select>
      {error && <span className="error-message">{error}</span>}
    </div>
  );
};

export default TaxSelector;