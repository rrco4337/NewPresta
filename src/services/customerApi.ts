import axios from 'axios';
import type { AxiosInstance } from 'axios';
import md5 from 'md5';

// ==========================================
// CONFIGURATION & INTERFACE
// ==========================================
const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080/api',
  params: {
    language: '1', // Force le Français (ID 1) pour tous les appels
  },
  headers: {
    'Content-Type': 'application/xml',
    'Accept': 'application/xml'
  }
 
});

export interface Customer {
  optin: string;
  newsletter: string;
  is_guest: string;
  id_shop_group: string;
  id_shop: string;
  id_lang: string;
  id: string;
  id_gender: string;
  id_default_group: string;
  firstname: string;
  lastname: string;
  email: string;
  birthday: string;
  active: boolean;
  date_add: string;
  passwd?: string;
  
}

// ==========================================
// UTILS: PARSER XML <-> JSON
// ==========================================
export function parseXMLToJSON(xmlString: string): any {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

  function parseNode(node: Element): any {
    if (node.children.length === 0) return node.textContent?.trim() ?? '';
    const obj: any = {};
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      const key = child.nodeName;
      const value = parseNode(child);
      if (obj[key] !== undefined) {
        if (!Array.isArray(obj[key])) obj[key] = [obj[key]];
        obj[key].push(value);
      } else {
        obj[key] = value;
      }
    }
    return obj;
  }
  return parseNode(xmlDoc.documentElement);
}

/**
 * Convertit un objet JS en XML simple pour PrestaShop
 * Nécessaire pour le POST (Create) et le PUT (Update)
 */
