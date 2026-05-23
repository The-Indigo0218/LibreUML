import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectZipperService } from '../project-zipper.service';
import type { DomainNode } from '../../core/domain/models/nodes';
import type { ClassNode } from '../../core/domain/models/nodes/class-diagram.types';
import type { SemanticModel } from '../../core/domain/vfs/vfs.types';

const mockFile = vi.fn();
// JSZip's folder() returns another folder-capable object — make the mock recursive
// so nested folder().folder() chains work.
const mockFolder: ReturnType<typeof vi.fn> = vi.fn(() => ({
  file: mockFile,
  folder: mockFolder,
}));

vi.mock('jszip', () => {
  return {
    default: class MockJSZip {
      folder = mockFolder;
      file = mockFile;
      generateAsync = vi.fn().mockResolvedValue('fake-blob-content');
    }
  };
});

//  Mock global browser APIs
global.URL.createObjectURL = vi.fn();
global.URL.revokeObjectURL = vi.fn();

describe('ProjectZipperService', () => {
  
  // Dummy Data
  const mockNodes: DomainNode[] = [
    {
      id: '1',
      type: 'CLASS',
      name: 'User',
      attributes: [],
      methods: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as ClassNode
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'electronAPI', { value: undefined, writable: true });
  });

  it('should generate the correct folder structure for Maven projects', async () => {
    const config = {
      projectName: 'demo',
      groupId: 'com.test',
      artifactId: 'demo',
      packageName: 'com.test.demo',
      nodes: mockNodes,
      allNodes: mockNodes,  
      edges: [],            
      javaVersion: '17',
      buildTool: 'maven' as const
    };

    const createElementSpy = vi.spyOn(document, 'createElement');
    
    await ProjectZipperService.generateAndDownloadZip(config);

    
    // Service creates folders in two steps: zip.folder('src/main/java') then .folder('com/test/demo')
    expect(mockFolder).toHaveBeenCalledWith('src/main/java');
    expect(mockFolder).toHaveBeenCalledWith('com/test/demo');
    expect(mockFile).toHaveBeenCalledWith('User.java', expect.stringContaining('class User'));
    expect(mockFile).toHaveBeenCalledWith('pom.xml', expect.stringContaining('<artifactId>demo</artifactId>'));
    
    expect(createElementSpy).toHaveBeenCalledWith('a');
  });

  it('should generate build.gradle for Gradle projects', async () => {
    const config = {
      projectName: 'demo-gradle',
      groupId: 'org.code',
      artifactId: 'app',
      packageName: 'org.code.app',
      nodes: [],
      allNodes: [],        
      edges: [],           
      javaVersion: '21',
      buildTool: 'gradle' as const
    };

    await ProjectZipperService.generateAndDownloadZip(config);

    expect(mockFile).toHaveBeenCalledWith('build.gradle', expect.stringContaining("id 'java'"));
    expect(mockFile).toHaveBeenCalledWith('settings.gradle', expect.stringContaining("rootProject.name = 'demo-gradle'"));
  });

  it('should use electronAPI when available (Desktop Environment)', async () => {
    const mockSaveFile = vi.fn();
    Object.defineProperty(window, 'electronAPI', {
      value: { 
        isElectron: () => true,
        saveFile: mockSaveFile 
      },
      writable: true
    });

    const config = {
      projectName: 'desktop-app',
      groupId: 'com.app',
      artifactId: 'desktop',
      packageName: 'com.app',
      nodes: [],
      allNodes: [],        
      edges: [],           
      javaVersion: '17',
      buildTool: 'maven' as const
    };

    await ProjectZipperService.generateAndDownloadZip(config);

    expect(document.createElement).not.toHaveBeenCalledWith('a');

    expect(mockSaveFile).toHaveBeenCalled();
  });
});

// ─── generateAndDownloadZipFromModel ─────────────────────────────────────────

