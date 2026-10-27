import { Activity, CalendarDays, Package, ShieldAlert, Wallet } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useEffect, useMemo } from 'react';

import { useAppSelector } from '../hooks/useAppSelector';
import { useOptimization } from '../hooks/useOptimization';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';
import TransferTable from '../components/TransferTable';
import UnmetShortageList from '../components/UnmetShortageList';
import { formatDate } from '../utils/dates';
import { paiseToRupees } from '../utils/money';

function normalizeFacilityCode(code: string | null | undefined): string {
  return (code ?? '').trim().toUpperCase().replace(/^([A-Z]+)0+(\d+)$/, '$1$2');
}

function formatNumber(value: number): string {
  return value.toLocaleString('en-IN');
}

export default function RecommendationsPage() {
  const user = useAppSelector((state) => state.auth.user);
  const isInitializing = useAppSelector((state) => state.auth.isInitializing);
  const optimization = useOptimization();
  const { refreshLatestRun } = optimization;
  const latest = optimization.latest;
  const isCoordinator = user?.role === 'NETWORK_COORDINATOR';
  const userFacility = normalizeFacilityCode(user?.facility_code);

  useEffect(() => {
    if (user) void refreshLatestRun();
  }, [user, refreshLatestRun]);

  const visibleTransfers = useMemo(() => {
    const transfers = latest?.transfers ?? [];
    if (isCoordinator) return transfers;
    return transfers.filter(
      (transfer) =>
        normalizeFacilityCode(transfer.source_facility_code) === userFacility ||
        normalizeFacilityCode(transfer.destination_facility_code) === userFacility,
    );
  }, [isCoordinator, latest, userFacility]);

  const visibleShortages = useMemo(() => {
    const shortages = latest?.unmet_shortages ?? [];
    if (isCoordinator) return shortages;
    return shortages.filter(
      (shortage) => normalizeFacilityCode(shortage.facility_code) === userFacility,
    );
  }, [isCoordinator, latest, userFacility]);

  if (isInitializing) return <LoadingState label="Checking your session…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (optimization.latestStatus === 'loading' && !latest) {
    return <LoadingState label="Loading recommendations…" />;
  }

  const visibleCost = visibleTransfers.reduce(
    (sum, transfer) => sum + transfer.estimated_cost_minor_units,
    0,
  );
  const visibleUnits = visibleTransfers.reduce(
    (sum, transfer) => sum + transfer.recommended_quantity_units,
    0,
  );
  const remainingShortage = visibleShortages.reduce(
    (sum, shortage) => sum + shortage.shortage_after_units,
    0,
  );

  return (
    <main className="min-h-screen bg-[#f3efe6] px-5 pb-12 pt-6 font-sans text-[#193632] sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1240px]">
        <div className="flex items-start gap-2.5 border-b border-dashed border-[#ded6c7] pb-3 text-xs leading-5 text-[#7a8982] sm:text-[13px]">
          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#d89a18]" />
          <p>Persisted optimizer results from the MedMove API.</p>
        </div>

        <section className="flex flex-col justify-between gap-5 py-7 sm:flex-row sm:items-end sm:py-8">
          <div className="min-w-0">
            <p className="font-mono text-xs tracking-wide text-[#7a8982]">
              {isCoordinator ? 'NETWORK · COORDINATOR' : `${user.facility_code ?? 'FACILITY'} · HOSPITAL USER`}
            </p>
            <h1 className="mt-3 font-sans text-[34px] font-medium leading-tight tracking-[-0.035em] text-[#193632] sm:text-[43px]">
              Transfer recommendations
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#7a8982] sm:text-[15px]">
              Review proposed medicine transfers and outstanding shortages from the latest saved run.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-xs text-[#7a8982]">
            <span className="h-2 w-2 rounded-full bg-[#1f625d]" />
            Live environment
          </div>
        </section>

        {!latest ? (
          <EmptyState
            title="No optimization run yet"
            description="A Network Coordinator must run the optimizer before recommendations are available."
          />
        ) : (
          <>
            <section className="border-y border-[#ded6c7] py-4">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <p className="font-sans text-xl text-[#193632]">Optimization run overview</p>
                  <p className="mt-1 text-sm text-[#7a8982]">Persisted run details and transfer metrics</p>
                </div>
                <span className="inline-flex w-fit items-center gap-2 text-xs text-[#8a6417]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#1f625d]" />
                  {latest.run?.status ?? 'Unknown'}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-1 border-t border-[#ded6c7] sm:grid-cols-2 xl:grid-cols-4">
                <div className="flex items-start gap-3 py-4 sm:px-4 xl:first:pl-0">
                  <CalendarDays size={16} className="mt-0.5 shrink-0 text-[#7a8982]" />
                  <div><p className="text-xs text-[#7a8982]">Run date</p><p className="mt-1.5 text-sm font-medium text-[#193632]">{latest.run ? formatDate(latest.run.created_at) : '—'}</p></div>
                </div>
                <div className="flex items-start gap-3 border-t border-[#ded6c7] py-4 sm:border-l sm:px-4 sm:border-t-0">
                  <Activity size={16} className="mt-0.5 shrink-0 text-[#7a8982]" />
                  <div><p className="text-xs text-[#7a8982]">Trigger source</p><p className="mt-1.5 text-sm font-medium text-[#193632]">{latest.run?.trigger_source ?? '—'}</p></div>
                </div>
                <div className="flex items-start gap-3 border-t border-[#ded6c7] py-4 xl:border-l xl:px-4 xl:border-t-0">
                  <Package size={16} className="mt-0.5 shrink-0 text-[#7a8982]" />
                  <div><p className="text-xs text-[#7a8982]">Transfer lines</p><p className="mt-1.5 text-sm font-medium text-[#193632]">{visibleTransfers.length}</p></div>
                </div>
                <div className="flex items-start gap-3 border-t border-[#ded6c7] py-4 sm:border-l sm:px-4 xl:border-t-0">
                  <Wallet size={16} className="mt-0.5 shrink-0 text-[#7a8982]" />
                  <div><p className="text-xs text-[#7a8982]">Estimated cost</p><p className="mt-1.5 text-sm font-medium text-[#193632]">{paiseToRupees(visibleCost)}</p></div>
                </div>
              </div>
            </section>

            <section className="mt-8 grid grid-cols-1 border-y border-[#ded6c7] sm:grid-cols-2 xl:grid-cols-4">
              <div className="min-w-0 border-b border-[#ded6c7] px-0 py-5 sm:px-5 xl:border-b-0 xl:border-r xl:first:pl-0"><p className="text-sm text-[#7a8982]">Proposed transfer lines</p><p className="mt-2 text-3xl text-[#193632]">{formatNumber(visibleTransfers.length)}</p></div>
              <div className="min-w-0 border-b border-[#ded6c7] px-0 py-5 sm:px-5 xl:border-b-0 xl:border-r"><p className="text-sm text-[#7a8982]">Recommended units</p><p className="mt-2 text-3xl text-[#193632]">{formatNumber(visibleUnits)}</p></div>
              <div className="min-w-0 border-b border-[#ded6c7] px-0 py-5 sm:px-5 xl:border-b-0 xl:border-r"><p className="text-sm text-[#7a8982]">Estimated transport cost</p><p className="mt-2 text-3xl text-[#193632]">{paiseToRupees(visibleCost)}</p></div>
              <div className="min-w-0 px-0 py-5 sm:px-5 xl:last:pr-0"><p className="text-sm text-[#7a8982]">Remaining shortage</p><p className="mt-2 text-3xl text-[#193632]">{formatNumber(remainingShortage)}</p></div>
            </section>

            <section className="mt-10">
              <div className="flex items-end justify-between border-b border-[#ded6c7] pb-4"><div><h2 className="text-[25px] text-[#193632]">Proposed transfers</h2><p className="mt-2 text-sm text-[#7a8982]">Recommendations from the saved optimizer result.</p></div><span className="font-mono text-xs text-[#7a8982]">{String(visibleTransfers.length).padStart(2, '0')} TRANSFERS</span></div>
              {visibleTransfers.length ? <div className="mt-4 overflow-x-auto"><TransferTable transfers={visibleTransfers} role={user.role} runId={latest.run?.run_id} /></div> : <EmptyState title="No transfers in this scope" description="The latest run has no transfer recommendations for this facility." />}
            </section>

            <section className="mt-10">
              <div className="flex items-end gap-3 border-b border-[#ded6c7] pb-4"><ShieldAlert size={20} className="text-[#7a8982]" /><div><h2 className="text-[25px] text-[#193632]">Unmet shortages</h2><p className="mt-2 text-sm text-[#7a8982]">Shortages remaining after the proposed transfers.</p></div></div>
              <div className="mt-4"><UnmetShortageList shortages={visibleShortages} /></div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
