// services/csvService.ts
import Papa from 'papaparse';

export interface CSVProductRow {
  name: string;
  reference: string;
  price: number;
  id_category_default: number;
  quantity: number;
  id_manufacturer: number;
  id_tax_rules_group: number;
  wholesale_price: number;
  minimal_quantity: number;
  width: number;
  height: number;
  depth: number;
  weight: number;
  additional_shipping_cost: number;
  description_short: string;
  description: string;
}

export interface ValidationError {
  row: number;
  column: string;
  message: string;
  value: string;
}

export const csvService = {
  // Parser le CSV en JSON
  parseCSV(file: File): Promise<{ data: CSVProductRow[]; errors: ValidationError[] }> {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        encoding: 'UTF-8',
        complete: (results) => {
          const rawData = results.data as any[];
          const errors: ValidationError[] = [];
          const validData: CSVProductRow[] = [];

          rawData.forEach((row, index) => {
            const rowNum = index + 2; // +2 car ligne 1 = header, ligne 2 = première donnée
            
            // Validation des champs obligatoires
            if (!row.name || row.name.trim() === '') {
              errors.push({ row: rowNum, column: 'name', message: 'Nom du produit requis', value: row.name });
            }
            if (!row.reference || row.reference.trim() === '') {
              errors.push({ row: rowNum, column: 'reference', message: 'Référence requise', value: row.reference });
            }
            if (!row.price || parseFloat(row.price) <= 0) {
              errors.push({ row: rowNum, column: 'price', message: 'Prix HT doit être > 0', value: row.price });
            }
            if (!row.id_category_default || parseInt(row.id_category_default) <= 0) {
              errors.push({ row: rowNum, column: 'id_category_default', message: 'Catégorie requise', value: row.id_category_default });
            }

            // Conversion des types
            const product: CSVProductRow = {
              name: row.name?.trim() || '',
              reference: row.reference?.trim() || '',
              price: parseFloat(row.price) || 0,
              id_category_default: parseInt(row.id_category_default) || 0,
              quantity: parseInt(row.quantity) || 0,
              id_manufacturer: parseInt(row.id_manufacturer) || 0,
              id_tax_rules_group: parseInt(row.id_tax_rules_group) || 1,
              wholesale_price: parseFloat(row.wholesale_price) || 0,
              minimal_quantity: parseInt(row.minimal_quantity) || 1,
              width: parseFloat(row.width) || 0,
              height: parseFloat(row.height) || 0,
              depth: parseFloat(row.depth) || 0,
              weight: parseFloat(row.weight) || 0,
              additional_shipping_cost: parseFloat(row.additional_shipping_cost) || 0,
              description_short: row.description_short?.trim() || '',
              description: row.description?.trim() || '',
            };

            validData.push(product);
          });

          resolve({ data: validData, errors });
        },
        error: (error) => {
          reject(error);
        }
      });
    });
  },

  // Générer un template CSV à télécharger
  getTemplate(): string {
    const headers = [
      'name',
      'reference', 
      'price',
      'id_category_default',
      'quantity',
      'id_manufacturer',
      'id_tax_rules_group',
      'wholesale_price',
      'minimal_quantity',
      'width',
      'height',
      'depth',
      'weight',
      'additional_shipping_cost',
      'description_short',
      'description'
    ].join(',');

    const exampleRow = [
      '"T-Shirt Blanc"',
      '"TSH-001"',
      '19.99',
      '2',
      '50',
      '1',
      '1',
      '10.00',
      '1',
      '30',
      '20',
      '5',
      '0.250',
      '0',
      '"T-shirt coton bio"',
      '"Description complète du produit"'
    ].join(',');

    return `${headers}\n${exampleRow}`;
  }
};