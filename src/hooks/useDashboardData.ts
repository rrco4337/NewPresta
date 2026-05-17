import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchDashboardData, type GlobalStats } from '../services/dashboardApi';

interface DateRange {
  dateFrom?: string;
  dateTo?: string;
}

interface UseDashboardDataReturn {
  data: GlobalStats | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useDashboardData(dateRange: DateRange, refreshInterval?: number): UseDashboardDataReturn {
  const [data, setData] = useState<GlobalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchDashboardData(dateRange.dateFrom, dateRange.dateTo);
      if (isMounted.current) {
        setData(result);
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [dateRange.dateFrom, dateRange.dateTo]);

  useEffect(() => {
    isMounted.current = true;
    load();
    return () => { isMounted.current = false; };
  }, [load]);

  useEffect(() => {
    if (!refreshInterval) return;
    const id = setInterval(load, refreshInterval);
    return () => clearInterval(id);
  }, [load, refreshInterval]);

  return { data, loading, error, refetch: load };
}
