
import {
  AlertTriangle,
  Boxes,
  CalendarClock,
  CheckCircle2,
  PackagePlus,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';

import { useAppSelector } from '../hooks/useAppSelector';
import InventoryTable, {
  type InventoryBatchRow,
  type InventoryQuality,
} from '../components/InventoryTable';
import InventoryBatchForm from '../components/InventoryBatchForm';

type Medicine = {
  medicine_code: string;
  generic_name: string;
  strength: string;
};

type Facility = {
  facility_code: string;
  name: string;
};

const STORAGE_KEY = 'medmove_demo_inventory_v1';

const facilities: Facility[] = [
  { facility_code: 'H01', name: 'City General Hospital' },
  { facility_code: 'H02', name: 'Riverside Medical Centre' },
  { facility_code: 'H03', name: 'Central District Hospital' },
  { facility_code: 'H04', name: 'Green Valley Hospital' },
  { facility_code: 'H05', name: 'Sunrise Community Hospital' },
  { facility_code: 'H06', name: 'Northside Medical Centre' },
  { facility_code: 'H07', name: 'Unity Care Hospital' },
  { facility_code: 'H08', name: 'Lakeside General Hospital' },
  { facility_code: 'H09', name: 'Hopewell Medical Centre' },
  { facility_code: 'H10', name: 'West End District Hospital' },
];

const medicines: Medicine[] = [
  { medicine_code: 'MED001', generic_name: 'Paracetamol', strength: '500 mg' },
  { medicine_code: 'MED002', generic_name: 'Amoxicillin', strength: '250 mg' },
  { medicine_code: 'MED003', generic_name: 'ORS', strength: 'WHO formula' },
  { medicine_code: 'MED004', generic_name: 'Cetirizine', strength: '10 mg' },
];

const qualityOptions: InventoryQuality[] = [
  'ELIGIBLE',
  'QUARANTINED',
  'RECALLED',
  'DAMAGED',
];

type DemoBatch = InventoryBatchRow;

function dateFromToday(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function createInitialBatches(): DemoBatch[] {
  const seed = [
    ['H01', 'MED001', 'LOT-101', 420, 1200, 'ELIGIBLE'],
    ['H01', 'MED002', 'LOT-102', 160, 450, 'ELIGIBLE'],
    ['H02', 'MED001', 'LOT-201', 250, 720, 'ELIGIBLE'],
    ['H02', 'MED003', 'LOT-202', 24, 150, 'ELIGIBLE'],
    ['H02', 'MED004', 'LOT-203', 12, 80, 'ELIGIBLE'],
    ['H03', 'MED001', 'LOT-301', 310, 180, 'ELIGIBLE'],
    ['H03', 'MED002', 'LOT-302', 190, 900, 'ELIGIBLE'],
    ['H04', 'MED003', 'LOT-401', 180, 520, 'ELIGIBLE'],
    ['H04', 'MED004', 'LOT-402', 300, 320, 'ELIGIBLE'],
    ['H05', 'MED001', 'LOT-501', 7, 240, 'ELIGIBLE'],
    ['H05', 'MED002', 'LOT-502', 160, 0, 'QUARANTINED'],
    ['H06', 'MED003', 'LOT-601', 220, 650, 'ELIGIBLE'],
    ['H06', 'MED004', 'LOT-602', 200, 170, 'ELIGIBLE'],
    ['H07', 'MED001', 'LOT-701', 270, 340, 'ELIGIBLE'],
    ['H07', 'MED002', 'LOT-702', 5, 90, 'ELIGIBLE'],
    ['H08', 'MED003', 'LOT-801', 140, 400, 'ELIGIBLE'],
    ['H08', 'MED004', 'LOT-802', 240, 260, 'ELIGIBLE'],
    ['H09', 'MED001', 'LOT-901', 365, 820, 'ELIGIBLE'],
    ['H09', 'MED002', 'LOT-902', 180, 220, 'RECALLED'],
    ['H10', 'MED003', 'LOT-1001', 210, 760, 'ELIGIBLE'],
    ['H10', 'MED004', 'LOT-1002', 150, 190, 'DAMAGED'],
  ] as const;

  const now = new Date().toISOString();

  return seed.map(
    ([facility, medicineCode, lot, expiryDays, quantity, quality], index) => {
      const medicine = medicines.find(
        (item) => item.medicine_code === medicineCode,
      )!;

      return {
        batch_code: `BATCH-${String(index + 1).padStart(3, '0')}`,
        lot_number: lot,
        facility_code: facility,
        medicine_code: medicine.medicine_code,
        generic_name: medicine.generic_name,
        strength: medicine.strength,
        expiry_date: dateFromToday(expiryDays),
        quantity_on_hand_units: quantity,
        quality_status: quality as InventoryQuality,
        updated_at: now,
      };
    },
  );
}

function loadBatches(): DemoBatch[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved) {
      const parsed: unknown = JSON.parse(saved);

      if (Array.isArray(parsed)) {
        return parsed as DemoBatch[];
      }
    }
  } catch {
    // Use the initial demo dataset if browser storage is unavailable.
  }

  return createInitialBatches();
}

