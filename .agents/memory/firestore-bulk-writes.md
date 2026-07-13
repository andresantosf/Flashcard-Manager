---
name: Firestore bulk writes
description: How to perform bulk update/delete across many Firestore documents safely and atomically.
---

Firestore's `writeBatch` caps out at 500 operations per commit. For bulk
actions that might touch hundreds/thousands of documents (e.g. "select all"
+ bulk delete/move in a card/note app), split the id list into chunks
(e.g. 450 per chunk to leave headroom) and commit each chunk's batch
sequentially.

**Why:** A batch over the 500-op limit throws at commit time. Each chunk is
still atomic on its own, which is good enough consistency for blind bulk
writes (no cross-chunk reads), and keeps the operation fast even at scale.

**How to apply:** See the `runBatchedWrite` helper pattern in
`artifacts/anki-manager/context/StorageContext.tsx` — a single chunking
helper takes an id list and an `(batch, id) => void` mutator, used for
`bulkMoveNotes`, `bulkSetCompleted`, and `bulkDeleteNotes`. Reuse this
pattern for any new bulk Firestore mutation instead of writing raw
`updateDoc`/`deleteDoc` loops (which aren't atomic per-item and are much
slower for large selections).
