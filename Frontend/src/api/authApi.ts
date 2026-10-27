// src/api/authApi.ts

import { httpClient } from './httpClient';
import type {
  AuthResponse,
  LoginPayload,
  UserProfile,
} from '../types/contracts';

export const authApi = {
  async login(payload: LoginPayload): Promise<AuthResponse> {
    const { data } = await httpClient.post<AuthResponse>(
      '/auth/login',
      {
        email: payload.email.trim().toLowerCase(),
        password: payload.password,
      },
    );

    return data;
  },

  async getMe(): Promise<{ user: UserProfile }> {
    const { data } = await httpClient.get<{ user: UserProfile }>(
      '/auth/me',
    );

    return data;
  },

  async logout(): Promise<void> {
    await httpClient.post('/auth/logout');
  },
};
