import { commandRegistry, COMING_SOON } from '../registry';
import { useModelStore } from '../../../store/model.store';
import { useSettingsStore } from '../../../store/settingsStore';

commandRegistry.register({
  name: 'magic',
  aliases: ['layout'] as const,
  description: 'Run Dagre TB auto-layout on the active diagram',
  category: 'Editor & Canvas',
  execute(_args, ctx) {
    if (ctx.actions.runLayout) {
      ctx.actions.runLayout();
      ctx.print('Auto Layout applied ✓', 'success');
    } else {
      ctx.print(COMING_SOON, 'warn');
    }
  },
});

commandRegistry.register({
  name: 'find',
  description: 'Find elements on canvas — try: find class <name>',
  category: 'Editor & Canvas',
  execute(args, ctx) {
    const sub = args[0];
    const query = args.slice(1).join(' ').trim();

    if (sub !== 'class' || !query) {
      ctx.print('Usage: find class <name>', 'error');
      return;
    }

    const model = useModelStore.getState().model;
    if (!model) {
      ctx.print('No model loaded.', 'error');
      return;
    }

    const found = Object.values(model.classes).filter((c) =>
      c.name.toLowerCase().includes(query.toLowerCase()),
    );

    if (found.length === 0) {
      ctx.print(`No classes matching "${query}" found.`, 'warn');
      return;
    }

    ctx.print(
      `Found ${found.length} class${found.length !== 1 ? 'es' : ''} matching "${query}":`,
      'info',
    );

    for (const cls of found) {
      const prefix = cls.isAbstract ? '⟨abstract⟩ ' : '';
      ctx.print(`  ${prefix}${cls.name}`, 'success');

      if (cls.attributeIds.length > 0) {
        const attrs = cls.attributeIds
          .map((id) => model.attributes[id]?.name ?? id)
          .join(', ');
        ctx.print(`    attributes: ${attrs}`);
      }

      if (cls.operationIds.length > 0) {
        const ops = cls.operationIds
          .map((id) => model.operations[id]?.name ?? id)
          .join(', ');
        ctx.print(`    methods:    ${ops}`);
      }
    }
  },
});

commandRegistry.register({
  name: 'add',
  description: 'Add an element to the canvas — try: add class <name>',
  category: 'Editor & Canvas',
  execute(_args, ctx) {
    ctx.print(COMING_SOON, 'warn');
  },
});

commandRegistry.register({
  name: 'link',
  description: 'Create a relation — try: link <ClassA> to <ClassB>',
  category: 'Editor & Canvas',
  execute(_args, ctx) {
    ctx.print(COMING_SOON, 'warn');
  },
});

commandRegistry.register({
  name: 'edges',
  description: 'Manage edge display — try: edges highlight',
  category: 'Editor & Canvas',
  execute(args, ctx) {
    const sub = args[0];

    if (!sub || sub === 'highlight') {
      const { showAllEdges, toggleShowAllEdges } =
        useSettingsStore.getState();
      toggleShowAllEdges();
      ctx.print(
        `Edge highlighting ${showAllEdges ? 'disabled' : 'enabled'}.`,
        'success',
      );
      return;
    }

    ctx.print(
      `edges: unknown subcommand "${sub}". Try: edges highlight`,
      'error',
    );
  },
});
