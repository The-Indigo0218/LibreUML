import { describe, it, expect } from 'vitest';
import { JavaGeneratorService } from '../javaGenerator.service';
import type { UmlClassNode } from '../../features/diagram/types/diagram.types';

describe('JavaGeneratorService', () => {

  // Helper function to create nodes easily
  const createNode = (name: string, stereotype: 'class' | 'interface' | 'abstract' = 'class'): UmlClassNode => ({
    id: '1',
    type: 'umlClass',
    position: { x: 0, y: 0 },
    data: {
      label: name,
      stereotype,
      attributes: [],
      methods: []
    }
  });

  it('should generate a simple empty class', () => {
    const node = createNode('User');
    const code = JavaGeneratorService.generate(node);

    expect(code).toContain('public class User');
    expect(code).toMatch(/class User\s*\{/); 
    expect(code).toContain('}');
  });

  it('should generate an interface correctly', () => {
    const node = createNode('Auditable', 'interface');
    const code = JavaGeneratorService.generate(node);

    expect(code).toContain('public interface Auditable');
    expect(code).toMatch(/interface Auditable\s*\{/);
  });

  it('should generate attributes with correct visibility and types', () => {
    const node = createNode('Product');
    node.data.attributes = [
      { id: 'a1', name: 'price', type: 'double', visibility: '-', isArray: false },
      { id: 'a2', name: 'tags', type: 'String', visibility: '+', isArray: true }
    ];

    const code = JavaGeneratorService.generate(node);

    expect(code).toContain('private double price;');
    expect(code).toContain('public String[] tags;');
  });

  it('should generate methods with parameters', () => {
    const node = createNode('Calculator');
    node.data.methods = [
      { 
        id: 'm1', 
        name: 'sum', 
        returnType: 'int', 
        visibility: '+', 
        parameters: [
          { name: 'a', type: 'int' },
          { name: 'b', type: 'int' }
        ]
      }
    ];

    const code = JavaGeneratorService.generate(node);

    expect(code).toContain('public int sum(int a, int b)');
  });

  it('should handle Abstract classes', () => {
    const node = createNode('Shape', 'abstract');
    const code = JavaGeneratorService.generate(node);

    expect(code).toContain('public abstract class Shape');
  });
});