import {
  Activity,
  Building2,
  Boxes,
  KeyRound,
  LockKeyhole,
  Mail,
  RefreshCw,
  UserRound,
  X,
  HeartPulse,
  ShieldCheck,
} from 'lucide-react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useEffect, useState, type FormEvent } from 'react';

import { useAuth } from '../hooks/useAuth';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { signupOptionsThunk } from '../store/authSlice';

export default function SignupPage() {
  const {
    user,
    signup,
    status,
    error,
    clearError,
    signupFacilities,
    signupOptionsStatus,
  } = useAuth();

  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [facilityCode, setFacilityCode] = useState('');
  const [joinCode, setJoinCode] = useState('');

  useEffect(() => {
    if (signupOptionsStatus === 'idle') {
      void dispatch(signupOptionsThunk());
    }
  }, [dispatch, signupOptionsStatus]);

  if (user) {
    return (
      <Navigate
        to={user.role === 'NETWORK_COORDINATOR' ? '/network' : '/dashboard'}
        replace
      />
    );
  }

  const facilities = Array.isArray(signupFacilities) ? signupFacilities : [];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearError();

    try {
      const profile = await signup({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        facility_code: facilityCode,
        join_code: joinCode.trim(),
      });

      navigate(
        profile.user.role === 'NETWORK_COORDINATOR' ? '/network' : '/dashboard',
        { replace: true },
      );
    } catch {
      // The auth hook stores the API error for the form to display.
    }
  }

  function retryFacilityLoad() {
    void dispatch(signupOptionsThunk());
  }

  const isLoading = status === 'loading';
  const facilitiesLoading = signupOptionsStatus === 'loading';
  const canSubmit =
    !isLoading &&
    signupOptionsStatus === 'succeeded' &&
    facilities.length > 0;

  return (
    <main className="relative h-screen w-full overflow-hidden bg-[#f3efe6] font-sans text-[#193632]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_15%_20%,rgba(220,229,218,0.65),transparent_40%),radial-gradient(ellipse_at_85%_85%,rgba(212,226,220,0.55),transparent_38%)]"
      />

      <div className="relative grid h-full w-full grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(480px,0.88fr)]">
        {/* Left brand panel */}
        <section className="relative hidden min-h-0 flex-col justify-between overflow-hidden bg-[#1f625d] px-8 py-6 text-[#f8f5ed] lg:flex xl:px-12 xl:py-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-32 top-24 h-96 w-96 rounded-full border border-white/10"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-12 top-40 h-64 w-64 rounded-full border border-white/10"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-[#2d756b]/70"
          />

          <Link
            to="/login"
            className="relative z-10 inline-flex w-fit items-center gap-3 text-[#f8f5ed] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
           <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#f8f5ed] text-[#1f625d]">
              <Activity size={24} strokeWidth={2.4} />
            </span>
            <span className="text-2xl font-bold tracking-tight">medmove</span>
          </Link>

          <div className="relative z-10 max-w-xl py-4">
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-medium tracking-wide text-white/90">
              <HeartPulse size={14} />
              HEALTH NETWORK PLATFORM
            </span>
            <h1 className="max-w-lg text-4xl font-semibold leading-[1.12] tracking-tight xl:text-5xl">
              Better access.
              <br />
              Smarter distribution.
              <br />
              <span className="text-[#d4e2c9]">Healthier communities.</span>
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-white/75">
              Connect hospitals, make medicine inventory visible, and help teams
              explore responsible redistribution across the network.
            </p>

            <div className="mt-6 grid max-w-md grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/15 bg-white/[0.07] p-4">
                <Boxes size={20} className="mb-3 text-[#d4e2c9]" />
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

        {/* Right signup panel */}
        <section className="flex h-full min-h-0 items-center justify-center px-0 py-0">
          <div className="w-full max-w-[520px] px-5 py-2 sm:px-7 lg:px-10">
            <div className="mb-3 flex items-center justify-between lg:justify-end">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-xl font-bold tracking-tight text-[#193632] lg:hidden"
              >
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#1f625d] text-white">
                  <Activity size={20} />
                </span>
                medmove
              </Link>
              <Link
                to="/login"
                aria-label="Close create account"
                className="grid h-10 w-10 place-items-center rounded-full border border-[#ded7c8] bg-[#faf8f2] text-[#71827d] transition-colors hover:bg-[#e8e2d6] hover:text-[#193632] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f625d]"
              >
                <X size={18} />
              </Link>
            </div>

            <div className="w-full">
              <div className="mb-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#5c8277]">
                  Get started with MedMove
                </p>
                <h2
                  id="signup-title"
                  className="text-3xl font-semibold leading-tight tracking-tight text-[#193632] sm:text-[34px]"
                >
                  Create your account
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#71827d]">
                  Register as a hospital user at an existing facility.
                </p>
              </div>

              <div className="mb-3 flex gap-6 border-b border-[#ded7c8]">
                <Link
                  to="/login"
                  className="inline-flex items-center border-b-2 border-transparent pb-3 text-sm text-[#71827d] transition-colors hover:text-[#193632]"
                >
                  Sign in
                </Link>
                <span
                  aria-current="page"
                  className="relative -mb-px inline-flex items-center border-b-2 border-[#1f625d] pb-3 text-sm font-semibold text-[#193632]"
                >
                  Create account
                </span>
              </div>

              <form className="space-y-2.5" onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="fullName" className="mb-1 block text-xs font-medium text-[#193632]">
                      Full name
                    </label>
                    <div className="flex items-center rounded-md border border-[#ded7c8] bg-[#fcfaf5] px-3 transition-colors focus-within:border-[#1f625d] focus-within:ring-2 focus-within:ring-[#1f625d]/10">
                      <UserRound size={16} className="mr-2 shrink-0 text-[#71827d]" aria-hidden="true" />
                      <input
                        id="fullName"
                        type="text"
                        autoComplete="name"
                        placeholder="Your full name"
                        className="w-full min-w-0 bg-transparent py-2.5 text-sm text-[#193632] outline-none placeholder:text-[#8b9690]"
                        value={fullName}
                        onChange={(event) => setFullName(event.target.value)}
                        minLength={2}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="signupEmail" className="mb-1 block text-xs font-medium text-[#193632]">
                      Work email
                    </label>
                    <div className="flex items-center rounded-md border border-[#ded7c8] bg-[#fcfaf5] px-3 transition-colors focus-within:border-[#1f625d] focus-within:ring-2 focus-within:ring-[#1f625d]/10">
                      <Mail size={16} className="mr-2 shrink-0 text-[#71827d]" aria-hidden="true" />
                      <input
                        id="signupEmail"
                        type="email"
                        autoComplete="email"
                        placeholder="you@hospital.org"
                        className="w-full min-w-0 bg-transparent py-2.5 text-sm text-[#193632] outline-none placeholder:text-[#8b9690]"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="facility" className="mb-1 block text-xs font-medium text-[#193632]">
                    Hospital / facility
                  </label>
                  <div className="flex items-center rounded-md border border-[#ded7c8] bg-[#fcfaf5] px-3 transition-colors focus-within:border-[#1f625d] focus-within:ring-2 focus-within:ring-[#1f625d]/10">
                    <Building2 size={16} className="mr-2 shrink-0 text-[#71827d]" aria-hidden="true" />
                    <select
                      id="facility"
                      className="w-full min-w-0 appearance-none bg-transparent py-2.5 text-sm text-[#193632] outline-none disabled:cursor-not-allowed disabled:text-[#8b9690]"
                      value={facilityCode}
                      onChange={(event) => setFacilityCode(event.target.value)}
                      required
                      disabled={signupOptionsStatus !== 'succeeded'}
                    >
                      <option value="">
                        {facilitiesLoading
                          ? 'Loading facilities…'
                          : signupOptionsStatus === 'failed'
                            ? 'Unable to load facilities'
                            : 'Choose your facility'}
                      </option>
                      {facilities.map((facility) => (
                        <option key={facility.facility_code} value={facility.facility_code}>
                          {facility.name} ({facility.facility_code})
                        </option>
                      ))}
                    </select>
                  </div>

                  {signupOptionsStatus === 'failed' && (
                    <div className="mt-2 rounded-lg border border-[#e7c8bd] bg-[#fbefea] p-3" role="alert">
                      <p className="text-sm leading-5 text-[#9b4234]">
                        The facility list could not be loaded. Check the backend connection and try again.
                      </p>
                      <button
                        className="mt-2 inline-flex items-center gap-2 rounded-lg border border-[#e7c8bd] bg-[#fcfaf5] px-3 py-2 text-sm font-medium text-[#9b4234] hover:bg-[#f5e8e0] disabled:opacity-60"
                        type="button"
                        onClick={retryFacilityLoad}
                        disabled={facilitiesLoading}
                      >
                        <RefreshCw size={14} className={facilitiesLoading ? 'animate-spin' : ''} />
                        Retry
                      </button>
                    </div>
                  )}

                  {signupOptionsStatus === 'succeeded' && facilities.length === 0 && (
                    <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-800" role="alert">
                      No facilities are currently available for signup. Please contact the project team.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="signupPassword" className="mb-1 block text-xs font-medium text-[#193632]">
                      Password
                    </label>
                    <div className="flex items-center rounded-md border border-[#ded7c8] bg-[#fcfaf5] px-3 transition-colors focus-within:border-[#1f625d] focus-within:ring-2 focus-within:ring-[#1f625d]/10">
                      <LockKeyhole size={16} className="mr-2 shrink-0 text-[#71827d]" aria-hidden="true" />
                      <input
                        id="signupPassword"
                        type="password"
                        autoComplete="new-password"
                        placeholder="At least 8 characters"
                        className="w-full min-w-0 bg-transparent py-2.5 text-sm text-[#193632] outline-none placeholder:text-[#8b9690]"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        minLength={8}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="joinCode" className="mb-1 block text-xs font-medium text-[#193632]">
                      Demo join code
                    </label>
                    <div className="flex items-center rounded-md border border-[#ded7c8] bg-[#fcfaf5] px-3 transition-colors focus-within:border-[#1f625d] focus-within:ring-2 focus-within:ring-[#1f625d]/10">
                      <KeyRound size={16} className="mr-2 shrink-0 text-[#71827d]" aria-hidden="true" />
                      <input
                        id="joinCode"
                        type="password"
                        autoComplete="off"
                        placeholder="Enter the code"
                        className="w-full min-w-0 bg-transparent py-2.5 text-sm text-[#193632] outline-none placeholder:text-[#8b9690]"
                        value={joinCode}
                        onChange={(event) => setJoinCode(event.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>

                <p className="text-xs leading-5 text-[#71827d]">
                  New accounts receive the Hospital User role. Network coordinator accounts are provisioned separately.
                </p>

                {error && (
                  <div className="rounded-lg border border-[#e7c8bd] bg-[#fbefea] px-3.5 py-3 text-sm leading-5 text-[#9b4234]" role="alert">
                    {error}
                  </div>
                )}

                <button
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#1f625d] px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#194f4b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f625d] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f8f5ed] disabled:cursor-not-allowed disabled:opacity-60"
                  type="submit"
                  disabled={!canSubmit}
                >
                  {isLoading ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Creating account…
                    </>
                  ) : (
                    'Create account'
                  )}
                </button>
              </form>

              <p className="mt-3 text-center text-xs text-[#71827d]">
                Already registered?{' '}
                <Link to="/login" className="font-semibold text-[#1f625d] underline underline-offset-2 hover:text-[#193632]">
                  Sign in
                </Link>
              </p>

              <div className="mt-3 flex items-start justify-center gap-2 border-t border-[#ded7c8] pt-2 text-center text-[10px] leading-4 text-[#8b9690]">
                <Activity size={14} className="mt-0.5 shrink-0" />
                <span>MedMove demo environment. Do not enter patient information.</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
