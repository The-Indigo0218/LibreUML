import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useInlineEditorStore } from '../inlineEditorStore';

const POS  = { x: 0, y: 0 };
const DIMS = { width: 100, height: 24 };

function start(text: string, cb: (t: string, g?: string) => void) {
  useInlineEditorStore.getState().startEditing('n1', text, 'name', POS, DIMS, cb);
}

beforeEach(() => {
  useInlineEditorStore.getState().cancelEdit();
});

describe('inlineEditorStore — generics parsing on commit (F8.5)', () => {
  it('parses "Bar<K>" into name="Bar" and generics="<K>"', () => {
    const cb = vi.fn();
    start('Irrelevant', cb);
    useInlineEditorStore.getState().updateText('Bar<K>');
    useInlineEditorStore.getState().commitEdit();
    expect(cb).toHaveBeenCalledWith('Bar', '<K>');
  });

  it('parses "Foo<T, U>" into name="Foo" and generics="<T, U>"', () => {
    const cb = vi.fn();
    start('Irrelevant', cb);
    useInlineEditorStore.getState().updateText('Foo<T, U>');
    useInlineEditorStore.getState().commitEdit();
    expect(cb).toHaveBeenCalledWith('Foo', '<T, U>');
  });

  it('passes a plain name without generics as a single argument', () => {
    const cb = vi.fn();
    start('Irrelevant', cb);
    useInlineEditorStore.getState().updateText('Customer');
    useInlineEditorStore.getState().commitEdit();
    expect(cb).toHaveBeenCalledWith('Customer');
    expect(cb.mock.calls[0][1]).toBeUndefined();
  });

  it('trims surrounding whitespace before parsing', () => {
    const cb = vi.fn();
    start('Irrelevant', cb);
    useInlineEditorStore.getState().updateText('  Repository < T > ');
    useInlineEditorStore.getState().commitEdit();
    expect(cb).toHaveBeenCalledWith('Repository', '< T >');
  });

  it('handles multi-character generic params', () => {
    const cb = vi.fn();
    start('Irrelevant', cb);
    useInlineEditorStore.getState().updateText('Map<String, Integer>');
    useInlineEditorStore.getState().commitEdit();
    expect(cb).toHaveBeenCalledWith('Map', '<String, Integer>');
  });

  it('does NOT parse generics when fieldType is "title" (note title)', () => {
    const cb = vi.fn();
    useInlineEditorStore.getState().startEditing('n1', 'old', 'title', POS, DIMS, cb);
    useInlineEditorStore.getState().updateText('Note <important>');
    useInlineEditorStore.getState().commitEdit();
    // Plain commit — no second argument
    expect(cb).toHaveBeenCalledWith('Note <important>');
    expect(cb.mock.calls[0][1]).toBeUndefined();
  });

  it('cancelEdit does not call onCommit', () => {
    const cb = vi.fn();
    start('Original', cb);
    useInlineEditorStore.getState().updateText('Ignored<T>');
    useInlineEditorStore.getState().cancelEdit();
    expect(cb).not.toHaveBeenCalled();
  });
});
