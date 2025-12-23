package org.libreuml.domain.model.diagram;

import org.libreuml.exceptions.InvalidDiagramException;

public record DiagramEdge(String id, String source, String target, String label, Boolean animated) {
    public DiagramEdge{
        if (id.isBlank()) throw new InvalidDiagramException("Cannot creare a diagram because edge id is empty");
        if (source.isBlank()) throw new InvalidDiagramException("Cannot create a diagram because source  is empty");
        if (target.isBlank()) throw new InvalidDiagramException("Cannot create a diagram because target  is empty");
    }
}
