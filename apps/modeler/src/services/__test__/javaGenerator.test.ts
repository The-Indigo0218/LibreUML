import { describe, it, expect } from 'vitest';
import { JavaGeneratorService } from '../javaGenerator.service';
import type { DomainEdge } from '../../core/domain/models/edges';
import type { ClassNode, InterfaceNode, AbstractClassNode, EnumNode } from '../../core/domain/models/nodes/class-diagram.types';

describe('JavaGeneratorService', () => {

  // Helper function to create domain nodes easily
  const createNode = (
    name: string, 
    nodeType: 'CLASS' | 'INTERFACE' | 'ABSTRACT_CLASS' | 'ENUM' = 'CLASS',
    packageName?: string
  ): ClassNode | InterfaceNode | AbstractClassNode | EnumNode => {
    const baseNode = {
      id: '1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      package: packageName,
    };

    if (nodeType === 'CLASS') {
      return {
        ...baseNode,
        type: 'CLASS',
        name,
        attributes: [],
        methods: [],
      } as ClassNode;
    } else if (nodeType === 'INTERFACE') {
      return {
        ...baseNode,
        type: 'INTERFACE',
        name,
        methods: [],
      } as InterfaceNode;
    } else if (nodeType === 'ABSTRACT_CLASS') {
      return {
        ...baseNode,
        type: 'ABSTRACT_CLASS',
        name,
        attributes: [],
        methods: [],
      } as AbstractClassNode;
    } else {
      return {
        ...baseNode,
        type: 'ENUM',
        name,
        literals: [],
      } as EnumNode;
    }
  };

  it('should generate a simple empty class', () => {
    const node = createNode('User');
    const code = JavaGeneratorService.generate(node);

    expect(code).toContain('public class User');
    expect(code).toMatch(/class User\s*\{/); 
    expect(code).toContain('}');
  });

  it('should generate an interface correctly', () => {
    const node = createNode('Auditable', 'INTERFACE');
    const code = JavaGeneratorService.generate(node);

    expect(code).toContain('public interface Auditable');
    expect(code).toMatch(/interface Auditable\s*\{/);
  });

  it('should generate attributes with correct visibility and types', () => {
    const node = createNode('Product');
    (node as ClassNode).attributes = [
      { id: 'a1', name: 'price', type: 'double', visibility: '-', isArray: false },
      { id: 'a2', name: 'tags', type: 'String', visibility: '+', isArray: true }
    ];

    const code = JavaGeneratorService.generate(node);

    expect(code).toContain('private double price;');
    expect(code).toContain('public String[] tags;');
  });

  it('should generate methods with parameters', () => {
    const node = createNode('Calculator');
    (node as ClassNode).methods = [
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
    const node = createNode('Shape', 'ABSTRACT_CLASS');
    const code = JavaGeneratorService.generate(node);

    expect(code).toContain('public abstract class Shape');
  });

  // ========== PACKAGE DECLARATION TESTS ==========

  describe('Package Declaration Generation', () => {
    
    it('should prepend package declaration when package is defined', () => {
      const node = createNode('User', 'CLASS', 'com.example.models');
      const code = JavaGeneratorService.generate(node);

      expect(code).toContain('package com.example.models;');
      expect(code.indexOf('package')).toBe(0); // Package should be at the very start
      expect(code).toContain('public class User');
    });

    it('should place package declaration before class declaration', () => {
      const node = createNode('Service', 'CLASS', 'com.example.services');
      const code = JavaGeneratorService.generate(node);

      const packageIndex = code.indexOf('package com.example.services;');
      const classIndex = code.indexOf('public class Service');
      
      expect(packageIndex).toBeGreaterThanOrEqual(0);
      expect(classIndex).toBeGreaterThan(packageIndex);
    });

    it('should add empty line after package declaration', () => {
      const node = createNode('Helper', 'CLASS', 'utils');
      const code = JavaGeneratorService.generate(node);

      expect(code).toMatch(/^package utils;\n\npublic class Helper/);
    });

    it('should not add package declaration when package is undefined', () => {
      const node = createNode('NoPackage', 'CLASS');
      const code = JavaGeneratorService.generate(node);

      expect(code).not.toContain('package');
      expect(code).toMatch(/^public class NoPackage/);
    });

    it('should handle package with interface', () => {
      const node = createNode('Repository', 'INTERFACE', 'com.example.repositories');
      const code = JavaGeneratorService.generate(node);

      expect(code).toContain('package com.example.repositories;');
      expect(code).toContain('public interface Repository');
    });

    it('should handle package with abstract class', () => {
      const node = createNode('BaseEntity', 'ABSTRACT_CLASS', 'com.example.domain');
      const code = JavaGeneratorService.generate(node);

      expect(code).toContain('package com.example.domain;');
      expect(code).toContain('public abstract class BaseEntity');
    });

    it('should generate complete class with package, attributes, and methods', () => {
      const node = createNode('Product', 'CLASS', 'com.example.models');
      (node as ClassNode).attributes = [
        { id: 'a1', name: 'name', type: 'String', visibility: '-', isArray: false },
        { id: 'a2', name: 'price', type: 'double', visibility: '-', isArray: false }
      ];
      (node as ClassNode).methods = [
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
      expect(code).toContain('private String name');
      expect(code).toContain('private double price;');
      expect(code).toContain('public double getPrice()');
    });

    it('should handle deeply nested package names', () => {
      const node = createNode('Feature', 'CLASS', 'com.company.project.module.submodule');
      const code = JavaGeneratorService.generate(node);

      expect(code).toContain('package com.company.project.module.submodule;');
    });

    it('should handle single-segment package names', () => {
      const node = createNode('Util', 'CLASS', 'utils');
      const code = JavaGeneratorService.generate(node);

      expect(code).toContain('package utils;');
    });
  });

  // ========== NEW TESTS FOR IMPROVEMENTS ==========

  describe('Attribute Initialization', () => {
    
    it('should initialize String attributes to empty string', () => {
      const node = createNode('User');
      (node as ClassNode).attributes = [
        { id: 'a1', name: 'name', type: 'String', visibility: '-', isArray: false },
        { id: 'a2', name: 'email', type: 'String', visibility: '-', isArray: false }
      ];

      const code = JavaGeneratorService.generate(node);

      expect(code).toContain('private String name = "";');
      expect(code).toContain('private String email = "";');
    });

    it('should initialize List collections', () => {
      const node = createNode('Course');
      (node as ClassNode).attributes = [
        { id: 'a1', name: 'students', type: 'List<String>', visibility: '-', isArray: false }
      ];

      const code = JavaGeneratorService.generate(node);

      expect(code).toContain('private List<String> students = new ArrayList<String>();');
    });

    it('should initialize ArrayList collections', () => {
      const node = createNode('Classroom');
      (node as ClassNode).attributes = [
        { id: 'a1', name: 'items', type: 'ArrayList<Item>', visibility: '-', isArray: false }
      ];

      const code = JavaGeneratorService.generate(node);

      expect(code).toContain('private ArrayList<Item> items = new ArrayList<Item>();');
    });

    it('should initialize Set collections', () => {
      const node = createNode('Group');
      (node as ClassNode).attributes = [
        { id: 'a1', name: 'members', type: 'Set<User>', visibility: '-', isArray: false }
      ];

      const code = JavaGeneratorService.generate(node);

      expect(code).toContain('private Set<User> members = new HashSet<User>();');
    });

    it('should initialize Map collections', () => {
      const node = createNode('Registry');
      (node as ClassNode).attributes = [
        { id: 'a1', name: 'data', type: 'Map<String, Integer>', visibility: '-', isArray: false }
      ];

      const code = JavaGeneratorService.generate(node);

      expect(code).toContain('private Map<String, Integer> data = new HashMap<String, Integer>();');
    });

    it('should NOT initialize primitive types', () => {
      const node = createNode('Counter');
      (node as ClassNode).attributes = [
        { id: 'a1', name: 'count', type: 'int', visibility: '-', isArray: false },
        { id: 'a2', name: 'active', type: 'boolean', visibility: '-', isArray: false }
      ];

      const code = JavaGeneratorService.generate(node);

      expect(code).toContain('private int count;');
      expect(code).toContain('private boolean active;');
      // Check that attributes are not initialized at declaration (no = after semicolon on attribute line)
      expect(code).toMatch(/private int count;/);
      expect(code).toMatch(/private boolean active;/);
    });

    it('should NOT initialize String arrays', () => {
      const node = createNode('Data');
      (node as ClassNode).attributes = [
        { id: 'a1', name: 'tags', type: 'String', visibility: '-', isArray: true }
      ];

      const code = JavaGeneratorService.generate(node);

      expect(code).toContain('private String[] tags;');
      // Check that the attribute declaration doesn't have initialization
      expect(code).toMatch(/private String\[\] tags;/);
    });
  });

  describe('Getters and Setters with this keyword', () => {
    
    it('should generate getters with explicit this.propertyName return', () => {
      const node = createNode('Person');
      (node as ClassNode).attributes = [
        { id: 'a1', name: 'name', type: 'String', visibility: '-', isArray: false },
        { id: 'a2', name: 'age', type: 'int', visibility: '-', isArray: false }
      ];

      const code = JavaGeneratorService.generate(node);

      expect(code).toContain('public String getName() {');
      expect(code).toContain('return this.name;');
      expect(code).toContain('public int getAge() {');
      expect(code).toContain('return this.age;');
    });

    it('should generate setters with explicit this.propertyName assignment', () => {
      const node = createNode('Person');
      (node as ClassNode).attributes = [
        { id: 'a1', name: 'name', type: 'String', visibility: '-', isArray: false },
        { id: 'a2', name: 'age', type: 'int', visibility: '-', isArray: false }
      ];

      const code = JavaGeneratorService.generate(node);

      expect(code).toContain('public void setName(String name) {');
      expect(code).toContain('this.name = name;');
      expect(code).toContain('public void setAge(int age) {');
      expect(code).toContain('this.age = age;');
    });

    it('should generate getters and setters for collection types', () => {
      const node = createNode('Library');
      (node as ClassNode).attributes = [
        { id: 'a1', name: 'books', type: 'List<String>', visibility: '-', isArray: false }
      ];

      const code = JavaGeneratorService.generate(node);

      expect(code).toContain('public List<String> getBooks() {');
      expect(code).toContain('return this.books;');
      expect(code).toContain('public void setBooks(List<String> books) {');
      expect(code).toContain('this.books = books;');
    });
  });

  describe('Constructor Generation', () => {
    
    it('should generate constructor with all attributes as parameters', () => {
      const node = createNode('Student');
      (node as ClassNode).attributes = [
        { id: 'a1', name: 'name', type: 'String', visibility: '-', isArray: false },
        { id: 'a2', name: 'age', type: 'int', visibility: '-', isArray: false }
      ];

      const code = JavaGeneratorService.generate(node);

      expect(code).toContain('public Student(String name, int age) {');
      expect(code).toContain('this.name = name;');
      expect(code).toContain('this.age = age;');
    });

    it('should use this keyword in constructor assignments', () => {
      const node = createNode('Product');
      (node as ClassNode).attributes = [
        { id: 'a1', name: 'price', type: 'double', visibility: '-', isArray: false }
      ];

      const code = JavaGeneratorService.generate(node);

      expect(code).toContain('this.price = price;');
    });
  });

  describe('Inheritance with super() call', () => {
    
    it('should generate constructor with super() call when class has parent', () => {
      // Create parent class
      const parentNode = createNode('Animal');
      parentNode.id = 'parent-1';
      (parentNode as ClassNode).attributes = [
        { id: 'a1', name: 'name', type: 'String', visibility: '-', isArray: false },
        { id: 'a2', name: 'age', type: 'int', visibility: '-', isArray: false }
      ];

      // Create child class
      const childNode = createNode('Dog');
      childNode.id = 'child-1';
      (childNode as ClassNode).attributes = [
        { id: 'a3', name: 'breed', type: 'String', visibility: '-', isArray: false }
      ];

      // Create inheritance edge
      const edges: DomainEdge[] = [
        {
          id: 'edge-1',
          sourceNodeId: 'child-1',
          targetNodeId: 'parent-1',
          type: 'INHERITANCE',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
      ];

      const code = JavaGeneratorService.generate(childNode, [parentNode, childNode], edges);

      // Should have parent attributes first in constructor
      expect(code).toContain('public Dog(String name, int age, String breed) {');
      
      // Should call super with parent attributes
      expect(code).toContain('super(name, age);');
      
      // Should assign own attributes after super
      expect(code).toContain('this.breed = breed;');
      
      // Verify super() comes before this assignments
      const superIndex = code.indexOf('super(name, age);');
      const thisIndex = code.indexOf('this.breed = breed;');
      expect(superIndex).toBeLessThan(thisIndex);
    });

    it('should handle multiple levels of inheritance', () => {
      // Grandparent
      const grandparent = createNode('LivingBeing');
      grandparent.id = 'gp-1';
      (grandparent as ClassNode).attributes = [
        { id: 'a1', name: 'alive', type: 'boolean', visibility: '-', isArray: false }
      ];

      // Parent
      const parent = createNode('Animal');
      parent.id = 'p-1';
      (parent as ClassNode).attributes = [
        { id: 'a2', name: 'name', type: 'String', visibility: '-', isArray: false }
      ];

      // Child
      const child = createNode('Cat');
      child.id = 'c-1';
      (child as ClassNode).attributes = [
        { id: 'a3', name: 'color', type: 'String', visibility: '-', isArray: false }
      ];

      // Edges: Cat -> Animal (we only check direct parent)
      const edges: DomainEdge[] = [
        {
          id: 'e1',
          sourceNodeId: 'c-1',
          targetNodeId: 'p-1',
          type: 'INHERITANCE',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
      ];

      const code = JavaGeneratorService.generate(child, [grandparent, parent, child], edges);

      // Should include parent's attributes in constructor
      expect(code).toContain('public Cat(String name, String color) {');
      expect(code).toContain('super(name);');
      expect(code).toContain('this.color = color;');
    });

    it('should not add super() call when class has no parent', () => {
      const node = createNode('IndependentClass');
      (node as ClassNode).attributes = [
        { id: 'a1', name: 'value', type: 'int', visibility: '-', isArray: false }
      ];

      const code = JavaGeneratorService.generate(node, [node], []);

      expect(code).toContain('public IndependentClass(int value) {');
      expect(code).not.toContain('super(');
      expect(code).toContain('this.value = value;');
    });

    it('should handle child class with collections and parent', () => {
      const parent = createNode('Vehicle');
      parent.id = 'v-1';
      (parent as ClassNode).attributes = [
        { id: 'a1', name: 'brand', type: 'String', visibility: '-', isArray: false }
      ];

      const child = createNode('Car');
      child.id = 'c-1';
      (child as ClassNode).attributes = [
        { id: 'a2', name: 'passengers', type: 'List<String>', visibility: '-', isArray: false }
      ];

      const edges: DomainEdge[] = [
        {
          id: 'e1',
          sourceNodeId: 'c-1',
          targetNodeId: 'v-1',
          type: 'INHERITANCE',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
      ];

      const code = JavaGeneratorService.generate(child, [parent, child], edges);

      // Collection should be initialized
      expect(code).toContain('private List<String> passengers = new ArrayList<String>();');
      
      // Constructor should have both parent and child params
      expect(code).toContain('public Car(String brand, List<String> passengers) {');
      expect(code).toContain('super(brand);');
      expect(code).toContain('this.passengers = passengers;');
    });
  });

  describe('Complete Class Generation', () => {
    
    it('should generate a complete class with all features', () => {
      const node = createNode('Student', 'CLASS', 'com.university.models');
      (node as ClassNode).attributes = [
        { id: 'a1', name: 'name', type: 'String', visibility: '-', isArray: false },
        { id: 'a2', name: 'courses', type: 'List<String>', visibility: '-', isArray: false },
        { id: 'a3', name: 'gpa', type: 'double', visibility: '-', isArray: false }
      ];

      const code = JavaGeneratorService.generate(node);

      // Package
      expect(code).toContain('package com.university.models;');
      
      // Class declaration
      expect(code).toContain('public class Student');
      
      // Attributes with initialization
      expect(code).toContain('private String name = "";');
      expect(code).toContain('private List<String> courses = new ArrayList<String>();');
      expect(code).toContain('private double gpa;');
      
      // Constructor
      expect(code).toContain('public Student(String name, List<String> courses, double gpa) {');
      expect(code).toContain('this.name = name;');
      expect(code).toContain('this.courses = courses;');
      expect(code).toContain('this.gpa = gpa;');
      
      // Getters
      expect(code).toContain('public String getName() {');
      expect(code).toContain('return this.name;');
      expect(code).toContain('public List<String> getCourses() {');
      expect(code).toContain('return this.courses;');
      expect(code).toContain('public double getGpa() {');
      expect(code).toContain('return this.gpa;');
      
      // Setters
      expect(code).toContain('public void setName(String name) {');
      expect(code).toContain('this.name = name;');
      expect(code).toContain('public void setCourses(List<String> courses) {');
      expect(code).toContain('this.courses = courses;');
      expect(code).toContain('public void setGpa(double gpa) {');
      expect(code).toContain('this.gpa = gpa;');
    });
  });
});
