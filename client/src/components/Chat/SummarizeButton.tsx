import { useState, useCallback } from 'react';
import { BookmarkMinus } from 'lucide-react';
import { useConversationSummary } from '~/hooks/useConversationSummary';

/**
 * Appears in the chat header once the conversation reaches 10+ messages.
 * Sends the summary prompt via the normal chat submit flow so the AI
 * responds inline — no modal, no new tab, no separate API call.
 *
 * Nimbus palette: violet-400/30 border, violet-500/10 background.
 */
export default function SummarizeButton() {
  const { shouldSuggest, triggerSummarize } = useConversationSummary();
  const [isBusy, setIsBusy] = useState(false);

  const handleClick = useCallback(() => {
    if (isBusy) {
      return;
    }
    setIsBusy(true);
    triggerSummarize();
    // Reset label after a short window — the AI response begins streaming
    // immediately so no need to track async completion here.
    const timer = setTimeout(() => setIsBusy(false), 2500);
    return () => clearTimeout(timer);
  }, [isBusy, triggerSummarize]);

  if (!shouldSuggest) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isBusy}
      title="Summarize conversation to save context"
      aria-label="Summarize conversation"
      className="flex items-center gap-1 rounded-lg border border-violet-400/30 bg-violet-500/10 px-2 py-1 text-xs text-violet-300 transition-colors hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <BookmarkMinus className="h-3 w-3" aria-hidden="true" />
      {isBusy ? 'Summarizing...' : 'Summarize'}
    </button>
  );
}
