import React from 'react';

function mockComponent(name: string) {
  return React.forwardRef<HTMLDivElement, Record<string, unknown>>((props, ref) => {
    const {
      children,
      listening: _listening,
      perfectDrawEnabled: _perfectDrawEnabled,
      onDblClick: _onDblClick,
      onContextMenu: _onContextMenu,
      ...rest
    } = props;
    const safe: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) {
      if (typeof v !== 'function') safe[k] = v;
    }
    return React.createElement(
      'div',
      { ref, 'data-konva': name, 'data-props': JSON.stringify(safe) },
      children as React.ReactNode,
    );
  });
}

export const Group = mockComponent('Group');
export const Rect = mockComponent('Rect');
export const Text = mockComponent('Text');
export const Line = mockComponent('Line');
export const Arrow = mockComponent('Arrow');
export const Circle = mockComponent('Circle');
export const Ellipse = mockComponent('Ellipse');
export const Shape = mockComponent('Shape');
export const Transformer = mockComponent('Transformer');
