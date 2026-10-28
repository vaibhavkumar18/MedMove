import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import './HomePage.css';

const checks = [
  {
    title: 'The medicine is fit to use',
    description:
      'Only batches marked eligible. Anything quality-flagged stays where it is.',
  },
  {
    title: 'It will still be in date on arrival',
    description:
      "The destination's shelf-life rule is applied at the day the batch lands, not today.",
  },
  {
    title: 'The sender keeps its reserve',
    description:
      'No hospital is pushed below the minimum stock it has set aside for that medicine.',
  },
  {
    title: 'The receiver only gets what it needs',
    description: 'A destination is never sent more than its shortage.',
  },
  {
    title: 'A real route exists',
    description:
      'Direct routes only, with shared capacity across every medicine on that route. A route one way does not imply the other.',
  },
  {
    title: 'It fits the budget',
    description:
      'Quantity times cost per unit, added up, stays under the figure you set.',
  },
];

const timeline = [
  {
    label: 'FIRST TIME',
    title: 'The coordinator runs it once',
    description:
      'Pick a planning date and a budget. That gives everyone a starting plan to look at.',
  },
  {
    label: 'AFTER THAT',
    title: 'A hospital edits a batch',
    description:
      'Quantity, expiry date or quality status, at its own facility only.',
  },
  {
    label: 'AUTOMATIC',
    title: 'MedMove checks if it matters',
    description:
      'No real change, no shortage, or the same snapshot already analysed: it skips, and says why.',
  },
  {
    label: 'AUTOMATIC',
    title: 'One run covers all ten hospitals',
    description: 'Not site by site. The whole network is solved together.',
  },
  {
    label: 'THEN IT STOPS',
    title: 'A person reviews every proposal',
    description:
      'The source sees it as outgoing, the destination as incoming. Real inventory is untouched.',
    final: true,
  },
];

function Wordmark({ footer = false }: { footer?: boolean }) {
  return (
    <Link
      to="/"
      aria-label="MedMove home"
      className={`mm-wordmark${footer ? ' mm-wordmark--footer' : ''}`}
    >
      <img
        src="/logo.png"
        alt="MedMove"
        className={
          footer
            ? 'block h-[30px] w-auto object-contain'
            : 'block h-[40px] w-auto object-contain'
        }
      />
    </Link>
  );
}

function TransferProposal() {
  return (
    <div
      className="mm-hero-visual"
      aria-label="Illustration of a transfer proposal awaiting review"
    >
      <p className="mm-visual-caption">what a suggestion looks like</p>

      <article className="mm-transfer-slip">
        <div className="mm-slip-topline">
          <span>TRANSFER PROPOSAL</span>
          <span>NO. 001</span>
        </div>

        <div className="mm-slip-heading">
          <span className="mm-slip-quantity">80</span>
          <span className="mm-slip-unit">units of MED1</span>
        </div>

        <div className="mm-review-stamp">
          PENDING
          <br />
          REVIEW
          <small>NOTHING HAS MOVED</small>
        </div>

        <div className="mm-slip-rows">
          <div>
            <span>From</span>
            <strong>H01</strong>
          </div>
          <div>
            <span>To</span>
            <strong>H02</strong>
          </div>
          <div>
            <span>Medicine</span>
            <strong>Paracetamol 500 mg</strong>
          </div>
          <div>
            <span>Route</span>
            <strong>Direct, 1 day</strong>
          </div>
          <div>
            <span>Shelf-life at arrival</span>
            <strong>Rule met</strong>
          </div>
          <div>
            <span>Est. cost</span>
            <strong>₹204.00</strong>
          </div>
          <div>
            <span>Still short after this</span>
            <strong>100 units</strong>
          </div>
        </div>

        <div className="mm-slip-signature">
          <span>Reviewed by</span>
          <i />
        </div>
      </article>

      <div className="mm-uncovered-note">
        <div className="mm-note-heading">
          <span>COULD NOT BE COVERED</span>
          <strong>40 units short</strong>
        </div>

        <p className="mm-note-medicine">H02 · MED3</p>

        <p>
          No eligible route from a hospital with spare stock. It stays on the
          list instead of being quietly dropped.
        </p>
      </div>

      <p className="mm-visual-footnote">
        and the ones it can’t
        <br />
        solve are shown too
      </p>
    </div>
  );
}

