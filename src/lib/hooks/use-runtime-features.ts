import { useEffect, useState } from 'react';
import { getRuntimeConfig, loadRuntimeConfig } from '@/lib/config/runtime';

interface RuntimeFeatures {
  enableWorkflows: boolean;
  enableSchedules: boolean;
  loaded: boolean;
}

export function useRuntimeFeatures(): RuntimeFeatures {
  const [features, setFeatures] = useState<RuntimeFeatures>(() => {
    const config = getRuntimeConfig();
    return {
      enableWorkflows: config.enableWorkflows ?? true,
      enableSchedules: config.enableSchedules ?? true,
      loaded: false,
    };
  });

  useEffect(() => {
    let cancelled = false;

    loadRuntimeConfig()
      .then((config) => {
        if (cancelled) return;
        setFeatures({
          enableWorkflows: config.enableWorkflows ?? true,
          enableSchedules: config.enableSchedules ?? true,
          loaded: true,
        });
      })
      .catch(() => {
        // /api/config failed on a hosted origin: keep the default feature flags.
        // RuntimeConfigBootstrap already reports the failure to the user.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return features;
}
