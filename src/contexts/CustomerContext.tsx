import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Customer } from '../services/customerService';

interface CustomerContextType {
  customer: Customer | null;
  setCustomer: (c: Customer | null) => void;
  logout: () => void;
}

const CustomerContext = createContext<CustomerContextType | null>(null);

const STORAGE_KEY = 'ps_shop_customer';

export const CustomerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [customer, setCustomerState] = useState<Customer | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Customer) : null;
    } catch { return null; }
  });

  useEffect(() => {
    if (customer) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(customer));
      // Store secure_key in sessionStorage for quick access by cart sync
      if (customer.secureKey) {
        sessionStorage.setItem('customerSecureKey', customer.secureKey);
      }
    } else {
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem('customerSecureKey');
    }
  }, [customer]);

  const logout = () => setCustomerState(null);

  return (
    <CustomerContext.Provider value={{ customer, setCustomer: setCustomerState, logout }}>
      {children}
    </CustomerContext.Provider>
  );
};

export function useCustomer(): CustomerContextType {
  const ctx = useContext(CustomerContext);
  if (!ctx) throw new Error('useCustomer must be used inside CustomerProvider');
  return ctx;
}
