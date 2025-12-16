package org.libreuml.ui.controller;

import javafx.fxml.FXML;
import javafx.scene.layout.Pane;
import org.springframework.stereotype.Component;

@Component
public class MainController {

    @FXML
    private Pane canvasPane;

    public void initialize() {
        System.out.println("Lienzo inicializado: " + canvasPane.getWidth() + "x" + canvasPane.getHeight());
        canvasPane.setStyle("-fx-border-color: red; -fx-border-width: 2; -fx-background-color: #f0f0f0;");
    }
}