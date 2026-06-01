import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useInfiniteScroll } from "./useInfiniteScroll";

// Mock IntersectionObserver
class MockIntersectionObserver {
  callback: IntersectionObserverCallback;
  options?: IntersectionObserverInit;
  elements: Element[] = [];
  static instances: MockIntersectionObserver[] = [];

  constructor(
    callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit,
  ) {
    this.callback = callback;
    this.options = options;
    MockIntersectionObserver.instances.push(this);
  }

  observe(element: Element) {
    this.elements.push(element);
  }

  unobserve(element: Element) {
    this.elements = this.elements.filter((el) => el !== element);
  }

  disconnect() {
    this.elements = [];
  }

  // Test helper: simulate an intersection
  simulateIntersection(isIntersecting: boolean) {
    const entries = this.elements.map(
      (target) =>
        ({
          isIntersecting,
          target,
          intersectionRatio: isIntersecting ? 1 : 0,
        }) as IntersectionObserverEntry,
    );
    this.callback(entries, this as unknown as IntersectionObserver);
  }
}

describe("useInfiniteScroll", () => {
  let originalIO: typeof IntersectionObserver;

  beforeEach(() => {
    originalIO = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver =
      MockIntersectionObserver as unknown as typeof IntersectionObserver;
    MockIntersectionObserver.instances = [];
  });

  afterEach(() => {
    globalThis.IntersectionObserver = originalIO;
  });

  it("returns sentinelRef, isLoadingMore, and setIsLoadingMore", () => {
    const onLoadMore = vi.fn();
    const { result } = renderHook(() => useInfiniteScroll(onLoadMore));

    expect(result.current.sentinelRef).toBeTypeOf("function");
    expect(result.current.isLoadingMore).toBe(false);
    expect(result.current.setIsLoadingMore).toBeTypeOf("function");
  });

  it("creates an IntersectionObserver when sentinelRef is attached to a node", () => {
    const onLoadMore = vi.fn();
    const { result } = renderHook(() => useInfiniteScroll(onLoadMore));

    const node = document.createElement("div");
    act(() => {
      result.current.sentinelRef(node);
    });

    expect(MockIntersectionObserver.instances.length).toBe(1);
    expect(MockIntersectionObserver.instances[0].elements).toContain(node);
  });

  it("calls onLoadMore when the sentinel element intersects", () => {
    const onLoadMore = vi.fn();
    const { result } = renderHook(() => useInfiniteScroll(onLoadMore));

    const node = document.createElement("div");
    act(() => {
      result.current.sentinelRef(node);
    });

    const observer = MockIntersectionObserver.instances[0];
    act(() => {
      observer.simulateIntersection(true);
    });

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("does not call onLoadMore when the sentinel is not intersecting", () => {
    const onLoadMore = vi.fn();
    const { result } = renderHook(() => useInfiniteScroll(onLoadMore));

    const node = document.createElement("div");
    act(() => {
      result.current.sentinelRef(node);
    });

    const observer = MockIntersectionObserver.instances[0];
    act(() => {
      observer.simulateIntersection(false);
    });

    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it("does not create an observer when enabled is false", () => {
    const onLoadMore = vi.fn();
    const { result } = renderHook(() =>
      useInfiniteScroll(onLoadMore, { enabled: false }),
    );

    const node = document.createElement("div");
    act(() => {
      result.current.sentinelRef(node);
    });

    expect(MockIntersectionObserver.instances.length).toBe(0);
  });

  it("disconnects old observer when sentinelRef receives a new node", () => {
    const onLoadMore = vi.fn();
    const { result } = renderHook(() => useInfiniteScroll(onLoadMore));

    const node1 = document.createElement("div");
    act(() => {
      result.current.sentinelRef(node1);
    });

    const firstObserver = MockIntersectionObserver.instances[0];
    const disconnectSpy = vi.spyOn(firstObserver, "disconnect");

    const node2 = document.createElement("div");
    act(() => {
      result.current.sentinelRef(node2);
    });

    expect(disconnectSpy).toHaveBeenCalled();
  });

  it("applies the threshold as rootMargin", () => {
    const onLoadMore = vi.fn();
    const { result } = renderHook(() =>
      useInfiniteScroll(onLoadMore, { threshold: 200 }),
    );

    const node = document.createElement("div");
    act(() => {
      result.current.sentinelRef(node);
    });

    const observer = MockIntersectionObserver.instances[0];
    expect(observer.options?.rootMargin).toBe("0px 0px 200px 0px");
  });

  it("allows setting isLoadingMore externally", () => {
    const onLoadMore = vi.fn();
    const { result } = renderHook(() => useInfiniteScroll(onLoadMore));

    expect(result.current.isLoadingMore).toBe(false);

    act(() => {
      result.current.setIsLoadingMore(true);
    });

    expect(result.current.isLoadingMore).toBe(true);
  });

  it("uses the latest onLoadMore callback without resubscribing observer", () => {
    let callCount = 0;
    const callback1 = vi.fn(() => {
      callCount = 1;
    });
    const callback2 = vi.fn(() => {
      callCount = 2;
    });

    const { result, rerender } = renderHook(
      ({ cb }) => useInfiniteScroll(cb),
      { initialProps: { cb: callback1 } },
    );

    const node = document.createElement("div");
    act(() => {
      result.current.sentinelRef(node);
    });

    // Rerender with new callback — observer should NOT be recreated
    const observerCountBefore = MockIntersectionObserver.instances.length;
    rerender({ cb: callback2 });
    expect(MockIntersectionObserver.instances.length).toBe(observerCountBefore);

    // Trigger intersection — should call the latest callback (callback2)
    const observer = MockIntersectionObserver.instances[0];
    act(() => {
      observer.simulateIntersection(true);
    });

    expect(callCount).toBe(2);
    expect(callback2).toHaveBeenCalled();
  });
});