function makeIRModel(overrides: Partial<SemanticModel> = {}): SemanticModel {
  return {
    id: 'model-1',
    name: 'Test',
    version: '1',
    packages: {},
    classes: {},
    interfaces: {},
    enums: {},
    dataTypes: {},
    attributes: {},
    operations: {},
    actors: {},
    useCases: {},
    relations: {},
    activityNodes: {},
    objectInstances: {},
    components: {},
    nodes: {},
    artifacts: {},
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  } as SemanticModel;
}

describe('ProjectZipperService.generateAndDownloadZipFromModel', () => {
  const codeConfig = {
    targetLanguage: 'java' as const,
    generateGettersSetters: false,
    generateEmptyConstructors: false,
    includePackageDeclaration: true,
    generateDocStubs: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'electronAPI', { value: undefined, writable: true });
  });

  it('generates a file for each class element', async () => {
    const model = makeIRModel({
      classes: {
        'cls-1': { id: 'cls-1', name: 'User', kind: 'CLASS', isAbstract: false, attributeIds: [], operationIds: [], packageName: 'com.example' } as any,
      },
    });

    const createElementSpy = vi.spyOn(document, 'createElement');

    await ProjectZipperService.generateAndDownloadZipFromModel({
      projectName: 'my-app',
      groupId: 'com.example',
      artifactId: 'my-app',
      packageName: 'com.example',
      elementIds: ['cls-1'],
      model,
      codeConfig,
      javaVersion: '17',
      buildTool: 'maven',
    });

    expect(mockFile).toHaveBeenCalledWith('User.java', expect.stringContaining('class User'));
    expect(mockFile).toHaveBeenCalledWith('pom.xml', expect.stringContaining('<artifactId>my-app</artifactId>'));
    expect(createElementSpy).toHaveBeenCalledWith('a');
  });

  it('generates build.gradle for Gradle build tool', async () => {
    const model = makeIRModel();

    await ProjectZipperService.generateAndDownloadZipFromModel({
      projectName: 'gradle-app',
      groupId: 'org.test',
      artifactId: 'gradle-app',
      packageName: 'org.test',
      elementIds: [],
      model,
      codeConfig,
      javaVersion: '21',
      buildTool: 'gradle',
    });

    expect(mockFile).toHaveBeenCalledWith('build.gradle', expect.stringContaining("id 'java'"));
    expect(mockFile).toHaveBeenCalledWith('settings.gradle', expect.stringContaining("rootProject.name = 'gradle-app'"));
  });

  it('skips elementIds not found in the model', async () => {
    const model = makeIRModel();

    await ProjectZipperService.generateAndDownloadZipFromModel({
      projectName: 'empty',
      groupId: 'com.test',
      artifactId: 'empty',
      packageName: 'com.test',
      elementIds: ['non-existent-id'],
      model,
      codeConfig,
      javaVersion: '17',
      buildTool: 'maven',
    });

    // Only Main.java and build files — no element .java file
    const javaFileCalls = (mockFile as ReturnType<typeof vi.fn>).mock.calls
      .filter((args) => String(args[0]).endsWith('.java') && args[0] !== 'Main.java');
    expect(javaFileCalls).toHaveLength(0);
  });

  it('uses element packageName for folder placement', async () => {
    const model = makeIRModel({
      interfaces: {
        'if-1': { id: 'if-1', name: 'Repository', kind: 'INTERFACE', operationIds: [], packageName: 'com.example.repo' } as any,
      },
    });

    await ProjectZipperService.generateAndDownloadZipFromModel({
      projectName: 'repo-app',
      groupId: 'com.example',
      artifactId: 'repo-app',
      packageName: 'com.example',
      elementIds: ['if-1'],
      model,
      codeConfig,
      javaVersion: '17',
      buildTool: 'maven',
    });

    expect(mockFolder).toHaveBeenCalledWith('com/example/repo');
    expect(mockFile).toHaveBeenCalledWith('Repository.java', expect.any(String));
  });
});