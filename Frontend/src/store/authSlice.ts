
import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from '@reduxjs/toolkit';
import axios from 'axios';

import { authApi } from '../api/authApi';
import { getErrorMessage } from '../utils/errors';

import type {
  AuthResponse,
  LoginPayload,
  UserProfile,
} from '../types/contracts';

type RequestStatus = 'idle' | 'loading' | 'succeeded' | 'failed';

interface AuthState {
  token: null;
  user: UserProfile | null;
  isInitializing: boolean;
  status: RequestStatus;
  error: string | null;
}

interface RestoreSessionError {
  message: string;
  clearToken: boolean;
}

const initialState: AuthState = {
  token: null,
  user: null,
  isInitializing: true,
  status: 'idle',
  error: null,
};

// Real backend login.
export const loginThunk = createAsyncThunk<
  AuthResponse,
  LoginPayload,
  { rejectValue: string }
>(
  'auth/login',
  async (payload, { rejectWithValue }) => {
    try {
      return await authApi.login(payload);
    } catch (error) {
      return rejectWithValue(
        getErrorMessage(error, 'Unable to sign in.'),
      );
    }
  },
);

export const logoutThunk = createAsyncThunk(
  'auth/logout',
  async (_, { dispatch }) => {
    try {
      await authApi.logout();
    } finally {
      dispatch(logout());
    }
  },
);

// Restore real session after refresh via HttpOnly cookie.
export const restoreSessionThunk = createAsyncThunk<
  UserProfile | null,
  void,
  { rejectValue: RestoreSessionError }
>(
  'auth/restoreSession',
  async (_, { rejectWithValue }) => {
    try {
      const response = await authApi.getMe();
      return response.user;
    } catch (error) {
      const status = axios.isAxiosError(error)
        ? error.response?.status
        : undefined;

      const clearToken = status === 401;

      return rejectWithValue({
        message: getErrorMessage(
          error,
          'Unable to verify your session.',
        ),
        clearToken,
      });
    }
  },
);

const authSlice = createSlice({
  name: 'auth',
  initialState,

  reducers: {
    setCredentials(state, action: PayloadAction<AuthResponse>) {
      state.token = null;
      state.user = action.payload.user;
      state.status = 'succeeded';
      state.error = null;
      state.isInitializing = false;
    },

    logout(state) {
      state.token = null;
      state.user = null;
      state.status = 'idle';
      state.error = null;
      state.isInitializing = false;
    },

    clearAuthError(state) {
      state.error = null;
    },
  },

  extraReducers: (builder) => {
    builder
      // Real login
      .addCase(loginThunk.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.token = null;
        state.user = action.payload.user;
        state.status = 'succeeded';
        state.error = null;
        state.isInitializing = false;
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload ?? 'Unable to sign in.';
      })

      // Restore session
      .addCase(restoreSessionThunk.pending, (state) => {
        state.isInitializing = true;
      })
      .addCase(restoreSessionThunk.fulfilled, (state, action) => {
        state.user = action.payload;
        state.token = null;
        state.isInitializing = false;
        state.error = null;
        state.status = action.payload ? 'succeeded' : 'idle';
      })
      .addCase(restoreSessionThunk.rejected, (state, action) => {
        const failure = action.payload;

        state.user = null;
        state.isInitializing = false;
        state.status = 'idle';
        // A 401 from /auth/me is the normal unauthenticated state during
        // initial session checking, not a login-form error. Only surface
        // session-restoration errors for genuine failures (network, server).
        state.error = failure?.clearToken
          ? null
          : (failure?.message ?? 'Unable to verify your session.');
        state.token = null;
      });
  },
});

export const {
  logout,
  clearAuthError,
  setCredentials,
} = authSlice.actions;

export default authSlice.reducer;
