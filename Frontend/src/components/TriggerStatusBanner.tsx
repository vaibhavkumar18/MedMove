import { CheckCircle2, Info, AlertTriangle, RefreshCw } from 'lucide-react';
import type { TriggerOutcome } from '../types/contracts';

export default function TriggerStatusBanner({ trigger }: { trigger: TriggerOutcome | null }) {
  if (!trigger) return null;
  const failed = trigger.decision === 'FAILED';
  const ran = trigger.decision === 'RAN';
  const Icon = failed ? AlertTriangle : ran ? CheckCircle2 : Info;
  return <div className={`trigger-banner ${failed ? 'failed' : ran ? 'success' : 'info'}`}><Icon size={19} /><div><strong>{ran ? 'Recommendations refreshed' : failed ? 'Inventory saved · optimization failed' : 'Inventory saved'}</strong><p>{trigger.message}</p>{failed && <span className="trigger-hint"><RefreshCw size={13} /> Ask the Network Coordinator to retry optimization.</span>}</div></div>;
}
