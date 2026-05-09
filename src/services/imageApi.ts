// services/prestashopApi.ts
import axios from 'axios';
import type { AxiosInstance } from 'axios';

const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080/api',
  headers: {
    'Content-Type': 'application/xml',
    'Accept': 'application/xml'
  }
});

// Parser XML (réutilisable)
export function parseXMLToJSON(xmlString: string): any {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

  function parseNode(node: Element): any {
    if (node.children.length === 0) return node.textContent ?? '';
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


// ==========================================
// API IMAGES
// ==========================================
export const imageService = {
  async upload(productId: string, imageFile: File): Promise<boolean> {
    const formData = new FormData();
    formData.append('image', imageFile);
    
    try {
      await api.post(`/images/products/${productId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return true;
    } catch (error) {
      console.error('Erreur upload image:', error);
      return false;
    }
  },

  async uploadMultiple(productId: string, images: File[]): Promise<boolean[]> {
    return Promise.all(images.map(img => this.upload(productId, img)));
  }
};