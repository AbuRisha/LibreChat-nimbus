import React, { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Sparkles,
  Zap,
  Code2,
  Lightbulb,
  Search,
  BarChart2,
  Layers,
  Shield,
  Target,
  Bug,
} from 'lucide-react';
import type { TModelSpec } from 'librechat-data-provider';
import { useGetStartupConfig } from '~/data-provider';
import useNewConvo from '~/hooks/useNewConvo';
import { getModelSpecPreset } from '~/utils';

/* ─── Spec icon map ─────────────────────────────────────────────── */
const ICONS: Record<string, React.ReactNode> = {
  'nimbus-scroll-design': <Zap size={14} />,
  'nimbus-code-review': <Code2 size={14} />,
  'nimbus-instant-concept': <Lightbulb size={14} />,
  'nimbus-research-agent': <Search size={14} />,
  'nimbus-data-analyst': <BarChart2 size={14} />,
  'nimbus-full-stack-builder': <Layers size={14} />,
  'nimbus-security-auditor': <Shield size={14} />,
  'nimbus-product-strategist': <Target size={14} />,
  'nimbus-debug-wizard': <Bug size={14} />,
};

/* ─── Fallback spec list (mirrors librechat.yaml) ───────────────── */
const FALLBACK_SPECS = [
  {
    name: 'nimbus-scroll-design',
    label: 'Scroll Designer',
    description: 'Best-in-class scroll-triggered heroes + parallax + reveal.',
    preset: { endpoint: 'Nimbus', model: 'anthropic/claude-sonnet-5' },
  },
  {
    name: 'nimbus-code-review',
    label: 'Code Reviewer',
    description: 'Adversarial line-by-line audit with concrete failure scenarios.',
    preset: { endpoint: 'Nimbus', model: 'anthropic/claude-opus-4.8' },
  },
  {
    name: 'nimbus-instant-concept',
    label: 'Instant Concept',
    description: 'Prompt-to-Awwwards-site with clarify chips if needed.',
    preset: { endpoint: 'Nimbus', model: 'anthropic/claude-sonnet-5' },
  },
  {
    name: 'nimbus-research-agent',
    label: 'Deep Research',
    description:
      'Multi-source research with cited synthesis — uses web fetch and browser tools.',
    preset: { endpoint: 'Nimbus', model: 'google/gemini-3.1-pro-preview' },
  },
  {
    name: 'nimbus-data-analyst',
    label: 'Data Analyst',
    description: 'Python/pandas analysis, chart generation, statistical reasoning.',
    preset: { endpoint: 'Nimbus', model: 'openai/gpt-5.4-mini' },
  },
  {
    name: 'nimbus-full-stack-builder',
    label: 'Full-Stack Builder',
    description: 'Complete apps: Next.js + Postgres + Auth + API in one shot.',
    preset: { endpoint: 'Nimbus', model: 'anthropic/claude-opus-4.8' },
  },
  {
    name: 'nimbus-security-auditor',
    label: 'Security Auditor',
    description: 'OWASP-focused deep audit with exploits and remediation.',
    preset: { endpoint: 'Nimbus', model: 'anthropic/claude-opus-4.8' },
  },
  {
    name: 'nimbus-product-strategist',
    label: 'Product Strategist',
    description: 'PRDs, user stories, roadmaps and competitive positioning.',
    preset: { endpoint: 'Nimbus', model: 'openai/gpt-5.1' },
  },
  {
    name: 'nimbus-debug-wizard',
    label: 'Debug Wizard',
    description: 'Root-cause diagnosis with minimal-repro and precise fix.',
    preset: { endpoint: 'Nimbus', model: 'anthropic/claude-sonnet-5' },
  },
] as TModelSpec[];

/* ─── useAssistantsMarketplace hook ─────────────────────────────── */
export function useAssistantsMarketplace() {
  const [open, setOpen] = useState(false);
  return {
    open,
    openMarketplace: () => setOpen(true),
    closeMarketplace: () => setOpen(false),
  };
}

/* ─── Component ─────────────────────────────────────────────────── */
interface AssistantsMarketplaceProps {
  open: boolean;
  onClose: () => void;
}

export default function AssistantsMarketplace({ open, onClose }: AssistantsMarketplaceProps) {
  const { data: startupConfig } = useGetStartupConfig();
  const { newConversation } = useNewConvo();

  const specs: TModelSpec[] =
    (startupConfig?.modelSpecs?.list?.length ?? 0) > 0
      ? (startupConfig!.modelSpecs!.list as TModelSpec[])
      : FALLBACK_SPECS;

  const handleLaunch = useCallback(
    (spec: TModelSpec) => {
      onClose();
      const preset = getModelSpecPreset(spec);
      newConversation({ preset });
    },
    [onClose, newConversation],
  );

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Assistants Marketplace"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div className="relative z-10 w-full max-w-3xl rounded-2xl border border-violet-500/20 bg-[#05070E] shadow-2xl shadow-violet-500/10">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-violet-400" />
            <h2 className="text-base font-semibold text-white">Assistants</h2>
            <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 font-mono text-xs text-violet-300">
              {specs.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-white/5 hover:text-white"
            aria-label="Close Assistants Marketplace"
          >
            <X size={18} />
          </button>
        </div>

        {/* Spec card grid */}
        <div className="max-h-[70vh] overflow-y-auto p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {specs.map((spec) => (
              <div
                key={spec.name}
                onClick={() => handleLaunch(spec)}
                className="group cursor-pointer rounded-xl border border-white/5 bg-[#0d1020] p-4 transition-all hover:border-violet-500/30 hover:bg-[#0f1228]"
              >
                {/* Icon + label */}
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-violet-400">
                    {ICONS[spec.name] ?? <Sparkles size={14} />}
                  </span>
                  <span className="text-sm font-semibold text-white">{spec.label}</span>
                </div>

                {/* Description */}
                <p className="mb-4 line-clamp-3 text-xs leading-relaxed text-gray-400">
                  {spec.description ?? spec.label}
                </p>

                {/* Footer: model badge + launch */}
                <div className="flex items-center justify-between gap-2">
                  <span className="max-w-[120px] truncate rounded-md border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 font-mono text-xs text-cyan-400">
                    {spec.preset?.model
                      ? String(spec.preset.model).split('/').pop() ?? String(spec.preset.model)
                      : 'nimbus'}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLaunch(spec);
                    }}
                    className="shrink-0 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-violet-500"
                  >
                    Launch →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
