"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useReducedMotion } from "@/lib/use-reduced-motion";

const PULL_THRESHOLD = 80;
const MAX_PULL = 120;
const RESISTANCE = 2.5;

function getIsIOSStandalone(): boolean {
  if (typeof window === "undefined") return false;
  
  const isStandalone =
    ("standalone" in window.navigator && window.navigator.standalone === true) ||
    window.matchMedia("(display-mode: standalone)").matches;
  
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  
  return isStandalone && isIOS;
}

function subscribeToStandalone(callback: () => void) {
  const mql = window.matchMedia("(display-mode: standalone)");
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getServerSnapshot() {
  return false;
}

export function PullToRefresh() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  
  const startYRef = useRef(0);
  const isPullingRef = useRef(false);

  const isEnabled = useSyncExternalStore(
    subscribeToStandalone,
    getIsIOSStandalone,
    getServerSnapshot
  );

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (isRefreshing) return;
    if (window.scrollY > 0) return;
    
    startYRef.current = e.touches[0].clientY;
    isPullingRef.current = true;
    setIsPulling(true);
  }, [isRefreshing]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isPullingRef.current || isRefreshing) return;
    if (window.scrollY > 0) {
      isPullingRef.current = false;
      setIsPulling(false);
      setPullDistance(0);
      return;
    }
    
    const currentY = e.touches[0].clientY;
    const diff = currentY - startYRef.current;
    
    if (diff > 0) {
      e.preventDefault();
      const distance = prefersReducedMotion
        ? diff >= PULL_THRESHOLD
          ? PULL_THRESHOLD
          : 0
        : Math.min(diff / RESISTANCE, MAX_PULL);
      setPullDistance(distance);
    }
  }, [isRefreshing, prefersReducedMotion]);

  const handleTouchEnd = useCallback(() => {
    if (!isPullingRef.current) return;
    isPullingRef.current = false;
    setIsPulling(false);
    
    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(PULL_THRESHOLD);
      
      router.refresh();
      
      setTimeout(() => {
        setIsRefreshing(false);
        setPullDistance(0);
      }, 1000);
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, isRefreshing, router]);

  useEffect(() => {
    if (!isEnabled) return;

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isEnabled, handleTouchStart, handleTouchMove, handleTouchEnd]);

  if (!isEnabled || (pullDistance === 0 && !isRefreshing)) {
    return null;
  }

  const progress = Math.min(pullDistance / PULL_THRESHOLD, 1);
  const rotation = prefersReducedMotion ? 0 : progress * 180;
  const transition = isPulling || prefersReducedMotion ? "none" : "all 0.3s ease-out";

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center"
      style={{
        transform: prefersReducedMotion ? undefined : `translateY(${pullDistance - 40}px)`,
        opacity: prefersReducedMotion ? 1 : progress,
        transition,
      }}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-lg dark:bg-slate-800">
        {isRefreshing ? (
          <svg
            className="h-5 w-5 animate-spin text-sky-600 dark:text-sky-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          <svg
            className="h-5 w-5 text-sky-600 dark:text-sky-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            style={{
              transform: prefersReducedMotion ? undefined : `rotate(${rotation}deg)`,
              transition: isPulling || prefersReducedMotion ? "none" : "transform 0.3s ease-out",
            }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        )}
      </div>
    </div>
  );
}
