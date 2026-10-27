
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Building2,
  Network,
  ShieldCheck,
} from 'lucide-react';

const galleryImages = [
  {
    src: '/hero1.png',
    alt: 'Medicine waste and surplus inventory across hospitals',
    label: '01 / The challenge',
  },
  {
    src: '/hero2.png',
    alt: 'The challenge of affordable access to medicines',
    label: '02 / Why it matters',
  },
  {
    src: '/hero3.png',
    alt: 'MedMove connecting hospital surplus with facilities that need medicines',
    label: '03 / The MedMove approach',
  },
];

function GalleryImage({
  image,
  index,
}: {
  image: (typeof galleryImages)[number];
  index: number;
}) {
  const figureRef = useRef<HTMLElement | null>(null);
  const [isVisible, setIsVisible] = useState(index === 0);
  const [revealColor, setRevealColor] = useState(false);

  useEffect(() => {
    const element = figureRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          setRevealColor(true);
          observer.unobserve(element);
        }
      },
      {
        threshold: 0.2,
        rootMargin: '0px 0px -30px 0px',
      },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <figure
      ref={figureRef}
      className={`mx-5 transition-[opacity,transform] duration-1000 ease-out motion-reduce:transition-none sm:mx-10 ${
        isVisible
          ? 'translate-y-0 opacity-100'
          : 'translate-y-8 opacity-0'
      }`}
      style={{ transitionDelay: `${Math.min(index * 100, 200)}ms` }}
    >
      <div className="mx-auto max-w-[1000px]">
        <div
          className="group relative rounded-2xl bg-transparent transition-[transform] duration-500 ease-out hover:scale-[1.004] motion-reduce:transition-none sm:rounded-3xl"
          onMouseEnter={() => setRevealColor(true)}
          onMouseLeave={() => setRevealColor(false)}
        >
          {/* Minimal frame that blends with the beige page */}
          <div className="relative overflow-hidden rounded-2xl bg-[#f1efe6] ring-1 ring-[#193632]/[0.07] transition-[box-shadow] duration-700 group-hover:shadow-[0_16px_38px_rgba(25,54,50,0.09)] sm:rounded-3xl">
            {/* Full-colour image underneath */}
            <img
              src={image.src}
              alt={image.alt}
              loading={index === 0 ? 'eager' : 'lazy'}
              decoding="async"
              className="block h-auto w-full rounded-2xl object-contain sm:rounded-3xl"
            />

            {/* Grayscale layer fades away when scrolled into view or hovered */}
            <img
              src={image.src}
              alt=""
              aria-hidden="true"
              loading={index === 0 ? 'eager' : 'lazy'}
              decoding="async"
              className={`pointer-events-none absolute inset-0 block h-full w-full rounded-2xl object-contain transition-opacity duration-[1400ms] ease-in-out motion-reduce:transition-none sm:rounded-3xl ${
                revealColor
                  ? 'opacity-0'
                  : 'opacity-100 group-hover:opacity-0'
              }`}
              style={{
                filter: 'grayscale(1)',
              }}
            />

            {/* Soft beige tint for a cohesive page-wide look */}
            <div
              className={`pointer-events-none absolute inset-0 rounded-2xl bg-[#e8e2d2]/[0.10] transition-opacity duration-[1400ms] ease-in-out motion-reduce:transition-none sm:rounded-3xl ${
                revealColor ? 'opacity-0' : 'opacity-100'
              }`}
            />

            {/* Gentle edge blending — no heavy visible border */}
            <div className="pointer-events-none absolute inset-0 rounded-2xl shadow-[inset_0_0_22px_rgba(241,239,230,0.12)] sm:rounded-3xl" />
          </div>
        </div>

        <figcaption className="flex items-center gap-3 px-1 pt-3 text-[#397568]/90 sm:px-2 sm:pt-4">
          <span className="whitespace-nowrap text-xs font-semibold tracking-[0.12em] sm:text-sm">
            {image.label}
          </span>
          <span className="h-px flex-1 bg-[#193632]/[0.09]" />
        </figcaption>
      </div>
    </figure>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f1efe6] text-[#193632]">
      {/* HERO: LOOPING VIDEO BACKGROUND */}
      <section className="relative isolate min-h-[100svh] overflow-hidden bg-[#193632]">
        <video
          className="absolute inset-0 -z-30 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
        >
          <source src="/home.mp4" type="video/mp4" />
        </video>

        <div className="pointer-events-none absolute inset-0 -z-20 bg-gradient-to-r from-[#081f1d]/75 via-[#102d29]/50 to-[#102d29]/30" />
        <div className="pointer-events-none absolute inset-0 -z-20 bg-gradient-to-b from-[#081f1d]/25 via-[#081f1d]/10 to-[#081f1d]/45" />

        {/* NAVBAR OVER VIDEO */}
        <header className="absolute inset-x-0 top-0 z-30 bg-transparent">
          <nav className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-10">
            <Link
              to="/"
              aria-label="MedMove home"
              className="group inline-flex items-center border-0 bg-transparent p-0 shadow-none transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <img
                src="/logoo.png"
                alt="MedMove"
                className="h-[35px] w-auto object-contain sm:h-[39px]"
              />
            </Link>

            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-white/35 bg-white/20 px-5 py-2.5 text-sm font-semibold text-white shadow-sm backdrop-blur-md transition hover:border-white/50 hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Sign in
              <ArrowUpRight size={16} />
            </Link>
          </nav>
        </header>

        {/* HERO CONTENT */}
        <div className="mx-auto flex min-h-[100svh] max-w-[1440px] items-center justify-center px-5 pb-12 pt-28 sm:px-8 sm:pb-12 sm:pt-32 lg:px-10 lg:py-24">
          <div className="mx-auto flex w-full max-w-4xl flex-col items-center text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-[#102d29]/40 px-4 py-2.5 text-[11px] font-semibold tracking-[0.18em] text-[#e0eee6] backdrop-blur-md sm:text-xs">
              <ShieldCheck size={15} />
              HEALTH NETWORK PLATFORM
            </div>

       <h1 className="mt-7 w-full max-w-4xl text-center text-[32px] font-semibold leading-[1.06] tracking-[-0.055em] text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)] sm:text-[44px] lg:text-[58px] xl:text-[4.8125rem]">
  Better access.
  <br />
  <span className="text-[#a5d9c5]">
    Smarter distribution.
  </span>
</h1>

          

           

           

            <p className="mt-6 mx-auto max-w-2xl text-center text-base leading-8 text-white drop-shadow-[0_1px_5px_rgba(0,0,0,0.85)] sm:text-lg sm:leading-9 lg:text-xl">
              Identify medicine shortages and usable surpluses across your
              hospital network. Explore transparent, constraint-aware
              redistribution recommendations while keeping every decision
              under human review.
            </p>

            <div className="mt-8 flex w-full flex-col items-center justify-center gap-3 sm:flex-row sm:items-center">
              <Link
                to="/login"
                className="inline-flex min-h-13 items-center justify-center gap-2 rounded-xl bg-[#20645f] px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-black/10 transition duration-200 hover:-translate-y-0.5 hover:bg-[#1b5752] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#193632]"
              >
                Sign in to MedMove
                <ArrowRight size={17} />
              </Link>

              <a
                href="#gallery"
                className="inline-flex min-h-13 items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Explore our mission
                <ArrowDown size={16} />
              </a>
            </div>

            <div className="mt-20 grid w-full max-w-3xl grid-cols-1 gap-4 border-t border-white/20 pt-6 sm:grid-cols-3 sm:gap-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-[#b8e1ce]">
                  <Building2 size={19} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">
                    Network-wide
                  </p>
                  <p className="mt-1 text-xs text-white/65">
                    Inventory visibility
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-[#b8e1ce]">
                  <Network size={19} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">
                    Constraint-aware
                  </p>
                  <p className="mt-1 text-xs text-white/65">
                    Transfer recommendations
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-[#b8e1ce]">
                  <ShieldCheck size={19} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">
                    Human-reviewed
                  </p>
                  <p className="mt-1 text-xs text-white/65">
                    Responsible decisions
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CENTERED IMAGE GALLERY */}
      <section
        id="gallery"
        className="scroll-mt-5 bg-gradient-to-b from-[#f1efe6] via-[#f4f2ea] to-[#f1efe6] py-10 sm:py-14 lg:py-16"
      >
        <div className="mb-8 px-5 sm:mb-10 sm:px-8 lg:px-10">
          <div className="mx-auto max-w-[1080px]">
            <p className="text-xs font-semibold tracking-[0.2em] text-[#398a78]">
              THE MEDMOVE STORY
            </p>
            <h2 className="mt-3 max-w-3xl text-2xl font-semibold leading-tight tracking-[-0.04em] text-[#193632] sm:text-3xl lg:text-4xl">
              One network. A better way forward.
            </h2>
          </div>
        </div>

        <div className="space-y-7 sm:space-y-9 lg:space-y-10">
          {galleryImages.map((image, index) => (
            <GalleryImage key={image.src} image={image} index={index} />
          ))}
        </div>
      </section>

      {/* CLOSING CTA */}
      <section className="bg-[#f1efe6] px-5 pb-14 pt-6 sm:px-8 sm:pb-20 lg:px-10">
        <div className="relative mx-auto flex max-w-[1080px] flex-col items-start justify-between gap-7 overflow-hidden rounded-2xl border border-[#deded1]/70 bg-[#e9ede3] p-6 sm:rounded-3xl sm:p-10 md:flex-row md:items-center lg:p-12">
          <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[#8dbda3]/20 blur-3xl" />

          <div className="relative max-w-2xl">
            <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-[#398a78]">
              <Network size={15} />
              MEDICINE REDISTRIBUTION DECISION SUPPORT
            </p>

            <h2 className="mt-4 text-xl font-semibold leading-tight tracking-[-0.035em] text-[#193632] sm:text-2xl lg:text-3xl">
              Make every inventory decision more informed.
            </h2>

            <p className="mt-3 max-w-xl text-sm leading-7 text-[#71827d] sm:text-base">
              Identify imbalances, evaluate feasible transfers and review
              recommendations before any action is taken.
            </p>
          </div>

          <Link
            to="/login"
            className="relative inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#1f625d] px-6 py-3.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#194f4b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f625d] focus-visible:ring-offset-2"
          >
            Sign in to MedMove
            <ArrowRight size={17} />
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-[#deded1]/70 bg-[#f8f6ef]">
        <div className="mx-auto flex max-w-[1080px] flex-col gap-5 px-5 py-7 sm:px-8 md:flex-row md:items-center md:justify-between">
          <Link to="/" aria-label="MedMove home" className="inline-flex w-fit items-center">
            <img
              src="/logoo.png"
              alt="MedMove"
              className="h-9 w-auto object-contain"
            />
          </Link>

          <div className="text-xs leading-6 text-[#71827d] md:text-right">
            <p>Medicine redistribution decision support</p>
            <p>Synthetic demonstration data — not real operational data.</p>
            <p>Do not enter patient information.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
