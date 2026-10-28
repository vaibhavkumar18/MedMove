import { LockKeyhole, Mail, ShieldCheck, ArrowRight } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useState, type FormEvent } from 'react';

import { useAuth } from '../hooks/useAuth';
import type { LoginPayload, UserRole } from '../types/contracts';
import './LoginPage.css';

function getDestination(role: UserRole) {
  return role === 'NETWORK_COORDINATOR' ? '/network' : '/dashboard';
}

function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`mm-login-wordmark${compact ? ' is-compact' : ''}`} aria-label="MedMove">
      <span>med</span><em>move</em>
    </div>
  );
}

function AccessScopeCard() {
  return (
    <div className="mm-login-scope-layout">
      <article className="mm-login-scope-card" aria-label="What each role can see">
        <p className="mm-login-scope-kicker">WHO SEES WHAT</p>
        <div className="mm-login-scope-row">
          <strong>Hospital user</strong>
          <span>Their own facility</span>
        </div>
        <div className="mm-login-scope-row">
          <strong>Network coordinator</strong>
          <span>All ten hospitals</span>
        </div>
      </article>

      <aside className="mm-login-scope-note">
        <svg
          className="mm-login-scope-arrow"
          viewBox="0 0 74 45"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M70 5C51 3 33 9 20 24L5 28M5 28L20 13M5 28L21 31"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <p>you only see what you should</p>
      </aside>
    </div>
  );
}

export default function LoginPage() {
  const { user, login, status, error, clearError } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const isLoading = status === 'loading';

  if (user) {
    return <Navigate to={getDestination(user.role)} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearError();

    try {
      const payload: LoginPayload = { email: email.trim(), password };
      const response = await login(payload);
      navigate(getDestination(response.user.role), { replace: true });
    } catch {
      // Redux stores the readable error.
    }
  }

  return (
    <main className="mm-login-page">
      <div className="mm-login-layout">
        {/* Editorial left panel — replaces the old green branding panel */}
        <section className="mm-login-editorial" aria-labelledby="login-editorial-title">
          <div className="mm-login-editorial-inner">
            <header className="mm-login-editorial-header">
              <Wordmark />
            </header>

            <div className="mm-login-editorial-content">
              <p className="mm-login-eyebrow">MEDICINE, WHERE IT IS NEEDED</p>
              <h2 id="login-editorial-title" className="mm-login-editorial-title">
                Nothing in your
                <br />
                <em>network</em> left off.
              </h2>
              <p className="mm-login-editorial-description">
                Sign in to see your facility&apos;s stock, the shortages across the network,
                and any transfer proposals waiting for a person to review.
              </p>

              <AccessScopeCard />
            </div>

            <footer className="mm-login-editorial-footer">
              <Wordmark compact />
              <span>Medicine redistribution decision support</span>
            </footer>
          </div>
        </section>

        {/* Login panel */}
        <section className="mm-login-form-panel" aria-labelledby="login-title">
          <div className="mm-login-form-wrap">
            <div className="mm-login-mobile-wordmark">
              <Wordmark />
            </div>

            <div className="mm-login-form-heading">
              <p className="mm-login-eyebrow">WELCOME BACK TO MEDMOVE</p>
              <h1 id="login-title">Sign in to your account</h1>
              <p>Access your hospital inventory and network dashboard.</p>
            </div>

            <form className="mm-login-form" onSubmit={handleSubmit}>
              <div className="mm-login-field">
                <label htmlFor="email">Work email</label>
                <div className="mm-login-input-wrap">
                  <Mail size={17} aria-hidden="true" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="username"
                    placeholder="you@hospital.org"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="mm-login-field">
                <label htmlFor="password">Password</label>
                <div className="mm-login-input-wrap">
                  <LockKeyhole size={17} aria-hidden="true" />
                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="mm-login-error" role="alert">
                  {error}
                </div>
              )}

              <button className="mm-login-submit" type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <span className="mm-login-spinner" aria-hidden="true" />
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign in <ArrowRight size={16} strokeWidth={1.8} aria-hidden="true" />
                  </>
                )}
              </button>
            </form>

            <div className="mm-login-security-note">
              <ShieldCheck size={15} aria-hidden="true" />
              <span>
                MedMove · Medicine redistribution decision support. Do not enter patient
                information.
              </span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
