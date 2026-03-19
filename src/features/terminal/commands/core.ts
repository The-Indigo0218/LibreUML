import { commandRegistry } from '../registry';

const CATEGORY_ORDER = [
  'Core',
  'Workspace & Metadata',
  'VFS & Navigation',
  'Editor & Canvas',
  'Export & Generation',
  'Cloud & Git',
];

commandRegistry.register({
  name: 'help',
  aliases: ['list', '?'] as const,
  description: 'List all available commands',
  category: 'Core',
  execute(_args, ctx) {
    const all = commandRegistry.getAll();

    const grouped = new Map<string, typeof all>();
    for (const cmd of all) {
      const cat = cmd.category ?? 'Core';
      if (!grouped.has(cat)) grouped.set(cat, []);
      grouped.get(cat)!.push(cmd);
    }

    const maxName = Math.max(0, ...all.map((c) => c.name.length));
    const maxAlias = Math.max(
      0,
      ...all.map((c) =>
        c.aliases?.length ? `[${c.aliases.join('/')}]`.length : 0,
      ),
    );

    const W = 62;
    ctx.print('─'.repeat(W), 'info');
    ctx.print('  LibreUML Terminal — Available Commands', 'info');
    ctx.print('─'.repeat(W), 'info');

    const orderedCategories = [
      ...CATEGORY_ORDER.filter((c) => grouped.has(c)),
      ...[...grouped.keys()].filter((c) => !CATEGORY_ORDER.includes(c)),
    ];

    for (const cat of orderedCategories) {
      const cmds = grouped.get(cat)!;
      ctx.print('', 'output');
      ctx.print(`  ${cat}`, 'info');

      for (const cmd of cmds) {
        const aliasStr = cmd.aliases?.length
          ? `[${cmd.aliases.join('/')}]`
          : '';
        const col1 = cmd.name.padEnd(maxName + 2);
        const col2 = aliasStr.padEnd(maxAlias + 2);
        ctx.print(`  ${col1}${col2}  ${cmd.description}`);
      }
    }

    ctx.print('', 'output');
    ctx.print('─'.repeat(W), 'info');
    ctx.print(
      '  Tab = autocomplete  ·  ↑/↓ = history  ·  Ctrl+C = cancel',
      'info',
    );
  },
});

commandRegistry.register({
  name: 'clear',
  description: 'Clear the terminal output',
  category: 'Core',
  execute(_args, ctx) {
    ctx.clear();
  },
});

commandRegistry.register({
  name: 'ping',
  description: 'Send a ping — try: ping monroy',
  category: 'Core',
  execute(args, ctx) {
    const target = args.join(' ').trim().toLowerCase();
    if (target === 'monroy') {
      ctx.print(
        "Monroy is busy grading exams. Make sure your diagrams compile!",
        'success',
      );
    } else if (target) {
      ctx.print(`PONG: ${args.join(' ')}`, 'success');
    } else {
      ctx.print('Usage: ping <target>', 'error');
    }
  },
});
