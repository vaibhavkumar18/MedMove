import { PackageOpen } from 'lucide-react';
export default function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="empty-state"><span className="empty-icon"><PackageOpen size={22} /></span><strong>{title}</strong><p>{description}</p></div>;
}
