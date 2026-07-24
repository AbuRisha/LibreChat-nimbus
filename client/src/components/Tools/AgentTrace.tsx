import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { useExpandCollapse } from '~/hooks';
import { cn } from '~/utils';

type TraceStatus = 'running' | 'done' | 'error' | 'cancelled';

function formatElapsed(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

function tryFormatJson(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) {
      return JSON.stringify(parsed, null, 2);
    }
    return typeof parsed === 'string' ? parsed : String(parsed);
  } catch {
    return raw;
  }
}

function hasSignificantArgs(args: string): boolean {
  if (!args || args.trim() === '' || args === '{}') {
    return false;
  }
  try {
    const p = JSON.parse(args);
    if (typeof p === 'object' && p !== null) {
      return Object.keys(p).length > 0;
    }
    return false;
  } catch {
    return args.trim().length > 0;
  }
}

export interface AgentTraceProps {
  /** Tool display name (already parsed, no MCP delimiters) */
  name: string;
  /** Raw JSON-serialized args string */
  args: string;
  output?: string | null;
  isRunning: boolean;
  isError: boolean;
  isCancelled: boolean;
  /** Tool icon element rendered on the left */
  icon?: React.ReactNode;
  /** Optional subtitle, e.g. "via server-name" */
  subtitle?: string;
  /** Called the first time the user opens input or output */
  onExpand?: () => void;
}

/**
 * AgentTrace — Nimbus-style inline agent trace panel.
 *
 * Always-visible one-liner:
 *   [icon] tool_name … [●status] [▼ Input] [▼ Output] [Xms]
 *
 * Clicking Input / Output expands a monospace JSON / text viewer.
 * Dark violet theme (#0d0f1a bg, violet-* text) matching Nimbus palette.
 */
