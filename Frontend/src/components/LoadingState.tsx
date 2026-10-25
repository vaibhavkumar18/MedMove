export default function LoadingState({ label = 'Loading data…' }: { label?: string }) {
  return <div className="state-card"><span className="spinner" /><span>{label}</span></div>;
}
