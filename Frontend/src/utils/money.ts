export function paiseToRupees(paise: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(paise / 100);
}

export function rupeesToPaise(rupees: number) {
  return Math.round(rupees * 100);
}
