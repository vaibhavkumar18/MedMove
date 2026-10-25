import {
  Activity,
  CalendarDays,
  CheckCircle2,
  Package,
  ShieldAlert,
  Wallet,
} from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { useMemo } from 'react';

import { useAppSelector } from '../hooks/useAppSelector';
import LoadingState from '../components/LoadingState';
import { formatDate } from '../utils/dates';
import { paiseToRupees } from '../utils/money';
import TransferTable from '../components/TransferTable';

const demoResult = {
  run: {
    created_at: '2026-10-25T09:00:00Z',
    trigger_source: 'MANUAL',
    status: 'PENDING_REVIEW',
  },
  summary: {
    transfer_count: 3,
    estimated_cost_minor_units: 185000,
  },
  transfers: [
    {
      source_facility_code: 'H001',
      destination_facility_code: 'H002',
      medicine_code: 'MED-001',
      source_batch_code: 'BATCH-A101',
      recommended_quantity_units: 120,
      estimated_cost_minor_units: 45000,
      transit_days: 2,
      status: 'PENDING_REVIEW',
      direction: 'OUTGOING',
    },
    {
      source_facility_code: 'H003',
      destination_facility_code: 'H001',
      medicine_code: 'MED-002',
      source_batch_code: 'BATCH-B204',
      recommended_quantity_units: 80,
      estimated_cost_minor_units: 60000,
      transit_days: 1,
      status: 'PENDING_REVIEW',
      direction: 'INCOMING',
    },
    {
      source_facility_code: 'H001',
      destination_facility_code: 'H004',
      medicine_code: 'MED-003',
      source_batch_code: 'BATCH-C305',
      recommended_quantity_units: 50,
      estimated_cost_minor_units: 80000,
      transit_days: 3,
      status: 'PENDING_REVIEW',
      direction: 'OUTGOING',
    },
  ],
  unmet_shortages: [
    {
      facility_code: 'H002',
      medicine_code: 'MED-004',
      shortage_before_units: 100,
      recommended_inbound_units: 60,
      shortage_after_units: 40,
    },
    {
      facility_code: 'H004',
      medicine_code: 'MED-005',
      shortage_before_units: 75,
      recommended_inbound_units: 25,
      shortage_after_units: 50,
    },
  ],
};

function normalizeFacilityCode(code: string | null | undefined): string {
  return (code ?? '').trim().toUpperCase().replace(/^([A-Z]+)0+(\d+)$/, '$1$2');
}

function formatNumber(value: number): string {
  return value.toLocaleString('en-IN');
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="min-w-0 border-b border-[#ded6c7] px-0 py-5 sm:px-5 xl:border-b-0 xl:border-r xl:first:pl-0 xl:last:border-r-0 xl:last:pr-0">
      <p className="text-sm text-[#7a8982]">{label}</p>
      <p className="mt-2 break-words font-sans text-3xl leading-tight tracking-tight text-[#193632] sm:text-[34px]">
        {value}
      </p>
      <p className="mt-2 max-w-xs text-xs leading-5 text-[#7a8982]">{detail}</p>
    </article>
  );
}

