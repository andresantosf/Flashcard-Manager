---
name: Anki Manager multi-select scope
description: Which screens in the Anki Card Manager app support bulk card selection, and why calendar/search were excluded.
---

The multi-select / bulk-edit feature (long-press → "Selecionar" → contextual
selection bar → bulk actions sheet) was implemented only on the two screens
that render real, individually-selectable card lists:

- Deck detail screen (`app/deck/[id].tsx`) — `FlatList` of `NoteCard`.
- Updates/recent feed screen (`app/(tabs)/updates.tsx`) — `FlatList` of the
  local `FeedItem` component.

**Why:** The original spec asked for selection on "any screen with cards,"
explicitly naming calendar and search results too. But the calendar screen
renders notes as small dots/summaries inside nested `.map()`s in a
`ScrollView` (not a real selectable card list — tapping just navigates to
the deck screen), and there is no dedicated search-results screen (search is
just deck-filter chips inside Updates). Adding selection there would mean
inventing new UI, not extending an existing card list.

**How to apply:** If asked to extend multi-select further, treat the
calendar screen and any future "search results" screen as new work, not a
gap in the current implementation. Reuse `hooks/useCardSelection.ts`,
`components/SelectionBar.tsx`, `components/BulkActionsSheet.tsx`,
`components/DeckPickerSheet.tsx`, and `components/ConfirmDialog.tsx` — they
were built screen-agnostic for exactly this kind of reuse.
