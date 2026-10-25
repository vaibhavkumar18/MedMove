
import { useCallback } from 'react';

import { useAppDispatch } from './useAppDispatch';
import { useAppSelector } from './useAppSelector';

import {
  clearAuthError,
  demoLogin,
  loginThunk,
  logout,
  restoreSessionThunk,
  signupThunk,
  signupOptionsThunk,
} from '../store/authSlice';

import type { UserRole } from '../types/contracts';

export function useAuth() {
  const dispatch = useAppDispatch();
  const auth = useAppSelector((state) => state.auth);

  const login = useCallback(
    (payload: Parameters<typeof loginThunk>[0]) =>
      dispatch(loginThunk(payload)).unwrap(),
    [dispatch],
  );

  const signup = useCallback(
    (payload: Parameters<typeof signupThunk>[0]) =>
      dispatch(signupThunk(payload)).unwrap(),
    [dispatch],
  );

  const loginDemo = useCallback(
    (role: UserRole) => dispatch(demoLogin(role)).unwrap(),
    [dispatch],
  );

  const loadSignupOptions = useCallback(
    () => dispatch(signupOptionsThunk()),
    [dispatch],
  );

  const restoreSession = useCallback(
    () => dispatch(restoreSessionThunk()),
    [dispatch],
  );

  const logoutUser = useCallback(
    () => dispatch(logout()),
    [dispatch],
  );

  const clearError = useCallback(
    () => dispatch(clearAuthError()),
    [dispatch],
  );

  return {
    ...auth,
    signupFacilities: auth.signupFacilities ?? [],
    signupOptionsStatus: auth.signupOptionsStatus ?? 'idle',
    login,
    signup,
    loginDemo,
    loadSignupOptions,
    restoreSession,
    logout: logoutUser,
    clearError,
  };
}
