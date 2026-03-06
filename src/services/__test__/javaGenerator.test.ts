import { describe, it, expect } from 'vitest';
import { JavaGeneratorService } from '../javaGenerator.service';
import type { UmlClassNode } from '../../features/diagram/types/diagram.types';

describe('JavaGeneratorService', () => {

  // Helper function to create nodes easily
  const createNode = (
    name: string, 
    stereotype: 'class' | 'interface' | 'abstract' = 'class',
    packageName?: string
  ): UmlClassNode => ({
    id: '1',
    type: 'umlClass',
    position: { x: 0, y: 0 },
    data: {
      label: name,
      stereotype,
      attributes: [],
      methods: [],
      package: packageName
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

  // ========== PACKAGE DECLARATION TESTS ==========

  describe('Package Declaration Generation', () => {
    
    it('should prepend package declaration when package is defined', () => {
      const node = createNode('User', 'class', 'com.example.models');
      const code = JavaGeneratorService.generate(node);

      expect(code).toContain('package com.example.models;');
      expect(code.indexOf('package')).toBe(0); // Package should be at the very start
      expect(code).toContain('public class User');
    });

    it('should place package declaration before class declaration', () => {
      const node = createNode('Service', 'class', 'com.example.services');
      const code = JavaGeneratorService.generate(node);

      const packageIndex = code.indexOf('package com.example.services;');
      const classIndex = code.indexOf('public class Service');
      
      expect(packageIndex).toBeGreaterThanOrEqual(0);
      expect(classIndex).toBeGreaterThan(packageIndex);
    });

    it('should add empty line after package declaration', () => {
      const node = createNode('Helper', 'class', 'utils');
      const code = JavaGeneratorService.generate(node);

      expect(code).toMatch(/^package utils;\n\npublic class Helper/);
    });

    it('should not add package declaration when package is undefined', () => {
      const node = createNode('NoPackage', 'class');
      const code = JavaGeneratorService.generate(node);

      expect(code).not.toContain('package');
      expect(code).toMatch(/^public class NoPackage/);
    });

    it('should handle package with interface', () => {
      const node = createNode('Repository', 'interface', 'com.example.repositories');
      const code = JavaGeneratorService.generate(node);

      expect(code).toContain('package com.example.repositories;');
      expect(code).toContain('public interface Repository');
    });

    it('should handle package with abstract class', () => {
      const node = createNode('BaseEntity', 'abstract', 'com.example.domain');
      const code = JavaGeneratorService.generate(node);

      expect(code).toContain('package com.example.domain;');
      expect(code).toContain('public abstract class BaseEntity');
    });

    it('should generate complete class with package, attributes, and methods', () => {
      const node = createNode('Product', 'class', 'com.example.models');
      node.data.attributes = [
        { id: 'a1', name: 'name', type: 'String', visibility: '-', isArray: false },
        { id: 'a2', name: 'price', type: 'double', visibility: '-', isArray: false }
      ];
      node.data.methods = [
        { 
          id: 'm1', 
          name: 'getPrice', 
          returnType: 'double', 
          visibility: '+', 
          parameters: []
        }
      ];

      const code = JavaGeneratorService.generate(node);

      // Verify structure order
      expect(code).toMatch(/^package com\.example\.models;\n\npublic class Product/);
      expect(code).toContain('private String name;');
      expect(code).toContain('private double price;');
      expect(code).toContain('public double getPrice()');
    });

    it('should handle deeply nested package names', () => {
      const node = createNode('Feature', 'class', 'com.company.project.module.submodule');
      const code = JavaGeneratorService.generate(node);

      expect(code).toContain('package com.company.project.module.submodule;');
    });

    it('should handle single-segment package names', () => {
      const node = createNode('Util', 'class', 'utils');
      const code = JavaGeneratorService.generate(node);

      expect(code).toContain('package utils;');
    });
  });
});
