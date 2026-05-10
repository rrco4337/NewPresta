import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { customerService, type Customer } from '../services/customerApi'; // Import du bon service

import { useAuth } from '../contexts/AuthContext';
import './CustomerList.css'; // Pensez à adapter le CSS

interface Filters {
  name: string;
  email: string;
  id_default_group: string;
  statusFilter: 'all' | 'active' | 'inactive';
}

const CustomerList: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState<Filters>({
    name: '',
    email: '',
    id_default_group: 'all',
    statusFilter: 'all',
  });

  const navigate = useNavigate();
  const { user, logout } = useAuth();

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const data = await customerService.getAll();
      setCustomers(data);
      setError(null);
    } catch (err) {
      setError('Erreur lors du chargement des clients');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Supprimer ce client ?")) {
      const success = await customerService.delete(id);
      if (success) loadCustomers();
      else alert("Erreur lors de la suppression");
    }
  };

  

  // Logique de filtrage
  const filteredCustomers = customers.filter(c => {
    const matchesName = `${c.firstname} ${c.lastname}`.toLowerCase().includes(filters.name.toLowerCase());
    const matchesEmail = c.email.toLowerCase().includes(filters.email.toLowerCase());
    const matchesStatus = filters.statusFilter === 'all' || 
      (filters.statusFilter === 'active' ? c.active : !c.active);
    const matchesGroup = filters.id_default_group === 'all' || c.id_default_group === filters.id_default_group;

    return matchesName && matchesEmail && matchesStatus && matchesGroup;
  });

  if (loading) return <div className="loading">Chargement...</div>;

  return (
    <div className="customer-list-container">
      <header className="list-header">
        <h1>Clients ({filteredCustomers.length})</h1>
        <div className="header-actions">
          <button onClick={() => navigate('/customers/add')} className="btn-add">➕ Nouveau Client</button>
          <button onClick={logout} className="btn-logout">Déconnexion</button>
        </div>
      </header>

      {/* Barre de recherche rapide */}
      <div className="search-section">
        <input 
          type="text" 
          placeholder="Rechercher par nom..." 
          value={filters.name}
          onChange={(e) => setFilters({...filters, name: e.target.value})}
        />
        <button onClick={() => setShowFilters(!showFilters)} className="btn-filter-toggle">
          {showFilters ? 'Fermer Filtres' : 'Filtres Avancés'}
        </button>
      </div>

      {showFilters && (
        <div className="filters-panel">
          <input 
            type="text" 
            placeholder="Email..." 
            value={filters.email}
            onChange={(e) => setFilters({...filters, email: e.target.value})}
          />
          <select value={filters.statusFilter} onChange={(e) => setFilters({...filters, statusFilter: e.target.value as any})}>
            <option value="all">Tous les statuts</option>
            <option value="active">Actifs</option>
            <option value="inactive">Inactifs</option>
          </select>
        </div>
      )}

      {/* Rendu en TABLEAU simple */}
      <div className="table-responsive">
        <table className="customer-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Genre</th>
              <th>Nom / Prénom</th>
              <th>Email</th>
              <th>Groupe</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.map((customer) => (
              <tr key={customer.id}>
                <td>{customer.id}</td>
                <td>{customer.id_gender === '1' ? 'M.' : 'Mme'}</td>
                <td className="name-cell">
                  <strong>{customer.lastname.toUpperCase()}</strong> {customer.firstname}
                </td>
                <td>{customer.email}</td>
                <td><span className="badge-group">Groupe {customer.id_default_group}</span></td>
                <td>
                  <span className={`status-dot ${customer.active ? 'active' : 'inactive'}`}></span>
                  {customer.active ? 'Actif' : 'Inactif'}
                </td>
                <td className="actions-cell">
                  <button onClick={() => navigate(`/customers/${customer.id}`)} title="Modifier">✏️</button>
                  <button onClick={() => handleDelete(customer.id)} title="Supprimer" className="btn-delete">🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredCustomers.length === 0 && <p className="no-data">Aucun client trouvé.</p>}
    </div>
  );
};

export default CustomerList;