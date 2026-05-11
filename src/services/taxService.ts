import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: { 'Content-Type': 'application/xml', 'Accept': 'application/xml' },
});

type TaxRule = { groupId: number; taxId: number };

const DEFAULT_COUNTRY_ID = 8;
const DEFAULT_STATE_ID = 0;
const DEFAULT_ZIP_FROM = 0;
const DEFAULT_ZIP_TO = 0;
const DEFAULT_BEHAVIOR = 0;

const taxCache = {
  loaded: false,
  groupRate: new Map<number, number>(),
  rateGroup: new Map<string, number>(),
};

function rateKey(ratePercent: number): string {
  return ratePercent.toFixed(3);
}

function parseTaxRules(xml: string): TaxRule[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const rules: TaxRule[] = [];
  doc.querySelectorAll('tax_rule').forEach((el) => {
    const groupId = parseInt(el.querySelector('id_tax_rules_group')?.textContent ?? '0', 10);
    const taxId = parseInt(el.querySelector('id_tax')?.textContent ?? '0', 10);
    if (groupId && taxId) rules.push({ groupId, taxId });
  });
  return rules;
}

function parseTaxes(xml: string): Map<number, number> {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const map = new Map<number, number>();
  doc.querySelectorAll('tax').forEach((el) => {
    const id = parseInt(el.querySelector('id')?.textContent ?? '0', 10);
    const rate = parseFloat(el.querySelector('rate')?.textContent ?? '0');
    if (id) map.set(id, rate);
  });
  return map;
}

function parseCreatedId(xml: string): number | null {
  try {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const id = doc.querySelector('id')?.textContent?.trim();
    if (!id) return null;
    const parsed = parseInt(id, 10);
    return Number.isNaN(parsed) ? null : parsed;
  } catch {
    return null;
  }
}

async function createTax(ratePercent: number): Promise<number> {
  const label = `Auto ${ratePercent.toFixed(3)}%`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <tax>
    <rate><![CDATA[${ratePercent.toFixed(3)}]]></rate>
    <active><![CDATA[1]]></active>
    <name><language id="1"><![CDATA[${label}]]></language></name>
  </tax>
</prestashop>`;
  const res = await api.post('/taxes', xml);
  const id = parseCreatedId(res.data);
  if (!id) throw new Error('Creation taxe: ID manquant');
  return id;
}

async function createTaxRuleGroup(ratePercent: number): Promise<number> {
  const label = `Auto ${ratePercent.toFixed(3)}%`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <tax_rule_group>
    <name><![CDATA[${label}]]></name>
    <active><![CDATA[1]]></active>
  </tax_rule_group>
</prestashop>`;
  const res = await api.post('/tax_rule_groups', xml);
  const id = parseCreatedId(res.data);
  if (!id) throw new Error('Creation groupe de taxe: ID manquant');
  return id;
}

async function createTaxRule(groupId: number, taxId: number): Promise<number> {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <tax_rule>
    <id_tax_rules_group><![CDATA[${groupId}]]></id_tax_rules_group>
    <id_country><![CDATA[${DEFAULT_COUNTRY_ID}]]></id_country>
    <id_state><![CDATA[${DEFAULT_STATE_ID}]]></id_state>
    <zipcode_from><![CDATA[${DEFAULT_ZIP_FROM}]]></zipcode_from>
    <zipcode_to><![CDATA[${DEFAULT_ZIP_TO}]]></zipcode_to>
    <id_tax><![CDATA[${taxId}]]></id_tax>
    <behavior><![CDATA[${DEFAULT_BEHAVIOR}]]></behavior>
    <description><![CDATA[Auto tax rule]]></description>
  </tax_rule>
</prestashop>`;
  const res = await api.post('/tax_rules', xml);
  const id = parseCreatedId(res.data);
  if (!id) throw new Error('Creation regle de taxe: ID manquant');
  return id;
}

async function loadTaxCaches(): Promise<void> {
  if (taxCache.loaded) return;
  const [taxRulesRes, taxesRes] = await Promise.all([
    api.get('/tax_rules?display=[id_tax,id_tax_rules_group]'),
    api.get('/taxes?display=[id,rate]'),
  ]);

  const rules = parseTaxRules(taxRulesRes.data);
  const taxRates = parseTaxes(taxesRes.data);

  for (const rule of rules) {
    if (taxCache.groupRate.has(rule.groupId)) continue;
    const ratePercent = taxRates.get(rule.taxId);
    if (ratePercent == null) continue;
    taxCache.groupRate.set(rule.groupId, ratePercent);
    const key = rateKey(ratePercent);
    if (!taxCache.rateGroup.has(key)) {
      taxCache.rateGroup.set(key, rule.groupId);
    }
  }

  taxCache.loaded = true;
}

export async function getTaxRateByGroup(groupId: number): Promise<number> {
  if (!groupId) return 0;
  try {
    await loadTaxCaches();
  } catch {
    return 0;
  }
  const ratePercent = taxCache.groupRate.get(groupId) ?? 0;
  return ratePercent / 100;
}

export async function resolveTaxRulesGroupIdByRate(rate: number): Promise<number | null> {
  try {
    await loadTaxCaches();
  } catch (err) {
    console.error('Failed to load tax rules for rate lookup', err);
    return null;
  }
  const percent = Math.max(0, rate * 100);
  const key = rateKey(percent);
  const groupId = taxCache.rateGroup.get(key) ?? null;
  if (!groupId) {
    console.error('No tax group found for rate', {
      rate: percent,
      availableRates: Array.from(taxCache.rateGroup.keys()),
    });
  }
  return groupId;
}

export async function ensureTaxRulesGroupIdByRate(rate: number): Promise<number | null> {
  const existing = await resolveTaxRulesGroupIdByRate(rate);
  if (existing) return existing;

  const ratePercent = Math.max(0, rate * 100);
  try {
    console.log('Creating tax group for rate', ratePercent);
    const [taxId, groupId] = await Promise.all([
      createTax(ratePercent),
      createTaxRuleGroup(ratePercent),
    ]);
    await createTaxRule(groupId, taxId);
    taxCache.groupRate.set(groupId, ratePercent);
    taxCache.rateGroup.set(rateKey(ratePercent), groupId);
    return groupId;
  } catch (err) {
    console.error('Failed to auto-create tax group', {
      rate: ratePercent,
      error: err,
    });
    return null;
  }
}
