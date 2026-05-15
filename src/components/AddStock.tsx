// src/pages/backoffice/AddStock.tsx
import React, { useState } from 'react';
import { stockService } from '../services/stockApi';
import './AddStock.css';

const AddStock: React.FC = () => {
  const [productId, setProductId] = useState('');
  const [quantityToAdd, setQuantityToAdd] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId.trim()) {
      setMessage({ type: 'error', text: 'Veuillez entrer un ID produit.' });
      return;
    }
    if (quantityToAdd <= 0) {
      setMessage({ type: 'error', text: 'La quantité doit être supérieure à 0.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      // 1. Récupérer le stock actuel
      const currentStock = await stockService.getStockQuantity(productId, '0');
      // 2. Nouvelle quantité = actuelle + ajout
      const newQuantity = currentStock + quantityToAdd;
      // 3. Mettre à jour
      const success = await stockService.setProductStock(productId, newQuantity, '0');
      if (success) {
        setMessage({ type: 'success', text: `Stock mis à jour : +${quantityToAdd} (nouveau total : ${newQuantity})` });
        setProductId('');
        setQuantityToAdd(1);
      } else {
        setMessage({ type: 'error', text: 'Erreur lors de la mise à jour du stock.' });
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Erreur technique. Voir console.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-stock-container">
      <h1>Ajouter du stock</h1>
      <form onSubmit={handleSubmit} className="add-stock-form">
        <div className="form-group">
          <label htmlFor="productId">ID Produit :</label>
          <input
            type="number"
            id="productId"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            required
            min="1"
          />
        </div>
        <div className="form-group">
          <label htmlFor="quantity">Quantité à ajouter :</label>
          <input
            type="number"
            id="quantity"
            value={quantityToAdd}
            onChange={(e) => setQuantityToAdd(parseInt(e.target.value) || 0)}
            required
            min="1"
            step="1"
          />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Mise à jour...' : 'Ajouter au stock'}
        </button>
      </form>
      {message && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}
    </div>
  );
};

export default AddStock;