function saveBatches(batches: DemoBatch[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(batches));
}

function daysUntilExpiry(value: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(`${value.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(expiry.getTime())) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.ceil(
    (expiry.getTime() - today.getTime()) / 86_400_000,
  );
}

function formatNumber(value: number): string {
  return value.toLocaleString('en-IN');
}

export default function InventoryPage() {
  const user = useAppSelector((state) => state.auth.user);
  const isCoordinator = user?.role === 'NETWORK_COORDINATOR';
  const facilityCode = user?.facility_code ?? '';

  const [batches, setBatches] = useState<DemoBatch[]>(loadBatches);
  const [search, setSearch] = useState('');
  const [facilityFilter, setFacilityFilter] = useState('ALL');
  const [qualityFilter, setQualityFilter] = useState('ALL');
  const [expiryFilter, setExpiryFilter] = useState('ALL');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<DemoBatch | null>(null);
  const [notice, setNotice] = useState('');
  const [noticeType, setNoticeType] = useState<'success' | 'error'>(
    'success',
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        saveBatches(batches);
      }
    } catch {
      // The current session can still use in-memory data.
    }
  }, [batches]);

  const visibleBatches = useMemo(() => {
    if (isCoordinator) return batches;

    return batches.filter(
      (batch) => batch.facility_code === facilityCode,
    );
  }, [batches, isCoordinator, facilityCode]);

  const filteredBatches = useMemo(() => {
    const term = search.trim().toLowerCase();

    return visibleBatches.filter((batch) => {
      const matchesSearch = [
        batch.batch_code,
        batch.lot_number,
        batch.medicine_code,
        batch.generic_name,
        batch.strength,
        batch.facility_code,
      ]
        .join(' ')
        .toLowerCase()
        .includes(term);

      const matchesFacility =
        !isCoordinator ||
        facilityFilter === 'ALL' ||
        batch.facility_code === facilityFilter;

      const matchesQuality =
        qualityFilter === 'ALL' ||
        batch.quality_status === qualityFilter;

      const days = daysUntilExpiry(batch.expiry_date);

      const matchesExpiry =
        expiryFilter === 'ALL' ||
        (expiryFilter === 'EXPIRING' && days >= 0 && days <= 30) ||
        (expiryFilter === 'NEXT_90' && days >= 0 && days <= 90) ||
        (expiryFilter === 'EXPIRED' && days < 0);

      return (
        matchesSearch &&
        matchesFacility &&
        matchesQuality &&
        matchesExpiry
      );
    });
  }, [
    visibleBatches,
    search,
    isCoordinator,
    facilityFilter,
    qualityFilter,
    expiryFilter,
  ]);

  const totalUnits = visibleBatches.reduce(
    (total, batch) => total + batch.quantity_on_hand_units,
    0,
  );

  const eligibleUnits = visibleBatches.reduce((total, batch) => {
    const usable =
      batch.quality_status === 'ELIGIBLE' &&
      daysUntilExpiry(batch.expiry_date) >= 0;

    return total + (usable ? batch.quantity_on_hand_units : 0);
  }, 0);

  const expiringCount = visibleBatches.filter((batch) => {
    const days = daysUntilExpiry(batch.expiry_date);
    return days >= 0 && days <= 30;
  }).length;

  const exceptionCount = visibleBatches.filter(
    (batch) => batch.quality_status !== 'ELIGIBLE',
  ).length;

  const expiredCount = visibleBatches.filter(
    (batch) => daysUntilExpiry(batch.expiry_date) < 0,
  ).length;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  function announce(
    message: string,
    type: 'success' | 'error' = 'success',
  ) {
    setNotice(message);
    setNoticeType(type);
  }

  function resetFilters() {
    setSearch('');
    setFacilityFilter('ALL');
    setQualityFilter('ALL');
    setExpiryFilter('ALL');
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
  }

  function startCreate() {
    setNotice('');
    setEditing(null);
    setShowForm(true);
  }

  function startEdit(batch: DemoBatch) {
    if (isCoordinator || batch.facility_code !== facilityCode) return;

    setNotice('');
    setEditing(batch);
    setShowForm(true);
  }

  async function handleCreate(payload: {
    medicine_code: string;
    lot_number: string;
    expiry_date: string;
    quantity_on_hand_units: number;
    quality_status: InventoryQuality;
  }) {
    setSaving(true);

    try {
      if (!facilityCode) {
        throw new Error('Your account has no assigned facility.');
      }

      const lot = payload.lot_number.trim();

      if (!lot) {
        throw new Error('Lot number is required.');
      }

      if (
        batches.some(
          (batch) =>
            batch.facility_code === facilityCode &&
            batch.lot_number.toLowerCase() === lot.toLowerCase(),
        )
      ) {
        throw new Error(
          'This lot number already exists at your facility.',
        );
      }

      const medicine = medicines.find(
        (item) => item.medicine_code === payload.medicine_code,
      );

      if (!medicine) {
        throw new Error('Please choose a valid medicine.');
      }

      const nextNumber =
        batches.reduce((max, batch) => {
          const match = batch.batch_code.match(/^BATCH-(\d+)$/);

          return match
            ? Math.max(max, Number(match[1]))
            : max;
        }, 0) + 1;

      const updated: DemoBatch[] = [
        {
          batch_code: `BATCH-${String(nextNumber).padStart(3, '0')}`,
          lot_number: lot,
          facility_code: facilityCode,
          medicine_code: medicine.medicine_code,
          generic_name: medicine.generic_name,
          strength: medicine.strength,
          expiry_date: payload.expiry_date,
          quantity_on_hand_units: payload.quantity_on_hand_units,
          quality_status: payload.quality_status,
          updated_at: new Date().toISOString(),
        },
        ...batches,
      ];

      saveBatches(updated);
      setBatches(updated);
      closeForm();
      announce('Batch added to local demo inventory.');
    } catch (error) {
      announce(
        error instanceof Error
          ? error.message
          : 'Could not save the batch.',
        'error',
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(
    batchCode: string,
    patch: {
      expiry_date: string;
      quantity_on_hand_units: number;
      quality_status: InventoryQuality;
    },
  ) {
    setSaving(true);

    try {
      const ownedBatch = batches.find(
        (batch) =>
          batch.batch_code === batchCode &&
          batch.facility_code === facilityCode,
      );

      if (isCoordinator || !ownedBatch) {
        throw new Error(
          'You can only edit batches belonging to your facility.',
        );
      }

      const updated = batches.map((batch) =>
        batch.batch_code === batchCode
          ? { ...batch, ...patch, updated_at: new Date().toISOString() }
          : batch,
      );

      saveBatches(updated);
      setBatches(updated);
      closeForm();
      announce('Batch updated in local demo inventory.');
    } catch (error) {
      announce(
        error instanceof Error
          ? error.message
          : 'Could not update the batch.',
        'error',
      );
    } finally {
      setSaving(false);
    }
  }

  function resetDemoInventory() {
    const confirmed = window.confirm(
      'Reset demo inventory to the original sample data? Local changes will be lost.',
    );

    if (!confirmed) return;

    const initial = createInitialBatches();

    try {
      saveBatches(initial);
      setBatches(initial);
      resetFilters();
      announce('Demo inventory reset to the original sample data.');
    } catch {
      setBatches(initial);
      resetFilters();
      announce(
        'Demo data reset for this session, but browser storage is unavailable.',
        'error',
      );
    }
  }

  return (
    <main className="mx-auto grid w-full max-w-[1280px] gap-8 px-5 pb-12 pt-5 font-sans text-[#193632] sm:px-8 lg:px-10">
      {/* Page heading */}
      <section className="flex flex-col justify-between gap-5 border-b border-[#ded7c8] pb-7 sm:flex-row sm:items-end">
        <div>
          <p className="mb-3 font-mono text-xs text-[#71827d]">
            Stock management
          </p>

          <h2 className="font-sans text-4xl font-medium leading-tight tracking-tight text-[#193632] sm:text-5xl">
            {isCoordinator ? 'Network inventory' : 'Inventory batches'}
          </h2>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#71827d] sm:text-base">
            {isCoordinator
              ? 'Review medicine availability, expiry and quality across demo facilities.'
              : 'Track medicine batches, quantities, expiry dates and quality at your facility.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 border-b border-dashed border-[#ded7c8] px-1 py-2 text-xs text-[#71827d]">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Local demo data
          </span>

          {!isCoordinator && (
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-[#1f625d] px-4 py-3 text-sm font-medium text-white hover:bg-[#174d49] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f625d] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={startCreate}
            >
              <PackagePlus size={16} />
              Add batch
            </button>
          )}

          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 px-3 py-3 text-sm text-[#71827d] hover:text-[#193632] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f625d] focus-visible:ring-offset-2"
            onClick={resetDemoInventory}
          >
            <RefreshCw size={15} />
            Reset demo
          </button>
        </div>
      </section>

      {/* Feedback message */}
      {notice && (
        <div
          className={`flex items-start gap-3 rounded-md border px-4 py-3 text-sm ${
            noticeType === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
          role={noticeType === 'error' ? 'alert' : 'status'}
        >
          {noticeType === 'success' ? (
            <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
          ) : (
            <AlertTriangle size={17} className="mt-0.5 shrink-0" />
          )}

          <span className="flex-1">{notice}</span>

          <button
            type="button"
            className="rounded-md p-1 opacity-70 hover:bg-black/5 hover:opacity-100"
            onClick={() => setNotice('')}
            aria-label="Dismiss message"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Summary cards */}
      <section className="grid grid-cols-1 border-y border-[#ded7c8] sm:grid-cols-2 xl:grid-cols-4">
        <article className="min-w-0 border-b border-[#ded7c8] px-4 py-5 sm:border-r xl:border-b-0 xl:py-6">
          <div className="flex items-center justify-between gap-3 text-sm text-[#71827d]">
            <span>Total batches</span>
            <span className="hidden">
              <Boxes size={18} />
            </span>
          </div>

          <strong className="mt-2 block font-sans text-4xl font-medium tracking-tight text-[#193632]">
            {formatNumber(visibleBatches.length)}
          </strong>

          <p className="mt-3 text-xs leading-5 text-[#71827d]">
            Recorded medicine lots
          </p>
        </article>

        <article className="min-w-0 border-b border-[#ded7c8] px-4 py-5 sm:border-r xl:border-b-0 xl:py-6">
          <div className="flex items-center justify-between gap-3 text-sm text-[#71827d]">
            <span>Units on hand</span>
            <span className="hidden">
              <PackagePlus size={18} />
            </span>
          </div>

          <strong className="mt-2 block font-sans text-4xl font-medium tracking-tight text-[#193632]">
            {formatNumber(totalUnits)}
          </strong>

          <p className="mt-3 text-xs leading-5 text-[#71827d]">
            Across visible batches
          </p>
        </article>

        <article className="min-w-0 border-b border-[#ded7c8] px-4 py-5 sm:border-r xl:border-b-0 xl:py-6">
          <div className="flex items-center justify-between gap-3 text-sm text-[#71827d]">
            <span>Expiring in 30 days</span>
            <span className="hidden">
              <CalendarClock size={18} />
            </span>
          </div>

          <strong className="mt-2 block font-sans text-4xl font-medium tracking-tight text-[#193632]">
            {formatNumber(expiringCount)}
          </strong>

          <p className="mt-3 text-xs leading-5 text-[#71827d]">
            Batches approaching expiry
          </p>
        </article>

        <article className="min-w-0 border-b border-[#ded7c8] px-4 py-5 sm:border-r xl:border-b-0 xl:py-6">
          <div className="flex items-center justify-between gap-3 text-sm text-[#71827d]">
            <span>Quality exceptions</span>
            <span className="hidden">
              <ShieldCheck size={18} />
            </span>
          </div>

          <strong className="mt-2 block font-sans text-4xl font-medium tracking-tight text-[#193632]">
            {formatNumber(exceptionCount)}
          </strong>

          <p className="mt-3 text-xs leading-5 text-[#71827d]">
            {formatNumber(expiredCount)} expired batches identified
          </p>
        </article>
      </section>

      {/* Stock eligibility notice */}
      <section className="flex flex-col gap-4 border-b border-[#ded7c8] py-5 sm:flex-row sm:items-center">
        <span className="hidden">
          <AlertTriangle size={19} />
        </span>

        <div className="flex-1">
          <h3 className="text-sm font-medium text-[#193632]">
            Check eligibility before redistribution
          </h3>

          <p className="mt-1 text-sm leading-6 text-[#71827d]">
            Only eligible, unexpired stock should be considered. Final
            transfer feasibility also depends on reserves, shelf life,
            routes and budget.
          </p>
        </div>

        <div className="sm:min-w-40 sm:border-l sm:border-[#ded7c8] sm:pl-5">
          <p className="text-xs text-[#71827d]">
            Eligible, unexpired units
          </p>

          <strong className="mt-1 block text-2xl font-semibold text-[#193632]">
            {formatNumber(eligibleUnits)}
          </strong>
        </div>
      </section>

      {/* Inventory table and filters */}
      <section className="min-w-0 overflow-hidden border-y border-[#ded7c8] bg-transparent">
        <div className="flex flex-col gap-4 border-b border-[#ded7c8] py-5 sm:py-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-base font-semibold text-[#193632]">
              Medicine batches
            </h3>

            <p className="mt-1 text-sm text-[#71827d]">
              Showing {formatNumber(filteredBatches.length)} of{' '}
              {formatNumber(visibleBatches.length)}
              {isCoordinator ? ' network batches' : ' facility batches'}
            </p>
          </div>

          <div className="flex min-w-0 items-center gap-2 rounded-md border border-[#ded7c8] px-3 text-[#71827d] focus-within:border-[#1f625d] focus-within:ring-2 focus-within:ring-[#1f625d]/10 sm:w-80">
            <Search size={16} className="shrink-0" />

            <input
              className="w-full min-w-0 bg-transparent py-2.5 text-sm text-[#304944] outline-none placeholder:text-[#8b9690]"
              aria-label="Search inventory"
              placeholder="Search medicine, lot or batch"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            {search && (
              <button
                type="button"
                className="rounded p-1 text-[#8b9690] hover:bg-[#e9e3d7] hover:text-[#304944]"
                onClick={() => setSearch('')}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3 border-b border-[#ded7c8] py-4">
          {isCoordinator && (
            <label className="grid min-w-[180px] flex-1 gap-1.5 sm:flex-none">
              <span className="text-xs font-medium text-[#71827d]">
                Facility
              </span>

              <select
                className="rounded-md border border-[#ded7c8] bg-[#f3efe6] px-3 py-2.5 text-sm text-[#304944] outline-none focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10"
                value={facilityFilter}
                onChange={(event) => setFacilityFilter(event.target.value)}
              >
                <option value="ALL">All facilities</option>

                {facilities.map((facility) => (
                  <option
                    key={facility.facility_code}
                    value={facility.facility_code}
                  >
                    {facility.facility_code} · {facility.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="grid min-w-[160px] flex-1 gap-1.5 sm:flex-none">
            <span className="text-xs font-medium text-[#71827d]">
              Quality status
            </span>

            <select
              className="rounded-md border border-[#ded7c8] bg-[#f3efe6] px-3 py-2.5 text-sm text-[#304944] outline-none focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10"
              value={qualityFilter}
              onChange={(event) => setQualityFilter(event.target.value)}
            >
              <option value="ALL">All statuses</option>

              {qualityOptions.map((option) => (
                <option key={option} value={option}>
                  {option.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </label>

          <label className="grid min-w-[160px] flex-1 gap-1.5 sm:flex-none">
            <span className="text-xs font-medium text-[#71827d]">
              Expiry
            </span>

            <select
              className="rounded-md border border-[#ded7c8] bg-[#f3efe6] px-3 py-2.5 text-sm text-[#304944] outline-none focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10"
              value={expiryFilter}
              onChange={(event) => setExpiryFilter(event.target.value)}
            >
              <option value="ALL">All expiry dates</option>
              <option value="EXPIRING">Within 30 days</option>
              <option value="NEXT_90">Within 90 days</option>
              <option value="EXPIRED">Already expired</option>
            </select>
          </label>

          <button
            type="button"
            className="rounded-md px-3 py-2.5 text-sm font-medium text-[#1f625d] hover:bg-[#e4e9df]"
            onClick={resetFilters}
          >
            Clear filters
          </button>
        </div>

        {filteredBatches.length === 0 ? (
          <div className="flex flex-col items-center px-5 py-12 text-center">
            <span className="mb-4 grid h-11 w-11 place-items-center rounded-md bg-[#e4e9df] text-[#1f625d]">
              <Boxes size={21} />
            </span>

            <h3 className="text-base font-semibold text-[#193632]">
              {visibleBatches.length === 0
                ? 'No batches for this facility'
                : 'No matching batches'}
            </h3>

            <p className="mt-2 max-w-md text-sm leading-6 text-[#71827d]">
              {visibleBatches.length === 0
                ? 'Add a batch to start tracking this facility’s inventory.'
                : 'Try another search or clear the selected filters.'}
            </p>

            {!isCoordinator && visibleBatches.length === 0 && (
              <button
                type="button"
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-md bg-[#1f625d] px-4 py-3 text-sm font-medium text-white hover:bg-[#174d49] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f625d] focus-visible:ring-offset-2"
                onClick={startCreate}
              >
                <PackagePlus size={16} />
                Add first batch
              </button>
            )}
          </div>
        ) : (
          <InventoryTable
            batches={filteredBatches}
            showFacility={isCoordinator}
            editable={!isCoordinator}
            onEdit={startEdit}
            facilityName={(code) =>
              facilities.find((item) => item.facility_code === code)?.name ??
              code
            }
          />
        )}

        <div className="flex flex-col gap-2 border-t border-[#ded7c8] px-4 py-3 text-xs text-[#71827d] sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <span className="inline-flex items-center gap-2">
            <ShieldCheck size={14} className="shrink-0" />
            {isCoordinator
              ? 'Network-wide read-only view'
              : `Facility scope: ${facilityCode || 'Unassigned'}`}
          </span>

          <span>Fictional demo data · Local browser storage</span>
        </div>
      </section>

      <p className="flex items-start gap-2 text-xs leading-5 text-[#71827d]">
        <RefreshCw size={13} className="mt-0.5 shrink-0" />
        Changes are stored in this browser only. No real inventory is changed,
        and no optimization trigger or transfer is executed.
      </p>

      {/* Add/edit batch modal */}
      {showForm && !isCoordinator && (
        <div
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#193632]/60 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !saving
            ) {
              closeForm();
            }
          }}
        >
          <section
            className="my-auto max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg border border-[#ded7c8] bg-[#f3efe6] p-5 shadow-2xl sm:p-8"
            role="dialog"
            aria-modal="true"
            aria-labelledby="batch-modal-title"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="mb-3 font-mono text-xs text-[#71827d]">
                  {editing ? 'Update inventory' : 'New inventory'}
                </p>

                <h2
                  className="text-xl font-semibold tracking-tight text-[#193632]"
                  id="batch-modal-title"
                >
                  {editing
                    ? `Edit ${editing.batch_code}`
                    : 'Add inventory batch'}
                </h2>

                <p className="mt-2 text-sm leading-6 text-[#71827d]">
                  {editing
                    ? 'Update this batch’s quantity, expiry or quality status.'
                    : `Add a medicine batch to ${facilityCode || 'your facility'}.`}
                </p>
              </div>

              <button
                type="button"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[#ded7c8] text-[#71827d] hover:bg-[#e9e3d7] disabled:opacity-50"
                onClick={closeForm}
                disabled={saving}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <InventoryBatchForm
              medicines={medicines}
              batch={editing}
              busy={saving}
              onCancel={closeForm}
              onCreate={handleCreate}
              onUpdate={handleUpdate}
            />
          </section>
        </div>
      )}
    </main>
  );
}
