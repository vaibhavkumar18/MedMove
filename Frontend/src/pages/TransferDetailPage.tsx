
import {
  ArrowLeft,
  Calendar,
  Package,
  Route,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { Link, Navigate, useParams } from 'react-router-dom';

import { useAppSelector } from '../hooks/useAppSelector';
import { useOptimization } from '../hooks/useOptimization';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';
import { formatDate } from '../utils/dates';
import { paiseToRupees } from '../utils/money';
import type { Transfer } from '../types/contracts';

function DetailRow({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-dashed border-[#ded6c7] py-3.5 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <p className="shrink-0 text-sm text-[#7a8982] sm:w-44">{label}</p>
      <div className="min-w-0 text-right sm:text-left">
        <p className="text-sm font-medium text-[#193632]">{value}</p>
        {sub && <p className="mt-0.5 text-[11px] text-[#7a8982]">{sub}</p>}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800">
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status.replaceAll('_', ' ')}
    </span>
  );
}

export default function TransferDetailPage() {
  const { transferIndex } = useParams<{
    runId: string;
    transferIndex: string;
  }>();

  const user = useAppSelector((state) => state.auth.user);
  const isInitializing = useAppSelector((state) => state.auth.isInitializing);
  const optimization = useOptimization();
  const latest = optimization.latest;

  if (isInitializing) return <LoadingState label="Checking your session…" />;
  if (!user) return <Navigate to="/login" replace />;

  // Derive the transfer from Redux state.
  // The recommendations page always loads /latest, so we reuse that state.
  // If the user navigated here directly, state may be empty; show loading.
  if (optimization.latestStatus === 'idle' || optimization.latestStatus === 'loading') {
    return <LoadingState label="Loading transfer details…" />;
  }

  const run = latest?.run ?? null;
  const transfers = latest?.transfers ?? [];
  const index = transferIndex !== undefined ? parseInt(transferIndex, 10) : NaN;
  const transfer: Transfer | undefined =
    !isNaN(index) && index >= 0 && index < transfers.length
      ? transfers[index]
      : undefined;

  if (!transfer) {
    return (
      <main className="min-h-screen bg-[#f3efe6] px-5 pb-12 pt-6 font-sans text-[#193632] sm:px-8 lg:px-10">
        <div className="mx-auto max-w-[900px]">
          <Link
            to="/recommendations"
            className="mb-8 inline-flex items-center gap-2 text-sm text-[#7a8982] hover:text-[#193632]"
          >
            <ArrowLeft size={15} />
            Back to recommendations
          </Link>
          <EmptyState
            title="Transfer not found"
            description="This transfer line could not be located in the latest saved result. The result may have been refreshed."
          />
        </div>
      </main>
    );
  }

  const isCoordinator = user.role === 'NETWORK_COORDINATOR';
  const srcName = transfer.source_facility_name ?? transfer.source_facility_code;
  const dstName = transfer.destination_facility_name ?? transfer.destination_facility_code;
  const medLabel = transfer.medicine_name ?? transfer.medicine_code;

  return (
    <main className="min-h-screen bg-[#f3efe6] px-5 pb-12 pt-6 font-sans text-[#193632] sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[900px]">
        {/* Back link */}
        <Link
          to="/recommendations"
          className="mb-6 inline-flex items-center gap-2 text-sm text-[#7a8982] hover:text-[#193632]"
        >
          <ArrowLeft size={15} />
          Back to recommendations
        </Link>

        {/* Page header */}
        <div className="mb-8">
          <p className="font-mono text-xs tracking-wide text-[#7a8982]">
            TRANSFER DETAIL · {transfer.status.replaceAll('_', ' ')}
          </p>
          <h1 className="mt-3 font-sans text-[28px] font-medium leading-tight tracking-tight text-[#193632] sm:text-[36px]">
            {srcName}
            <span className="mx-3 text-[#7a8982]">→</span>
            {dstName}
          </h1>
          <p className="mt-2 text-sm text-[#7a8982]">
            {medLabel}
          </p>
        </div>

        {/* Direction badge for hospital users */}
        {!isCoordinator && transfer.direction && (
          <div className="mb-6">
            <span
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold ${
                transfer.direction === 'INCOMING'
                  ? 'border-sky-200 bg-sky-50 text-sky-700'
                  : 'border-orange-200 bg-orange-50 text-orange-700'
              }`}
            >
              {transfer.direction === 'INCOMING' ? 'INCOMING TO YOUR FACILITY' : 'OUTGOING FROM YOUR FACILITY'}
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          {/* Left: main detail sections */}
          <div className="space-y-6">

            {/* A. Transfer overview */}
            <section className="rounded-xl border border-[#ded6c7] bg-white px-6 py-5">
              <div className="mb-4 flex items-center gap-2.5">
                <Route size={16} className="text-[#1f625d]" />
                <h2 className="text-base font-semibold text-[#193632]">Transfer overview</h2>
              </div>

              <DetailRow
                label="Source facility"
                value={srcName}
                sub={transfer.source_facility_name ? transfer.source_facility_code : undefined}
              />
              <DetailRow
                label="Destination facility"
                value={dstName}
                sub={transfer.destination_facility_name ? transfer.destination_facility_code : undefined}
              />
              <DetailRow
                label="Medicine"
                value={medLabel}
                sub={transfer.medicine_name ? transfer.medicine_code : undefined}
              />
              <DetailRow
                label="Batch / lot"
                value={<span className="font-mono text-[13px]">{transfer.source_batch_code}</span>}
              />
              <DetailRow
                label="Proposed quantity"
                value={`${transfer.recommended_quantity_units.toLocaleString('en-IN')} units`}
              />
              <DetailRow
                label="Estimated cost"
                value={paiseToRupees(transfer.estimated_cost_minor_units)}
                sub="Estimate only — validate before approving"
              />
              <DetailRow
                label="Transit time"
                value={`${transfer.transit_days} day${transfer.transit_days === 1 ? '' : 's'}`}
                sub="Based on configured route"
              />
              <DetailRow label="Status" value={<StatusBadge status={transfer.status} />} />
            </section>

            {/* B. Why this transfer was recommended */}
            <section className="rounded-xl border border-[#ded6c7] bg-white px-6 py-5">
              <div className="mb-4 flex items-center gap-2.5">
                <Package size={16} className="text-[#1f625d]" />
                <h2 className="text-base font-semibold text-[#193632]">Why this transfer was recommended</h2>
              </div>

              <p className="text-sm leading-7 text-[#4a5e59]">
                The optimizer identified that{' '}
                <strong className="text-[#193632]">{dstName}</strong>
                {' '}has a stock shortage for{' '}
                <strong className="text-[#193632]">{medLabel}</strong>,
                while{' '}
                <strong className="text-[#193632]">{srcName}</strong>
                {' '}holds eligible stock above its minimum reserve.
              </p>

              <p className="mt-3 text-sm leading-7 text-[#4a5e59]">
                Transferring{' '}
                <strong className="text-[#193632]">
                  {transfer.recommended_quantity_units.toLocaleString('en-IN')} units
                </strong>
                {' '}from batch{' '}
                <span className="font-mono text-[13px] text-[#193632]">{transfer.source_batch_code}</span>
                {' '}via the configured route would partially or fully address the destination shortage,
                at an estimated transport cost of{' '}
                <strong className="text-[#193632]">{paiseToRupees(transfer.estimated_cost_minor_units)}</strong>
                {' '}with a transit time of{' '}
                <strong className="text-[#193632]">{transfer.transit_days} day{transfer.transit_days === 1 ? '' : 's'}</strong>.
              </p>

              <p className="mt-3 text-sm leading-7 text-[#7a8982]">
                The optimizer considered stock eligibility, batch expiry, route capacity, the
                destination's minimum remaining shelf-life requirement, and the overall transfer
                budget when selecting this recommendation.
              </p>

              {transfer.reason && (
                <div className="mt-4 rounded-lg border border-[#ded6c7] bg-[#f7f3ec] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#7a8982]">Explanation code</p>
                  <p className="mt-1 font-mono text-xs text-[#4a5e59]">{transfer.reason}</p>
                </div>
              )}

              <div className="mt-4 rounded-lg border border-[#e2ddd6] bg-[#fafaf8] px-4 py-3">
                <p className="text-[11px] leading-5 text-[#7a8982]">
                  <ShieldCheck size={12} className="mr-1.5 inline-block" />
                  This is a proposed recommendation only. No stock has been moved.
                  Costs and transit times are estimates derived from configured route data and
                  require operational validation before any transfer is approved.
                </p>
              </div>
            </section>

          </div>

          {/* Right: optimization context */}
          <div className="space-y-6">

            {/* D. Optimization context */}
            {run && (
              <section className="rounded-xl border border-[#ded6c7] bg-white px-5 py-5">
                <div className="mb-4 flex items-center gap-2.5">
                  <Calendar size={15} className="text-[#1f625d]" />
                  <h2 className="text-sm font-semibold text-[#193632]">Optimization context</h2>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-[#7a8982]">Planning date</p>
                    <p className="mt-0.5 text-sm font-medium text-[#193632]">
                      {typeof run.planning_date === 'string'
                        ? run.planning_date
                        : String(run.planning_date)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#7a8982]">Transfer budget</p>
                    <p className="mt-0.5 text-sm font-medium text-[#193632]">
                      {paiseToRupees(run.budget_minor_units)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#7a8982]">Run date</p>
                    <p className="mt-0.5 text-sm font-medium text-[#193632]">
                      {formatDate(run.created_at)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#7a8982]">Trigger</p>
                    <p className="mt-0.5 text-sm font-medium text-[#193632]">
                      {run.trigger_source}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#7a8982]">Status</p>
                    <p className="mt-0.5 text-sm font-medium text-[#193632]">
                      {run.status}
                    </p>
                  </div>
                  <div className="pt-1">
                    <p className="text-[10px] text-[#7a8982]">Run ID</p>
                    <p className="mt-0.5 break-all font-mono text-[10px] text-[#7a8982]">
                      {run.run_id}
                    </p>
                  </div>
                </div>
              </section>
            )}

            {/* Summary stats */}
            {latest && (
              <section className="rounded-xl border border-[#ded6c7] bg-white px-5 py-5">
                <div className="mb-4 flex items-center gap-2.5">
                  <Wallet size={15} className="text-[#1f625d]" />
                  <h2 className="text-sm font-semibold text-[#193632]">Run summary</h2>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-[#7a8982]">Total transfer lines</p>
                    <p className="mt-0.5 text-sm font-medium text-[#193632]">
                      {latest.summary.transfer_count}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#7a8982]">Total recommended units</p>
                    <p className="mt-0.5 text-sm font-medium text-[#193632]">
                      {latest.summary.total_recommended_units.toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#7a8982]">Total estimated cost</p>
                    <p className="mt-0.5 text-sm font-medium text-[#193632]">
                      {paiseToRupees(latest.summary.total_cost_minor_units)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#7a8982]">Unmet shortage lines</p>
                    <p className="mt-0.5 text-sm font-medium text-[#193632]">
                      {latest.summary.unmet_shortage_line_count}
                    </p>
                  </div>
                </div>
              </section>
            )}

          </div>
        </div>
      </div>
    </main>
  );
}
