import axios from 'axios';

const API_BASE = '/api/prestashop'; // à adapter selon votre proxy

export const createProduct = (productData: any) => axios.post(`${API_BASE}/products`, productData);
export const createCombination = (combinationData: any) => axios.post(`${API_BASE}/combinations`, combinationData);
export const createCustomer = (customerData: any) => axios.post(`${API_BASE}/customers`, customerData);
export const createAddress = (addressData: any) => axios.post(`${API_BASE}/addresses`, addressData);
export const createOrder = (orderData: any) => axios.post(`${API_BASE}/orders`, orderData);
export const uploadProductImage = (reference: string, imageBlob: Blob) => {
  const formData = new FormData();
  formData.append('image', imageBlob);
  formData.append('reference', reference);
  return axios.post(`${API_BASE}/products/image`, formData);
};