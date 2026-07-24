import { useCallback, useContext } from 'react';
import { useParams } from 'react-router-dom';
import { Constants } from 'librechat-data-provider';
import type { TMessage } from 'librechat-data-provider';
import { useGetMessagesByConvoId } from '~/data-provider';
import { ChatContext } from '~/Providers';

const SUMMARY_PROMPT =
  'Please provide a concise summary of our conversation so far, focusing on key decisions, code written, and remaining tasks. Keep it under 200 words.';

/**
 * Returns whether the current conversation is long enough to warrant a summary
 * button (>= 10 messages), and a callback to fire the summary prompt.
 *
 * Reactivity: useGetMessagesByConvoId subscribes to the React Query cache key
 * [QueryKeys.messages, conversationId] — the same key ChatView populates via
 * setMessages / useGetMessagesByConvoId. The `select` transformer limits
 * re-renders to count changes only, not every streaming content update.
 */
export function useConversationSummary() {
  const { conversationId } = useParams();
  const ctx = useContext(ChatContext);

  const isValidConvo =
    !!conversationId &&
    conversationId !== Constants.NEW_CONVO &&
    conversationId !== Constants.SEARCH;

  const { data: messageCount = 0 } = useGetMessagesByConvoId(
    conversationId ?? '',
    {
      select: (data: TMessage[]) => data.length,
      enabled: isValidConvo,
    },
    { isStreaming: ctx?.isSubmitting },
  );

  const shouldSuggest = messageCount >= 10;

  const triggerSummarize = useCallback(() => {
    if (!ctx || ctx.isSubmitting) {
      return;
    }
    ctx.ask({ text: SUMMARY_PROMPT });
  }, [ctx]);

  return { shouldSuggest, triggerSummarize };
}

export default useConversationSummary;
