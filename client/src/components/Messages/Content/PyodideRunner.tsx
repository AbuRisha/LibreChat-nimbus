import React, { useState, useRef, useCallback } from 'react';
import { getPyodide } from '~/hooks/usePyodide';

const PYTHON_LANGS = new Set(['python', 'py', 'python3', 'python-repl']);

function isPython(lang: string): boolean {
  return PYTHON_LANGS.has(lang.toLowerCase().trim());
}

type RunStatus = 'idle' | 'loading-pyodide' | 'running' | 'done' | 'error';

interface PyodideRunnerProps {
  lang: string;
  codeRef: React.RefObject<HTMLElement>;
}

const PyodideRunner: React.FC<PyodideRunnerProps> = ({ lang, codeRef }) => {
  const [status, setStatus] = useState<RunStatus>('idle');
  const [stdout, setStdout] = useState<string>('');
  const [stderr, setStderr] = useState<string>('');
  const [elapsed, setElapsed] = useState<number | null>(null);
  const runningRef = useRef(false);

  const handleRun = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;

    const code = codeRef.current?.textContent ?? '';
    if (!code.trim()) {
      runningRef.current = false;
      return;
    }

    setStdout('');
    setStderr('');
    setElapsed(null);
    setStatus('loading-pyodide');

    try {
      const pyodide = await getPyodide();
      setStatus('running');

      const start = performance.now();

      let capturedStdout = '';
      let capturedStderr = '';

      pyodide.setStdout({ batched: (text: string) => { capturedStdout += text + '\n'; } });
      pyodide.setStderr({ batched: (text: string) => { capturedStderr += text + '\n'; } });

      try {
        await pyodide.runPythonAsync(code);
      } catch (err: any) {
        capturedStderr += String(err);
      }

      const end = performance.now();

      setStdout(capturedStdout);
      setStderr(capturedStderr);
      setElapsed(Math.round(end - start));
      setStatus(capturedStderr ? 'error' : 'done');
    } catch (err: any) {
      setStderr(String(err));
      setStatus('error');
    } finally {
      runningRef.current = false;
    }
  }, [codeRef]);

  if (!isPython(lang)) return null;

  const isLoading = status === 'loading-pyodide' || status === 'running';
  const hasOutput = stdout || stderr;

  return (
    <>
      <div className="flex items-center gap-2 border-t border-border-light bg-surface-primary-alt px-1.5 py-1.5 dark:bg-transparent">
        <button
          type="button"
          onClick={handleRun}
          disabled={isLoading}
          style={{ backgroundColor: '#8B5CF6', borderRadius: '8px' }}
          className="inline-flex select-none items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-white transition-opacity disabled:opacity-60 hover:opacity-90"
          aria-label="Run Python code in browser"
          aria-busy={isLoading || undefined}
        >
          {isLoading ? (
            <>
              <span className="inline-block animate-spin">&#8635;</span>
              {status === 'loading-pyodide' ? 'Loading Python…' : 'Running…'}
            </>
          ) : (
            <>&#9654; Run</>
          )}
        </button>
        {elapsed !== null && (
          <span className="text-[10px] text-text-secondary">{elapsed} ms</span>
        )}
      </div>
      {hasOutput && (
        <div className="border-t border-border-light bg-[#0d1117] p-3">
          {stdout && (
            <pre className="whitespace-pre-wrap break-words font-mono text-xs text-[#22c55e]">
              {stdout}
            </pre>
          )}
          {stderr && (
            <pre className="whitespace-pre-wrap break-words font-mono text-xs text-[#ef4444]">
              {stderr}
            </pre>
          )}
        </div>
      )}
    </>
  );
};

export default PyodideRunner;
