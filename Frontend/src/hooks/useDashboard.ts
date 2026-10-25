import { useCallback } from 'react';
import { loadDashboardThunk } from '../store/dashboardSlice';
import { useAppDispatch } from './useAppDispatch';
import { useAppSelector } from './useAppSelector';

export function useDashboard() {
  const dispatch = useAppDispatch();
  const dashboard = useAppSelector((state) => state.dashboard);
  return { ...dashboard, loadDashboard: useCallback(() => dispatch(loadDashboardThunk()), [dispatch]) };
}
