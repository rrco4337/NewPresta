// hooks/useFormValidation.ts
import { useState, useEffect } from 'react';

export interface ValidationRule {
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean;
  message: string;
}

export interface ValidationSchema {
  [key: string]: ValidationRule[];
}

export const productValidationSchema: ValidationSchema = {
  name: [
    { required: true, message: 'Le nom du produit est requis' },
    { minLength: 3, message: 'Le nom doit contenir au moins 3 caractères' },
    { maxLength: 128, message: 'Le nom ne peut pas dépasser 128 caractères' }
  ],
  reference: [
    { required: true, message: 'La référence est requise' }
  ],
  price: [
    { required: true, message: 'Le prix est requis' },
    { custom: (v) => v > 0, message: 'Le prix doit être supérieur à 0' }
  ],
  quantity: [
    { custom: (v) => v >= 0, message: 'La quantité ne peut pas être négative' }
  ],
  ean13: [
    { custom: (v) => !v || /^\d{13}$/.test(v), message: 'L\'EAN-13 doit contenir 13 chiffres' }
  ],
  meta_title: [
    { maxLength: 70, message: 'Le meta title ne doit pas dépasser 70 caractères' }
  ],
  meta_description: [
    { maxLength: 160, message: 'La meta description ne doit pas dépasser 160 caractères' }
  ]
};

export const useFormValidation = (data: any, schema: ValidationSchema) => {
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [touched, setTouched] = useState<{ [key: string]: boolean }>({});
  const [isValid, setIsValid] = useState(false);

  const validateField = (field: string, value: any): string => {
    const rules = schema[field];
    if (!rules) return '';

    for (const rule of rules) {
      if (rule.required && !value) return rule.message;
      if (rule.minLength && value?.length < rule.minLength) return rule.message;
      if (rule.maxLength && value?.length > rule.maxLength) return rule.message;
      if (rule.custom && !rule.custom(value)) return rule.message;
    }
    return '';
  };

  const validateAll = () => {
    const newErrors: { [key: string]: string } = {};
    Object.keys(schema).forEach(field => {
      const error = validateField(field, data[field]);
      if (error) newErrors[field] = error;
    });
    setErrors(newErrors);
    setIsValid(Object.keys(newErrors).length === 0);
    return newErrors;
  };

  const onTouch = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  useEffect(() => {
    validateAll();
  }, [data]);

  return { errors, touched, isValid, validateField, onTouch, validateAll };
};