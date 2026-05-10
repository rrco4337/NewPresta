import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { customerService, type Customer } from '../services/customerApi';
import { useCustomerFormData } from '../hooks/CreateCustomerData';
import './CustomerCreate.css';

const CustomerForm: React.FC = () => {
  const { id } = useParams<{ id: string }>(); // Récupère l'ID si on est en mode édition
  const isEditMode = Boolean(id);
  const navigate = useNavigate();
  
  const { genders, groups, loadingOptions } = useCustomerFormData();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<Omit<Customer, 'id' | 'date_add'>>({
    id_gender: '1',
    id_default_group: '3',
    firstname: '',
    lastname: '',
    email: '',
    birthday: '',
    active: true,
    passwd: '',
  });

  // 1. Chargement des données si mode ÉDITION
  useEffect(() => {
    if (isEditMode && id) {
      const fetchCustomer = async () => {
        try {
          setLoading(true);
          const customer = await customerService.getById(id);
          if (customer) {
            setFormData({
              id_gender: customer.id_gender,
              id_default_group: customer.id_default_group,
              firstname: customer.firstname,
              lastname: customer.lastname,
              email: customer.email,
              birthday: customer.birthday || '',
              active: customer.active,
              passwd: '', // On laisse vide par sécurité en édition
            });
          }
        } catch (err) {
          setError("Impossible de charger les données du client.");
        } finally {
          setLoading(false);
        }
      };
      fetchCustomer();
    }
  }, [isEditMode, id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let success;
      if (isEditMode && id) {
        // En mode édition, on n'envoie le mot de passe que s'il est rempli
        const updateData = { ...formData };
        if (!updateData.passwd) delete updateData.passwd; 
        
        success = await customerService.update(id, updateData);
      } else {
        success = await customerService.create(formData);
      }

      if (success) {
        alert(isEditMode ? 'Client mis à jour !' : 'Client créé !');
        navigate('/customers');
      } else {
        setError("L'opération a échoué. Vérifiez les champs.");
      }
    } catch (err) {
      setError("Une erreur est survenue lors de la communication avec l'API.");
    } finally {
      setLoading(false);
    }
  };

  if (loadingOptions || (isEditMode && loading)) return <div className="loading">Chargement...</div>;

  return (
    <div className="form-container">
      <div className="form-header">
        <h2>{isEditMode ? `Modifier le client #${id}` : 'Créer un nouveau client'}</h2>
        <button className="btn-back" onClick={() => navigate('/customers')}>Retour</button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <form onSubmit={handleSubmit} className="customer-form">
        <div className="form-grid">
          {/* Genre */}
          <div className="form-group">
            <label>Genre</label>
            <select name="id_gender" value={formData.id_gender} onChange={handleChange} required>
              <option value="">Sélectionnez...</option>
              {genders.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="firstname">Prénom *</label>
            <input id="firstname" name="firstname" type="text" required value={formData.firstname} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label htmlFor="lastname">Nom *</label>
            <input id="lastname" name="lastname" type="text" required value={formData.lastname} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label htmlFor="email">Adresse e-mail *</label>
            <input id="email" name="email" type="email" required value={formData.email} onChange={handleChange} />
          </div>

        {!isEditMode && (
  <div className="form-group">
    <label htmlFor="passwd">
      Mot de passe *
    </label>

    <input
      id="passwd"
      name="passwd"
      type="password"
      required
      minLength={5}
      value={formData.passwd}
      onChange={handleChange}
    />
  </div>
)}

          <div className="form-group">
            <label htmlFor="birthday">Date de naissance</label>
            <input id="birthday" name="birthday" type="date" value={formData.birthday} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label>Groupe par défaut</label>
            <select name="id_default_group" value={formData.id_default_group} onChange={handleChange} required>
              <option value="">Sélectionnez...</option>
              {groups.map(gr => <option key={gr.id} value={gr.id}>{gr.name}</option>)}
            </select>
          </div>

          <div className="form-group checkbox-group">
            <label>
              <input name="active" type="checkbox" checked={formData.active} onChange={handleChange} />
              Compte activé
            </label>
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-save" disabled={loading}>
            {loading ? 'Traitement...' : isEditMode ? 'Mettre à jour' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CustomerForm;