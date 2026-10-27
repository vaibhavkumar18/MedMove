
import { Link } from 'react-router-dom';
import { ShieldCheck, Network } from 'lucide-react';

/**
 * Public homepage — accessible to logged-out and logged-in users.
 * Minimal placeholder; visual design will be added later.
 */
export default function HomePage() {
  return (
    <section className="mx-auto flex max-w-3xl flex-col items-center px-5 py-24 text-center sm:px-8 sm:py-32">

      {/* Eyebrow pill */}
      <span className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#ded7c8] bg-[#faf8f2] px-4 py-2 text-xs font-semibold tracking-widest text-[#5c8277]">
        <ShieldCheck size={13} />
        HEALTH NETWORK PLATFORM
      </span>

      {/* Headline */}
      <h1 className="text-4xl font-semibold leading-tight tracking-tight text-[#193632] sm:text-5xl lg:text-6xl">
        Better access.
        <br />
        Smarter distribution.
      </h1>

      {/* Sub-headline */}
      <p className="mt-6 max-w-xl text-base leading-7 text-[#71827d] sm:text-lg sm:leading-8">
        MedMove helps hospital networks identify medicine shortages and
        surpluses and explore responsible redistribution across facilities.
      </p>

      {/* CTA */}
      <div className="mt-10">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 rounded-lg bg-[#1f625d] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#194f4b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f625d] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f3efe6]"
        >
          <Network size={16} strokeWidth={2.4} />
          Sign in to MedMove
        </Link>
      </div>

      {/* Disclaimer */}
      <p className="mt-10 text-[11px] text-[#8b9690]">
        Synthetic demonstration data. Do not enter patient information.
      </p>

    </section>
  );
}