export default function AgentTrace({
  name,
  args,
  output,
  isRunning,
  isError,
  isCancelled,
  icon,
  subtitle,
  onExpand,
}: AgentTraceProps) {
  const mountTimeRef = useRef<number>(Date.now());
  const frozenElapsedRef = useRef<number | null>(null);
  const hasExpandedRef = useRef(false);
  /** Incremented every 250 ms while running to drive elapsed-timer re-renders */
  const [, forceRender] = useState(0);
  const [showInput, setShowInput] = useState(false);
  const [showOutput, setShowOutput] = useState(false);
  const { style: inputStyle, ref: inputRef } = useExpandCollapse(showInput);
  const { style: outputStyle, ref: outputRef } = useExpandCollapse(showOutput);

  const hasOutput = (output?.length ?? 0) > 0;
  const hasArgs = hasSignificantArgs(args);

  const status: TraceStatus = isCancelled
    ? 'cancelled'
    : isError
    ? 'error'
    : isRunning
    ? 'running'
    : 'done';

  // Freeze elapsed when run completes
  useEffect(() => {
    if (!isRunning) {
      frozenElapsedRef.current ??= Date.now() - mountTimeRef.current;
    }
  }, [isRunning]);

  // Live timer while running
  useEffect(() => {
    if (!isRunning) {
      return;
    }
    const id = setInterval(() => forceRender((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [isRunning]);

  const elapsedMs =
    frozenElapsedRef.current !== null
      ? frozenElapsedRef.current
      : Date.now() - mountTimeRef.current;

  /** Only show timing when the component was live at some point */
  const showTiming = isRunning || frozenElapsedRef.current !== null;

  const notifyExpand = useCallback(() => {
    if (!hasExpandedRef.current) {
      hasExpandedRef.current = true;
      onExpand?.();
    }
  }, [onExpand]);

  const handleToggleInput = useCallback(() => {
    setShowInput((v) => {
      const next = !v;
      if (next) {
        notifyExpand();
      }
      return next;
    });
  }, [notifyExpand]);

  const handleToggleOutput = useCallback(() => {
    setShowOutput((v) => {
      const next = !v;
      if (next) {
        notifyExpand();
      }
      return next;
    });
  }, [notifyExpand]);

  const STATUS_CONFIG: Record<TraceStatus, { dot: string; label: string }> = {
    running: { dot: 'bg-amber-400 animate-pulse', label: 'running' },
    done: { dot: 'bg-emerald-400', label: 'done' },
    error: { dot: 'bg-red-400', label: 'error' },
    cancelled: { dot: 'bg-zinc-500', label: 'cancelled' },
  };
  const { dot: dotClass, label: statusLabel } = STATUS_CONFIG[status];

  return (
    <div className="nimbus-agent-trace my-1.5 overflow-hidden rounded-lg border border-violet-500/20 bg-[#0d0f1a]">
      {/* ── Always-visible header row ── */}
      <div className="flex min-h-[32px] items-center gap-2 px-3 py-1.5">
        {/* Tool icon */}
        {icon && (
          <span className="shrink-0 text-violet-400" aria-hidden="true">
            {icon}
          </span>
        )}

        {/* Tool name */}
        <span className="max-w-[180px] truncate font-mono text-xs font-bold text-violet-200">
          {name}
        </span>

        {/* Subtitle (e.g. "via server-name") */}
        {subtitle && (
          <span
            className="hidden font-mono text-[10px] text-violet-500 sm:inline"
            title={subtitle}
          >
            {subtitle}
          </span>
        )}

        {/* Spacer */}
        <span className="flex-1" />

        {/* Status dot */}
        <span
          className={cn('h-2 w-2 shrink-0 rounded-full', dotClass)}
          title={statusLabel}
          aria-label={`Tool ${statusLabel}`}
        />

        {/* ▼ Input */}
        {hasArgs && (
          <button
            type="button"
            onClick={handleToggleInput}
            aria-expanded={showInput}
            className={cn(
              'flex items-center gap-0.5 rounded px-1.5 py-0.5',
              'font-mono text-[10px] text-violet-300',
              'transition-colors hover:bg-violet-900/40',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500',
              showInput && 'bg-violet-900/30 text-violet-200',
            )}
          >
            Input
            <ChevronDown
              size={9}
              className={cn(
                'shrink-0 transition-transform duration-150',
                showInput && 'rotate-180',
              )}
              aria-hidden
            />
          </button>
        )}

        {/* ▼ Output */}
        {hasOutput && (
          <button
            type="button"
            onClick={handleToggleOutput}
            aria-expanded={showOutput}
            className={cn(
              'flex items-center gap-0.5 rounded px-1.5 py-0.5',
              'font-mono text-[10px] text-violet-300',
              'transition-colors hover:bg-violet-900/40',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500',
              showOutput && 'bg-violet-900/30 text-violet-200',
            )}
          >
            Output
            <ChevronDown
              size={9}
              className={cn(
                'shrink-0 transition-transform duration-150',
                showOutput && 'rotate-180',
              )}
              aria-hidden
            />
          </button>
        )}

        {/* Elapsed timer */}
        {showTiming && (
          <span className="shrink-0 font-mono text-[10px] tabular-nums text-violet-500/70">
            {formatElapsed(elapsedMs)}
          </span>
        )}
      </div>

      {/* ── Input (args) expandable panel ── */}
      <div style={inputStyle}>
        <div ref={inputRef} className="overflow-hidden">
          <div className="border-t border-violet-500/20 bg-[#070910] px-3 py-2">
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-violet-100">
              {tryFormatJson(args)}
            </pre>
          </div>
        </div>
      </div>

      {/* ── Output expandable panel ── */}
      <div style={outputStyle}>
        <div ref={outputRef} className="overflow-hidden">
          <div className="border-t border-violet-500/20 bg-[#070910] px-3 py-2">
            <pre
              className={cn(
                'max-h-64 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed',
                isError ? 'text-red-300' : 'text-violet-100',
              )}
            >
              {output}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
