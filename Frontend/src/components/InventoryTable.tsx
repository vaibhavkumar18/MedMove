
import {
  Building2,
  CheckCircle2,
  Clock3,
  Package,
  Pencil,
  ShieldCheck,
} from 'lucide-react';

export type InventoryQuality =
  | 'ELIGIBLE'
  | 'QUARANTINED'
  | 'RECALLED'
  | 'DAMAGED';

export interface InventoryBatchRow {
  batch_code: string;
  lot_number: string;
  facility_code: string;
  medicine_code: string;
  generic_name: string;
  strength: string;
  expiry_date: string;
  quantity_on_hand_units: number;
  quality_status: InventoryQuality;
  updated_at: string;
}

interface InventoryTableProps {
  batches: InventoryBatchRow[];
  editable?: boolean;
  showFacility?: boolean;
  onEdit?: (batch: InventoryBatchRow) => void;
  facilityName?: (facilityCode: string) => string;
}

function formatDate(value: string): string {
  if (!value) return '—';

  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function daysUntilExpiry(value: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(expiry.getTime())) return Number.POSITIVE_INFINITY;

  return Math.ceil((expiry.getTime() - today.getTime()) / 86_400_000);
}

function getExpiryDetails(value: string) {
  const days = daysUntilExpiry(value);

  if (days < 0) {
    return { label: `Expired ${Math.abs(days)}d ago`, className: 'expired' };
  }

  if (days === 0) {
    return { label: 'Expires today', className: 'expired' };
  }

  if (days <= 30) {
    return { label: `${days} days left`, className: 'risk' };
  }

  if (days <= 90) {
    return { label: `${days} days left`, className: 'warning' };
  }

  return { label: 'Within date', className: 'healthy' };
}

function getQualityClass(status: InventoryQuality): string {
  switch (status) {
    case 'ELIGIBLE':
      return 'healthy';
    case 'QUARANTINED':
      return 'warning';
    case 'RECALLED':
    case 'DAMAGED':
      return 'risk';
    default:
      return 'risk';
  }
}

function formatNumber(value: number): string {
  return value.toLocaleString('en-IN');
}

export default function InventoryTable({
  batches,
  editable = false,
  showFacility = false,
  onEdit,
  facilityName,
}: InventoryTableProps) {
  if (batches.length === 0) {
    return (
      <div className="empty-state inventory-empty">
        <span className="empty-icon">
          <Package size={22} />
        </span>
        <strong>No inventory batches</strong>
        <p>There are no batches to display for the selected filters.</p>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table className="inventory-table">
        <thead>
          <tr>
            <th>Medicine / batch</th>
            {showFacility && <th>Facility</th>}
            <th>Expiry</th>
            <th>Quantity</th>
            <th>Quality</th>
            <th>Last updated</th>
            {editable && <th>Action</th>}
          </tr>
        </thead>

        <tbody>
          {batches.map((batch) => {
            const expiry = getExpiryDetails(batch.expiry_date);
            const days = daysUntilExpiry(batch.expiry_date);
            const unusable =
              batch.quality_status !== 'ELIGIBLE' || days < 0;

            return (
              <tr key={batch.batch_code}>
                <td>
                  <div className="inventory-medicine-cell">
                    <span className="medicine-icon">
                      <Package size={17} />
                    </span>
                    <div>
                      <strong>{batch.generic_name}</strong>
                      <small>
                        {batch.strength} · {batch.medicine_code}
                      </small>
                      <small>
                        {batch.batch_code} · Lot {batch.lot_number}
                      </small>
                    </div>
                  </div>
                </td>

                {showFacility && (
                  <td>
                    <div className="inventory-facility-cell">
                      <Building2 size={14} />
                      <div>
                        <strong>{batch.facility_code}</strong>
                        <small>
                          {facilityName?.(batch.facility_code) ?? batch.facility_code}
                        </small>
                      </div>
                    </div>
                  </td>
                )}

                <td>
                  <div className="expiry-cell">
                    <span className={`expiry-badge ${expiry.className}`}>
                      {expiry.className === 'healthy' ? (
                        <CheckCircle2 size={12} />
                      ) : (
                        <Clock3 size={12} />
                      )}
                      {expiry.label}
                    </span>
                    <small>{formatDate(batch.expiry_date)}</small>
                    {days < 0 && (
                      <small className="expiry-warning">
                        Not eligible for redistribution
                      </small>
                    )}
                  </div>
                </td>

                <td>
                  <strong className="inventory-quantity">
                    {formatNumber(batch.quantity_on_hand_units)}
                  </strong>
                  <small>units</small>
                </td>

                <td>
                  <span className={`status-pill ${getQualityClass(batch.quality_status)}`}>
                    {batch.quality_status.replaceAll('_', ' ')}
                  </span>
                  {unusable && (
                    <small className="inventory-quality-hint">
                      {batch.quality_status !== 'ELIGIBLE'
                        ? 'Quality restriction'
                        : 'Expired stock'}
                    </small>
                  )}
                </td>

                <td>
                  <span className="updated-date">
                    {formatDate(batch.updated_at)}
                  </span>
                </td>

                {editable && (
                  <td>
                    <button
                      type="button"
                      className="table-action inventory-edit-button"
                      onClick={() => onEdit?.(batch)}
                      aria-label={`Edit ${batch.batch_code}`}
                    >
                      <Pencil size={13} />
                      Edit
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="inventory-table-caption">
        <ShieldCheck size={14} />
        Quantities are on-hand units. Eligibility for redistribution depends on quality,
        expiry and the applicable inventory and transport rules.
      </div>
    </div>
  );
}
