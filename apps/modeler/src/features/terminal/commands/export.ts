import { commandRegistry, COMING_SOON } from '../registry';

commandRegistry.register({
  name: 'export',
  description: 'Generate output — try: export java · export png <file> · export svg <file> · export xmi <file>',
  category: 'Export & Generation',
  execute(args, ctx) {
    const fmt = args[0]?.toLowerCase();

    if (!fmt) {
      ctx.print('Usage: export <java|png|svg|xmi> [filename]', 'error');
      return;
    }

    const supported = ['java', 'png', 'svg', 'xmi'];
    if (!supported.includes(fmt)) {
      ctx.print(
        `export: unsupported format "${fmt}". Supported: java, png, svg, xmi`,
        'error',
      );
      return;
    }

    ctx.print(COMING_SOON, 'warn');
  },
});
