package org.libreuml.domain.model.diagram;

import org.libreuml.exceptions.InvalidDiagramException;

public record DiagramNode(String id, DiagramNodeType type, DiagramNodePosition position, DiagramNodeData data) {
    public DiagramNode{
        if (id.isEmpty()) throw new InvalidDiagramException("The diagram has not been created because the id is empty");
        if (type == null) throw  new InvalidDiagramException("The diagram has not been created because the type is " + type);
        if (position == null) throw  new InvalidDiagramException("The diagram position is empty");
        if (data == null) throw  new InvalidDiagramException("The diagram data is empty");
    }
}
