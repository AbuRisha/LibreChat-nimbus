import { useState, useCallback, useEffect, useRef, memo } from 'react';
import { useRecoilValue } from 'recoil';
import { Plus, Trash2 } from 'lucide-react';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';
import store from '~/store';

interface Task {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
}

const STORAGE_PREFIX = 'nimbus:tasks:';

function loadTasks(key: string): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    return raw ? (JSON.parse(raw) as Task[]) : [];
  } catch {
    return [];
  }
}

function saveTasks(key: string, tasks: Task[]): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(tasks));
  } catch {
    // storage full — silently ignore
  }
}

const TaskItem = memo(function TaskItem({
  task,
  onToggle,
  onDelete,
}: {
  task: Task;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <li className="group flex items-start gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/5">
      <button
        type="button"
        aria-label={task.done ? 'Mark incomplete' : 'Mark complete'}
        onClick={() => onToggle(task.id)}
        className={cn(
          'mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors',
          task.done
            ? 'border-violet-500 bg-violet-500'
            : 'border-zinc-600 bg-transparent hover:border-violet-400',
        )}
      >
        {task.done && (
          <svg
            width="10"
            height="8"
            viewBox="0 0 10 8"
            fill="none"
            className="text-white"
            aria-hidden="true"
          >
            <path
              d="M1 4L3.5 6.5L9 1"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      <span
        className={cn(
          'flex-1 text-sm leading-snug',
          task.done ? 'text-zinc-500 line-through' : 'text-zinc-200',
        )}
      >
        {task.text}
      </span>

      <button
        type="button"
        aria-label="Delete task"
        onClick={() => onDelete(task.id)}
        className="mt-0.5 flex-shrink-0 text-zinc-600 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  );
});

function TaskTracker() {
  const localize = useLocalize();
  const conversation = useRecoilValue(store.conversationByIndex(0));
  const storageKey = conversation?.conversationId ?? '__no_convo__';

  const [tasks, setTasks] = useState<Task[]>(() => loadTasks(storageKey));
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Reload tasks when conversation changes
  useEffect(() => {
    setTasks(loadTasks(storageKey));
  }, [storageKey]);

  // Persist tasks on every change
  useEffect(() => {
    saveTasks(storageKey, tasks);
  }, [storageKey, tasks]);

  const addTask = useCallback(() => {
    const text = input.trim();
    if (!text) {
      return;
    }
    setTasks((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, text, done: false, createdAt: Date.now() },
    ]);
    setInput('');
  }, [input]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addTask();
      }
    },
    [addTask],
  );

  const toggleTask = useCallback((id: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearDone = useCallback(() => {
    setTasks((prev) => prev.filter((t) => !t.done));
  }, []);

  const doneCount = tasks.filter((t) => t.done).length;
  const totalCount = tasks.length;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <h2 className="text-sm font-semibold text-zinc-100">
          {localize('com_ui_tasks')}
          {totalCount > 0 && (
            <span className="ml-2 rounded-full bg-violet-600/30 px-1.5 py-0.5 text-xs font-medium text-violet-300">
              {doneCount}/{totalCount}
            </span>
          )}
        </h2>
        {doneCount > 0 && (
          <button
            type="button"
            onClick={clearDone}
            className="text-xs text-zinc-500 transition-colors hover:text-red-400"
          >
            Clear done
          </button>
        )}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={localize('com_ui_task_placeholder')}
          className="flex-1 rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 outline-none ring-1 ring-zinc-700 transition-colors focus:ring-violet-500"
        />
        <button
          type="button"
          onClick={addTask}
          disabled={!input.trim()}
          aria-label="Add task"
          className={cn(
            'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md transition-colors',
            input.trim()
              ? 'bg-violet-600 text-white hover:bg-violet-500'
              : 'cursor-not-allowed bg-zinc-800 text-zinc-600',
          )}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Task list */}
      <ul className="flex-1 overflow-y-auto px-2 py-2">
        {tasks.length === 0 ? (
          <li className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mb-2 text-3xl">✅</div>
            <p className="text-sm text-zinc-500">No tasks yet</p>
            <p className="mt-0.5 text-xs text-zinc-600">Type above and press Enter</p>
          </li>
        ) : (
          tasks.map((task) => (
            <TaskItem key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} />
          ))
        )}
      </ul>

      {/* Footer progress bar */}
      {totalCount > 0 && (
        <div className="border-t border-zinc-800 px-4 py-2">
          <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 transition-all duration-300"
              style={{ width: `${(doneCount / totalCount) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(TaskTracker);
