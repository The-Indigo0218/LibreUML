package org.libreuml.domain.model.diagram;

import org.libreuml.exceptions.InvalidDiagramException;

public record DiagramViewPort(Double x, Double y, Double zoom) {
    public DiagramViewPort{
        if (x == null) throw  new InvalidDiagramException("The diagram viewPort x is empty");
        if (y  == null) throw  new InvalidDiagramException("The diagram viewPort y is empty");
        if (zoom == null) throw  new InvalidDiagramException("The diagram viewPort zoom is empty");
    }
}
