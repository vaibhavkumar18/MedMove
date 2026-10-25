
import {
  ArrowDownLeft,
  ArrowUpRight,
  Clock3,
  MapPin,
  Package,
  Route,
} from 'lucide-react';
import type { Transfer, UserRole } from '../types/contracts';
import { paiseToRupees } from '../utils/money';

function formatNumber(value: number): string {
  return value.toLocaleString('en-IN');
}

function getStatusStyles(status: string): string {
  switch (status) {
    case 'APPROVED':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'COMPLETED':
      return 'border-teal-200 bg-teal-50 text-teal-700';
    case 'REJECTED':
    case 'CANCELLED':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    case 'PENDING_REVIEW':
      return 'border-amber-200 bg-amber-50 text-amber-800';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-600';
  }
}

export default function TransferTable({
  transfers,
  role,
}: {
  transfers: Transfer[];
  role: UserRole;
}) {
  const isCoordinator = role === 'NETWORK_COORDINATOR';

  if (transfers.length === 0) {
    return (
      <div className="flex flex-col items-center px-6 py-12 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
          <Package size={22} />
        </span>
        <h3 className="mt-4 text-sm font-bold text-slate-800">
          No transfers to display
        </h3>
        <p className="mt-2 max-w-sm text-xs leading-6 text-slate-500">
          Transfer recommendations will appear here when available.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[850px] border-collapse text-left">
        <thead className="bg-slate-50/90">
          <tr>
            {!isCoordinator && (
              <th className="whitespace-nowrap px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Direction
              </th>
            )}
            <th className="whitespace-nowrap px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Transfer route
            </th>
            <th className="whitespace-nowrap px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Medicine / batch
            </th>
            <th className="whitespace-nowrap px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Quantity
            </th>
            <th className="whitespace-nowrap px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Estimated cost
            </th>
            <th className="whitespace-nowrap px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Transit
            </th>
            <th className="whitespace-nowrap px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Status
            </th>
          </tr>
        </thead>

        <tbody>
          {transfers.map((transfer, index) => {
            const direction = transfer.direction;
            const isIncoming = direction === 'INCOMING';

            return (
              <tr
                key={`${transfer.source_batch_code}-${transfer.destination_facility_code}-${index}`}
                className="border-t border-slate-100 transition-colors duration-150 hover:bg-teal-50/30"
              >
                {!isCoordinator && (
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-[10px] font-bold ${
                        isIncoming
                          ? 'border-sky-200 bg-sky-50 text-sky-700'
                          : 'border-orange-200 bg-orange-50 text-orange-700'
                      }`}
                    >
                      {isIncoming ? (
                        <ArrowDownLeft size={13} />
                      ) : (
                        <ArrowUpRight size={13} />
                      )}
                      {direction ?? '—'}
                    </span>
                  </td>
                )}

                <td className="px-5 py-4">
                  <div className="flex min-w-[170px] items-start gap-2.5">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700 ring-1 ring-teal-100">
                      <Route size={15} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-slate-700">
                        <span>{transfer.source_facility_code}</span>
                        <span className="text-slate-400">→</span>
                        <span>{transfer.destination_facility_code}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
                        <MapPin size={11} />
                        Source to destination
                      </div>
                    </div>
                  </div>
                </td>

                <td className="px-5 py-4">
                  <div className="flex min-w-[135px] items-start gap-2">
                    <Package size={15} className="mt-0.5 shrink-0 text-slate-400" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-700">
                        {transfer.medicine_code}
                      </p>
                      <p className="mt-1 break-all text-[10px] leading-4 text-slate-400">
                        {transfer.source_batch_code}
                      </p>
                    </div>
                  </div>
                </td>

                <td className="px-5 py-4">
                  <p className="whitespace-nowrap text-xs font-bold tabular-nums text-slate-700">
                    {formatNumber(transfer.recommended_quantity_units)}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">units</p>
                </td>

                <td className="px-5 py-4">
                  <p className="whitespace-nowrap text-xs font-semibold tabular-nums text-slate-700">
                    {paiseToRupees(transfer.estimated_cost_minor_units)}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">Estimated</p>
                </td>

                <td className="px-5 py-4">
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-slate-600">
                    <Clock3 size={13} className="text-slate-400" />
                    {transfer.transit_days} days
                  </span>
                </td>

                <td className="px-5 py-4">
                  <span
                    className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1.5 text-[10px] font-bold ${getStatusStyles(transfer.status)}`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {transfer.status.replaceAll('_', ' ')}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="flex items-start gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-3 text-[10px] leading-5 text-slate-500">
        <Package size={13} className="mt-0.5 shrink-0 text-teal-700" />
        <p>
          Quantities are recommended transfer units. Costs and transit times are estimates
          and should be validated before any transfer is approved.
        </p>
      </div>
    </div>
  );
}
