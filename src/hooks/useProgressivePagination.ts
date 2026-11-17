import { useState, useEffect, useCallback, useRef } from 'react';

interface UseProgressivePaginationOptions {
  batchSize?: number;
  initialBatches?: number;
}

export interface ProgressivePaginationResult<T> {
  displayedItems: T[];
  hasMore: boolean;
  loadMore: () => void;
  totalCount: number;
  loadedCount: number;
  setSentinelRef: (node: HTMLDivElement | null) => void;
}

export function useProgressivePagination<T>(
  items: T[],
  options: UseProgressivePaginationOptions = {}
): ProgressivePaginationResult<T> {
  const { batchSize = 30, initialBatches = 1 } = options;
  const [visibleCount, setVisibleCount] = useState<number>(batchSize * initialBatches);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelElementRef = useRef<HTMLDivElement | null>(null);

  // Track previous items length and first item to detect real filter changes without infinite re-render loops
  const prevSnapshotRef = useRef<{ length: number; first: any }>({
    length: items.length,
    first: items[0],
  });

  useEffect(() => {
    const hasChanged =
      items.length !== prevSnapshotRef.current.length ||
      items[0] !== prevSnapshotRef.current.first;

    if (hasChanged) {
      prevSnapshotRef.current = { length: items.length, first: items[0] };
      setVisibleCount(batchSize * initialBatches);
    }
  }, [items.length, items[0], batchSize, initialBatches]);

  const hasMore = visibleCount < items.length;

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + batchSize, items.length));
  }, [batchSize, items.length]);

  const displayedItems: T[] = items.slice(0, visibleCount);

  // IntersectionObserver for continuous scroll
  const setSentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      sentinelElementRef.current = node;

      if (node && hasMore) {
        observerRef.current = new IntersectionObserver(
          (entries) => {
            if (entries[0]?.isIntersecting) {
              loadMore();
            }
          },
          {
            root: null,
            rootMargin: '800px', // Pre-fetch next batch well ahead for fast-scrolling users
            threshold: 0.01,
          }
        );

        observerRef.current.observe(node);
      }
    },
    [hasMore, loadMore]
  );

  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  return {
    displayedItems,
    hasMore,
    loadMore,
    totalCount: items.length,
    loadedCount: displayedItems.length,
    setSentinelRef,
  };
}
