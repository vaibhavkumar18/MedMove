
import { useCallback } from 'react';

import { useAppDispatch } from './useAppDispatch';
import { useAppSelector } from './useAppSelector';

import {
  clearAuthError,
  loginThunk,
  logoutThunk,
  restoreSessionThunk,
} from '../store/authSlice';

import type { LoginPayload } from '../types/contracts';

export function useAuth() {
  const dispatch = useAppDispatch();
  const auth = useAppSelector((state) => state.auth);

  const login = useCallback(
    (payload: LoginPayload) =>
      dispatch(loginThunk(payload)).unwrap(),
    [dispatch],
  );

  const restoreSession = useCallback(
    () => dispatch(restoreSessionThunk()),
    [dispatch],
  );

  const logoutUser = useCallback(
    () => dispatch(logoutThunk()),
    [dispatch],
  );

  const clearError = useCallback(
    () => dispatch(clearAuthError()),
    [dispatch],
  );

  return {
    ...auth,
    login,
    restoreSession,
    logout: logoutUser,
    clearError,
  };
}
