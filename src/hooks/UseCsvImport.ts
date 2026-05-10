// hooks/useCSVImport.ts
import { useState } from 'react';
import { productService, type Product } from '../services/produitApi';
import { type CSVProductRow, csvService, type ValidationError } from '../services/CSVservice';
import { imageService } from '../services/imageApi';

export const useCSVImport = () => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [successCount, setSuccessCount] = useState(0);
  const [skipCount, setSkipCount] = useState(0);

  // Vérifier si une catégorie existe
  const checkCategoryExists = async (categoryId: number, existingCategories: any[]): Promise<boolean> => {
    return existingCategories.some(cat => cat.id === categoryId.toString());
  };

  // Vérifier si une marque existe
  const checkManufacturerExists = async (manufacturerId: number, existingManufacturers: any[]): Promise<boolean> => {
    if (manufacturerId === 0) return true; // 0 = pas de marque
    return existingManufacturers.some(man => man.id === manufacturerId.toString());
  };

  // Vérifier si la référence existe déjà
  const checkReferenceExists = async (reference: string, existingProducts: Product[]): Promise<boolean> => {
    return existingProducts.some(p => p.reference === reference);
  };

  // Importer les produits
  const importProducts = async (
    products: CSVProductRow[],
    categories: any[],
    manufacturers: any[],
    existingProducts: Product[]
  ): Promise<{ success: number; skipped: number; errors: ValidationError[] }> => {
    
    setLoading(true);
    setProgress(0);
    setErrors([]);
    setSuccessCount(0);
    setSkipCount(0);

    const importErrors: ValidationError[] = [];
    let imported = 0;
    let skipped = 0;

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      
      try {
        // 1. Vérifier catégorie
        const categoryExists = await checkCategoryExists(product.id_category_default, categories);
        if (!categoryExists) {
          importErrors.push({
            row: i + 2,
            column: 'id_category_default',
            message: `Catégorie ${product.id_category_default} n'existe pas`,
            value: product.id_category_default.toString()
          });
          continue;
        }

        // 2. Vérifier marque
        const manufacturerExists = await checkManufacturerExists(product.id_manufacturer, manufacturers);
        if (!manufacturerExists) {
          importErrors.push({
            row: i + 2,
            column: 'id_manufacturer',
            message: `Marque ${product.id_manufacturer} n'existe pas`,
            value: product.id_manufacturer.toString()
          });
          continue;
        }

        // 3. Vérifier référence dupliquée
        const referenceExists = await checkReferenceExists(product.reference, existingProducts);
        if (referenceExists) {
          skipped++;
          setSkipCount(skipped);
          continue; // Ignorer cette ligne
        }

        // 4. Créer le produit via l'API existante
        const productData = {
          name: product.name,
          reference: product.reference,
          price: product.price,
          id_category_default: product.id_category_default,
          id_manufacturer: product.id_manufacturer,
          id_tax_rules_group: product.id_tax_rules_group,
          wholesale_price: product.wholesale_price,
          minimal_quantity: product.minimal_quantity,
          width: product.width,
          height: product.height,
          depth: product.depth,
          weight: product.weight,
          additional_shipping_cost: product.additional_shipping_cost,
          description_short: product.description_short,
          description: product.description,
          active: true,
          visibility: 'both' as const,
          available_for_order: true,
          show_price: true,
          condition: 'new' as const,
        };

        const createdProduct = await productService.create(productData);

        // 5. Mettre à jour le stock
        if (createdProduct && product.quantity > 0) {
          await productService.updateStock(createdProduct.id, product.quantity);
        }

        imported++;
        setSuccessCount(imported);
        
      } catch (error) {
        importErrors.push({
          row: i + 2,
          column: 'general',
          message: `Erreur création: ${error}`,
          value: product.reference
        });
      }

      // Mise à jour progression
      setProgress(Math.round(((i + 1) / products.length) * 100));
    }

    setErrors(importErrors);
    setLoading(false);

    return { 
      success: imported, 
      skipped: skipped, 
      errors: importErrors 
    };
  };

  return {
    importProducts,
    loading,
    progress,
    errors,
    successCount,
    skipCount
  };
};