export default function RecommendationsPage() {
  const user = useAppSelector((state) => state.auth.user);
  const isInitializing = useAppSelector((state) => state.auth.isInitializing);

  const isCoordinator = user?.role === 'NETWORK_COORDINATOR';
  const userFacility = normalizeFacilityCode(user?.facility_code);

  const visibleTransfers = useMemo(() => {
    if (isCoordinator) return demoResult.transfers;
    if (!userFacility) return [];
    return demoResult.transfers.filter(
      (transfer) =>
        normalizeFacilityCode(transfer.source_facility_code) === userFacility ||
        normalizeFacilityCode(transfer.destination_facility_code) === userFacility,
    );
  }, [isCoordinator, userFacility]);

  const visibleShortages = useMemo(() => {
    if (isCoordinator) return demoResult.unmet_shortages;
    if (!userFacility) return [];
    return demoResult.unmet_shortages.filter(
      (item) => normalizeFacilityCode(item.facility_code) === userFacility,
    );
  }, [isCoordinator, userFacility]);

  const visibleCost = visibleTransfers.reduce(
    (sum, transfer) => sum + transfer.estimated_cost_minor_units,
    0,
  );
  const visibleUnits = visibleTransfers.reduce(
    (sum, transfer) => sum + transfer.recommended_quantity_units,
    0,
  );
  const remainingShortage = visibleShortages.reduce(
    (sum, item) => sum + item.shortage_after_units,
    0,
  );

  if (isInitializing) return <LoadingState label="Checking your session…" />;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <main className="min-h-screen bg-[#f3efe6] px-5 pb-12 pt-6 font-sans text-[#193632] sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1240px]">
        <div className="flex items-start gap-2.5 border-b border-dashed border-[#ded6c7] pb-3 text-xs leading-5 text-[#7a8982] sm:text-[13px]">
          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#d89a18]" />
          <p>
            Preview workspace. Sample routes and quantities are illustrative and are not verified optimizer results.
          </p>
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
              {isCoordinator
                ? 'Review proposed medicine redistribution routes and outstanding shortages across the network.'
                : 'Review proposed medicine transfers involving your hospital, including incoming and outgoing stock.'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-xs text-[#7a8982]">
            <span className="h-2 w-2 rounded-full bg-[#d89a18]" />
            Demo environment
          </div>
        </section>

        <section className="border-y border-[#ded6c7] py-4">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <p className="font-sans text-xl text-[#193632]">Optimization run overview</p>
              <p className="mt-1 text-sm text-[#7a8982]">Sample run details and transfer metrics</p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 text-xs text-[#8a6417]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#d89a18]" />
              Pending review · Sample
            </span>
          </div>
          <div className="mt-4 grid grid-cols-1 border-t border-[#ded6c7] sm:grid-cols-2 xl:grid-cols-4">
            <div className="flex items-start gap-3 py-4 sm:px-4 xl:first:pl-0">
              <CalendarDays size={16} className="mt-0.5 shrink-0 text-[#7a8982]" />
              <div>
                <p className="text-xs text-[#7a8982]">Sample run date</p>
                <p className="mt-1.5 text-sm font-medium text-[#193632]">{formatDate(demoResult.run.created_at)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 border-t border-[#ded6c7] py-4 sm:border-l sm:px-4 sm:border-t-0">
              <Activity size={16} className="mt-0.5 shrink-0 text-[#7a8982]" />
              <div>
                <p className="text-xs text-[#7a8982]">Trigger source</p>
                <p className="mt-1.5 text-sm font-medium text-[#193632]">{demoResult.run.trigger_source}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 border-t border-[#ded6c7] py-4 xl:border-l xl:px-4 xl:border-t-0">
              <Package size={16} className="mt-0.5 shrink-0 text-[#7a8982]" />
              <div>
                <p className="text-xs text-[#7a8982]">{isCoordinator ? 'Network transfer lines' : 'Relevant transfer lines'}</p>
                <p className="mt-1.5 text-sm font-medium text-[#193632]">{visibleTransfers.length}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 border-t border-[#ded6c7] py-4 sm:border-l sm:px-4 xl:border-t-0">
              <Wallet size={16} className="mt-0.5 shrink-0 text-[#7a8982]" />
              <div>
                <p className="text-xs text-[#7a8982]">Illustrative cost</p>
                <p className="mt-1.5 text-sm font-medium text-[#193632]">{paiseToRupees(visibleCost)}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 grid grid-cols-1 border-y border-[#ded6c7] sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Proposed transfer lines" value={formatNumber(visibleTransfers.length)} detail="Sample routes in this view" />
          <Metric label="Recommended units" value={formatNumber(visibleUnits)} detail="Illustrative transfer quantity" />
          <Metric label="Estimated transport cost" value={paiseToRupees(visibleCost)} detail="Sample cost, not a live quote" />
          <Metric label="Remaining shortage" value={formatNumber(remainingShortage)} detail="Units across visible shortage records" />
        </section>

        <section className="mt-10">
          <div className="flex flex-col justify-between gap-3 border-b border-[#ded6c7] pb-4 sm:flex-row sm:items-end">
            <div>
              <h2 className="font-sans text-[25px] leading-tight tracking-tight text-[#193632]">Proposed transfers</h2>
              <p className="mt-2 text-sm leading-6 text-[#7a8982]">
                {isCoordinator
                  ? 'Illustrative routes between network facilities.'
                  : 'Illustrative routes where your facility is the source or destination.'}
              </p>
            </div>
            <span className="font-mono text-xs text-[#7a8982]">{visibleTransfers.length.toString().padStart(2, '0')} TRANSFERS</span>
          </div>

          {visibleTransfers.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <TransferTable transfers={visibleTransfers as never} role={user.role} />
            </div>
          ) : (
            <div className="border-b border-[#ded6c7] py-10">
              <Package size={21} className="text-[#7a8982]" />
              <h3 className="mt-3 font-sans text-xl text-[#193632]">No sample transfers for this facility</h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-[#7a8982]">
                This demo dataset does not include routes for the currently assigned facility. No live optimization has been run.
              </p>
            </div>
          )}
          <p className="mt-3 text-xs italic leading-5 text-[#7a8982]">Sample proposals for preview only. These are not approved transfers.</p>
        </section>

        <section className="mt-10">
          <div className="flex flex-col justify-between gap-3 border-b border-[#ded6c7] pb-4 sm:flex-row sm:items-end">
            <div>
              <h2 className="font-sans text-[25px] leading-tight tracking-tight text-[#193632]">Unmet shortages</h2>
              <p className="mt-2 text-sm leading-6 text-[#7a8982]">
                Remaining sample shortages after the illustrative proposed inbound quantity.
              </p>
            </div>
            <span className="font-mono text-xs text-[#7a8982]">{visibleShortages.length.toString().padStart(2, '0')} RECORDS</span>
          </div>

          {visibleShortages.length > 0 ? (
            <div className="mt-4 w-full overflow-x-auto">
              <table className="w-full min-w-[700px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-y border-[#ded6c7] text-xs text-[#7a8982]">
                    {['Facility', 'Medicine', 'Shortage before', 'Proposed inbound', 'Remaining shortage'].map((heading) => (
                      <th key={heading} className="whitespace-nowrap px-4 py-3 font-medium first:pl-0">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleShortages.map((item) => (
                    <tr key={`${item.facility_code}-${item.medicine_code}`} className="border-b border-[#e2dacb]">
                      <td className="px-4 py-4 pl-0 font-mono text-xs text-[#7a8982]">{item.facility_code}</td>
                      <td className="px-4 py-4 font-medium text-[#193632]">{item.medicine_code}</td>
                      <td className="px-4 py-4 tabular-nums text-[#7a8982]">{formatNumber(item.shortage_before_units)}</td>
                      <td className="px-4 py-4 tabular-nums text-[#1f625d]">+{formatNumber(item.recommended_inbound_units)}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium tabular-nums ${item.shortage_after_units > 0 ? 'text-[#b94b3c]' : 'text-[#1f625d]'}`}>
                          {item.shortage_after_units > 0 && <ShieldAlert size={13} />}
                          {formatNumber(item.shortage_after_units)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="border-b border-[#ded6c7] py-10">
              <CheckCircle2 size={21} className="text-[#7a8982]" />
              <h3 className="mt-3 font-sans text-xl text-[#193632]">No sample shortages for this facility</h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-[#7a8982]">The current demo records do not contain shortage entries for this facility.</p>
            </div>
          )}
        </section>

        <footer className="mt-8 border-t border-dashed border-[#ded6c7] pt-4 text-xs leading-5 text-[#7a8982]">
          All routes, quantities and costs are illustrative. Recommendations require human review; this page does not approve transfers, modify inventory or execute optimization.
        </footer>

        <div className="mt-6 flex flex-wrap gap-5 border-t border-[#ded6c7] pt-4 text-sm">
          <Link to={isCoordinator ? '/network' : '/dashboard'} className="text-[#1f625d] underline underline-offset-4 hover:text-[#193632]">
            {isCoordinator ? 'Back to network overview' : 'Back to dashboard'}
          </Link>
          <Link to="/inventory" className="text-[#1f625d] underline underline-offset-4 hover:text-[#193632]">Open inventory</Link>
        </div>
      </div>
    </main>
  );
}
