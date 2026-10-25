// src/api/authApi.ts

import { httpClient } from './httpClient';
import type {
  AuthResponse,
  LoginPayload,
  SignupOptionsResponse,
  SignupPayload,
  UserProfile,
} from '../types/contracts';

export const authApi = {
  async getSignupOptions(): Promise<SignupOptionsResponse> {
    const { data } =
      await httpClient.get<SignupOptionsResponse>('/auth/signup-options');

    return data;
  },

  async signup(payload: SignupPayload): Promise<AuthResponse> {
    const { data } = await httpClient.post<AuthResponse>(
      '/auth/signup',
      {
        ...payload,
        full_name: payload.full_name.trim(),
        email: payload.email.trim().toLowerCase(),
      },
    );

    return data;
  },

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
};