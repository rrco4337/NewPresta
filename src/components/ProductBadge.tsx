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
}

const ProductBadge: React.FC<ProductBadgeProps> = ({ dateAvailability, className }) => {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!dateAvailability) return;
    return subscribe(setNowMs);
  }, [dateAvailability]);

  const badge = useMemo(
    () => getProductBadge(dateAvailability, nowMs),
    [dateAvailability, nowMs]
  );

  if (!badge) return null;

  const badgeClass = `availability-badge availability-badge--${badge.toLowerCase()}`;
  return (
    <span className={[badgeClass, className].filter(Boolean).join(' ')}>
      {badge}
    </span>
  );
};

export default memo(ProductBadge);
