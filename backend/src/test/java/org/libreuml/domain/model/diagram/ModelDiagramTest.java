package org.libreuml.domain.model.diagram;

import org.junit.jupiter.api.Test;
import org.libreuml.exceptions.InvalidDiagramException;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.libreuml.domain.model.diagram.DiagramNodeType.*;

public class ModelDiagramTest {

    @Test
    void should_create_valid_diagram() {
        UUID uuidMock = UUID.fromString("a1b2c3d4-e5f6-7890-1234-567890abcdef");
        DiagramNodePosition position = new DiagramNodePosition(12.4, 15.5);
        List<String> attributes = List.of("- id:int", "+ name:string", "# edad:int");
        List<String> methods = List.of("void feed()", "string changeName()");
        DiagramNodeData data = new DiagramNodeData("Animal", attributes, methods, null );
        DiagramNode node = new DiagramNode("1", UML_CLASS, position, data);
        DiagramNode node2 = new DiagramNode("2", UML_CLASS, position, data);
        DiagramEdge edge = new DiagramEdge("1", "idk", "idk", "idk", false);
        DiagramEdge edge2 = new DiagramEdge("2", "idk", "idk", "idk", false);
        DiagramViewPort viewPort = new DiagramViewPort(12.2, 20.02, 2.0);
        Diagram diagram = new Diagram(uuidMock, "Animal", List.of(node, node2), List.of(edge, edge2), viewPort);

        assertNotNull(diagram);
        assertEquals("Animal", diagram.name());
        assertEquals(uuidMock, diagram.id());
        assertEquals(2, diagram.nodes().size());
        assertEquals("1", diagram.nodes().getFirst().id());
    }

    @Test
    void should_throw_exception_when_name_is_invalid(){
        assertThrows(InvalidDiagramException.class, () ->
                new Diagram(UUID.randomUUID(), "", List.of(), List.of(), null)
                );
    }

}
