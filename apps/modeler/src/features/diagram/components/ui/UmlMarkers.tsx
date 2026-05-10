import { useEffect, useState } from "react";

const useCSSVariables = () => {
  const [colors, setColors] = useState({
    canvasBase: "#0b0f1a",
    edgeInheritance: "#60a5fa",
    edgeImplementation: "#22d3ee",
    edgeAssociation: "#a78bfa",
  });

  useEffect(() => {
    const updateColors = () => {
      const root = document.documentElement;
      const computedStyle = getComputedStyle(root);

      setColors({
        canvasBase: computedStyle.getPropertyValue("--canvas-base").trim() || "#0b0f1a",
        edgeInheritance: computedStyle.getPropertyValue("--edge-inheritance").trim() || "#60a5fa",
        edgeImplementation: computedStyle.getPropertyValue("--edge-implementation").trim() || "#22d3ee",
        edgeAssociation: computedStyle.getPropertyValue("--edge-association").trim() || "#a78bfa",
      });
    };

    updateColors();

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === "class") {
          updateColors();
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  return colors;
};

function injectMarkers(colors: {
  canvasBase: string;
  edgeInheritance: string;
  edgeImplementation: string;
  edgeAssociation: string;
}) {
  const svgElement = document.querySelector('.react-flow__edges')
    || document.querySelector('.react-flow__renderer')
    || document.querySelector('svg');
  
  if (!svgElement) return false;

  const rootSvg = svgElement.closest('svg') || svgElement;
  let defs = rootSvg.querySelector('defs');
  if (!defs) {
    defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    rootSvg.insertBefore(defs, rootSvg.firstChild);
  }

  ['inheritance-end', 'implementation-end', 'aggregation-end', 'composition-end'].forEach(id => {
    const old = defs!.querySelector(`#${id}`);
    if (old) old.remove();
  });

  const markers = [
    createTriangleMarker('inheritance-end', colors.canvasBase, colors.edgeInheritance),
    createTriangleMarker('implementation-end', colors.canvasBase, colors.edgeImplementation),
    createDiamondMarker('aggregation-end', colors.canvasBase, colors.edgeAssociation),
    createDiamondMarker('composition-end', colors.edgeAssociation, colors.edgeAssociation),
  ];

  markers.forEach(marker => defs!.appendChild(marker));
  
  return true;
}

function createTriangleMarker(id: string, fillColor: string, strokeColor: string) {
  const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
  marker.setAttribute('id', id);
  marker.setAttribute('viewBox', '0 0 10 10');
  marker.setAttribute('refX', '10');
  marker.setAttribute('refY', '5');
  marker.setAttribute('markerWidth', '10');
  marker.setAttribute('markerHeight', '10');
  marker.setAttribute('orient', 'auto');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M 0,0 L 10,5 L 0,10 Z');
  path.setAttribute('fill', fillColor);
  path.setAttribute('stroke', strokeColor);
  path.setAttribute('stroke-width', '2');

  marker.appendChild(path);
  return marker;
}

function createDiamondMarker(id: string, fillColor: string, strokeColor: string) {
  const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
  marker.setAttribute('id', id);
  marker.setAttribute('viewBox', '0 0 14 10');
  marker.setAttribute('refX', '14');
  marker.setAttribute('refY', '5');
  marker.setAttribute('markerWidth', '14');
  marker.setAttribute('markerHeight', '10');
  marker.setAttribute('orient', 'auto');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M 0,5 L 7,0 L 14,5 L 7,10 Z');
  path.setAttribute('fill', fillColor);
  path.setAttribute('stroke', strokeColor);
  path.setAttribute('stroke-width', '2');

  marker.appendChild(path);
  return marker;
}

export default function UmlMarkers() {
  const colors = useCSSVariables();

  useEffect(() => {
    let injected = injectMarkers(colors);
    const maxAttempts = 50;
    let attempts = 0;
    
    const interval = setInterval(() => {
      if (injected || attempts >= maxAttempts) {
        clearInterval(interval);
        return;
      }
      
      injected = injectMarkers(colors);
      attempts++;
    }, 100);

    const observer = new MutationObserver(() => {
      const existingMarker = document.querySelector('#inheritance-end');
      if (!existingMarker) {
        injectMarkers(colors);
      }
    });

    const reactFlowElement = document.querySelector('.react-flow');
    if (reactFlowElement) {
      observer.observe(reactFlowElement, {
        childList: true,
        subtree: true,
      });
    }

    return () => {
      clearInterval(interval);
      observer.disconnect();
    };
  }, [colors]);

  return null;
}