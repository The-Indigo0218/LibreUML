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
});