
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
  SignupOptionsResponse,
  SignupPayload,
  UserProfile,
  UserRole,
} from '../types/contracts';

type RequestStatus = 'idle' | 'loading' | 'succeeded' | 'failed';

interface AuthState {
  token: string | null;
  user: UserProfile | null;
  isDemoMode: boolean;
  isInitializing: boolean;
  status: RequestStatus;
  error: string | null;
  signupFacilities: SignupOptionsResponse['facilities'];
  signupOptionsStatus: RequestStatus;
  signupOptionsError: string | null;
}

interface RestoreSessionError {
  message: string;
  clearToken: boolean;
}

const TOKEN_KEY = 'medmove_access_token';
const DEMO_SESSION_KEY = 'medmove_demo_session';

export const DEMO_USERS: Record<UserRole, UserProfile> = {
  HOSPITAL_USER: {
    user_id: 'demo-hospital',
    full_name: 'Demo Hospital User',
    email: 'hospital@medmove.demo',
    role: 'HOSPITAL_USER',
    facility_code: 'DEMO-HOSPITAL',
    facility_name: 'Demo Hospital',
  },
  NETWORK_COORDINATOR: {
    user_id: 'demo-coordinator',
    full_name: 'Demo Network Coordinator',
    email: 'coordinator@medmove.demo',
    role: 'NETWORK_COORDINATOR',
    facility_code: null,
    facility_name: null,
  },
};

const initialState: AuthState = {
  token: sessionStorage.getItem(TOKEN_KEY),
  user: null,
  isDemoMode: false,
  isInitializing: true,
  status: 'idle',
  error: null,
  signupFacilities: [],
  signupOptionsStatus: 'idle',
  signupOptionsError: null,
};

function persistCredentials(response: AuthResponse) {
  sessionStorage.setItem(TOKEN_KEY, response.access_token);
}

function clearPersistedCredentials() {
  sessionStorage.removeItem(TOKEN_KEY);
}

function persistDemoUser(user: UserProfile) {
  sessionStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(user));
}

function clearDemoSession() {
  sessionStorage.removeItem(DEMO_SESSION_KEY);
}

function getSavedDemoUser(): UserProfile | null {
  try {
    const raw = sessionStorage.getItem(DEMO_SESSION_KEY);

    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('user_id' in parsed) ||
      typeof parsed.user_id !== 'string' ||
      !('full_name' in parsed) ||
      typeof parsed.full_name !== 'string' ||
      !('email' in parsed) ||
      typeof parsed.email !== 'string' ||
      !('role' in parsed) ||
      (parsed.role !== 'HOSPITAL_USER' &&
        parsed.role !== 'NETWORK_COORDINATOR') ||
      !('facility_code' in parsed) ||
      !(typeof parsed.facility_code === 'string' ||
        parsed.facility_code === null) ||
      !('facility_name' in parsed) ||
      !(typeof parsed.facility_name === 'string' ||
        parsed.facility_name === null)
    ) {
      clearDemoSession();
      return null;
    }

    return parsed as UserProfile;
  } catch {
    clearDemoSession();
    return null;
  }
}

export function isDemoSessionActive(): boolean {
  return getSavedDemoUser() !== null;
}

// Demo login: does not call the backend or create a fake token.
export const demoLogin = createAsyncThunk(
  'auth/demoLogin',
  async (role: UserRole) => DEMO_USERS[role],
);

// Load facilities for signup.
export const signupOptionsThunk = createAsyncThunk<
  SignupOptionsResponse['facilities'],
  void,
  { rejectValue: string }
>(
  'auth/signupOptions',
  async (_, { rejectWithValue }) => {
    try {
      const response = await authApi.getSignupOptions();

      return Array.isArray(response.facilities)
        ? response.facilities
        : [];
    } catch (error) {
      return rejectWithValue(
        getErrorMessage(error, 'Unable to load facilities.'),
      );
    }
  },
);

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

// Real backend signup.
export const signupThunk = createAsyncThunk<
  AuthResponse,
  SignupPayload,
  { rejectValue: string }
>(
  'auth/signup',
  async (payload, { rejectWithValue }) => {
    try {
      return await authApi.signup(payload);
    } catch (error) {
      return rejectWithValue(
        getErrorMessage(error, 'Unable to create account.'),
      );
    }
  },
);

// Restore demo or real session after refresh.
export const restoreSessionThunk = createAsyncThunk<
  UserProfile | null,
  void,
  { rejectValue: RestoreSessionError }
