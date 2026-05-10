import { describe, it, expect } from 'vitest';
import { JavaParserService } from '../javaParser.service';

describe('JavaParserService', () => {

  it('should parse a simple class correctly', () => {
    const code = `
      public class Dog {
          private String name;
          public void bark() { }
      }
    `;
    const result = JavaParserService.parse(code);
    
    expect(result).not.toBeNull();
    expect(result?.name).toBe('Dog');
    expect(result?.attributes).toHaveLength(1);
    expect(result?.attributes[0].name).toBe('name');
    expect(result?.methods).toHaveLength(1);
    expect(result?.methods[0].name).toBe('bark');
  });

  it('should detect interfaces and inheritance', () => {
    const code = `public class Cat extends Animal implements Pet, Hunter {}`;
    const result = JavaParserService.parse(code);
    
    expect(result?.name).toBe('Cat');
    expect(result?.parentClass).toBe('Animal');
    expect(result?.interfaces).toContain('Pet');
    expect(result?.interfaces).toContain('Hunter');
  });

  it('should detect the MAIN method (Entry Point)', () => {
    const code = `
      public class Main {
          public static void main(String[] args) { 
              System.out.println("Hello World"); 
          }
      }
    `;
    const result = JavaParserService.parse(code);
    expect(result?.isMain).toBe(true);
  });

  it('should NOT detect main if the signature is incorrect', () => {
    const code = `
      public class FakeMain {
          public void main() { } // Missing static and args
      }
    `;
    const result = JavaParserService.parse(code);
    expect(result?.isMain).toBe(false); 
  });

  it('should ignore comments', () => {
    const code = `
      // Single line comment
      /* Multi-line 
         comment block */
      public class Cleaner {
          // private int ignored;
          private int real;
      }
    `;
    const result = JavaParserService.parse(code);
    expect(result?.attributes).toHaveLength(1);
    expect(result?.attributes[0].name).toBe('real');
  });

  // ========== PACKAGE DECLARATION TESTS ==========

  describe('Package Declaration Parsing', () => {
    
    it('should extract package declaration with semicolon', () => {
      const code = `
        package com.example.models;
        
        public class User {
            private String name;
        }
      `;
      const result = JavaParserService.parse(code);
      
      expect(result).not.toBeNull();
      expect(result?.package).toBe('com.example.models');
      expect(result?.name).toBe('User');
    });

    it('should extract package declaration without semicolon', () => {
      const code = `
        package com.example.services
        
        public class AuthService {
            public void login() { }
        }
      `;
      const result = JavaParserService.parse(code);
      
      expect(result).not.toBeNull();
      expect(result?.package).toBe('com.example.services');
      expect(result?.name).toBe('AuthService');
    });

    it('should handle package declaration with extra spaces', () => {
      const code = `
        package    com.company.utils   ;
        
        public class StringHelper {}
      `;
      const result = JavaParserService.parse(code);
      
      expect(result?.package).toBe('com.company.utils');
    });

    it('should handle package at the very start of file', () => {
      const code = `package org.apache.commons;
public class CommonsUtil {}`;
      const result = JavaParserService.parse(code);
      
      expect(result?.package).toBe('org.apache.commons');
      expect(result?.name).toBe('CommonsUtil');
    });

    it('should return undefined for files without package declaration', () => {
      const code = `
        public class NoPackageClass {
            private int value;
        }
      `;
      const result = JavaParserService.parse(code);
      
      expect(result).not.toBeNull();
      expect(result?.package).toBeUndefined();
      expect(result?.name).toBe('NoPackageClass');
    });

    it('should handle package with single segment', () => {
      const code = `
        package utils;
        
        public class Helper {}
      `;
      const result = JavaParserService.parse(code);
      
      expect(result?.package).toBe('utils');
    });

    it('should handle deeply nested package names', () => {
      const code = `
        package com.company.project.module.submodule.feature;
        
        public class DeepClass {}
      `;
      const result = JavaParserService.parse(code);
      
      expect(result?.package).toBe('com.company.project.module.submodule.feature');
    });

    it('should ignore package-like strings in comments', () => {
      const code = `
        // package fake.package;
        /* package another.fake; */
        
        package real.package;
        
        public class RealClass {}
      `;
      const result = JavaParserService.parse(code);
      
      expect(result?.package).toBe('real.package');
    });

    it('should work with package and full class features', () => {
      const code = `
        package com.example.domain;
        
        import java.util.List;
        
        public class Product extends BaseEntity implements Serializable {
            private String name;
            private double price;
            
            public void save() { }
        }
      `;
      const result = JavaParserService.parse(code);
      
      expect(result?.package).toBe('com.example.domain');
      expect(result?.name).toBe('Product');
      expect(result?.parentClass).toBe('BaseEntity');
      expect(result?.interfaces).toContain('Serializable');
      expect(result?.attributes).toHaveLength(2);
      expect(result?.methods).toHaveLength(1);
    });
  });
});
