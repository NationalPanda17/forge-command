// The scripted director used by the balance check: the in-game chief of staff with every area handed over, no reserve
// and a balanced stance. Testing balance this way also tests the automation players use.
import type { SimAction } from '../src/sim/actions';
import { AUTO_AREA_IDS, proposals } from '../src/sim/automation';
import type { SimState } from '../src/sim/types';

export function active(s: SimState): SimAction[] {
  return AUTO_AREA_IDS.flatMap((area) => proposals(s, area, 0, 'balanced'));
}
