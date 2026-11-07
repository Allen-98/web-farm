// Exclude only relocated geometry and discarded movement/interact state from legacy comparisons.
// Inventory, production clocks, employee tasks/credits, orders and financial values remain exact.
export function withoutMapState(value){
  const w=structuredClone(value);
  for(const key of ['navigationTarget','events','mode','credit','dwell'])delete w[key];
  for(const a of [w.player,...(w.workers??[])].filter(Boolean))for(const key of ['position','path','moving'])delete a[key];
  for(const c of w.bakery?.crops??[])delete c.position;
  for(const u of w.upgrades??[])delete u.position;
  return w;
}
export const withoutPositions=items=>items.map(({position,...value})=>value);
