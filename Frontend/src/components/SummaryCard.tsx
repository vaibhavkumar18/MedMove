import type { LucideIcon } from 'lucide-react';
export default function SummaryCard({ label, value, detail, icon: Icon, tone = 'teal' }: {
  label: string; value: string | number; detail: string; icon: LucideIcon; tone?: 'teal' | 'blue' | 'amber' | 'violet';
}) {
  return <article className="summary-card"><div className="summary-card-top"><span>{label}</span><span className={`summary-icon ${tone}`}><Icon size={18} /></span></div><strong className="summary-value">{value}</strong><p>{detail}</p></article>;
}
