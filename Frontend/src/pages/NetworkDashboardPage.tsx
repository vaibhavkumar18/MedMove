import { CalendarDays, ClipboardList, Boxes, Play, RefreshCw } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { useCallback, useEffect, useState, type FormEvent } from 'react';

import { useOptimization } from '../hooks/useOptimization';
import { useDashboard } from '../hooks/useDashboard';
import { useAppSelector } from '../hooks/useAppSelector';

import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';

import { formatDate } from '../utils/dates';
import { rupeesToPaise } from '../utils/money';

function MetricCard({
  title,
  value,
  detail,
}: {
  title: string;
  value: string | number;
  detail: string;
}) {
  return (
    <article className="min-w-0 border-b border-[#ded6c7] px-0 py-5 sm:px-5 sm:py-6 xl:border-b-0 xl:border-r xl:first:pl-0 xl:last:border-r-0 xl:last:pr-0">
      <p className="text-sm text-[#7a8982]">{title}</p>
      <p className="mt-2 font-sans text-3xl leading-tight tracking-tight text-[#193632] sm:text-[34px]">
        {value}
      </p>
      <p className="mt-2 max-w-xs text-xs leading-5 text-[#7a8982]">{detail}</p>
    </article>
  );
}

export default function NetworkDashboardPage() {
  const user = useAppSelector((state) => state.auth.user);
  const optimization = useOptimization();
  const dashboard = useDashboard();

  const [planningDate, setPlanningDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [budget, setBudget] = useState('5000');
  const [runMessage, setRunMessage] = useState('');

  const loadNetworkData = useCallback(async () => {
    await Promise.allSettled([
      dashboard.loadDashboard(),
      optimization.refreshLatestRun(),
    ]);
  }, [dashboard.loadDashboard, optimization.refreshLatestRun]);

  useEffect(() => {
    if (user?.role === 'NETWORK_COORDINATOR') {
      void loadNetworkData();
    }
  }, [user?.role, loadNetworkData]);

  const handleRun = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRunMessage('');

    const budgetValue = Number(budget);

    if (!planningDate) {
      setRunMessage('Please select a planning date.');
      return;
    }

    if (
      budget.trim() === '' ||
      !Number.isFinite(budgetValue) ||
      budgetValue < 0
    ) {
      setRunMessage('Enter a valid, non-negative transfer budget.');
      return;
    }

    try {
      const result = await optimization.runOptimization({
        planning_date: planningDate,
        budget_minor_units: rupeesToPaise(budgetValue),
        objective_policy: 'PRIORITY_WEIGHTED_UNITS_THEN_COST',
      });

      setRunMessage(
        `Optimization completed with ${result.summary.transfer_count} transfer line(s).`,
      );
      // Refresh dashboard counts now that a new run exists
      void dashboard.loadDashboard();
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'DUPLICATE_RUN'
      ) {
        setRunMessage(
          'This inventory snapshot has already been optimized. View the saved recommendations to review the existing transfer plan.',
        );
        // Load the existing saved result so it remains visible.
        void optimization.refreshLatestRun();
      } else {
        setRunMessage('Unable to generate an optimization result. Please try again.');
      }
    }
  };

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'NETWORK_COORDINATOR') {
    return <Navigate to="/dashboard" replace />;
  }

  const latest = optimization.latest;
  const summary = dashboard.data?.summary;
  const facilities = dashboard.data?.facilities ?? [];

  // Use live dashboard data for metrics; show '—' while loading
  const facilityCount =
    summary?.facility_count ?? facilities.length;
  const shortageLineCount = summary?.shortage_line_count ?? '—';
  const totalShortageUnits = summary?.total_shortage_units ?? 0;
  const eligibleSurplusUnits = summary?.eligible_surplus_units ?? '—';
  const eligibleSurplusLines = summary?.eligible_surplus_line_count ?? 0;

  return (
    <main className="min-h-screen bg-[#f3efe6] px-5 pb-12 pt-5 font-sans text-[#193632] sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1280px]">
        {/* Page introduction */}
        <section className="flex flex-col justify-between gap-5 py-7 sm:flex-row sm:items-end sm:py-8">
          <div>
            <p className="font-mono text-xs tracking-wide text-[#7a8982]">
              NETWORK · COORDINATOR
            </p>
            <h1 className="mt-3 font-sans text-[34px] font-medium leading-tight tracking-[-0.035em] text-[#193632] sm:text-[43px]">
              Network overview
            </h1>
            <p className="mt-2 text-sm leading-6 text-[#7a8982] sm:text-[15px]">
              Review inventory risks and explore a proposed medicine
              redistribution plan across the network.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={() => void loadNetworkData()}
              disabled={
                dashboard.status === 'loading' ||
                optimization.latestStatus === 'loading'
              }
              className="inline-flex items-center gap-2 rounded-md px-2 py-2 text-sm text-[#7a8982] transition-colors hover:text-[#193632] disabled:opacity-50"
            >
              <RefreshCw
                size={15}
                className={
                  dashboard.status === 'loading' ? 'animate-spin' : ''
                }
              />
              Refresh
            </button>
          </div>
        </section>

        {/* Navigation */}
        <nav
          aria-label="Network workspace navigation"
          className="mb-7 flex flex-wrap items-center gap-2 border-y border-[#ded6c7] py-3"
        >
          <Link
            to="/network"
            aria-current="page"
            className="inline-flex items-center gap-2 rounded-md bg-[#e6eee5] px-3.5 py-2.5 text-sm font-medium text-[#246b57] transition-colors"
          >
            <Boxes size={16} />
            Network overview
          </Link>
          <Link
            to="/recommendations"
            className="inline-flex items-center gap-2 rounded-md px-3.5 py-2.5 text-sm text-[#6f8078] transition-colors hover:bg-[#f3efe6] hover:text-[#246b57] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#246b57]"
          >
            <ClipboardList size={16} />
            Recommendations
          </Link>
          <Link
            to="/inventory"
            className="inline-flex items-center gap-2 rounded-md px-3.5 py-2.5 text-sm text-[#6f8078] transition-colors hover:bg-[#f3efe6] hover:text-[#246b57] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#246b57]"
          >
            <Boxes size={16} />
            Inventory
          </Link>
        </nav>

        {/* Top metric strip */}
        <section className="grid grid-cols-1 border-y border-[#ded6c7] sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Facilities"
            value={facilityCount}
            detail="Active facilities in the network"
          />
          <MetricCard
            title="Shortage lines"
            value={shortageLineCount}
            detail={
              typeof totalShortageUnits === 'number' && totalShortageUnits > 0
                ? `${totalShortageUnits.toLocaleString('en-IN')} units below target`
                : 'No active shortages detected'
            }
          />
          <MetricCard
            title="Eligible surplus"
            value={
              typeof eligibleSurplusUnits === 'number'
                ? eligibleSurplusUnits.toLocaleString('en-IN')
                : eligibleSurplusUnits
            }
            detail={`${eligibleSurplusLines} potential surplus lines`}
          />
          <MetricCard
            title="Latest run"
            value={latest?.run ? 'Run available' : 'No run yet'}
            detail={
              latest?.run
                ? `${latest.summary.transfer_count} transfer lines`
                : 'Run an optimization to see saved results'
            }
          />
        </section>

        {/* Main content */}
        <section className="mt-10 grid grid-cols-1 items-start gap-10 xl:grid-cols-[minmax(0,1.25fr)_minmax(350px,0.9fr)]">
          <div className="min-w-0">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <h2 className="font-sans text-[25px] leading-tight tracking-tight text-[#193632]">
                  Network facilities
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#7a8982]">
                  Shortage and surplus figures by facility.
                </p>
              </div>
              <span className="font-mono text-xs text-[#7a8982]">
                {String(facilityCount).padStart(2, '0')} FACILITIES
              </span>
            </div>

            {dashboard.status === 'loading' && facilities.length === 0 ? (
              <div className="mt-5">
                <LoadingState label="Loading facility data…" />
              </div>
            ) : facilities.length === 0 ? (
              <div className="mt-5">
                <EmptyState
                  title="No facility data available"
                  description="Dashboard data could not be loaded from the backend."
                />
              </div>
            ) : (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[590px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-y border-[#ded6c7] text-xs text-[#7a8982]">
                      <th className="py-3 pr-4 font-medium">Facility</th>
                      <th className="px-3 py-3 font-medium">Shortage</th>
                      <th className="px-3 py-3 font-medium">Surplus</th>
                      <th className="py-3 pl-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facilities.map((facility) => (
                      <tr
                        key={facility.facility_code}
                        className="border-b border-[#e2dacb] align-top"
                      >
                        <td className="py-4 pr-4">
                          <p className="font-medium text-[#193632]">
                            {facility.facility_name}
                          </p>
                          <p className="mt-1 font-mono text-[11px] text-[#7a8982]">
                            {facility.facility_code}
                          </p>
                        </td>
                        <td className="px-3 py-4">
                          <p
                            className={`font-sans text-lg tabular-nums ${
                              facility.total_shortage_units > 0
                                ? 'text-[#b94b3c]'
                                : 'text-[#193632]'
                            }`}
                          >
                            {facility.total_shortage_units.toLocaleString('en-IN')}
                          </p>
                          <p className="mt-1 text-xs text-[#7a8982]">
                            {facility.shortage_line_count} lines
                          </p>
                        </td>
                        <td className="px-3 py-4">
                          <p className="font-sans text-lg tabular-nums text-[#193632]">
                            {facility.eligible_surplus_units.toLocaleString('en-IN')}
                          </p>
                          <p className="mt-1 text-xs text-[#7a8982]">
                            {facility.eligible_surplus_line_count} lines
                          </p>
                        </td>
                        <td className="py-4 pl-3">
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-[#7a8982]">
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                facility.shortage_line_count > 0
                                  ? 'bg-[#d89a18]'
                                  : 'bg-[#1f625d]'
                              }`}
                            />
                            {facility.shortage_line_count > 0
                              ? 'Needs attention'
                              : 'On target'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Planning panel */}
          <section className="min-w-0 border border-[#ded6c7] bg-[#f3efe6] p-5 sm:p-6">
            <div className="border-b border-[#ded6c7] pb-5">
              <p className="font-mono text-[11px] tracking-wide text-[#7a8982]">
                PLANNING
              </p>
              <h2 className="mt-2 font-sans text-[25px] leading-tight tracking-tight text-[#193632]">
                Run optimization
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#7a8982]">
                Set a planning date and a transfer budget to generate a
                network plan.
              </p>
            </div>

            <form className="space-y-4 pt-5" onSubmit={handleRun}>
              <div>
                <label
                  htmlFor="planningDate"
                  className="mb-1.5 block text-sm font-medium text-[#193632]"
                >
                  Planning date
                </label>
                <div className="flex items-center rounded-md border border-[#ded6c7] bg-[#f3efe6] px-3 focus-within:border-[#1f625d] focus-within:ring-2 focus-within:ring-[#1f625d]/10">
                  <CalendarDays
                    size={15}
                    className="mr-2 shrink-0 text-[#7a8982]"
                    aria-hidden="true"
                  />
                  <input
                    id="planningDate"
                    name="planningDate"
                    type="date"
                    value={planningDate}
                    onChange={(event) => setPlanningDate(event.target.value)}
                    required
                    className="w-full min-w-0 bg-transparent py-3 text-sm text-[#193632] outline-none"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="budget"
                  className="mb-1.5 block text-sm font-medium text-[#193632]"
                >
                  Transfer budget (₹)
                </label>
                <div className="flex items-center rounded-md border border-[#ded6c7] bg-[#f3efe6] px-3 focus-within:border-[#1f625d] focus-within:ring-2 focus-within:ring-[#1f625d]/10">
                  <span className="mr-2 text-sm text-[#7a8982]">₹</span>
                  <input
                    id="budget"
                    name="budget"
                    type="number"
                    min="0"
                    step="0.01"
                    value={budget}
                    onChange={(event) => setBudget(event.target.value)}
                    required
                    className="w-full min-w-0 bg-transparent py-3 text-sm text-[#193632] outline-none"
                  />
                </div>
                <p className="mt-1.5 text-xs leading-5 text-[#7a8982]">
                  Enter in rupees. Rs 500 → 50,000 paise sent to the API.
                </p>
              </div>

              {optimization.error && (
                <div
                  className="border border-[#ead1c8] bg-[#fff5f1] px-3.5 py-3 text-sm leading-5 text-[#9b4234]"
                  role="alert"
                >
                  {optimization.error}
                </div>
              )}

              {runMessage && (
                <div
                  className="border border-[#cfe0d8] bg-[#f0f7f3] px-3.5 py-3 text-sm leading-5 text-[#315d4c]"
                  role="status"
                  aria-live="polite"
                >
                  {runMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={optimization.manualRunStatus === 'loading'}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#1f625d] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#194f4b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f625d] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {optimization.manualRunStatus === 'loading' ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    Running optimization…
                  </>
                ) : (
                  <>
                    <Play size={15} />
                    Run optimization
                  </>
                )}
              </button>
            </form>
            <p className="mt-4 border-t border-dashed border-[#ded6c7] pt-4 text-xs leading-5 text-[#7a8982]">
              Recommendations are proposals. No stock is moved by this action.
            </p>
          </section>
        </section>

        {/* Latest result */}
        <section className="mt-11">
          <div className="flex flex-col justify-between gap-3 border-b border-[#ded6c7] pb-4 sm:flex-row sm:items-end">
            <div>
              <p className="font-mono text-[11px] tracking-wide text-[#7a8982]">
                OPTIMIZATION RESULT
              </p>
              <h2 className="mt-2 font-sans text-[25px] leading-tight tracking-tight text-[#193632]">
                Latest result
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#7a8982]">
                Persisted optimization run from the network optimizer.
              </p>
            </div>
            <Link
              className="w-fit text-sm font-medium text-[#246b57] underline underline-offset-4 hover:text-[#193632]"
              to="/recommendations"
            >
              View recommendations
            </Link>
          </div>

          <div className="py-5">
            {optimization.latestStatus === 'loading' && !latest ? (
              <LoadingState label="Loading latest result…" />
            ) : !latest?.run ? (
              <EmptyState
                title="No optimization run yet"
                description="Choose a planning date and budget, then run the optimizer to generate a result."
              />
            ) : (
              <div>
                <div className="grid grid-cols-1 border-y border-[#ded6c7] sm:grid-cols-2 xl:grid-cols-4">
                  <div className="border-b border-[#ded6c7] py-4 sm:px-4 xl:border-b-0 xl:border-r xl:first:pl-0">
                    <p className="text-xs text-[#7a8982]">Run status</p>
                    <p className="mt-2 font-sans text-xl text-[#193632]">
                      {latest.run.status}
                    </p>
                  </div>
                  <div className="border-b border-[#ded6c7] py-4 sm:px-4 xl:border-b-0 xl:border-r">
                    <p className="text-xs text-[#7a8982]">Trigger source</p>
                    <p className="mt-2 break-words text-sm text-[#193632]">
                      {latest.run.trigger_source}
                    </p>
                  </div>
                  <div className="border-b border-[#ded6c7] py-4 sm:px-4 xl:border-b-0 xl:border-r">
                    <p className="text-xs text-[#7a8982]">Created</p>
                    <p className="mt-2 text-sm text-[#193632]">
                      {formatDate(latest.run.created_at)}
                    </p>
                  </div>
                  <div className="py-4 sm:px-4 xl:pr-0">
                    <p className="text-xs text-[#7a8982]">Unmet shortage</p>
                    <p className="mt-2 font-sans text-2xl tabular-nums text-[#b94b3c]">
                      {latest.summary.total_unmet_shortage_units.toLocaleString('en-IN')}
                      <span className="ml-1 font-sans text-xs text-[#7a8982]">
                        units
                      </span>
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <Link
                    to="/recommendations"
                    className="flex items-center justify-between gap-4 border-b border-[#ded6c7] py-4 transition-colors hover:border-[#246b57]"
                  >
                    <span>
                      <span className="block font-sans text-xl text-[#193632]">
                        Proposed transfers
                      </span>
                      <span className="mt-1 block text-sm text-[#7a8982]">
                        Review transfer routes
                      </span>
                    </span>
                    <span className="font-sans text-2xl tabular-nums text-[#193632]">
                      {latest.summary.transfer_count}
                    </span>
                  </Link>

                  <Link
                    to="/recommendations"
                    className="flex items-center justify-between gap-4 border-b border-[#ded6c7] py-4 transition-colors hover:border-[#b94b3c]"
                  >
                    <span>
                      <span className="block font-sans text-xl text-[#193632]">
                        Unmet shortage lines
                      </span>
                      <span className="mt-1 block text-sm text-[#7a8982]">
                        Review outstanding demand
                      </span>
                    </span>
                    <span className="font-sans text-2xl tabular-nums text-[#b94b3c]">
                      {latest.summary.unmet_shortage_line_count}
                    </span>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>

        <footer className="mt-8 border-t border-dashed border-[#ded6c7] pt-4 text-xs leading-5 text-[#7a8982]">
          Recommendations require human review. No stock is moved by viewing or generating optimization results.
        </footer>
      </div>
    </main>
  );
}
