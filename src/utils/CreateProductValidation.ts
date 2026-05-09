// utils/formValidation.ts
export interface ValidationErrors {
  [key: string]: string;
}

export const validateProduct = (data: any): ValidationErrors => {
  const errors: ValidationErrors = {};

  // Nom
  if (!data.name || data.name.trim().length < 3) {
    errors.name = 'Le nom doit contenir au moins 3 caractères';
  }

  // Prix
  if (data.price <= 0) {
    errors.price = 'Le prix doit être supérieur à 0';
  }

  // Référence
  if (!data.reference || data.reference.trim() === '') {
    errors.reference = 'La référence est obligatoire';
  }

  // Catégorie
  if (!data.id_category_default || data.id_category_default <= 0) {
    errors.id_category_default = 'Veuillez sélectionner une catégorie';
  }

  // Quantité
  if (data.quantity < 0) {
    errors.quantity = 'La quantité ne peut pas être négative';
  }

  // Dimensions
  if (data.weight < 0) errors.weight = 'Le poids ne peut pas être négatif';
  if (data.width < 0) errors.width = 'La largeur ne peut pas être négative';
  if (data.height < 0) errors.height = 'La hauteur ne peut pas être négative';
  if (data.depth < 0) errors.depth = 'La profondeur ne peut pas être négative';

  // SEO
  if (data.meta_title && data.meta_title.length > 70) {
    errors.meta_title = 'Le meta title ne doit pas dépasser 70 caractères';
  }
  if (data.meta_description && data.meta_description.length > 160) {
    errors.meta_description = 'La meta description ne doit pas dépasser 160 caractères';
  }

  return errors;
};

export const slugify = (text: string): string => {
  if (!text) return 'produit-sans-nom';
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 128);
};