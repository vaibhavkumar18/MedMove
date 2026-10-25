import type { UnmetShortage } from '../types/contracts';

export default function UnmetShortageList({ shortages }: { shortages: UnmetShortage[] }) {
  if (!shortages.length) return <div className="success-empty"><strong>No unmet shortages in this result.</strong></div>;
  return <div className="table-wrap"><table><thead><tr><th>Facility</th><th>Medicine</th><th>Shortage before</th><th>Recommended inbound</th><th>Shortage after</th></tr></thead><tbody>{shortages.map((item, index) => <tr key={`${item.facility_code}-${item.medicine_code}-${index}`}><td><span className="facility-code">{item.facility_code}</span></td><td><strong>{item.medicine_code}</strong></td><td>{item.shortage_before_units.toLocaleString('en-IN')}</td><td>{item.recommended_inbound_units.toLocaleString('en-IN')}</td><td><strong className={item.shortage_after_units ? 'risk-number' : ''}>{item.shortage_after_units.toLocaleString('en-IN')}</strong></td></tr>)}</tbody></table></div>;
}
