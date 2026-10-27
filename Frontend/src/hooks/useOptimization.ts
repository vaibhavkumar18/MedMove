import { useCallback } from 'react';
import { loadLatestRunThunk, runOptimizationThunk } from '../store/optimizationSlice';
import { useAppDispatch } from './useAppDispatch';
import { useAppSelector } from './useAppSelector';

export function useOptimization() {
  const dispatch = useAppDispatch();
  const optimization = useAppSelector((state) => state.optimization);
  return {
    ...optimization,
    refreshLatestRun: useCallback(() => dispatch(loadLatestRunThunk()), [dispatch]),
    runOptimization: useCallback((payload: Parameters<typeof runOptimizationThunk>[0]) => dispatch(runOptimizationThunk(payload)).unwrap(), [dispatch]),
  };
}
