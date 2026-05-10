export type OutputType = 'output' | 'error' | 'success' | 'info' | 'input' | 'warn';

export interface OutputLine {
  id: string;
  type: OutputType;
  content: string;
}

export interface TerminalActions {
  runLayout?: () => void;
}

export interface CommandContext {
  print: (content: string, type?: OutputType) => void;
  clear: () => void;
  actions: TerminalActions;
}

export interface Command {
  name: string;
  aliases?: readonly string[];
  description: string;
  category?: string;
  execute: (args: string[], ctx: CommandContext) => void;
}

export const COMING_SOON =
  '⚠️  [Coming Soon]  This feature is currently under development.';

class CommandRegistry {
  private readonly byName = new Map<string, Command>();
  private readonly unique = new Set<Command>();

  register(command: Command): void {
    this.byName.set(command.name, command);
    this.unique.add(command);
    command.aliases?.forEach((alias) => this.byName.set(alias, command));
  }

  get(name: string): Command | undefined {
    return this.byName.get(name.toLowerCase());
  }

  getAll(): Command[] {
    return [...this.unique].sort((a, b) => a.name.localeCompare(b.name));
  }

  getCompletions(prefix: string): string[] {
    const lower = prefix.toLowerCase();
    if (!lower) return this.getAll().map((c) => c.name);
    return this.getAll()
      .map((c) => c.name)
      .filter((name) => name.startsWith(lower));
  }
}

export const commandRegistry = new CommandRegistry();

export function makeLine(content: string, type: OutputType = 'output'): OutputLine {
  return { id: crypto.randomUUID(), type, content };
}
