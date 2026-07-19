# Personal Finance

An AI-first personal finance app where users link bank accounts via Plaid and manage savings goals and category budgets, optionally with help from an AI agent ("Piggy").

## Language

**Goal**:
A target amount of money a user wants to save, optionally by a target date, tracked via its contributions.
_Avoid_: Savings goal (redundant), target

**GoalContribution**:
A single record of money manually put toward a Goal on a given date. Append-only ledger entry — a Goal's progress is the sum of its contributions, not a mutable balance field.
_Avoid_: Deposit, payment, allocation

**Budget**:
A spending limit for one Plaid category during a given effective period — just `category` + `monthlyAmount` + `effectiveFrom`, compared against actual Plaid-tracked spending. A Budget is _not_ an envelope you fund with contributions; it has no separate ledger of allocations, only the limit itself.
_Avoid_: Budget contribution, allocation, envelope — these terms were considered and deliberately rejected; "budgeting" in user requests refers to Goal/Budget management broadly, not a new sub-concept.

**Source** (provenance):
A `'user' | 'agent'` marker on Goal, GoalContribution, and Budget recording who _created_ the record. Set once at creation and never changed afterward, even if the record is later edited by the other party. Answers "did I create this?", not "who last touched this?".
_Avoid_: createdBy (reads like a user ID, not an actor-type enum), lastModifiedBy (not tracked — this is provenance, not an edit history)

**Piggy**:
The AI agent embedded in the app (`lib/piggyai/`) that answers questions about the current user's finances and, as of this work, can create/update/delete Goals, GoalContributions, and Budgets on the user's behalf.
_Avoid_: PiggyAI (the package/route name, not the in-product persona), assistant, bot

**Confirmation gate**:
The requirement that every write Piggy initiates (create, update, delete, or log a contribution) pauses as a staged proposal and only executes after the user clicks an explicit Confirm button in the chat UI, rather than proceeding on the agent's own reading of the conversation. Applies uniformly to all of Piggy's writes, not just deletes — even an easily-corrected write like logging a contribution goes through the same gate, for one consistent mental model.
_Avoid_: Destructive confirmation gate (superseded — the gate isn't scoped to destructive actions, it's scoped to all agent-initiated writes), Confirmation prompt (ambiguous between this and a conversational "are you sure?" the agent asks and judges itself — the two are different mechanisms, only the UI-gated one qualifies as this term)

**Proposal**:
The staged, not-yet-executed description of a write Piggy wants to make, built from ground-truth server-side data (never from the agent's own free-text) so the confirmation card can't misrepresent what a record currently contains or what a delete would remove.
_Avoid_: Draft, pending action

**Security**:
global, tenant-less reference data (dedupes on `tickerSymbol`+`type`, falls back to Plaid's `plaidSecurityId` for tickerless securities like cash) vs. **Holding** and **InvestmentTransaction**, which are user-scoped.
_Avoid_: security (generic), ticker symbol, plaidSecurityId

**Holding**:
current-only snapshot of a position, reconciled (upserted + deleted) on every sync - no history, as distinct from the append-only ledger of InvestmentTransaction.
_Avoid_: position, snapshot, holding (lowercase)