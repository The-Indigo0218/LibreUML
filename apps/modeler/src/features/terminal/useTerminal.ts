import { useState, useCallback, useRef } from 'react';
import { commandRegistry, makeLine } from './registry';
import type { OutputLine, OutputType, TerminalActions } from './registry';
import './commands/index';

const WELCOME: OutputLine[] = [
  makeLine('LibreUML Terminal  v1.0', 'info'),
  makeLine(
    'Type "help" for available commands. Press Tab for autocomplete.',
    'info',
  ),
  makeLine('', 'output'),
];

export interface TerminalOptions {
  actions?: TerminalActions;
}

export function useTerminal(options: TerminalOptions = {}) {
  const [output, setOutput] = useState<OutputLine[]>(WELCOME);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const savedInputRef = useRef('');
  const inputRef = useRef<HTMLInputElement>(null);

  const actions = options.actions ?? {};

  const print = useCallback((content: string, type: OutputType = 'output') => {
    setOutput((prev) => [...prev, makeLine(content, type)]);
  }, []);

  const clear = useCallback(() => {
    setOutput([]);
  }, []);

  const execute = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return;

      setOutput((prev) => [
        ...prev,
        makeLine(`libreuml~$ ${trimmed}`, 'input'),
      ]);
      setHistory((prev) => [trimmed, ...prev]);
      setHistoryIndex(-1);
      savedInputRef.current = '';

      const [name, ...args] = trimmed.split(/\s+/);
      const command = commandRegistry.get(name);

      if (!command) {
        print(
          `${name}: command not found. Type "help" for available commands.`,
          'error',
        );
      } else {
        command.execute(args, { print, clear, actions });
      }
    },
    [print, clear, actions],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        execute(input);
        setInput('');
        return;
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        const completions = commandRegistry.getCompletions(input.trim());
        if (completions.length === 0) return;
        if (completions.length === 1) {
          setInput(completions[0] + ' ');
        } else {
          setOutput((prev) => [
            ...prev,
            makeLine(`libreuml~$ ${input}`, 'input'),
            makeLine(completions.join('    '), 'output'),
          ]);
        }
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const nextIndex = historyIndex + 1;
        if (nextIndex >= history.length) return;
        if (historyIndex === -1) savedInputRef.current = input;
        setHistoryIndex(nextIndex);
        setInput(history[nextIndex]);
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIndex === -1) return;
        const nextIndex = historyIndex - 1;
        if (nextIndex === -1) {
          setHistoryIndex(-1);
          setInput(savedInputRef.current);
        } else {
          setHistoryIndex(nextIndex);
          setInput(history[nextIndex]);
        }
        return;
      }

      if (e.ctrlKey && e.key === 'c') {
        e.preventDefault();
        setOutput((prev) => [
          ...prev,
          makeLine(`libreuml~$ ${input}^C`, 'input'),
        ]);
        setInput('');
        setHistoryIndex(-1);
        savedInputRef.current = '';
        return;
      }
    },
    [input, historyIndex, history, execute],
  );

  return { output, input, setInput, handleKeyDown, inputRef };
}
