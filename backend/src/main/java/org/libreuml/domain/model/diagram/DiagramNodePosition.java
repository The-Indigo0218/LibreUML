package org.libreuml.domain.model.diagram;

import org.libreuml.exceptions.InvalidDiagramException;

public record DiagramNodePosition(Double x, Double y) {
    public DiagramNodePosition {
        if (x == null) throw  new InvalidDiagramException("The diagram node position x is empty");
        if (y == null) throw  new InvalidDiagramException("The diagram node position y is empty");
    }
}
