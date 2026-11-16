# Forge Command

Run the munitions production board of a fictional nation, one month per turn. Keep the national reserve stocked through
fictional crises without running out of money, while every production line competes for the same few suppliers.

**Play:** https://nationalpanda17.github.io/forge-command/

## How it plays

- **Production lines** for PAC-3 MSE, SM-6, Tamir, IRIS-T, Stinger, GMLRS and 155mm shells. Designations and makers
  are real; plants are fictional. Game rates are about a fifth of public reference rates.
- **Ramp-up:** new floor space starts at about 30% and climbs month by month.
- **Shifts:** idle saves money, surge builds 30% more but wears the line, and worn lines throw quality faults and recalls.
- **Shared components:** solid rocket motors, RF and IR seekers, energetics, microelectronics, gallium and germanium,
  and forged shell bodies. When a supplier stumbles, every line that needs that part slows down. Line priority decides
  who gets scarce parts first.
- **Contracts:** multi-year supply contracts are cheaper the longer they run, but they are take-or-pay. Spot buys
  are flexible and cost 30% over list.
- **Demand:** wars are abstract demand curves. Fictional crises give a couple of months of warning, then raise the
  draw on interceptors or land fires.
- **Difficulty:** Easy has no component shortages and ramps up fast. Normal turns supply shocks on. Hard has tighter
  suppliers, slower ramp-up, more crises and a smaller budget.

## Roadmap

1. Lines, components, contracts and the monthly loop *(this release)*
2. Workforce and training, floor space, retooling, second sources, substitution
3. Allocation (reserve, airlift, test share, partner nations) and the fictional events deck
4. Advisor, adaptive opponent with imperfect intel, cost-exchange report
5. Guided tutorial, in-game guide, offline/PWA and desktop start files

## Develop

```bash
npm install
npm run dev     # http://localhost:5174
npm test        # engine tests (vitest)
npm run build   # typecheck + production build
```

The engine in `src/engine` is pure TypeScript with a seeded RNG: the same seed and the same actions always replay the
same campaign. The React UI lives in `src/ui`.

All data is from public company or government statements or is made up for the game. The world, nations, suppliers and
crises are fictional.