// Dans votre helper jsonToPrestaXML
function jsonToPrestaXML(data: Partial<Customer>): string {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
    <prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
      <customer>`;
  
  for (const [key, value] of Object.entries(data)) {
    if (key === 'id' || key === 'date_add') continue;
    
    // Gestion spécifique du mot de passe et de l'activation
    const xmlValue = key === 'active' ? (value ? '1' : '0') : value;
    
    xml += `<${key}><![CDATA[${xmlValue}]]></${key}>`;
  }

  xml += `</customer></prestashop>`;
  return xml;
}
// ==========================================
// SERVICE CLIENTS (CRUD)
// ==========================================
export const customerService = {

  // --- READ ALL ---
  async getAll(): Promise<Customer[]> {
    try {
      const response = await api.get('/customers?display=full&limit=100');
      const data = parseXMLToJSON(response.data);
      const customersRaw = data.customers?.customer || data.prestashop?.customers?.customer;
      
      if (!customersRaw) return [];
      const list = Array.isArray(customersRaw) ? customersRaw : [customersRaw];

      return list.map((c: any) => ({
        id: String(c.id),
        id_gender: String(c.id_gender),
        id_default_group: String(c.id_default_group),
        firstname: c.firstname,
        lastname: c.lastname,
        email: c.email,
        birthday: c.birthday,
        active: c.active === '1',
        date_add: c.date_add,

        // Champs supplémentaires pour la gestion interne
        id_lang: c.id_lang || '1',
        id_shop: c.id_shop || '1',
        id_shop_group: c.id_shop_group || '1',
        is_guest: c.is_guest || '0',
        newsletter: c.newsletter || '0',
        optin: c.optin || '0',
       
      }));
    
    
    } catch (error) {
      console.error('Erreur getAll Customers:', error);
      return [];
    }
  },

  // --- READ ONE ---
  async getById(id: string): Promise<Customer | null> {
    try {
      const response = await api.get(`/customers/${id}`);
      const data = parseXMLToJSON(response.data);
      const c = data.customer || data.prestashop?.customer;
      if (!c) return null;

      return {
        id: String(c.id),
        id_gender: String(c.id_gender),
        id_default_group: String(c.id_default_group),
        firstname: c.firstname,
        lastname: c.lastname,
        email: c.email,
        birthday: c.birthday,
        active: c.active === '1',
        date_add: c.date_add,

         // Champs supplémentaires pour la gestion interne
        id_lang: c.id_lang || '1',
        id_shop: c.id_shop || '1',
        id_shop_group: c.id_shop_group || '1',
        is_guest: c.is_guest || '0',
        newsletter: c.newsletter || '0',
        optin: c.optin || '0',

      };
    } catch (error) {
      console.error(`Erreur getById (${id}):`, error);
      return null;
    }
  },

  // --- CREATE ---
  async create(customerData: Omit<Customer, 'id' | 'date_add'>): Promise<boolean> {
    try {
      const xmlPayload = jsonToPrestaXML(customerData);
      await api.post('/customers', xmlPayload);
      return true;
    } catch (error) {
      console.error('Erreur création client:', error);
      return false;
    }
  },

  // --- UPDATE ---
 // Dans customerApi.ts
// --- UPDATE corrigé ---
// --- UPDATE corrigé (sans envoyer le passwd) ---
// --- UPDATE: Complete version ---
async update(id: string, data: Partial<Customer>): Promise<boolean> {
  try {
    // 1. Récupérer le client existant (AVANT modification)
    const existingCustomer = await this.getById(id);
    if (!existingCustomer) {
      console.error(`❌ Customer ${id} not found`);
      return false;
    }

    // 2. Déterminer le mot de passe
    let passwdValue = existingCustomer.passwd || md5(existingCustomer.email);
    if (data.passwd && data.passwd.trim() !== '') {
      passwdValue = md5(data.passwd);
    }

    // 3. Fusionner les données (en GARDANT les valeurs shop/lang)
    const mergedData = {
      id_gender: data.id_gender || existingCustomer.id_gender || '1',
      id_default_group: data.id_default_group || existingCustomer.id_default_group || '3',
      id_lang: existingCustomer.id_lang || '1',        // ⚠️ CRITICAL
      id_shop: existingCustomer.id_shop || '1',        // ⚠️ CRITICAL
      id_shop_group: existingCustomer.id_shop_group || '1', // ⚠️ CRITICAL
      firstname: data.firstname || existingCustomer.firstname,
      lastname: data.lastname || existingCustomer.lastname,
      email: data.email || existingCustomer.email,
      birthday: data.birthday || existingCustomer.birthday || '0000-00-00',
      active: data.active !== undefined ? data.active : existingCustomer.active,
      is_guest: existingCustomer.is_guest || '0',
      newsletter: existingCustomer.newsletter || '0',
      optin: existingCustomer.optin || '0'
    };

    // 4. Construire XML COMPLET (avec TOUS les champs)
    const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <customer>
    <id><![CDATA[${id}]]></id>
    <id_gender><![CDATA[${mergedData.id_gender}]]></id_gender>
    <id_default_group><![CDATA[${mergedData.id_default_group}]]></id_default_group>
    <id_lang><![CDATA[${mergedData.id_lang}]]></id_lang>
    <id_shop><![CDATA[${mergedData.id_shop}]]></id_shop>
    <id_shop_group><![CDATA[${mergedData.id_shop_group}]]></id_shop_group>
    <firstname><![CDATA[${mergedData.firstname}]]></firstname>
    <lastname><![CDATA[${mergedData.lastname}]]></lastname>
    <email><![CDATA[${mergedData.email}]]></email>
    <passwd><![CDATA[${passwdValue}]]></passwd>
    <birthday><![CDATA[${mergedData.birthday}]]></birthday>
    <active><![CDATA[${mergedData.active ? '1' : '0'}]]></active>
    <is_guest><![CDATA[${mergedData.is_guest}]]></is_guest>
    <newsletter><![CDATA[${mergedData.newsletter}]]></newsletter>
    <optin><![CDATA[${mergedData.optin}]]></optin>
  </customer>
</prestashop>`;

    console.log('📤 Mise à jour complète - ID Shop:', mergedData.id_shop);
    await api.put(`/customers/${id}`, xmlPayload);
    console.log(`✅ Customer ${id} updated successfully`);
    return true;
  } catch (error: any) {
    console.error('❌ Update failed:', error.response?.data);
    return false;
  }
},
  // --- DELETE ---
  async delete(id: string): Promise<boolean> {
    try {
      await api.delete(`/customers/${id}`);
      return true;
    } catch (error) {
      console.error(`Erreur delete (${id}):`, error);
      return false;
    }
  }
};