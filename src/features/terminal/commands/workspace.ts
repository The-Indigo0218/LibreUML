import { commandRegistry, COMING_SOON } from '../registry';
import { useVFSStore } from '../../../store/project-vfs.store';
import { useModelStore } from '../../../store/model.store';
import type { VFSFolder, VFSFile } from '../../../core/domain/vfs/vfs.types';

type VFSNodes = Record<string, VFSFolder | VFSFile>;

commandRegistry.register({
  name: 'project',
  description: 'Manage project — try: project info, project rename <name>',
  category: 'Workspace & Metadata',
  execute(args, ctx) {
    const sub = args[0];

    if (!sub || sub === 'info') {
      const project = useVFSStore.getState().project;
      const model = useModelStore.getState().model;

      if (!project) {
        ctx.print('No project open.', 'error');
        return;
      }

      const files = Object.values(project.nodes as VFSNodes).filter(
        (n) => n.type === 'FILE',
      );
      const folders = Object.values(project.nodes as VFSNodes).filter(
        (n) => n.type === 'FOLDER',
      );
      const classCount = model ? Object.keys(model.classes).length : 0;
      const ifaceCount = model ? Object.keys(model.interfaces).length : 0;
      const enumCount = model ? Object.keys(model.enums).length : 0;
      const relCount = model ? Object.keys(model.relations).length : 0;

      ctx.print('Project Information', 'info');
      ctx.print('─'.repeat(44), 'info');
      ctx.print(`  Name         ${project.projectName}`);
      ctx.print(`  Author       ${project.author ?? 'Unknown'}`);
      ctx.print(`  Version      ${project.version}`);
      ctx.print(`  Language     ${project.targetLanguage ?? 'unspecified'}`);
      ctx.print('─'.repeat(44), 'info');
      ctx.print(`  Diagrams     ${files.length}`);
      ctx.print(`  Folders      ${folders.length}`);
      ctx.print('─'.repeat(44), 'info');
      ctx.print(`  Classes      ${classCount}`);
      ctx.print(`  Interfaces   ${ifaceCount}`);
      ctx.print(`  Enums        ${enumCount}`);
      ctx.print(`  Relations    ${relCount}`);
      return;
    }

    if (sub === 'rename') {
      ctx.print(COMING_SOON, 'warn');
      return;
    }

    ctx.print(
      `project: unknown subcommand "${sub}". Try: project info, project rename <name>`,
      'error',
    );
  },
});

commandRegistry.register({
  name: 'author',
  description: 'Manage project author — try: author set <name>',
  category: 'Workspace & Metadata',
  execute(args, ctx) {
    const sub = args[0];

    if (sub === 'set') {
      ctx.print(COMING_SOON, 'warn');
      return;
    }

    if (!sub) {
      const project = useVFSStore.getState().project;
      if (!project) {
        ctx.print('No project open.', 'error');
        return;
      }
      ctx.print(`Author: ${project.author ?? 'Unknown'}`, 'info');
      return;
    }

    ctx.print(
      `author: unknown subcommand "${sub}". Try: author set <name>`,
      'error',
    );
  },
});

commandRegistry.register({
  name: 'stats',
  description: 'Show fun workspace statistics',
  category: 'Workspace & Metadata',
  execute(_args, ctx) {
    const project = useVFSStore.getState().project;
    const model = useModelStore.getState().model;

    const diagrams = project
      ? Object.values(project.nodes as VFSNodes).filter((n) => n.type === 'FILE').length
      : 0;
    const classCount = model ? Object.keys(model.classes).length : 0;
    const ifaceCount = model ? Object.keys(model.interfaces).length : 0;
    const enumCount = model ? Object.keys(model.enums).length : 0;
    const attrCount = model ? Object.keys(model.attributes).length : 0;
    const opCount = model ? Object.keys(model.operations).length : 0;
    const relCount = model ? Object.keys(model.relations).length : 0;
    const elements = classCount + ifaceCount + enumCount;
    const linesJavaSaved = elements * 45 + opCount * 8 + attrCount * 3;
    const minutesSaved = Math.round(linesJavaSaved / 50);

    ctx.print('  LibreUML Workspace Statistics', 'info');
    ctx.print('─'.repeat(44), 'info');
    ctx.print(`  Diagrams:       ${diagrams}`);
    ctx.print(`  Classes:        ${classCount}`);
    ctx.print(`  Interfaces:     ${ifaceCount}`);
    ctx.print(`  Enums:          ${enumCount}`);
    ctx.print(`  Attributes:     ${attrCount}`);
    ctx.print(`  Methods:        ${opCount}`);
    ctx.print(`  Relations:      ${relCount}`);
    ctx.print('─'.repeat(44), 'info');
    ctx.print(
      `  ☕  Java lines saved:    ~${linesJavaSaved.toLocaleString()}`,
      'success',
    );
    ctx.print(
      `  ⏱   Time saved:          ~${minutesSaved} minute${minutesSaved !== 1 ? 's' : ''}`,
      'success',
    );
  },
});
