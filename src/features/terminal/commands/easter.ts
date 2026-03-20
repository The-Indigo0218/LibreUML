import { commandRegistry, COMING_SOON } from '../registry';

commandRegistry.register({
  name: 'theme',
  description: 'Change the UI theme — try: theme hacker',
  category: 'Core',
  execute(args, ctx) {
    const sub = args[0]?.toLowerCase();

    if (sub === 'hacker') {
      ctx.print('Accessing mainframe...', 'info');
      ctx.print('[■■■■■■■■■■■■■■■■■■■■]  ACCESS GRANTED', 'success');
      ctx.print(COMING_SOON, 'warn');
      ctx.print('(Have you tried bribing the developer?)', 'output');
      return;
    }

    if (!sub) {
      ctx.print('Usage: theme <hacker>', 'error');
      return;
    }

    ctx.print(`theme: unknown theme "${sub}". Available: hacker`, 'error');
  },
});

commandRegistry.register({
  name: 'sudo',
  description: 'Execute a command as superuser',
  category: 'Core',
  execute(args, ctx) {
    const cmd = args.join(' ').trim().toLowerCase();

    if (cmd === 'make me a sandwich') {
      ctx.print('Permission denied. Make it yourself.', 'error');
      return;
    }

    ctx.print('sudo: this incident will be reported.', 'error');
  },
});
