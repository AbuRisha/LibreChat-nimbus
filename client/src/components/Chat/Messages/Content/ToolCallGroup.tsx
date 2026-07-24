import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { useRecoilValue } from 'recoil';
import { ChevronDown, MessageCircleQuestion, Users, Zap } from 'lucide-react';
import { Tools, Constants, ContentTypes, ToolCallTypes } from 'librechat-data-provider';
import type {
  TAttachment,
  TMessageContentParts,
  Agents,
  FunctionToolCall,
} from 'librechat-data-provider';
import type { PartWithIndex } from './ParallelContent';
import { useLocalize, useExpandCollapse, scheduleMessageContentLayoutReconcile } from '~/hooks';
import { isBashProgrammaticToolCall } from './routing';
import { ASK_USER_QUESTION } from '~/utils/approval';
import { cn, getToolDisplayLabel } from '~/utils';
import { StackedToolIcons } from './ToolOutput';
import { useMCPIconMap } from '~/hooks/MCP';
import { AttachmentGroup } from './Parts';
import store from '~/store';

interface ToolMeta {
  name: string;
  iconName: string;
  hasOutput: boolean;
}

function getToolMeta(part: TMessageContentParts): ToolMeta | null {
  if (part.type !== ContentTypes.TOOL_CALL) {
    return null;
  }
  const toolCall = part[ContentTypes.TOOL_CALL];
  if (!toolCall) {
    return null;
  }

  const isStandard =
    'args' in toolCall && (!toolCall.type || toolCall.type === ToolCallTypes.TOOL_CALL);
  if (isStandard) {
    const tc = toolCall as Agents.ToolCall & { progress?: number };
    const completed = !!tc.output || tc.progress === 1;
    const name = tc.name ?? '';
    const iconName = isBashProgrammaticToolCall(name, tc.args) ? Tools.bash_tool : name;
    return { name, iconName, hasOutput: completed };
  }

  if (toolCall.type === ToolCallTypes.CODE_INTERPRETER) {
    const ci = (toolCall as { code_interpreter?: { outputs?: unknown[] } }).code_interpreter;
    return {
      name: 'code_interpreter',
      iconName: 'code_interpreter',
      hasOutput: (ci?.outputs?.length ?? 0) > 0,
    };
  }

  if (toolCall.type === ToolCallTypes.RETRIEVAL || toolCall.type === ToolCallTypes.FILE_SEARCH) {
    return {
      name: 'file_search',
      iconName: 'file_search',
      hasOutput: !!(toolCall as { output?: string }).output,
    };
  }

  if (toolCall.type === ToolCallTypes.FUNCTION && ToolCallTypes.FUNCTION in toolCall) {
    const fn = (toolCall as FunctionToolCall).function;
    return { name: fn.name, iconName: fn.name, hasOutput: !!fn.output };
  }

  return null;
}

interface ToolCallGroupProps {
  parts: PartWithIndex[];
  isSubmitting: boolean;
  isLast: boolean;
  renderPart: (
    part: TMessageContentParts,
    idx: number,
    isLastPart: boolean,
    onToolExpand?: () => void,
  ) => React.ReactNode;
  lastContentIdx: number;
  groupAttachments?: TAttachment[];
  initialExpansionState?: ToolCallGroupExpansionState;
  onExpansionChange?: (state: ToolCallGroupExpansionState) => void;
}

export type ToolCallGroupExpansionState = {
  isExpanded: boolean;
  userOverride: boolean;
};

/** Choose grid-cols class based on tool count (capped at 3 columns). */
function parallelGridCols(count: number): string {
  if (count === 2) return 'sm:grid-cols-2';
  if (count === 3) return 'sm:grid-cols-3';
  return 'sm:grid-cols-2';
}

