package org.libreuml.domain.model.diagram;

import org.libreuml.exceptions.InvalidDiagramException;

import java.util.List;

public record DiagramNodeData(String label, List<String> attributes, List<String> methods, String stereotype) {
    public DiagramNodeData{
        if (label == null) throw  new InvalidDiagramException("Cannot create a diagram because node data label is empty");
        attributes = attributes == null ? List.of() : List.copyOf(attributes);
        methods = methods == null ? List.of() :  List.copyOf(methods);
    }
}
