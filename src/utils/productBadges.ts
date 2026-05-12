export type ProductBadge = 'HOT' | 'NEW';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const BADGE_RULES: Array<{ badge: ProductBadge; maxAgeMs: number }> = [
  { badge: 'HOT', maxAgeMs: DAY_MS },
  { badge: 'NEW', maxAgeMs: 7 * DAY_MS },
];

function parseLocalDateParts(value: string): Date | null {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const hour = Number(match[4] ?? '0');
  const minute = Number(match[5] ?? '0');
  const second = Number(match[6] ?? '0');
  const date = new Date(year, month, day, hour, minute, second);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseAvailabilityDate(value?: string | null): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('0000-00-00')) {
    console.log(`[parseAvailabilityDate] rejeté (0000-00-00) : "${trimmed}"`);
    return null;
  }

  const hasTimeZone = /z$|[+-]\d{2}:?\d{2}$/i.test(trimmed);
  if (hasTimeZone) {
    const parsed = new Date(trimmed);
    const result = Number.isNaN(parsed.getTime()) ? null : parsed;
    console.log(`[parseAvailabilityDate] timezone détecté : "${trimmed}" →`, result);
    return result;
  }

  const local = parseLocalDateParts(trimmed);
  if (local) {
    console.log(`[parseAvailabilityDate] local parts : "${trimmed}" →`, local.toISOString());
    return local;
  }

  const parsed = new Date(trimmed);
  const result = Number.isNaN(parsed.getTime()) ? null : parsed;
  console.log(`[parseAvailabilityDate] fallback Date() : "${trimmed}" →`, result?.toISOString() ?? 'null');
  return result;
}

export function getProductBadge(
  dateAvailability?: string | null,
  nowMs: number = Date.now()
): ProductBadge | null {
  const date = parseAvailabilityDate(dateAvailability);
  if (!date) return null;
  const ageMs = nowMs - date.getTime();
  const ageDays = (ageMs / (24 * 60 * 60 * 1000)).toFixed(2);
  console.log(`[getProductBadge] date="${dateAvailability}" | now=${new Date(nowMs).toISOString()} | âge=${ageDays}j`);
  if (ageMs < 0) {
    console.log(`[getProductBadge] → null (date dans le futur)`);
    return null;
  }

  for (const rule of BADGE_RULES) {
    if (ageMs < rule.maxAgeMs) {
      console.log(`[getProductBadge] → ${rule.badge}`);
      return rule.badge;
    }
  }

  console.log(`[getProductBadge] → null (trop ancien)`);
  return null;
}
