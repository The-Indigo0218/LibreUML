import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectZipperService } from '../project-zipper.service';
import type { DomainNode } from '../../core/domain/models/nodes';
import type { ClassNode } from '../../core/domain/models/nodes/class-diagram.types';

const mockFile = vi.fn();
const mockFolder = vi.fn(() => ({ file: mockFile }));

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

    
    expect(mockFolder).toHaveBeenCalledWith('src/main/java/com/test/demo');
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