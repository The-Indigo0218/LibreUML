package org.libreuml.domain.model.diagram;

import org.libreuml.exceptions.InvalidDiagramException;

import java.util.List;
import java.util.UUID;

public record Diagram(UUID id, String name, List<DiagramNode> nodes, List<DiagramEdge> edges, DiagramViewPort viewPort) {
    public Diagram{
        if (id == null) throw new InvalidDiagramException("The diagram has not been created because the id is null");
        if (name == null || name.isBlank()) throw new InvalidDiagramException("The diagram has not been created because the name is blank");
        nodes = (nodes == null) ? List.of() :  List.copyOf(nodes);
        edges = (edges == null) ? List.of() :  List.copyOf(edges);
        if (viewPort == null) throw new InvalidDiagramException("The diagram has not been created because the viewport is null");
    }
}
