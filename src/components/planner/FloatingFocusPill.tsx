import { GripVertical, Maximize2, Pause, Play } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  clampFloatingPosition,
  clearSavedFloatingRatio,
  defaultFloatingRatio,
  loadSavedFloatingRatio,
  positionToRatios,
  ratiosToPosition,
  saveFloatingRatio,
  type FloatingAnchorRatio,
  type FloatingBoxSize,
  type FloatingPoint,
  type FloatingViewport,
} from '../../lib/floatingPosition';
import { cx } from '../../lib/uiHelpers';

const STORAGE_KEY = 'unipedia-focus-pill-pos-v1';
const DRAG_THRESHOLD_PX = 4;
const ESTIMATED_BOX: FloatingBoxSize = { width: 260, height: 52 };

interface FloatingFocusPillProps {
  regionLabel: string;
  dragLabel: string;
  courseName: string;
  courseDotClass?: string;
  clockText: string;
  running: boolean;
  pauseLabel: string;
  resumeLabel: string;
  expandLabel: string;
  backText: string;
  onToggleRun: () => void;
  onExpand?: () => void;
}

function readViewport(): FloatingViewport {
  if (typeof window === 'undefined') {
    return { width: 1280, height: 800, margin: 16, topSafe: 16, bottomSafe: 20 };
  }
  const width = window.innerWidth;
  const height = window.innerHeight;
  const isMobile = width < 768;
  return {
    width,
    height,
    margin: isMobile ? 12 : 16,
    topSafe: 14,
    bottomSafe: isMobile ? 84 : 20,
  };
}

