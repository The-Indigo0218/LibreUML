package org.libreuml.ui.controller;

import javafx.fxml.FXML;
import javafx.scene.layout.Pane;
import javafx.scene.layout.StackPane;
import javafx.scene.shape.Rectangle;
import org.libreuml.ui.canvas.CanvasNavigator; // Asegúrate de importar esto
import org.springframework.stereotype.Component;

@Component
public class MainController {

    @FXML
    private StackPane viewport; // La ventana (necesita fx:id="viewport" en el FXML)

    @FXML
    private Pane canvasPane;    // El lienzo (necesita fx:id="canvasPane" en el FXML)

    private CanvasNavigator navigator;

    public void initialize() {
        // 1. EL LIENZO GIGANTE (Hijo)
        // Le decimos que MIDA 50,000 sí o sí.
        double gridSize = 50000;
        canvasPane.setPrefSize(gridSize, gridSize);
        canvasPane.setMinSize(gridSize, gridSize);
        canvasPane.setMaxSize(gridSize, gridSize);

        // 2. EL VISOR (Padre) - ¡ESTO ES LO QUE FALTABA!
        // Le decimos al StackPane: "Tú no crezcas. Tú mide lo que quepa en la ventana (0 mínimo)".
        // Esto evita que el padre intente igualar el tamaño del hijo gigante.
        viewport.setMinSize(0, 0);
        viewport.setMaxSize(Double.MAX_VALUE, Double.MAX_VALUE); // Opcional, para asegurar que crezca con la ventana

        // 3. LA TIJERA (Clipping)
        // Esto corta visualmente lo que sobresalga del visor para no tapar los menús.
        Rectangle clip = new Rectangle();
        clip.widthProperty().bind(viewport.widthProperty());
        clip.heightProperty().bind(viewport.heightProperty());
        viewport.setClip(clip);

        // 4. INICIAR NAVEGACIÓN
        this.navigator = new CanvasNavigator(canvasPane);
        canvasPane.setOnMouseReleased(e -> navigator.onMouseReleased());
    }
}