
import { ArrowRight, RefreshCw } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { useCallback, useEffect, useMemo } from 'react';

import { useDashboard } from '../hooks/useDashboard';
import { useOptimization } from '../hooks/useOptimization';
import { useAppSelector } from '../hooks/useAppSelector';

import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';

import { formatDate } from '../utils/dates';
import { paiseToRupees } from '../utils/money';

type DashboardTransfer = {
  source_batch_code: string;
  medicine_code: string;
  source_facility_code: string;
  destination_facility_code: string;
  recommended_quantity_units: number;
  estimated_cost_minor_units: number;
};

function formatNumber(value: number): string {
  return value.toLocaleString('en-IN');
}

export default function HospitalDashboardPage() {
  const user = useAppSelector((state) => state.auth.user);
  const dashboard = useDashboard();
  const optimization = useOptimization();

  const facilityCode = user?.facility_code ?? '';
  const facilityName = user?.facility_name ?? facilityCode ?? 'Your facility';

  const reload = useCallback(async () => {
    await Promise.allSettled([
      dashboard.loadDashboard(),
      optimization.refreshLatestRun(),
    ]);
  }, [dashboard.loadDashboard, optimization.refreshLatestRun]);

  useEffect(() => {
    if (user && user.role !== 'NETWORK_COORDINATOR') {
      void reload();
    }
  }, [reload, user]);

  const summary = dashboard.data?.summary;
  const facilityData = useMemo(
    () =>
      dashboard.data?.facilities.find(
        (f) => f.facility_code === facilityCode,
      ) ?? null,
    [dashboard.data, facilityCode],
  );

  const transfers: DashboardTransfer[] = useMemo(
    () =>
      (optimization.latest?.transfers ?? []).map((item) => ({
        source_batch_code: item.source_batch_code,
        medicine_code: item.medicine_code,
        source_facility_code: item.source_facility_code,
        destination_facility_code: item.destination_facility_code,
        recommended_quantity_units: item.recommended_quantity_units,
        estimated_cost_minor_units: item.estimated_cost_minor_units,
      })),
    [optimization.latest],
  );

  const visibleTransfers = useMemo(
    () =>
      transfers.filter(
        (t) =>
          t.source_facility_code === facilityCode ||
          t.destination_facility_code === facilityCode,
      ),
    [facilityCode, transfers],
  );

  const incoming = useMemo(
    () =>
      visibleTransfers.filter(
        (t) => t.destination_facility_code === facilityCode,
      ),
    [facilityCode, visibleTransfers],
  );

  const outgoing = useMemo(
    () =>
      visibleTransfers.filter(
        (t) => t.source_facility_code === facilityCode,
      ),
    [facilityCode, visibleTransfers],
  );

  const hasApiData = Boolean(dashboard.data);
  const isLoading = dashboard.status === 'loading' && !dashboard.data;

  const displayMedicineCount = summary?.medicine_count ?? '—';
  const displayShortageCount =
    facilityData?.shortage_line_count ?? summary?.shortage_line_count ?? '—';
  const displayShortageUnits = facilityData
    ? `${formatNumber(facilityData.total_shortage_units)} units below target`
    : hasApiData
      ? `${formatNumber(summary?.total_shortage_units ?? 0)} units below target`
      : 'Connect the backend to calculate demand shortages';

  const displaySurplus = facilityData?.eligible_surplus_units ?? '—';
  const displaySurplusLines = facilityData
    ? `${formatNumber(facilityData.eligible_surplus_line_count)} potential surplus lines`
    : hasApiData
      ? `${formatNumber(summary?.eligible_surplus_line_count ?? 0)} potential surplus lines`
      : 'Eligible and unexpired local stock';

  const displayRunStatus =
    summary?.latest_run_status ??
    (optimization.latest ? 'Run available' : 'No run yet');

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === 'NETWORK_COORDINATOR') {
    return <Navigate to="/network" replace />;
  }

  if (isLoading) {
    return (
      <div className="space-y-5">
        <LoadingState label="Loading your hospital overview…" />
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1280px] px-5 pb-12 pt-5 font-sans text-[#193632] sm:px-8 lg:px-10">
      <section className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div className="min-w-0">
          <p className="mb-3 font-mono text-xs text-[#71827d]">
            {facilityCode || 'H01'} · Hospital user
          </p>
          <h1 className="font-sans text-4xl font-medium leading-tight tracking-tight text-[#193632] sm:text-5xl">
            Good to see you, {user.full_name.split(' ')[0] || 'there'}.
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#71827d] sm:text-base">
            Here's where {facilityName} stands today.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-4">
          <button
            type="button"
            className="inline-flex items-center gap-2 py-2 text-sm text-[#71827d] hover:text-[#193632] disabled:opacity-50"
            onClick={() => void reload()}
            disabled={dashboard.status === 'loading'}
          >
            <RefreshCw
              size={14}
              className={dashboard.status === 'loading' ? 'animate-spin' : ''}
            />
            Refresh
          </button>

          <Link
            to="/inventory"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-[#1f625d] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#174d49]"
          >
            Manage inventory <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      {dashboard.error && (
        <div className="mb-8">
          <ErrorState
            message="Dashboard data is unavailable. Check the backend connection and try refreshing."
            onRetry={reload}
          />
        </div>
      )}

      {/* Summary metrics */}
      <section className="mb-12 grid grid-cols-1 border-y border-[#ded7c8] sm:grid-cols-2 lg:grid-cols-4">
        <div className="border-b border-[#ded7c8] px-4 py-5 sm:border-r lg:border-b-0 lg:py-6 lg:pl-0">
          <p className="text-sm text-[#71827d]">Medicines tracked</p>
          <p className="mt-2 font-sans text-4xl leading-none text-[#193632]">
            {displayMedicineCount}
          </p>
          <p className="mt-3 text-xs leading-5 text-[#71827d]">
            Unique medicines for this facility
          </p>
        </div>

        <div className="border-b border-[#ded7c8] px-4 py-5 lg:border-r lg:border-b-0 lg:py-6">
          <p className="text-sm text-[#71827d]">Shortage lines</p>
          <p className="mt-2 font-sans text-4xl leading-none text-[#193632]">
            {displayShortageCount}
          </p>
          <p className="mt-3 text-xs leading-5 text-[#71827d]">
            {displayShortageUnits}
          </p>
        </div>

        <div className="border-b border-[#ded7c8] px-4 py-5 sm:border-r sm:border-b-0 lg:py-6">
          <p className="text-sm text-[#71827d]">Eligible surplus</p>
          <p className="mt-2 font-sans text-4xl leading-none text-[#193632]">
            {typeof displaySurplus === 'number'
              ? formatNumber(displaySurplus)
              : displaySurplus}
          </p>
          <p className="mt-3 text-xs leading-5 text-[#71827d]">
            {displaySurplusLines}
          </p>
        </div>

        <div className="px-4 py-5 lg:py-6 lg:pr-0">
          <p className="text-sm text-[#71827d]">Latest run</p>
          <p className="mt-3 font-sans text-2xl leading-tight text-[#193632]">
            {displayRunStatus}
          </p>
          <p className="mt-2 text-xs leading-5 text-[#71827d]">
            {dashboard.data?.latest_run
              ? `Updated ${formatDate(dashboard.data.latest_run.created_at)}`
              : 'Waiting for a network optimization run'}
          </p>
        </div>
      </section>

      {/* Transfers + facility aside */}
      <section className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)] lg:gap-12">
        <div className="min-w-0">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-sans text-2xl font-medium text-[#193632] sm:text-3xl">
                Proposed transfers
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#71827d]">
                Proposals involving your facility. Each needs review before it proceeds.
              </p>
            </div>
            <Link
              to="/recommendations"
              className="shrink-0 text-sm text-[#1f625d] underline underline-offset-4 hover:text-[#174d49]"
            >
              All recommendations
            </Link>
          </div>

          <div className="mb-1 flex items-center gap-6 border-b border-[#ded7c8] text-sm">
            <span className="border-b-2 border-[#1f625d] pb-3 font-medium text-[#193632]">
              All{' '}
              <span className="ml-1 text-xs text-[#71827d]">
                {visibleTransfers.length}
              </span>
            </span>
            <span className="pb-3 text-[#71827d]">
              Incoming{' '}
              <span className="ml-1 text-xs">{incoming.length}</span>
            </span>
            <span className="pb-3 text-[#71827d]">
              Outgoing{' '}
              <span className="ml-1 text-xs">{outgoing.length}</span>
            </span>
          </div>

          {optimization.latestStatus === 'loading' && !optimization.latest ? (
            <LoadingState label="Loading recommendations…" />
          ) : optimization.error && !optimization.latest ? (
            <div className="py-6">
              <EmptyState
                title="Recommendations unavailable"
                description="The optimizer API is not connected or no result could be loaded."
              />
            </div>
          ) : visibleTransfers.length === 0 ? (
            <div className="py-6">
              <EmptyState
                title="No transfer proposals for this facility"
                description={
                  optimization.latest
                    ? 'The latest run has no incoming or outgoing proposals for your facility.'
                    : 'A Network Coordinator must run the optimizer before proposals are available.'
                }
              />
            </div>
          ) : (
            <div className="divide-y divide-[#ded7c8]">
              {visibleTransfers.slice(0, 5).map((transfer, index) => {
                const isIncoming =
                  transfer.destination_facility_code === facilityCode;
                const otherFacilityCode = isIncoming
                  ? transfer.source_facility_code
                  : transfer.destination_facility_code;

                return (
                  <div
                    className="flex flex-wrap items-center gap-3 py-4"
                    key={`${transfer.source_batch_code}-${transfer.medicine_code}-${index}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="font-mono text-sm font-medium text-[#193632]">
                          {transfer.medicine_code}
                        </span>
                        <span className="font-mono text-xs text-[#71827d]">
                          {transfer.source_facility_code} →{' '}
                          {transfer.destination_facility_code}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-[#71827d]">
                        {isIncoming ? 'Receiving from' : 'Sending to'}{' '}
                        {otherFacilityCode}{' '}
                        <span className="font-mono text-xs">
                          {transfer.source_batch_code}
                        </span>
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-sans text-xl leading-none text-[#193632]">
                        {formatNumber(transfer.recommended_quantity_units)}
                        <span className="ml-1 font-sans text-xs text-[#71827d]">
                          units
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-[#71827d]">
                        {paiseToRupees(transfer.estimated_cost_minor_units)}
                      </p>
                    </div>

                    <span className="inline-flex items-center gap-2 text-xs text-amber-800">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      Pending review
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <aside className="min-w-0">
          <section className="rounded-md border border-[#ded7c8] bg-[#fbf8f1] p-5">
            <p className="text-xs text-[#71827d]">Your facility</p>
            <h2 className="mt-2 font-sans text-2xl leading-tight text-[#193632]">
              {facilityName}
            </h2>
            <p className="mt-2 font-mono text-xs text-[#71827d]">
              {facilityCode || 'Facility not assigned'}
            </p>
          </section>

          {facilityData && (
            <section className="mt-10">
              <h2 className="mb-4 font-sans text-2xl text-[#193632]">
                Facility stock health
              </h2>

              {[
                {
                  label: 'Shortage lines',
                  value: formatNumber(facilityData.shortage_line_count),
                  danger: facilityData.shortage_line_count > 0,
                },
                {
                  label: 'Total shortage units',
                  value: formatNumber(facilityData.total_shortage_units),
                  danger: facilityData.total_shortage_units > 0,
                },
                {
                  label: 'Surplus lines',
                  value: formatNumber(facilityData.eligible_surplus_line_count),
                  danger: false,
                },
                {
                  label: 'Eligible surplus units',
                  value: formatNumber(facilityData.eligible_surplus_units),
                  danger: false,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between gap-4 border-b border-dashed border-[#ded7c8] py-4 last:border-b-0"
                >
                  <span className="text-sm text-[#71827d]">{item.label}</span>
                  <span
                    className={`font-sans text-xl ${
                      item.danger ? 'text-red-700' : 'text-[#193632]'
                    }`}
                  >
                    {item.value}
                  </span>
                </div>
              ))}

              <p className="mt-5 text-xs leading-5 text-[#71827d]">
                Calculated from ELIGIBLE batch stock vs. facility targets.
                Transfers must satisfy the network optimizer's full constraints.
              </p>
            </section>
          )}

          {!facilityData && hasApiData && (
            <section className="mt-10">
              <EmptyState
                title="No facility data"
                description="Stock health for your facility is not available in the current dashboard response."
              />
            </section>
          )}
        </aside>
      </section>
    </main>
  );
}
