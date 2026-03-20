import { commandRegistry, COMING_SOON } from '../registry';
import type { CommandContext } from '../registry';
import { useVFSStore } from '../../../store/project-vfs.store';
import { useWorkspaceStore } from '../../../store/workspace.store';
import type { VFSFolder, VFSFile } from '../../../core/domain/vfs/vfs.types';

type VFSNodes = Record<string, VFSFolder | VFSFile>;

function printTree(
  nodes: Record<string, VFSFolder | VFSFile>,
  parentId: string | null,
  ctx: CommandContext,
  indent: number,
): void {
  const children = Object.values(nodes)
    .filter((n) => n.parentId === parentId)
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'FOLDER' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  for (const node of children) {
    const pad = '  '.repeat(indent);
    if (node.type === 'FOLDER') {
      ctx.print(`${pad}📁  ${node.name}/`, 'info');
      printTree(nodes, node.id, ctx, indent + 1);
    } else {
      const label = node.diagramType
        .replace(/_DIAGRAM$/, '')
        .replace(/_/g, ' ')
        .toLowerCase();
      ctx.print(`${pad}📄  ${node.name}.luml    ${label}`);
    }
  }
}

commandRegistry.register({
  name: 'ls',
  aliases: ['dir'] as const,
  description: 'List all files and folders in the workspace',
  category: 'VFS & Navigation',
  execute(_args, ctx) {
    const project = useVFSStore.getState().project;
    if (!project) {
      ctx.print('No project open.', 'error');
      return;
    }

    const total = Object.values(project.nodes as VFSNodes).filter(
      (n) => n.type === 'FILE',
    ).length;

    ctx.print(`${project.projectName}  (${total} diagram${total !== 1 ? 's' : ''})`, 'info');
    ctx.print('─'.repeat(40), 'info');
    printTree(project.nodes, null, ctx, 0);
  },
});

commandRegistry.register({
  name: 'cd',
  aliases: ['open'] as const,
  description: 'Switch to a diagram tab — try: cd <name>',
  category: 'VFS & Navigation',
  execute(args, ctx) {
    if (!args[0]) {
      ctx.print('Usage: cd <diagram-name>', 'error');
      return;
    }

    const project = useVFSStore.getState().project;
    if (!project) {
      ctx.print('No project open.', 'error');
      return;
    }

    const query = args[0].toLowerCase();
    const files = Object.values(project.nodes as VFSNodes).filter(
      (n): n is VFSFile => n.type === 'FILE',
    );

    const match =
      files.find((n) => n.name.toLowerCase() === query) ??
      files.find((n) => n.name.toLowerCase().startsWith(query));

    if (!match) {
      ctx.print(`cd: ${args[0]}: no such diagram`, 'error');
      return;
    }

    useWorkspaceStore.getState().openTab(match.id);
    ctx.print(`Switched to ${match.name}.luml`, 'success');
  },
});

commandRegistry.register({
  name: 'diagram',
  description: 'Manage diagrams — try: diagram new <type> <name>',
  category: 'VFS & Navigation',
  execute(_args, ctx) {
    ctx.print(COMING_SOON, 'warn');
  },
});
