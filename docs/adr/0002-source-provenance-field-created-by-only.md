# Source provenance field tracks creator only, not last editor

Once Piggy can write Goals, GoalContributions, and Budgets alongside manual user edits, there's no way to tell after the fact whether a given record originated from the agent or from the user directly — a real trust/support concern for financial data ("why is there a contribution I don't remember making"). We added a `source: 'user' | 'agent'` field to all three models, set once at creation and never updated afterward, even if the record is later edited by the other party.

We considered also tracking last-modified-by (or updating `source` on every write) but rejected it: it doubles the field surface across three models for a need that's really about provenance, not edit history. If full edit history is needed later, that calls for a proper audit log, not a denormalized field that would silently overwrite the original provenance signal.

This is a schema decision (migration cost to change later) and the immutability is non-obvious — a future reader touching the update path might reasonably expect `source` to flip to `'agent'` on an agent-initiated edit of a user-created record, and would be wrong.