export default function FloatingFocusPill({
  regionLabel,
  dragLabel,
  courseName,
  courseDotClass,
  clockText,
  running,
  pauseLabel,
  resumeLabel,
  expandLabel,
  backText,
  onToggleRun,
  onExpand,
}: FloatingFocusPillProps) {
  const pillRef = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState<FloatingAnchorRatio>(
    () => loadSavedFloatingRatio(STORAGE_KEY) ?? defaultFloatingRatio(),
  );
  const [pos, setPos] = useState<FloatingPoint>(() =>
    ratiosToPosition(
      loadSavedFloatingRatio(STORAGE_KEY) ?? defaultFloatingRatio(),
      ESTIMATED_BOX,
      readViewport(),
    ),
  );
  const [dragging, setDragging] = useState(false);

  const dragStateRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);

  const measureBox = useCallback((): FloatingBoxSize => {
    const el = pillRef.current;
    return {
      width: el?.offsetWidth || ESTIMATED_BOX.width,
      height: el?.offsetHeight || ESTIMATED_BOX.height,
    };
  }, []);

  const syncFromRatio = useCallback(
    (nextRatio: FloatingAnchorRatio) => {
      const box = measureBox();
      const viewport = readViewport();
      setPos(ratiosToPosition(nextRatio, box, viewport));
    },
    [measureBox],
  );

  useEffect(() => {
    const onResize = () => {
      if (dragging) return;
      syncFromRatio(ratio);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [dragging, ratio, syncFromRatio]);

  useEffect(() => {
    const el = pillRef.current;
    if (!el) return;
    const rafId = window.requestAnimationFrame(() => {
      if (!dragStateRef.current) syncFromRatio(ratio);
    });
    if (typeof ResizeObserver === 'undefined') {
      return () => window.cancelAnimationFrame(rafId);
    }
    const ro = new ResizeObserver(() => {
      if (!dragStateRef.current) syncFromRatio(ratio);
    });
    ro.observe(el);
    return () => {
      window.cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [ratio, syncFromRatio]);

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('[data-pill-action="true"]')) return;

    const current = pos ?? ratiosToPosition(ratio, measureBox(), readViewport());
    dragStateRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      originX: current.x,
      originY: current.y,
      moved: false,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore environments without pointer capture
    }
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const st = dragStateRef.current;
    if (!st || st.pointerId !== e.pointerId) return;
    const dx = e.clientX - st.startClientX;
    const dy = e.clientY - st.startClientY;
    if (!st.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;

    if (!st.moved) {
      st.moved = true;
      setDragging(true);
    }
    const clamped = clampFloatingPosition(
      st.originX + dx,
      st.originY + dy,
      measureBox(),
      readViewport(),
    );
    setPos(clamped);
  };

  const finishDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const st = dragStateRef.current;
    if (!st || st.pointerId !== e.pointerId) return;
    dragStateRef.current = null;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }
    if (!st.moved) return;

    setDragging(false);
    const box = measureBox();
    const viewport = readViewport();
    const dx = e.clientX - st.startClientX;
    const dy = e.clientY - st.startClientY;
    const finalPoint = clampFloatingPosition(st.originX + dx, st.originY + dy, box, viewport);
    const nextRatio = positionToRatios(finalPoint.x, finalPoint.y, box, viewport);
    setPos(finalPoint);
    setRatio(nextRatio);
    saveFloatingRatio(STORAGE_KEY, nextRatio);
  };

  const resetPosition = () => {
    clearSavedFloatingRatio(STORAGE_KEY);
    const def = defaultFloatingRatio();
    setRatio(def);
    syncFromRatio(def);
  };

  const handleGripKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Home') {
      e.preventDefault();
      resetPosition();
      return;
    }
    const step = e.shiftKey ? 64 : 24;
    let dx = 0;
    let dy = 0;
    if (e.key === 'ArrowLeft') dx = -step;
    else if (e.key === 'ArrowRight') dx = step;
    else if (e.key === 'ArrowUp') dy = -step;
    else if (e.key === 'ArrowDown') dy = step;
    else return;

    e.preventDefault();
    const box = measureBox();
    const viewport = readViewport();
    const current = pos ?? ratiosToPosition(ratio, box, viewport);
    const nextPoint = clampFloatingPosition(current.x + dx, current.y + dy, box, viewport);
    const nextRatio = positionToRatios(nextPoint.x, nextPoint.y, box, viewport);
    setPos(nextPoint);
    setRatio(nextRatio);
    saveFloatingRatio(STORAGE_KEY, nextRatio);
  };

  return (
    <div
      ref={pillRef}
      role="region"
      aria-label={regionLabel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      style={
        pos
          ? { transform: `translate3d(${pos.x}px, ${pos.y}px, 0)` }
          : undefined
      }
      className={cx(
        'fixed left-0 top-0 z-40 flex touch-none select-none items-center gap-1 whitespace-nowrap rounded-full border border-line bg-surface/95 py-1 pl-1.5 pr-1 text-xs shadow-float backdrop-blur-md transition-shadow',
        pos ? 'opacity-100' : 'pointer-events-none opacity-0',
        dragging
          ? 'cursor-grabbing ring-2 ring-accent/40'
          : 'cursor-grab',
      )}
    >
      <button
        type="button"
        onDoubleClick={resetPosition}
        onKeyDown={handleGripKeyDown}
        aria-label={dragLabel}
        title={dragLabel}
        className="flex h-9 w-7 shrink-0 cursor-grab items-center justify-center rounded-full text-muted transition hover:bg-surface-2 hover:text-fg active:cursor-grabbing"
      >
        <GripVertical size={15} aria-hidden="true" />
      </button>
      {courseDotClass && (
        <span className={cx('size-2 shrink-0 rounded-full', courseDotClass)} aria-hidden="true" />
      )}
      <span className="max-w-[7rem] truncate font-semibold text-fg">{courseName}</span>
      <span className="tabular-nums shrink-0 px-1.5 font-mono text-sm font-semibold text-fg" aria-live="off">
        {clockText}
      </span>
      <button
        type="button"
        data-pill-action="true"
        onClick={onToggleRun}
        aria-label={running ? pauseLabel : resumeLabel}
        className="flex size-11 items-center justify-center rounded-full text-fg hover:bg-surface-2"
      >
        {running ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <button
        type="button"
        data-pill-action="true"
        onClick={onExpand}
        aria-label={expandLabel}
        className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-ink-cta px-3.5 font-semibold text-ink-cta-fg"
      >
        <Maximize2 size={14} aria-hidden="true" />
        <span>{backText}</span>
      </button>
    </div>
  );
}
