import { commandRegistry, COMING_SOON } from '../registry';

commandRegistry.register({
  name: 'gh',
  description: 'GitHub integration — try: gh push · gh clone <url>',
  category: 'Cloud & Git',
  execute(args, ctx) {
    const sub = args[0];

    if (!sub) {
      ctx.print('Usage: gh <push|clone> [url]', 'error');
      return;
    }

    if (sub === 'push' || sub === 'clone') {
      ctx.print(COMING_SOON, 'warn');
      return;
    }

    ctx.print(
      `gh: unknown subcommand "${sub}". Try: gh push, gh clone <url>`,
      'error',
    );
  },
});

commandRegistry.register({
  name: 'cloud',
  description: 'Cloud sync — try: cloud sync',
  category: 'Cloud & Git',
  execute(args, ctx) {
    const sub = args[0];

    if (!sub || sub === 'sync') {
      ctx.print(COMING_SOON, 'warn');
      return;
    }

    ctx.print(
      `cloud: unknown subcommand "${sub}". Try: cloud sync`,
      'error',
    );
  },
});
