"use client";

import { useState } from "react";

import { useCallback, useRef, useMemo } from "react";

// Debounced state update hook
export function useDebouncedState(initialState, delay = 100) {
  const [state, setState] = useState(initialState);
  const timeoutRef = useRef(null);

  const debouncedSetState = useCallback(
    (newState) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        setState(newState);
      }, delay);
    },
    [delay]
  );

  return [state, debouncedSetState];
}

// Throttled function hook
export function useThrottledCallback(callback, delay) {
  const lastCall = useRef(0);

  return useCallback(
    (...args) => {
      const now = Date.now();
      if (now - lastCall.current >= delay) {
        lastCall.current = now;
        return callback(...args);
      }
    },
    [callback, delay]
  );
}

// Memoized file elements for better performance
export function useMemoizedFileElements(files, folderId, fileRefs) {
  return useMemo(() => {
    return files
      .map((file) => ({
        id: file.id,
        element: fileRefs.current?.[folderId]?.[file.id],
        file,
      }))
      .filter((item) => item.element);
  }, [files, folderId, fileRefs]);
}

// Virtual scrolling helper for large file lists
export function useVirtualizedList(items, containerHeight, itemHeight) {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleItems = useMemo(() => {
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / itemHeight) + 1,
      items.length
    );

    return {
      startIndex,
      endIndex,
      items: items.slice(startIndex, endIndex),
      totalHeight: items.length * itemHeight,
      offsetY: startIndex * itemHeight,
    };
  }, [items, scrollTop, containerHeight, itemHeight]);

  return {
    visibleItems,
    onScroll: (e) => setScrollTop(e.target.scrollTop),
  };
}

// Performance monitoring hook
export function usePerformanceMonitor(componentName) {
  const renderCount = useRef(0);
  const startTime = useRef(Date.now());

  renderCount.current++;

  console.log(
    `${componentName} render #${renderCount.current} - ${
      Date.now() - startTime.current
    }ms`
  );
}
