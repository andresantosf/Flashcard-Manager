import { useCallback, useEffect, useState } from 'react';

/**
 * Generic multi-select state for any screen that lists cards (notes).
 * Mirrors the "select mode" pattern used by Google Photos/Gmail/Files:
 * long-press enters selection with the first item pre-selected, taps then
 * toggle membership, and the mode exits automatically once nothing is
 * selected (or explicitly via `clearSelection`).
 */
export function useCardSelection() {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Auto-exit selection mode once the user has deselected everything.
  useEffect(() => {
    if (selectionMode && selectedIds.size === 0) {
      setSelectionMode(false);
    }
  }, [selectionMode, selectedIds]);

  const enterSelection = useCallback((id: string) => {
    setSelectedIds(new Set([id]));
    setSelectionMode(true);
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
    setSelectionMode(true);
  }, []);

  const invertSelection = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set<string>();
      ids.forEach((id) => {
        if (!prev.has(id)) next.add(id);
      });
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  }, []);

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  return {
    selectionMode,
    selectedIds,
    selectedCount: selectedIds.size,
    isSelected,
    enterSelection,
    toggleSelect,
    selectAll,
    invertSelection,
    clearSelection,
  };
}
