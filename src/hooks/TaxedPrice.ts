// hooks/usePriceCalculation.ts
import { useState, useEffect, useCallback } from 'react';

interface PriceCalculationProps {
  priceHT: number;
  taxRate: number;
  ecoTax?: number;
  discount?: number;
}

interface PriceResult {
  priceHT: number;
  taxAmount: number;
  priceTTC: number;
  priceWithEcoTax: number;
  priceWithDiscount: number;
}

export const usePriceCalculation = (initialPriceHT: number = 0, initialTaxRate: number = 20) => {
  const [priceHT, setPriceHT] = useState(initialPriceHT);
  const [taxRate, setTaxRate] = useState(initialTaxRate);
  const [ecoTax, setEcoTax] = useState(0);
  const [discount, setDiscount] = useState(0);

  const calculate = useCallback((): PriceResult => {
    const taxAmount = priceHT * (taxRate / 100);
    const priceTTC = priceHT + taxAmount;
    const priceWithEcoTax = priceTTC + ecoTax;
    const priceWithDiscount = priceWithEcoTax * (1 - discount / 100);

    return {
      priceHT: parseFloat(priceHT.toFixed(2)),
      taxAmount: parseFloat(taxAmount.toFixed(2)),
      priceTTC: parseFloat(priceTTC.toFixed(2)),
      priceWithEcoTax: parseFloat(priceWithEcoTax.toFixed(2)),
      priceWithDiscount: parseFloat(priceWithDiscount.toFixed(2))
    };
  }, [priceHT, taxRate, ecoTax, discount]);

  const [result, setResult] = useState<PriceResult>(calculate());

  useEffect(() => {
    setResult(calculate());
  }, [calculate]);

  return {
    priceHT,
    setPriceHT,
    taxRate,
    setTaxRate,
    ecoTax,
    setEcoTax,
    discount,
    setDiscount,
    result
  };
};