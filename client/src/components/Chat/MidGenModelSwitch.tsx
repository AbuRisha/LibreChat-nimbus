import { useCallback } from 'react';
import { useRecoilValue } from 'recoil';
import { useChatContext } from '~/Providers';
import { useSetOptions } from '~/hooks';
import store from '~/store';

const QUICK_MODELS = [
  { id: 'anthropic/claude-haiku-4.5', label: 'Haiku 4.5', badge: '⚡' },
  { id: 'anthropic/claude-sonnet-5', label: 'Sonnet 5', badge: '◆' },
  { id: 'openai/gpt-5.4-mini', label: 'GPT Mini', badge: '▲' },
  { id: 'deepseek/deepseek-v4-pro', label: 'DeepSeek', badge: '✦' },
];

export default function MidGenModelSwitch() {
  const { isSubmitting, conversation } = useChatContext();
  const { setOption } = useSetOptions();
  const currentModel = conversation?.model ?? '';

  const switchModel = useCallback(
    (model: string) => {
      setOption('model')(model);
    },
    [setOption],
  );

  if (!isSubmitting) return null;

  return (
    <div
      className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-ink-950/60 px-2 py-1"
      title="Switch model for next reply"
    >
      <span className="shrink-0 font-mono text-[9px] uppercase tracking-widest text-cloud-400/50">
        Next
      </span>
      {QUICK_MODELS.filter((m) => m.id !== currentModel).slice(0, 3).map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => switchModel(m.id)}
          className="shrink-0 rounded-full border border-white/[0.1] bg-ink-950/40 px-2 py-0.5 font-mono text-[10px] text-cloud-400/70 transition-all duration-150 hover:border-violet-400/40 hover:bg-violet-500/10 hover:text-violet-300 motion-reduce:transition-none"
        >
          {m.badge} {m.label}
        </button>
      ))}
    </div>
  );
}
