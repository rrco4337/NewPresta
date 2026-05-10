// components/CSVImport.tsx
import React, { useState } from 'react';
import { useCSVImport } from '../hooks/UseCsvImport';
import { csvService, type CSVProductRow } from '../services/CSVservice';
import { CreateProductData } from '../hooks/CreateProductData';
import { productService, type Product } from '../services/produitApi';
import './CSVImport.css';

interface CSVImportProps {
  onClose: () => void;
  onSuccess: () => void;
}

const CSVImport: React.FC<CSVImportProps> = ({ onClose, onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CSVProductRow[]>([]);
  const [step, setStep] = useState<'upload' | 'preview' | 'import'>('upload');
  
  const { categories, manufacturers } = CreateProductData();
  const { importProducts, loading, progress, errors, successCount, skipCount } = useCSVImport();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      previewCSV(selectedFile);
    }
  };

  const previewCSV = async (fileToPreview: File) => {
    const { data, errors: parseErrors } = await csvService.parseCSV(fileToPreview);
    if (parseErrors.length > 0) {
      alert(`Erreurs dans le CSV: ${parseErrors.map(e => e.message).join(', ')}`);
      return;
    }
    setPreview(data.slice(0, 5)); // Aperçu des 5 premières lignes
    setStep('preview');
  };

  const handleImport = async () => {
    if (!file) return;
    
    const { data: products } = await csvService.parseCSV(file);
    
    // Récupérer les produits existants pour vérifier les doublons
    const existingProducts = await productService.getAllProducts();
    
    await importProducts(products, categories, manufacturers, existingProducts);
    setStep('import');
    
    setTimeout(() => {
      onSuccess();
      onClose();
    }, 2000);
  };

  const downloadTemplate = () => {
    const template = csvService.getTemplate();
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', 'template_produits.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="csv-import-modal">
      <div className="csv-import-container">
        <div className="csv-import-header">
          <h3>📄 Import CSV</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {step === 'upload' && (
          <div className="csv-upload-step">
            <div className="upload-zone">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                id="csv-file-input"
              />
              <label htmlFor="csv-file-input" className="upload-label">
                📁 Choisir un fichier CSV
              </label>
            </div>
            
            <button className="template-btn" onClick={downloadTemplate}>
              📥 Télécharger le template CSV
            </button>
            
            <small>Format: UTF-8, séparateur virgule, colonnes selon template</small>
          </div>
        )}

        {step === 'preview' && preview.length > 0 && (
          <div className="csv-preview-step">
            <h4>Aperçu (5 premières lignes)</h4>
            <div className="preview-table">
              <table>
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Référence</th>
                    <th>Prix HT</th>
                    <th>Catégorie</th>
                    <th>Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, idx) => (
                    <tr key={idx}>
                      <td>{row.name}</td>
                      <td>{row.reference}</td>
                      <td>{row.price} €</td>
                      <td>{row.id_category_default}</td>
                      <td>{row.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="preview-actions">
              <button className="btn-secondary" onClick={() => setStep('upload')}>
                ← Retour
              </button>
              <button className="btn-primary" onClick={handleImport}>
                Démarrer l'import
              </button>
            </div>
          </div>
        )}

        {step === 'import' && loading && (
          <div className="csv-import-step">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <p>Import en cours... {progress}%</p>
            <p>✅ Créés : {successCount}</p>
            <p>⏭️ Ignorés (références existantes) : {skipCount}</p>
          </div>
        )}

        {step === 'import' && !loading && (
          <div className="csv-result-step">
            {errors.length === 0 ? (
              <div className="success-message">
                ✅ Import terminé avec succès !
                <p>{successCount} produits créés</p>
                <p>{skipCount} produits ignorés (références existantes)</p>
              </div>
            ) : (
              <div className="error-message">
                ⚠️ Import partiel avec {errors.length} erreur(s)
                <ul>
                  {errors.slice(0, 5).map((err, idx) => (
                    <li key={idx}>Ligne {err.row}: {err.column} - {err.message}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {step !== 'import' && (
          <div className="csv-import-footer">
            <button className="btn-cancel" onClick={onClose}>
              Annuler
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CSVImport;