function ArithmeticLedger() {
  return (
    <section className="mm-ledger" aria-labelledby="mm-ledger-title">
      <div className="mm-shell mm-ledger-inner">
        <div className="mm-ledger-intro">
          <h2 id="mm-ledger-title">
            The arithmetic,
            <br />
            written out.
          </h2>

          <p>
            Same numbers as the slip above. The optimizer does this for every
            facility and medicine at once, so nobody has to.
          </p>
        </div>

        <div
          className="mm-arithmetic"
          aria-label="200 minus 20 equals 180, minus 80 equals 100 still short"
        >
          <div className="mm-math-row">
            <span className="mm-math-op" />
            <strong>200</strong>
            <span>H02’s target stock</span>
          </div>

          <div className="mm-math-row">
            <span className="mm-math-op">−</span>
            <strong>20</strong>
            <span>usable stock it has now</span>
          </div>

          <div className="mm-math-row mm-math-result">
            <span className="mm-math-op">=</span>
            <strong>180</strong>
            <span>short</span>
          </div>

          <div className="mm-math-row">
            <span className="mm-math-op">−</span>
            <strong>80</strong>
            <span>what H01 can safely send</span>
          </div>

          <div className="mm-math-row mm-math-final">
            <span className="mm-math-op">=</span>
            <strong>
              <span>100</span>
            </strong>
            <span>still short. Shown, never hidden.</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <main className="mm-home">
      <header className="mm-header">
        <nav className="mm-shell mm-nav" aria-label="Main navigation">
          <Wordmark />

          <div className="mm-nav-links">
            <a href="#idea">The idea</a>
            <a href="#checks">What it checks</a>
            <a href="#audience">Who sees what</a>
            <Link to="/login" className="mm-nav-signin">
              Sign in
            </Link>
          </div>
        </nav>
      </header>

      <section className="mm-hero" id="idea">
        <div className="mm-shell mm-hero-grid">
          <div className="mm-hero-copy">
            <p className="mm-eyebrow">FOR HOSPITAL NETWORKS</p>

            <h1>
              One hospital has
              <br />
              too much. Another
              <br />
              is <em>running short.</em>
            </h1>

            <p className="mm-hero-description">
              MedMove looks at every hospital in your network at the same time
              and suggests which transfers would actually work. It checks the
              expiry dates, the stock each site has to keep, the routes and the
              budget. Then it hands the suggestion to a person.
            </p>

            <div className="mm-hero-actions">
              <Link to="/login" className="mm-button mm-button-dark">
                Sign in to MedMove
                <ArrowRight size={14} strokeWidth={1.8} />
              </Link>

              <a href="#example" className="mm-text-link">
                See a worked example
              </a>
            </div>
          </div>

          <TransferProposal />
        </div>
      </section>

      <section className="mm-example mm-shell" id="example">
        <p className="mm-section-kicker">A PLAIN EXAMPLE</p>

        <div className="mm-example-copy">
          <h2>
            Hospital H02 needs 200 units of paracetamol. It has{' '}
            <span className="mm-highlight">20 usable.</span> Hospital H01, two
            hours away, has more than its own plan requires.
          </h2>

          <p>
            Working out how many H01 can send without leaving itself short, and
            whether the batch is still in date when it lands, is slow to do by
            hand across ten sites. It is what MedMove does on every run.
          </p>
        </div>
      </section>

      <ArithmeticLedger />

      <section className="mm-checks-section" id="checks">
        <div className="mm-shell mm-two-column">
          <div className="mm-section-intro">
            <h2>Six things it checks before it suggests anything.</h2>

            <p>
              These are hard rules, not preferences. A proposal that breaks one
              is never created.
            </p>

            <p className="mm-aside-note">
              If a full plan is impossible, it says so and shows what is left.
              It never invents stock.
            </p>
          </div>

          <div className="mm-check-list">
            {checks.map((check, index) => (
              <article className="mm-check-row" key={check.title}>
                <span className="mm-list-number">{index + 1}</span>

                <div>
                  <h3>{check.title}</h3>
                  <p>{check.description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mm-process-section">
        <div className="mm-shell mm-process-grid">
          <div className="mm-process-intro">
            <h2>It runs when something actually changes.</h2>

            <p>
              Nobody has to remember to press a button after every delivery. A
              relevant stock edit starts the check by itself, and tells you
              when it chose not to run.
            </p>

            <blockquote>
              If the optimizer fails after you save a stock change, the change
              is still saved. You get told both things, separately.
            </blockquote>
          </div>

          <div className="mm-timeline">
            {timeline.map((item) => (
              <article
                className={`mm-timeline-item${item.final ? ' is-final' : ''}`}
                key={item.title}
              >
                <span className="mm-timeline-dot" aria-hidden="true" />

                <div className="mm-timeline-content">
                  <p className="mm-timeline-label">{item.label}</p>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mm-audience-section" id="audience">
        <div className="mm-shell">
          <h2 className="mm-audience-heading">
            Everyone sees their own part of the picture.
          </h2>

          <div className="mm-audience-grid">
            <article className="mm-audience-card">
              <p className="mm-eyebrow">HOSPITAL USER</p>
              <h3>One facility, fully theirs</h3>

              <p>
                Keeps their own inventory up to date and sees every transfer
                that involves them, whether they are sending or receiving. A
                hospital can be both in the same run.
              </p>

              <p className="mm-audience-footnote">
                Cannot see or edit another hospital’s batches, even by changing
                an ID in the browser. The server checks, not the page.
              </p>
            </article>

            <article className="mm-audience-card">
              <p className="mm-eyebrow">NETWORK COORDINATOR</p>
              <h3>The whole network</h3>

              <p>
                Sees all ten hospitals, runs the first optimization, and reads
                every proposal along with every shortage that could not be
                covered.
              </p>

              <p className="mm-audience-footnote">
                Accounts of this kind are created by the administrator.
                Signing up never grants it.
              </p>
            </article>
          </div>

          <div className="mm-final-cta">
            <h2>Decide with the whole network in front of you.</h2>

            <div className="mm-final-cta-copy">
              <p>
                Find the imbalances, check which transfers are feasible, and
                review each one before anything happens.
              </p>

              <Link to="/login" className="mm-button mm-button-dark">
                Sign in to MedMove
                <ArrowRight size={14} strokeWidth={1.8} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="mm-footer">
        <div className="mm-shell mm-footer-inner">
          <Wordmark footer />

          <p>
            Demo data is fictional. Please don’t enter patient information.
            <br />
            A decision-support prototype: it never buys, dispatches or receives
            medicine.
          </p>
        </div>
      </footer>
    </main>
  );
}