export default function ToolCallGroup({
  parts,
  isSubmitting,
  isLast,
  renderPart,
  lastContentIdx,
  groupAttachments,
  initialExpansionState,
  onExpansionChange,
}: ToolCallGroupProps) {
  const localize = useLocalize();
  const mcpIconMap = useMCPIconMap();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const cancelLayoutReconcileRef = useRef<(() => void) | null>(null);
  const count = parts.length;

  const toolMetadata = useMemo(() => parts.map((p) => getToolMeta(p.part)), [parts]);
  const allCompleted = useMemo(
    () => toolMetadata.every((m) => m?.hasOutput === true),
    [toolMetadata],
  );
  const toolNames = useMemo(() => toolMetadata.map((m) => m?.name ?? ''), [toolMetadata]);
  const iconToolNames = useMemo(() => toolMetadata.map((m) => m?.iconName ?? ''), [toolMetadata]);

  const subagentCount = useMemo(
    () => toolNames.filter((n) => n === Constants.SUBAGENT).length,
    [toolNames],
  );
  const allSubagents = subagentCount > 0 && subagentCount === count;
  const subagentsDone = allSubagents && (allCompleted || !isSubmitting);

  const askQuestionCount = useMemo(
    () => toolNames.filter((n) => n === ASK_USER_QUESTION).length,
    [toolNames],
  );
  const allAskQuestions = askQuestionCount > 0 && askQuestionCount === count;
  const askQuestionsDone = allAskQuestions && (allCompleted || !isSubmitting);

  /** True when multiple regular tools ran in the same turn (parallel fan-out) */
  const isParallelGroup = count >= 2 && !allSubagents && !allAskQuestions;

  const toolNameSummary = useMemo(() => {
    const seen = new Set<string>();
    const labels: string[] = [];
    for (const rawName of toolNames) {
      if (!rawName) continue;
      const label = getToolDisplayLabel(rawName, localize);
      if (!seen.has(label)) {
        seen.add(label);
        labels.push(label);
      }
    }
    if (labels.length <= 3) {
      return labels.join(', ');
    }
    return `${labels.slice(0, 3).join(', ')}, +${labels.length - 3}`;
  }, [toolNames, localize]);

  const autoExpand = useRecoilValue(store.autoExpandTools);
  const autoCollapse = !autoExpand && count >= 2 && allCompleted;
  const initialState = initialExpansionState?.userOverride === true ? initialExpansionState : null;
  const [isExpanded, setIsExpanded] = useState(
    initialState?.isExpanded ?? (autoExpand || !autoCollapse),
  );
  const [userOverride, setUserOverride] = useState(initialState != null);
  const [shouldRenderBody, setShouldRenderBody] = useState(isExpanded);
  const previousIsExpandedRef = useRef(isExpanded);
  const { style: expandStyle, ref: expandRef } = useExpandCollapse(isExpanded);
  const notifyLayoutChange = useCallback(() => {
    cancelLayoutReconcileRef.current?.();
    cancelLayoutReconcileRef.current = scheduleMessageContentLayoutReconcile(rootRef.current);
  }, []);

  useEffect(
    () => () => {
      cancelLayoutReconcileRef.current?.();
    },
    [],
  );

  useEffect(() => {
    const wasExpanded = previousIsExpandedRef.current;
    previousIsExpandedRef.current = isExpanded;
    if (wasExpanded && !isExpanded) {
      notifyLayoutChange();
    }
  }, [isExpanded, notifyLayoutChange]);

  useEffect(() => {
    if (autoCollapse && !userOverride) {
      setIsExpanded(false);
    }
  }, [autoCollapse, userOverride]);

  const handleToggle = useCallback(() => {
    const nextExpanded = !isExpanded;
    setUserOverride(true);
    if (nextExpanded) {
      setShouldRenderBody(true);
    }
    setIsExpanded(nextExpanded);
    onExpansionChange?.({ isExpanded: nextExpanded, userOverride: true });
  }, [isExpanded, onExpansionChange]);

  const handleToolExpand = useCallback(() => {
    setUserOverride(true);
    setShouldRenderBody(true);
    setIsExpanded(true);
    onExpansionChange?.({ isExpanded: true, userOverride: true });
  }, [onExpansionChange]);

  const handleTransitionEnd = useCallback(
    (event: React.TransitionEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) {
        return;
      }
      if (isExpanded) {
        return;
      }
      setShouldRenderBody(false);
      notifyLayoutChange();
    },
    [isExpanded, notifyLayoutChange],
  );

  const resolveGroupLabel = (): string => {
    if (allSubagents) {
      return subagentsDone
        ? localize('com_ui_ran_n_agents', { 0: String(count) })
        : localize('com_ui_running_n_agents', { 0: String(count) });
    }
    if (allAskQuestions) {
      return askQuestionsDone
        ? localize('com_ui_asked_n_questions', { 0: String(count) })
        : localize('com_ui_asking_n_questions', { 0: String(count) });
    }
    return localize('com_ui_used_n_tools', { 0: String(count) });
  };
  const groupLabel = resolveGroupLabel();
  const CategoryIcon = allSubagents ? Users : MessageCircleQuestion;

  const hasActiveToolCall = useMemo(
    () => isSubmitting && toolMetadata.some((m) => m && !m.hasOutput),
    [toolMetadata, isSubmitting],
  );

  useEffect(() => {
    if (hasActiveToolCall && !userOverride) {
      setShouldRenderBody(true);
      setIsExpanded(true);
    }
  }, [hasActiveToolCall, userOverride]);

  return (
    <div className="mb-2 mt-1" ref={rootRef}>
      <button
        type="button"
        className="inline-flex w-full items-center gap-2 py-1 text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-heavy"
        onClick={handleToggle}
        aria-expanded={isExpanded}
        aria-label={groupLabel}
      >
        {allSubagents || allAskQuestions ? (
          <div
            className={cn(
              'flex h-5 w-5 shrink-0 items-center justify-center text-text-secondary',
              !allCompleted && isSubmitting && 'animate-pulse text-primary',
            )}
            aria-hidden="true"
          >
            <CategoryIcon size={14} />
          </div>
        ) : (
          <StackedToolIcons
            toolNames={iconToolNames}
            mcpIconMap={mcpIconMap}
            maxIcons={4}
            isAnimating={!allCompleted && isSubmitting}
          />
        )}
        <span className="tool-status-text font-medium">{groupLabel}</span>
        {toolNameSummary && !allSubagents && !allAskQuestions && (
          <span className="text-xs font-normal text-text-secondary">— {toolNameSummary}</span>
        )}
        {/* ⚡ parallel badge — shown for multi-tool groups (not subagent/ask-question) */}
        {isParallelGroup && (
          <span
            className="inline-flex shrink-0 items-center gap-0.5 rounded border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 font-mono text-[10px] text-violet-400"
            title="Tools ran in parallel in this turn"
          >
            <Zap size={8} aria-hidden />
            parallel
          </span>
        )}
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-text-secondary transition-transform duration-200 ease-out',
            isExpanded && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </button>
      <div style={expandStyle} onTransitionEnd={handleTransitionEnd} aria-hidden={!isExpanded}>
        {shouldRenderBody && (
          <div className="overflow-hidden" ref={expandRef}>
            {/* Parallel fan-out: responsive grid for multiple regular tool calls */}
            {isParallelGroup ? (
              <div
                className={cn(
                  'grid grid-cols-1 gap-2 py-1',
                  parallelGridCols(count),
                )}
              >
                {parts.map(({ part, idx }) => (
                  <div key={`parallel-cell-${idx}`} className="min-w-0">
                    {renderPart(part, idx, isLast && idx === lastContentIdx, handleToolExpand)}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-0.5 pl-4">
                {parts.map(({ part, idx }) =>
                  renderPart(part, idx, isLast && idx === lastContentIdx, handleToolExpand),
                )}
              </div>
            )}
          </div>
        )}
      </div>
      {groupAttachments && groupAttachments.length > 0 && (
        <AttachmentGroup attachments={groupAttachments} />
      )}
    </div>
  );
}
