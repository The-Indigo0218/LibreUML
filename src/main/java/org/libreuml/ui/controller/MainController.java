package org.libreuml.ui.controller;

import javafx.fxml.FXML;
import javafx.scene.control.Label;
import org.springframework.stereotype.Component;

@Component
public class MainController {

    @FXML
    public Label welcomeLabel;

    public void initialize() {
        // Este metodo lo llama JavaFX automáticamente despues de cargar los componentes
        welcomeLabel.setText("¡Hola desde Spring Controller!");
    }
}