>(
  'auth/restoreSession',
  async (_, { rejectWithValue }) => {
    const demoUser = getSavedDemoUser();

    if (demoUser) {
      clearPersistedCredentials();
      return demoUser;
    }

    const token = sessionStorage.getItem(TOKEN_KEY);

    if (!token) {
      return null;
    }

    try {
      const response = await authApi.getMe();
      return response.user;
    } catch (error) {
      const status = axios.isAxiosError(error)
        ? error.response?.status
        : undefined;

      const clearToken = status === 401;

      if (clearToken) {
        clearPersistedCredentials();
      }

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
      clearDemoSession();
      persistCredentials(action.payload);

      state.token = action.payload.access_token;
      state.user = action.payload.user;
      state.isDemoMode = false;
      state.status = 'succeeded';
      state.error = null;
      state.isInitializing = false;
    },

    logout(state) {
      clearPersistedCredentials();
      clearDemoSession();

      state.token = null;
      state.user = null;
      state.isDemoMode = false;
      state.status = 'idle';
      state.error = null;
      state.isInitializing = false;
    },

    clearAuthError(state) {
      state.error = null;
      state.signupOptionsError = null;
    },

    exitDemoMode(state) {
      clearDemoSession();

      state.token = null;
      state.user = null;
      state.isDemoMode = false;
      state.status = 'idle';
      state.error = null;
      state.isInitializing = false;
    },
  },

  extraReducers: (builder) => {
    builder
      // Demo login
      .addCase(demoLogin.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(demoLogin.fulfilled, (state, action) => {
        clearPersistedCredentials();
        persistDemoUser(action.payload);

        state.token = null;
        state.user = action.payload;
        state.isDemoMode = true;
        state.status = 'succeeded';
        state.error = null;
        state.isInitializing = false;
      })
      .addCase(demoLogin.rejected, (state) => {
        state.status = 'failed';
        state.error = 'Unable to start demo mode.';
        state.isInitializing = false;
      })

      // Signup facilities
      .addCase(signupOptionsThunk.pending, (state) => {
        state.signupOptionsStatus = 'loading';
        state.signupOptionsError = null;
      })
      .addCase(signupOptionsThunk.fulfilled, (state, action) => {
        state.signupOptionsStatus = 'succeeded';
        state.signupFacilities = action.payload;
        state.signupOptionsError = null;
      })
      .addCase(signupOptionsThunk.rejected, (state, action) => {
        state.signupOptionsStatus = 'failed';
        state.signupFacilities = [];
        state.signupOptionsError =
          action.payload ?? 'Unable to load facilities.';
      })

      // Real login
      .addCase(loginThunk.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(loginThunk.fulfilled, (state, action) => {
        clearDemoSession();
        persistCredentials(action.payload);

        state.token = action.payload.access_token;
        state.user = action.payload.user;
        state.isDemoMode = false;
        state.status = 'succeeded';
        state.error = null;
        state.isInitializing = false;
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload ?? 'Unable to sign in.';
      })

      // Real signup
      .addCase(signupThunk.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(signupThunk.fulfilled, (state, action) => {
        clearDemoSession();
        persistCredentials(action.payload);

        state.token = action.payload.access_token;
        state.user = action.payload.user;
        state.isDemoMode = false;
        state.status = 'succeeded';
        state.error = null;
        state.isInitializing = false;
      })
      .addCase(signupThunk.rejected, (state, action) => {
        state.status = 'failed';
        state.error =
          action.payload ?? 'Unable to create account.';
      })

      // Restore session
      .addCase(restoreSessionThunk.pending, (state) => {
        state.isInitializing = true;
      })
      .addCase(restoreSessionThunk.fulfilled, (state, action) => {
        const demoUser = getSavedDemoUser();

        state.user = action.payload;
        state.isDemoMode = Boolean(demoUser);

        state.token = state.isDemoMode
          ? null
          : action.payload
            ? sessionStorage.getItem(TOKEN_KEY)
            : null;

        state.isInitializing = false;
        state.error = null;
        state.status = action.payload ? 'succeeded' : 'idle';
      })
      .addCase(restoreSessionThunk.rejected, (state, action) => {
        const failure = action.payload;

        state.user = null;
        state.isDemoMode = false;
        state.isInitializing = false;
        state.status = 'idle';
        state.error =
          failure?.message ?? 'Unable to verify your session.';

        if (failure?.clearToken) {
          state.token = null;
          clearPersistedCredentials();
        } else {
          state.token = sessionStorage.getItem(TOKEN_KEY);
        }
      });
  },
});

export const {
  logout,
  clearAuthError,
  setCredentials,
  exitDemoMode,
} = authSlice.actions;

export default authSlice.reducer;
