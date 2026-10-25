
import { CalendarDays, ClipboardList, Boxes, Play, RefreshCw } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { useCallback, useEffect, useState, type FormEvent } from 'react';

import { useOptimization } from '../hooks/useOptimization';
import { useAppSelector } from '../hooks/useAppSelector';

import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';

import { formatDate } from '../utils/dates';
import { rupeesToPaise } from '../utils/money';
import type { DashboardFacility } from '../types/contracts';

// Illustrative frontend data, not live hospital inventory.
const DEMO_FACILITIES: DashboardFacility[] = [
  {
    facility_code: 'H01',
    facility_name: 'City General Hospital',
    shortage_line_count: 3,
    total_shortage_units: 180,
    eligible_surplus_line_count: 4,
    eligible_surplus_units: 420,
  },
  {
    facility_code: 'H02',
    facility_name: 'District Medical Centre',
    shortage_line_count: 2,
    total_shortage_units: 100,
    eligible_surplus_line_count: 3,
    eligible_surplus_units: 250,
  },
  {
    facility_code: 'H03',
    facility_name: 'Community Health Centre',
    shortage_line_count: 1,
    total_shortage_units: 45,
    eligible_surplus_line_count: 5,
    eligible_surplus_units: 560,
  },
  {
    facility_code: 'H04',
    facility_name: 'Regional Care Hospital',
    shortage_line_count: 2,
    total_shortage_units: 125,
    eligible_surplus_line_count: 2,
    eligible_surplus_units: 190,
  },
  {
    facility_code: 'H05',
    facility_name: 'Northside Medical Centre',
    shortage_line_count: 0,
    total_shortage_units: 0,
    eligible_surplus_line_count: 3,
    eligible_surplus_units: 310,
  },
  {
    facility_code: 'H06',
    facility_name: 'Community Hospital',
    shortage_line_count: 1,
    total_shortage_units: 60,
    eligible_surplus_line_count: 2,
    eligible_surplus_units: 140,
  },
  {
    facility_code: 'H07',
    facility_name: 'Central Health Facility',
    shortage_line_count: 0,
    total_shortage_units: 0,
    eligible_surplus_line_count: 4,
    eligible_surplus_units: 380,
  },
  {
    facility_code: 'H08',
    facility_name: 'East District Hospital',
    shortage_line_count: 2,
    total_shortage_units: 90,
    eligible_surplus_line_count: 1,
    eligible_surplus_units: 75,
  },
  {
    facility_code: 'H09',
    facility_name: 'Riverside Health Centre',
    shortage_line_count: 1,
    total_shortage_units: 30,
    eligible_surplus_line_count: 3,
    eligible_surplus_units: 220,
  },
  {
    facility_code: 'H10',
    facility_name: 'Southside General Hospital',
    shortage_line_count: 0,
    total_shortage_units: 0,
    eligible_surplus_line_count: 2,
    eligible_surplus_units: 165,
  },
];

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

  const [planningDate, setPlanningDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [budget, setBudget] = useState('5000');
  const [runMessage, setRunMessage] = useState('');

  const loadNetworkData = useCallback(async () => {
    await optimization.refreshLatestRun();
  }, [optimization.refreshLatestRun]);

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
        `Demo completed with ${result.summary.transfer_count} illustrative transfer line(s).`,
      );
    } catch {
      setRunMessage('Unable to generate the demo result. Please try again.');
    }
  };

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'NETWORK_COORDINATOR') {
    return <Navigate to="/dashboard" replace />;
  }

  const facilities = DEMO_FACILITIES;
  const facilityCount = facilities.length;

  const shortageLineCount = facilities.reduce(
    (sum, facility) => sum + facility.shortage_line_count,
    0,
  );

  const totalShortageUnits = facilities.reduce(
    (sum, facility) => sum + facility.total_shortage_units,
    0,
  );

  const eligibleSurplusUnits = facilities.reduce(
    (sum, facility) => sum + facility.eligible_surplus_units,
    0,
  );

  const eligibleSurplusLines = facilities.reduce(
    (sum, facility) => sum + facility.eligible_surplus_line_count,
    0,
  );

  const latest = optimization.latest;

  return (
    <main className="min-h-screen bg-[#f3efe6] px-5 pb-12 pt-5 font-sans text-[#193632] sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1280px]">
        {/* A restrained notice, matching the dashboard's dotted divider. */}
        <div className="flex items-start gap-2.5 border-b border-dashed border-[#ded6c7] pb-3 text-xs leading-5 text-[#7a8982] sm:text-[13px]">
          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#d89a18]" />
          <p>
            Preview workspace. Facility figures are illustrative sample data;
            optimization results are not verified hospital recommendations.
          </p>
        </div>

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
              disabled={optimization.latestStatus === 'loading'}
              className="inline-flex items-center gap-2 rounded-md px-2 py-2 text-sm text-[#7a8982] transition-colors hover:text-[#193632] disabled:opacity-50"
            >
              <RefreshCw
                size={15}
                className={
                  optimization.latestStatus === 'loading' ? 'animate-spin' : ''
                }
              />
              Refresh
            </button>
          </div>
        </section>

        {/* Reliable page-level navigation for coordinator workspaces. */}
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

        {/* Editorial metric strip: dividers rather than separate cards. */}
        <section className="grid grid-cols-1 border-y border-[#ded6c7] sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Facilities"
            value={facilityCount}
            detail="Facilities included in the sample network"
          />
          <MetricCard
            title="Shortage lines"
            value={shortageLineCount}
            detail={`${totalShortageUnits.toLocaleString('en-IN')} sample units below target`}
          />
          <MetricCard
            title="Eligible surplus"
            value={eligibleSurplusUnits.toLocaleString('en-IN')}
            detail={`${eligibleSurplusLines} potential surplus lines in sample data`}
          />
          <MetricCard
            title="Latest run"
            value={latest?.run ? 'Run available' : 'No run yet'}
            detail={
              latest?.run
                ? `${latest.summary.transfer_count} illustrative transfer lines`
                : 'Run an optimization preview to see sample results'
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
                  Sample shortage and surplus figures by facility.
                </p>
              </div>
              <span className="font-mono text-xs text-[#7a8982]">
                {facilityCount.toString().padStart(2, '0')} FACILITIES
              </span>
            </div>

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
            <p className="mt-3 text-xs italic leading-5 text-[#7a8982]">
              Facility values are sample figures for preview only.
            </p>
          </div>

          {/* Planning panel */}
          <section className="min-w-0 border border-[#ded6c7] bg-[#f3efe6] p-5 sm:p-6">
            <div className="border-b border-[#ded6c7] pb-5">
              <p className="font-mono text-[11px] tracking-wide text-[#7a8982]">
                PLANNING
              </p>
              <h2 className="mt-2 font-sans text-[25px] leading-tight tracking-tight text-[#193632]">
                Run demo optimization
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#7a8982]">
                Set a planning date and a transfer budget to preview a possible
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
                  The preview uses sample transfer lines and the selected
                  budget.
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
                  className={`border px-3.5 py-3 text-sm leading-5 ${
                    runMessage.startsWith('Demo completed')
                      ? 'border-[#cfe0d8] bg-[#f0f7f3] text-[#315d4c]'
                      : 'border-[#e5d4ad] bg-[#fff8e8] text-[#825c14]'
                  }`}
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
                    Preparing preview…
                  </>
                ) : (
                  <>
                    <Play size={15} />
                    Run demo optimization
                  </>
                )}
              </button>
            </form>
            <p className="mt-4 border-t border-dashed border-[#ded6c7] pt-4 text-xs leading-5 text-[#7a8982]">
              Demo only. No real stock is moved by this action.
            </p>
          </section>
        </section>

        {/* Latest result */}
        <section className="mt-11">
          <div className="flex flex-col justify-between gap-3 border-b border-[#ded6c7] pb-4 sm:flex-row sm:items-end">
            <div>
              <p className="font-mono text-[11px] tracking-wide text-[#7a8982]">
                OPTIMIZATION PREVIEW
              </p>
              <h2 className="mt-2 font-sans text-[25px] leading-tight tracking-tight text-[#193632]">
                Latest demo result
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#7a8982]">
                Illustrative transfers and remaining shortages.
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
              <LoadingState label="Preparing demo result…" />
            ) : !latest?.run ? (
              <EmptyState
                title="No demo result yet"
                description="Choose a planning date and budget, then run the demo to preview a result."
              />
            ) : (
              <div>
                <p className="mb-5 border-l-2 border-[#d89a18] bg-[#fff8e8] px-4 py-3 text-sm leading-6 text-[#825c14]">
                  This result is illustrative. No production optimization
                  solver was run.
                </p>

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
                      {latest.summary.unmet_shortage_units.toLocaleString('en-IN')}
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
                        Review sample transfer routes
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
                        Review outstanding sample demand
                      </span>
                    </span>
                    <span className="font-sans text-2xl tabular-nums text-[#b94b3c]">
                      {latest.summary.unmet_shortage_count}
                    </span>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>

        <footer className="mt-8 border-t border-dashed border-[#ded6c7] pt-4 text-xs leading-5 text-[#7a8982]">
          Frontend demo. Facility figures are sample values; no real stock is
          moved by this page.
        </footer>
      </div>
    </main>
  );
}
