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
A spending limit for one Plaid category during a given effective period — just `category` + `monthlyAmount` + `effectiveFrom`, compared against actual Plaid-tracked spending. A Budget is *not* an envelope you fund with contributions; it has no separate ledger of allocations, only the limit itself.
_Avoid_: Budget contribution, allocation, envelope — these terms were considered and deliberately rejected; "budgeting" in user requests refers to Goal/Budget management broadly, not a new sub-concept.

**Source** (provenance):
A `'user' | 'agent'` marker on Goal, GoalContribution, and Budget recording who *created* the record. Set once at creation and never changed afterward, even if the record is later edited by the other party. Answers "did I create this?", not "who last touched this?".
_Avoid_: createdBy (reads like a user ID, not an actor-type enum), lastModifiedBy (not tracked — this is provenance, not an edit history)

**Piggy**:
The AI agent embedded in the app (`lib/piggyai/`) that answers questions about the current user's finances and, as of this work, can create/update/delete Goals, GoalContributions, and Budgets on the user's behalf.
_Avoid_: PiggyAI (the package/route name, not the in-product persona), assistant, bot

**Destructive confirmation gate**:
The requirement that a delete initiated by Piggy pauses as a client-side tool call and only executes after the user clicks an explicit Confirm button in the chat UI, rather than proceeding on the agent's own reading of the conversation.
_Avoid_: Confirmation prompt (ambiguous between this and a conversational "are you sure?" the agent asks and judges itself — the two are different mechanisms, only the UI-gated one qualifies as this term)
