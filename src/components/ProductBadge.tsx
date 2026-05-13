import React, { memo, useEffect, useMemo, useState } from 'react';
import { getProductBadge } from '../utils/productBadges';
import './ProductBadge.css';

const REFRESH_MS = 60_000;
const listeners = new Set<(now: number) => void>();
let timerId: number | null = null;

function startTimer() {
  if (timerId !== null) return;
  timerId = window.setInterval(() => {
    const now = Date.now();
    listeners.forEach((listener) => listener(now));
  }, REFRESH_MS);
}

function stopTimer() {
  if (timerId === null) return;
  if (listeners.size > 0) return;
  window.clearInterval(timerId);
  timerId = null;
}

function subscribe(listener: (now: number) => void) {
  listeners.add(listener);
  startTimer();
  return () => {
    listeners.delete(listener);
    stopTimer();
  };
}

interface ProductBadgeProps {
  dateAvailability?: string | null;
  className?: string;
  nowMs?: number;
}

const ProductBadge: React.FC<ProductBadgeProps> = ({ dateAvailability, className, nowMs: nowMsProp }) => {
  const [nowMsInternal, setNowMs] = useState(() => Date.now());
  const nowMs = nowMsProp ?? nowMsInternal;

  useEffect(() => {
    if (!dateAvailability || nowMsProp !== undefined) return;
    return subscribe(setNowMs);
  }, [dateAvailability, nowMsProp]);

  const badge = useMemo(
    () => getProductBadge(dateAvailability, nowMs),
    [dateAvailability, nowMs]
  );

  if (!badge) return null;

  const badgeClass = `availability-badge availability-badge--${badge.toLowerCase()}`;
  const label = badge === 'HOT' ? '🔥 HOT' : '✨ NEW';
  return (
    <span className={[badgeClass, className].filter(Boolean).join(' ')}>
      {label}
    </span>
  );
};

export default memo(ProductBadge);
