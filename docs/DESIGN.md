# Forge Command: design

You are the Director of the Munitions Production Board of the Commonwealth of Aldmere, a fictional nation. One turn is
one month. A campaign lasts two, four or six years. There is no battle map: wars are demand curves. Fictional threats
arrive each month, and your interceptors and land fires are drawn from the national reserve to meet them.

Designations and manufacturers are real. Plants, suppliers, nations, partners and crises are fictional. Game rates
are scaled from public figures where they exist, and best guesses where they don't.

## Systems

### Campuses, bays and lines
- Three campuses each hold several production lines and have a fixed number of **bays** (floor space).
  - Corran Valley Works: PAC-3 MSE and SM-6.
  - Northgate Integration Center: Tamir, IRIS-T and Stinger.
  - Ashford Munitions Complex: GMLRS and 155mm.
- A line's original floor uses 4 bays. Each **expansion** adds +25% capacity in one more bay. It needs a free bay and
  equipment money, and it starts at about 30% maturity before ramping up.
- **New buildings** add 4 bays to a campus. They are big, slow projects of 6 to 12 months, depending on difficulty.
- **Retooling** moves an expansion bay from one line to another on the same campus. It is quicker than building
  (2 months), but costs money and restarts the ramp-up.
- **Upgrades** per line, two levels each:
  - automation: fewer crew needed;
  - quality systems: fewer faults and less wear.

  Lines run at reduced capacity while an upgrade installs.
- **Learning curve:** cumulative output raises productivity, up to +30%.
- **Shifts:** idle, normal or surge.
  - Surge builds +30%, needs overtime, wears the line and lowers morale.
  - Wear drives quality faults: batches go to **quarantine**. You can pay to rework them (80% recovered); otherwise
    they are scrapped after 3 months.

### Workforce
- Each campus has skilled workers, trainee cohorts, a local hiring pool, morale and a wage policy.
- Lines need crew in proportion to installed capacity and shift. Understaffed lines produce less.
- Hires are trainees for 2, 4 or 6 months (by difficulty) and cost wages before they count.
- Attrition rises when morale is low. Very low morale risks a **strike**, which comes as a decision card.

### Supply chain
- Seven shared components, each with one qualified primary supplier and one or two candidate **second sources**:
  - solid rocket motors;
  - RF seekers;
  - IR seekers;
  - energetics;
  - microelectronics;
  - gallium and germanium;
  - forged shell bodies.
- Qualifying a second source takes months and money. After that it can take contracts and spot orders.
- Supplier state:
  - financial **health**: distress brings a bailout decision, and bankruptcy ends its contracts;
  - **shocks**: lower deliveries for a few months;
  - **embargoes** on foreign suppliers;
  - port congestion.
- Contracts are signed with a specific supplier. They run 12, 24 or 36 months, are cheaper the longer they run, and
  are take-or-pay, with a cancellation penalty. Spot buys fill after contracts at a 30% premium.
- **Substitutes:** each component has a lower-grade substitute, switched on per line. Units built with substitutes
  are **degraded**: their interceptors are less likely to stop a threat.
- Stock costs storage each month.

### Allocation
- Each month a line's output goes, in order:
  1. its **test & evaluation share** (lot acceptance and crew training);
  2. its **partner contracts**;
  3. the **national reserve**.
- A test share below 3% lets latent defects slip through, which brings later recalls from the reserve.
- **Emergency airlift** requests arrive as decisions: ship interceptors from the reserve now for goodwill and money.

### Demand and the cost exchange
- Five fictional threat classes arrive each month:
  - one-way attack drone;
  - short-range rocket;
  - cruise missile;
  - short-range ballistic missile;
  - combat aircraft.

  Each has an estimated unit cost from public reporting.
- Each threat class is assigned to interceptor types by doctrine weights, with fallbacks when a type runs dry.
  **Conserve** doctrine keeps PAC-3 and SM-6 off cheap threats: more leakers, but a far better cost exchange.
- Threats that are not engaged, or not stopped, are **leakers**. They cost confidence.
- Land fires (GMLRS, 155mm) are drawn by fire-mission demand.
- The **cost exchange** ledger records interceptor dollars spent against threat dollars stopped, per type.

### Crises, intel and the opponent
- Crises brew for 2 months (an intel warning), then run 4 to 10 months with their own threat mix.
- Intel forecasts the next 3 months of draw per line. On hard, intel is sometimes wrong.
- **Adaptive opponent** (hard): it shifts its threat mix toward whatever your scarcest interceptor covers.

### Money and confidence
- Monthly appropriation plus partner revenue. Costs:
  - wages;
  - plant overhead;
  - components;
  - storage;
  - projects.
- **Confidence** (0 to 100) from the Defence Committee:
  - rises with readiness and deliveries;
  - falls with leakers, shortfalls, recalls and overspending.

  At 0 you are dismissed.
- A **fiscal-year review** every 12 months resets the appropriation from confidence.
- **Supplemental** requests are possible during crises.

### Events and decisions
- Random events, more frequent on harder levels:
  - supplier distress or bankruptcy;
  - energetics plant fire;
  - export restrictions;
  - strikes;
  - defective component lots;
  - port congestion;
  - energy price spikes;
  - audits;
  - process breakthroughs;
  - a skilled labour influx;
  - partner tenders;
  - emergency airlifts;
  - espionage alerts and sabotage (hard only).
- Many arrive as **decision cards** with two or three options.

### Difficulty
| | Easy | Normal | Hard |
|---|---|---|---|
| Component shortages | off | on | tighter |
| Ramp-up, training, construction | fast | normal | slow |
| Events | rare | normal | frequent + sabotage |
| Advisor | suggests orders (one-click) | hints | none |
| Opponent | static | static | adaptive, imperfect intel |

### Scenarios
- **Standard:** a calm start.
- **Long War:** sustained pressure from month one.
- **Broken Chain:** a critical-materials embargo and a microelectronics shock at the start.
- **Rebuild:** depleted reserves and a bigger budget.

### Interface
- Tabs: Overview, Plants, Workforce, Supply chain, Partners, Intel, Ledger, Guide.
- Decision cards, fiscal-year reviews and a final debrief with grades.
- A guided tutorial, save slots with export and import, and offline play.
