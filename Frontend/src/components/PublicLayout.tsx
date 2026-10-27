
import { Outlet } from 'react-router-dom';
import PublicNavbar from './PublicNavbar';

export default function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-[#f3efe6] font-sans text-[#193632]">
      <PublicNavbar />

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-[#ded7c8] px-5 py-6 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-[#71827d]">
            MedMove · Medicine redistribution decision support
          </span>
          <span className="text-xs text-[#8b9690]">
            Synthetic demonstration data — not real operational data
          </span>
        </div>
      </footer>
    </div>
  );
}
