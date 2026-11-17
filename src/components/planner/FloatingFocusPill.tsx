import {
  ChevronsLeftRight,
  ChevronsRightLeft,
  GripVertical,
  Maximize2,
  PanelLeft,
  Pause,
  Play,
} from 'lucide-react';
import { motion, useDragControls, useMotionValue } from 'motion/react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import {
  clampFloatingPosition,
  clearSavedFloatingRatio,
  defaultFloatingRatio,
  getViewportBounds,
  loadSavedFloatingRatio,
  positionToRatios,
  ratiosToPosition,
  saveFloatingRatio,
  type FloatingAnchorRatio,
  type FloatingBoxSize,
  type FloatingViewport,
} from '../../lib/floatingPosition';
import { UNIPEDIA_SPRING } from '../../lib/motionTokens';
import { cx } from '../../lib/uiHelpers';
import { useHubUiStore } from '../../store/useHubUiStore';

const STORAGE_KEY = 'unipedia-focus-pill-pos-v1';
const ESTIMATED_FULL_BOX: FloatingBoxSize = { width: 320, height: 52 };
const ESTIMATED_COMPACT_BOX: FloatingBoxSize = { width: 176, height: 48 };

interface FloatingFocusPillProps {
  regionLabel: string;
  dragLabel: string;
  compactLabel: string;
  regularLabel: string;
  dockSidebarLabel: string;
  undockFloatLabel: string;
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
    return { width: 1280, height: 800, margin: 16, topSafe: 14, bottomSafe: 20 };
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
  compactLabel,
  regularLabel,
  dockSidebarLabel,
  undockFloatLabel,
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
  const focusBubbleMode = useHubUiStore((s) => s.focusBubbleMode);
  const setFocusBubbleMode = useHubUiStore((s) => s.setFocusBubbleMode);
  const compact = useHubUiStore((s) => s.focusBubbleCompact);
  const setCompact = useHubUiStore((s) => s.setFocusBubbleCompact);
  const sidebarCollapsed = useHubUiStore((s) => s.sidebarCollapsed);

  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : true,
  );
  const [sidebarSlot, setSidebarSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = () => setIsDesktop(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (focusBubbleMode !== 'sidebar' || !isDesktop) return;
    const rafId = window.requestAnimationFrame(() => {
      setSidebarSlot(document.getElementById('unipedia-sidebar-focus-slot'));
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [focusBubbleMode, isDesktop, sidebarCollapsed]);

  const dockTarget = focusBubbleMode === 'sidebar' && isDesktop ? sidebarSlot : null;

  const pillRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  const draggingRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [ratio, setRatio] = useState<FloatingAnchorRatio>(
    () => loadSavedFloatingRatio(STORAGE_KEY) ?? defaultFloatingRatio(),
  );

  const [constraints, setConstraints] = useState(() => {
    const bounds = getViewportBounds(
      compact ? ESTIMATED_COMPACT_BOX : ESTIMATED_FULL_BOX,
      readViewport(),
    );
    return { left: bounds.minX, right: bounds.maxX, top: bounds.minY, bottom: bounds.maxY };
  });

  const initialPoint = ratiosToPosition(
    ratio,
    compact ? ESTIMATED_COMPACT_BOX : ESTIMATED_FULL_BOX,
    readViewport(),
  );
  const x = useMotionValue(initialPoint.x);
  const y = useMotionValue(initialPoint.y);

  const measureBox = useCallback((): FloatingBoxSize => {
    const el = pillRef.current;
    const fallback = compact ? ESTIMATED_COMPACT_BOX : ESTIMATED_FULL_BOX;
    return {
      width: el?.offsetWidth || fallback.width,
      height: el?.offsetHeight || fallback.height,
    };
  }, [compact]);

  const syncBoundsAndPosition = useCallback(
    (nextRatio: FloatingAnchorRatio) => {
      const box = measureBox();
      const viewport = readViewport();
      const bounds = getViewportBounds(box, viewport);
      setConstraints({ left: bounds.minX, right: bounds.maxX, top: bounds.minY, bottom: bounds.maxY });
      const pt = ratiosToPosition(nextRatio, box, viewport);
      x.set(pt.x);
      y.set(pt.y);
    },
    [measureBox, x, y],
  );

  useEffect(() => {
    if (dockTarget) return;
    const onResize = () => {
      if (!draggingRef.current) syncBoundsAndPosition(ratio);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [dockTarget, ratio, syncBoundsAndPosition]);

  useEffect(() => {
    if (dockTarget) return;
    const el = pillRef.current;
    if (!el) return;
    const rafId = window.requestAnimationFrame(() => {
      if (!draggingRef.current) syncBoundsAndPosition(ratio);
    });
    if (typeof ResizeObserver === 'undefined') {
      return () => window.cancelAnimationFrame(rafId);
    }
    const ro = new ResizeObserver(() => {
      if (!draggingRef.current) syncBoundsAndPosition(ratio);
    });
    ro.observe(el);
    return () => {
      window.cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [dockTarget, ratio, syncBoundsAndPosition, compact, courseName, backText]);

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('[data-pill-action="true"]')) return;
    dragControls.start(e);
  };

  const handleDragStart = () => {
    draggingRef.current = true;
    setDragging(true);
  };

  const handleDragEnd = () => {
    draggingRef.current = false;
    setDragging(false);
    const box = measureBox();
    const viewport = readViewport();
    const finalPoint = clampFloatingPosition(x.get(), y.get(), box, viewport);
    x.set(finalPoint.x);
    y.set(finalPoint.y);
    const nextRatio = positionToRatios(finalPoint.x, finalPoint.y, box, viewport);
    setRatio(nextRatio);
    saveFloatingRatio(STORAGE_KEY, nextRatio);
  };

  const resetPosition = () => {
    clearSavedFloatingRatio(STORAGE_KEY);
    const def = defaultFloatingRatio();
    setRatio(def);
    syncBoundsAndPosition(def);
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
    const nextPoint = clampFloatingPosition(x.get() + dx, y.get() + dy, box, viewport);
    x.set(nextPoint.x);
    y.set(nextPoint.y);
    const nextRatio = positionToRatios(nextPoint.x, nextPoint.y, box, viewport);
    setRatio(nextRatio);
    saveFloatingRatio(STORAGE_KEY, nextRatio);
  };

  if (dockTarget) {
    return createPortal(
      sidebarCollapsed ? (
        <div
          role="region"
          aria-label={regionLabel}
          className="mx-auto flex w-full flex-col items-center gap-1.5 rounded-2xl border border-line bg-bg p-1.5 shadow-card"
        >
          <button
            type="button"
            onClick={onExpand}
            aria-label={expandLabel}
            title={`${courseName} · ${clockText} — ${expandLabel}`}
            className="flex w-full flex-col items-center gap-1 rounded-xl py-1 text-fg transition hover:bg-surface-2"
          >
            {courseDotClass && <span className={cx('size-2 rounded-full', courseDotClass)} aria-hidden="true" />}
            <span className="tabular-nums font-mono text-xs font-bold tracking-tight text-fg" aria-live="off">
              {clockText}
            </span>
          </button>
          <div className="flex w-full items-center justify-center gap-1">
            <button
              type="button"
              onClick={onToggleRun}
              aria-label={running ? pauseLabel : resumeLabel}
              title={running ? pauseLabel : resumeLabel}
              className="flex size-7 items-center justify-center rounded-lg text-fg transition hover:bg-surface-2"
            >
              {running ? <Pause size={13} /> : <Play size={13} />}
            </button>
            <button
              type="button"
              onClick={() => setFocusBubbleMode('floating')}
              aria-label={undockFloatLabel}
              title={undockFloatLabel}
              className="flex size-7 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-fg"
            >
              <Maximize2 size={13} />
            </button>
          </div>
        </div>
      ) : (
        <div
          role="region"
          aria-label={regionLabel}
          className="rounded-[18px] border border-line bg-bg p-2.5 shadow-card"
        >
          <div className="mb-1.5 flex items-center justify-between gap-1.5">
            <div className="flex min-w-0 items-center gap-1.5">
              {courseDotClass && <span className={cx('size-2 shrink-0 rounded-full', courseDotClass)} aria-hidden="true" />}
              <span className="truncate text-xs font-semibold text-fg">{courseName}</span>
            </div>
            <button
              type="button"
              onClick={() => setFocusBubbleMode('floating')}
              aria-label={undockFloatLabel}
              title={undockFloatLabel}
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-surface-2 hover:text-fg"
            >
              <Maximize2 size={13} aria-hidden="true" />
            </button>
          </div>
          <div className="flex items-center justify-between gap-1.5">
            <span className="tabular-nums font-mono text-base font-bold text-fg" aria-live="off">
              {clockText}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onToggleRun}
                aria-label={running ? pauseLabel : resumeLabel}
                title={running ? pauseLabel : resumeLabel}
                className="flex size-9 items-center justify-center rounded-full border border-line bg-surface text-fg transition hover:bg-surface-2"
              >
                {running ? <Pause size={14} /> : <Play size={14} />}
              </button>
              <button
                type="button"
                onClick={onExpand}
                aria-label={expandLabel}
                className="flex min-h-9 items-center gap-1 rounded-full bg-ink-cta px-3 text-xs font-semibold text-ink-cta-fg"
              >
                <span>{backText}</span>
              </button>
            </div>
          </div>
        </div>
      ),
      dockTarget,
    );
  }

  return (
    <motion.div
      ref={pillRef}
      role="region"
      aria-label={regionLabel}
      layout
      drag
      dragControls={dragControls}
      dragListener={false}
      dragConstraints={constraints}
      dragElastic={0.08}
      dragMomentum={false}
      whileDrag={{ scale: 1.03 }}
      transition={UNIPEDIA_SPRING}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      onPointerDown={handlePointerDown}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      style={{ x, y }}
      className={cx(
        'fixed left-0 top-0 z-40 flex touch-none select-none items-center gap-1 whitespace-nowrap rounded-full border border-line bg-surface/95 py-1 pl-1 pr-1 text-xs shadow-float backdrop-blur-md',
        dragging
          ? 'cursor-grabbing ring-2 ring-accent/45'
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

      {!compact && (
        <span className="max-w-[6.5rem] truncate font-semibold text-fg">{courseName}</span>
      )}

      <span className="tabular-nums shrink-0 px-1 font-mono text-sm font-semibold text-fg" aria-live="off">
        {clockText}
      </span>

      <button
        type="button"
        data-pill-action="true"
        onClick={onToggleRun}
        aria-label={running ? pauseLabel : resumeLabel}
        title={running ? pauseLabel : resumeLabel}
        className="flex size-10 items-center justify-center rounded-full text-fg transition hover:bg-surface-2"
      >
        {running ? <Pause size={15} /> : <Play size={15} />}
      </button>

      <button
        type="button"
        data-pill-action="true"
        onClick={() => setCompact(!compact)}
        aria-label={compact ? regularLabel : compactLabel}
        title={compact ? regularLabel : compactLabel}
        className="flex size-9 items-center justify-center rounded-full text-muted transition hover:bg-surface-2 hover:text-fg"
      >
        {compact ? <ChevronsLeftRight size={15} /> : <ChevronsRightLeft size={15} />}
      </button>

      {isDesktop && !compact && (
        <button
          type="button"
          data-pill-action="true"
          onClick={() => setFocusBubbleMode('sidebar')}
          aria-label={dockSidebarLabel}
          title={dockSidebarLabel}
          className="hidden size-9 items-center justify-center rounded-full text-muted transition hover:bg-surface-2 hover:text-fg md:flex"
        >
          <PanelLeft size={15} />
        </button>
      )}

      <button
        type="button"
        data-pill-action="true"
        onClick={onExpand}
        aria-label={expandLabel}
        title={expandLabel}
        className={cx(
          'flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-ink-cta font-semibold text-ink-cta-fg',
          compact ? 'size-10 px-0' : 'px-3.5',
        )}
      >
        <Maximize2 size={14} aria-hidden="true" />
        {!compact && <span>{backText}</span>}
      </button>
    </motion.div>
  );
}
