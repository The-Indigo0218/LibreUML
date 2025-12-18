package org.libreuml.ui.controller;

import javafx.fxml.FXML;
import javafx.scene.layout.Pane;
import javafx.scene.layout.StackPane;
import javafx.scene.shape.Rectangle;
import org.libreuml.ui.canvas.CanvasNavigator;
import org.libreuml.ui.components.UmlClassBox;
import javafx.event.ActionEvent;
import org.springframework.stereotype.Component;

@Component
public class MainController {

    @FXML
    private StackPane viewport;

    @FXML
    private Pane canvasPane;

    private CanvasNavigator navigator;
    private static final double GRID_SIZE = 50000;

    public void initialize() {

        canvasPane.setPrefSize(MainController.GRID_SIZE, MainController.GRID_SIZE);
        canvasPane.setMinSize(MainController.GRID_SIZE, MainController.GRID_SIZE);
        canvasPane.setMaxSize(MainController.GRID_SIZE, MainController.GRID_SIZE);

        viewport.setPrefSize(800, 600);

        viewport.setMinSize(0, 0);
        viewport.setMaxSize(Double.MAX_VALUE, Double.MAX_VALUE);

        Rectangle clip = new Rectangle();
        clip.widthProperty().bind(viewport.widthProperty());
        clip.heightProperty().bind(viewport.heightProperty());
        viewport.setClip(clip);


        this.navigator = new CanvasNavigator(canvasPane);
        canvasPane.setOnMouseReleased(e -> navigator.onMouseReleased());
    }

    @FXML
    public void handleCreateClass(ActionEvent event) {
        UmlClassBox newBox = new UmlClassBox("Nueva Clase");
        double centerX = GRID_SIZE / 2;
        double centerY = GRID_SIZE / 2;
        double offset = (Math.random() * 40) - 20;
        newBox.setLayoutX(centerX + offset);
        newBox.setLayoutY(centerY + offset);
        canvasPane.getChildren().add(newBox);
    }
}