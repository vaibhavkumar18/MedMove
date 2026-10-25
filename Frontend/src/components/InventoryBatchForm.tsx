
import { useEffect, useState, type FormEvent } from 'react';
import {
  Boxes,
  CalendarClock,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import type {
  InventoryBatchRow,
  InventoryQuality,
} from './InventoryTable';

export interface MedicineOption {
  medicine_code: string;
  generic_name: string;
  strength: string;
}

export interface CreateBatchPayload {
  medicine_code: string;
  lot_number: string;
  expiry_date: string;
  quantity_on_hand_units: number;
  quality_status: InventoryQuality;
}

export interface UpdateBatchPayload {
  expiry_date: string;
  quantity_on_hand_units: number;
  quality_status: InventoryQuality;
}

interface InventoryBatchFormProps {
  medicines: MedicineOption[];
  batch?: InventoryBatchRow | null;
  busy?: boolean;
  onCancel: () => void;
  onCreate: (payload: CreateBatchPayload) => Promise<void>;
  onUpdate: (
    batchCode: string,
    patch: UpdateBatchPayload,
  ) => Promise<void>;
}

const qualityOptions: InventoryQuality[] = [
  'ELIGIBLE',
  'QUARANTINED',
  'RECALLED',
  'DAMAGED',
];

function todayISO(): string {
  const date = new Date();

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export default function InventoryBatchForm({
  medicines,
  batch,
  busy = false,
  onCancel,
  onCreate,
  onUpdate,
}: InventoryBatchFormProps) {
  const [medicineCode, setMedicineCode] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [quantity, setQuantity] = useState('');
  const [quality, setQuality] = useState<InventoryQuality>('ELIGIBLE');
  const [error, setError] = useState('');

  useEffect(() => {
    setMedicineCode(batch?.medicine_code ?? medicines[0]?.medicine_code ?? '');
    setLotNumber(batch?.lot_number ?? '');
    setExpiryDate(batch?.expiry_date?.slice(0, 10) ?? '');
    setQuantity(
      batch ? String(batch.quantity_on_hand_units) : '0',
    );
    setQuality(batch?.quality_status ?? 'ELIGIBLE');
    setError('');
  }, [batch, medicines]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (!batch && !medicines.some((item) => item.medicine_code === medicineCode)) {
      setError('Please choose a valid medicine.');
      return;
    }

    if (!batch && !lotNumber.trim()) {
      setError('Lot number is required.');
      return;
    }

    if (!expiryDate || Number.isNaN(Date.parse(`${expiryDate}T00:00:00`))) {
      setError('Please choose a valid expiry date.');
      return;
    }

    if (expiryDate < todayISO()) {
      setError('This expiry date is in the past. Please verify it before saving.');
      return;
    }

    const numericQuantity = Number(quantity);

    if (
      quantity.trim() === '' ||
      !Number.isSafeInteger(numericQuantity) ||
      numericQuantity < 0 ||
      numericQuantity > 100_000_000
    ) {
      setError('Enter a whole-number quantity between 0 and 100,000,000.');
      return;
    }

    try {
      if (batch) {
        await onUpdate(batch.batch_code, {
          expiry_date: expiryDate,
          quantity_on_hand_units: numericQuantity,
          quality_status: quality,
        });
      } else {
        await onCreate({
          medicine_code: medicineCode,
          lot_number: lotNumber.trim(),
          expiry_date: expiryDate,
          quantity_on_hand_units: numericQuantity,
          quality_status: quality,
        });
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to save this batch. Please try again.',
      );
    }
  }

  return (
    <form className="auth-form modal-form" onSubmit={submit} noValidate>
      {!batch && (
        <>
          <label htmlFor="inventory-medicine">Medicine</label>
          <div className="input-wrap">
            <Boxes size={16} />
            <select
              id="inventory-medicine"
              value={medicineCode}
              onChange={(event) => setMedicineCode(event.target.value)}
              disabled={busy}
              required
            >
              {medicines.length === 0 && (
                <option value="">No medicines available</option>
              )}
              {medicines.map((medicine) => (
                <option
                  key={medicine.medicine_code}
                  value={medicine.medicine_code}
                >
                  {medicine.generic_name} · {medicine.strength} ({medicine.medicine_code})
                </option>
              ))}
            </select>
          </div>

          <label htmlFor="inventory-lot">Lot number</label>
          <div className="input-wrap">
            <Boxes size={16} />
            <input
              id="inventory-lot"
              value={lotNumber}
              onChange={(event) => setLotNumber(event.target.value)}
              placeholder="e.g. LOT-NEW-01"
              maxLength={50}
              disabled={busy}
              required
            />
          </div>
        </>
      )}

      {batch && (
        <div className="inventory-edit-summary">
          <span>Medicine</span>
          <strong>{batch.generic_name} · {batch.strength}</strong>
          <small>
            {batch.batch_code} · Lot {batch.lot_number}
          </small>
        </div>
      )}

      <label htmlFor="inventory-expiry">Expiry date</label>
      <div className="input-wrap">
        <CalendarClock size={16} />
        <input
          id="inventory-expiry"
          type="date"
          value={expiryDate}
          onChange={(event) => setExpiryDate(event.target.value)}
          disabled={busy}
          required
        />
      </div>

      <label htmlFor="inventory-quantity">Quantity on hand (units)</label>
      <div className="input-wrap">
        <Boxes size={16} />
        <input
          id="inventory-quantity"
          type="number"
          min="0"
          max="100000000"
          step="1"
          inputMode="numeric"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          disabled={busy}
          required
        />
      </div>

      <label htmlFor="inventory-quality">Quality status</label>
      <div className="input-wrap">
        <ShieldCheck size={16} />
        <select
          id="inventory-quality"
          value={quality}
          onChange={(event) => setQuality(event.target.value as InventoryQuality)}
          disabled={busy}
          required
        >
          {qualityOptions.map((option) => (
            <option key={option} value={option}>
              {option.replaceAll('_', ' ')}
            </option>
          ))}
        </select>
      </div>

      <p className="field-hint">
        Demo only: changes are stored in this browser. No real inventory,
        transfer or optimization run is performed.
      </p>

      {error && (
        <div className="form-error" role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="modal-actions">
        <button
          className="button button-secondary"
          type="button"
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </button>
        <button
          className="button button-primary"
          type="submit"
          disabled={busy || medicines.length === 0 && !batch}
        >
          {busy ? 'Saving...' : batch ? 'Save changes' : 'Add batch'}
        </button>
      </div>
    </form>
  );
}
