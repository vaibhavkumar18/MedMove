
import {
  Building2,
  LockKeyhole,
  Mail,
  Network,
  ShieldCheck,
  X,
} from 'lucide-react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useState, type FormEvent } from 'react';

import { useAuth } from '../hooks/useAuth';
import type { LoginPayload, UserRole } from '../types/contracts';

const DEMO_ACCOUNTS: Array<{
  label: string;
  description: string;
  role: UserRole;
}> = [
  {
    label: 'Hospital Demo',
    description: 'Open the hospital dashboard',
    role: 'HOSPITAL_USER',
  },
  {
    label: 'Network Coordinator Demo',
    description: 'Open the network dashboard',
    role: 'NETWORK_COORDINATOR',
  },
];

function getDestination(role: UserRole) {
  return role === 'NETWORK_COORDINATOR' ? '/network' : '/dashboard';
}

export default function LoginPage() {
  const {
    user,
    login,
    loginDemo,
    status,
    error,
    clearError,
  } = useAuth();

  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const isLoading = status === 'loading';

  if (user) {
    return <Navigate to={getDestination(user.role)} replace />;
  }

  async function signIn(payload: LoginPayload) {
    clearError();

    try {
      const response = await login(payload);
      navigate(getDestination(response.user.role), { replace: true });
    } catch {
      // Redux stores the readable error.
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await signIn({ email: email.trim(), password });
  }

  async function handleDemoLogin(
    account: (typeof DEMO_ACCOUNTS)[number],
  ) {
    clearError();

    try {
      await loginDemo(account.role);
      navigate(getDestination(account.role), { replace: true });
    } catch {
      // Demo login errors are stored in Redux.
    }
  }

  return (
    <main className="relative h-screen w-full overflow-hidden bg-[#f3efe6] font-sans text-[#193632]">
      {/* Split-panel backgrounds */}
      <div className="absolute inset-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(480px,0.88fr)]">
        <div className="hidden bg-[#1f625d] lg:block" />
        <div className="bg-[#f3efe6]" />
      </div>

      {/* Decorative circle shared across both panels */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-7rem] left-[calc(53.2%-12rem)] z-[1] hidden h-96 w-96 rounded-full border-2 border-white/10 lg:block"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-7rem] left-[calc(53.2%-12rem)] z-[1] hidden h-96 w-96 rounded-full bg-[#2d756b]/70 lg:block"
        style={{ clipPath: 'inset(0 50% 0 0)' }}
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-7rem] left-[calc(53.2%-12rem)] z-[1] hidden h-96 w-96 rounded-full bg-[#dce5da]/85 lg:block"
        style={{ clipPath: 'inset(0 0 0 50%)' }}
      />

      <div className="relative z-10 grid h-full w-full grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(480px,0.88fr)]">
        {/* Left branding panel */}
        <section className="relative hidden min-h-0 flex-col justify-between overflow-hidden px-8 py-6 text-[#f8f5ed] lg:flex xl:px-12 xl:py-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-32 top-24 h-96 w-96 rounded-full border border-white/10"
          />

          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-12 top-40 h-64 w-64 rounded-full border border-white/10"
          />

          <Link
            to="/login"
            className="relative z-10 inline-flex w-fit items-center gap-3 text-[#f8f5ed] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#f8f5ed] text-[#1f625d]">
              <Network size={24} strokeWidth={2.4} />
            </span>
            <span className="text-2xl font-bold tracking-tight">
              medmove
            </span>
          </Link>

          <div className="relative z-10 max-w-xl py-4">
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-medium tracking-wide text-white/90">
              <ShieldCheck size={14} />
              HEALTH NETWORK PLATFORM
            </span>

            <h2 className="max-w-lg text-4xl font-semibold leading-[1.12] tracking-tight xl:text-5xl">
              Better access.
              <br />
              Smarter distribution.
              <br />
              <span className="text-[#d4e2c9]">
                Healthier communities.
              </span>
            </h2>

            <p className="mt-6 max-w-md text-base leading-7 text-white/75">
              Connect hospitals, make medicine inventory visible, and help
              teams explore responsible redistribution across the network.
            </p>

            <div className="mt-6 grid max-w-md grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/15 bg-white/[0.07] p-4">
                <Building2 size={20} className="mb-3 text-[#d4e2c9]" />
                <p className="text-sm font-semibold">Shared visibility</p>
                <p className="mt-1 text-xs leading-5 text-white/65">
                  A clearer view of stock across facilities.
                </p>
              </div>

              <div className="rounded-xl border border-white/15 bg-white/[0.07] p-4">
                <ShieldCheck size={20} className="mb-3 text-[#d4e2c9]" />
                <p className="text-sm font-semibold">Careful by design</p>
                <p className="mt-1 text-xs leading-5 text-white/65">
                  Eligibility and quality stay in focus.
                </p>
              </div>
            </div>
          </div>

          <p className="relative z-10 text-xs text-white/55">
            MedMove demo environment · Built for better coordination
          </p>
        </section>

        {/* Right login panel — no separate outer card */}
        <section className="relative flex h-full min-h-0 items-center justify-center px-5 py-4 sm:px-8 lg:px-10">
          <div className="relative z-10 w-full max-w-[520px]">
            <div className="mb-3 flex items-center justify-between lg:justify-end">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-xl font-bold tracking-tight text-[#193632] lg:hidden"
              >
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#1f625d] text-white">
                  <Network size={20} />
                </span>
                medmove
              </Link>

              <Link
                to="/dashboard"
                aria-label="Close sign in"
                className="grid h-10 w-10 place-items-center rounded-full border border-[#ded7c8] bg-[#faf8f2] text-[#71827d] transition-colors hover:bg-[#e8e2d6] hover:text-[#193632] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f625d]"
              >
                <X size={18} />
              </Link>
            </div>

            <div className="mb-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#5c8277]">
                Welcome back to MedMove
              </p>

              <h1
                id="login-title"
                className="text-3xl font-semibold leading-tight tracking-tight text-[#193632] sm:text-[34px]"
              >
                Sign in to your account
              </h1>

              <p className="mt-2 text-sm leading-6 text-[#71827d]">
                Access your hospital inventory and network dashboard.
              </p>
            </div>

            <div className="mb-3 flex gap-6 border-b border-[#ded7c8]">
              <span
                aria-current="page"
                className="relative -mb-px inline-flex items-center border-b-2 border-[#1f625d] pb-3 text-sm font-semibold text-[#193632]"
              >
                Sign in
              </span>

              <Link
                to="/signup"
                className="inline-flex items-center border-b-2 border-transparent pb-3 text-sm text-[#71827d] transition-colors hover:text-[#193632]"
              >
                Create account
              </Link>
            </div>

            {/* Demo login options */}
            <div className="mb-3">
              <p className="mb-2 text-xs leading-5 text-[#71827d]">
                Choose a demo role to explore MedMove without backend
                credentials.
              </p>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {DEMO_ACCOUNTS.map((account) => {
                  const isCoordinator =
                    account.role === 'NETWORK_COORDINATOR';

                  return (
                    <button
                      key={account.role}
                      type="button"
                      onClick={() => void handleDemoLogin(account)}
                      disabled={isLoading}
                      className="flex min-w-0 items-center gap-3 rounded-md border border-[#ded7c8] bg-[#faf8f2] px-3 py-2.5 text-left transition-colors hover:border-[#1f625d]/50 hover:bg-[#e8e2d6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f625d] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[#e4e9df] text-[#1f625d]">
                        {isCoordinator ? (
                          <Network size={18} />
                        ) : (
                          <Building2 size={18} />
                        )}
                      </span>

                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-[#193632]">
                          {account.label}
                        </span>

                        <span className="mt-0.5 block text-xs leading-4 text-[#71827d]">
                          {account.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <p className="mt-2 text-xs leading-5 text-[#71827d]">
                Demo mode uses fictional account details and local demo data.
              </p>
            </div>

            <div className="my-3 flex items-center gap-3 text-xs text-[#8b9690]">
              <span className="h-px flex-1 bg-[#ded7c8]" />
              <span>Or sign in with email</span>
              <span className="h-px flex-1 bg-[#ded7c8]" />
            </div>

            {/* Email/password login */}
            <form className="space-y-3" onSubmit={handleSubmit}>
              <div>
                <label
                  htmlFor="email"
                  className="mb-1 block text-xs font-medium text-[#193632]"
                >
                  Work email
                </label>

                <div className="flex items-center rounded-md border border-[#ded7c8] bg-[#faf8f2] px-3 transition-colors focus-within:border-[#1f625d] focus-within:ring-2 focus-within:ring-[#1f625d]/10">
                  <Mail
                    size={16}
                    className="mr-2 shrink-0 text-[#71827d]"
                    aria-hidden="true"
                  />

                  <input
                    id="email"
                    type="email"
                    autoComplete="username"
                    placeholder="you@hospital.org"
                    className="w-full min-w-0 bg-transparent py-2.5 text-sm text-[#193632] outline-none placeholder:text-[#8b9690]"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-1 block text-xs font-medium text-[#193632]"
                >
                  Password
                </label>

                <div className="flex items-center rounded-md border border-[#ded7c8] bg-[#faf8f2] px-3 transition-colors focus-within:border-[#1f625d] focus-within:ring-2 focus-within:ring-[#1f625d]/10">
                  <LockKeyhole
                    size={16}
                    className="mr-2 shrink-0 text-[#71827d]"
                    aria-hidden="true"
                  />

                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    className="w-full min-w-0 bg-transparent py-2.5 text-sm text-[#193632] outline-none placeholder:text-[#8b9690]"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                </div>
              </div>

              {error && (
                <div
                  className="rounded-md border border-[#e7c8bd] bg-[#fbefea] px-3 py-2.5 text-sm leading-5 text-[#9b4234]"
                  role="alert"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#1f625d] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#194f4b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f625d] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f3efe6] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Signing in…
                  </>
                ) : (
                  'Sign in'
                )}
              </button>
            </form>

            <p className="mt-3 text-center text-xs text-[#71827d]">
              New to the network?{' '}
              <Link
                to="/signup"
                className="font-semibold text-[#1f625d] underline underline-offset-2 hover:text-[#193632]"
              >
                Create a hospital account
              </Link>
            </p>

            <div className="mt-3 flex items-start justify-center gap-2 border-t border-[#ded7c8] pt-2 text-center text-[10px] leading-4 text-[#8b9690]">
              <ShieldCheck size={14} className="mt-0.5 shrink-0" />
              <span>
                MedMove demo environment. Do not enter patient information.
              </span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
