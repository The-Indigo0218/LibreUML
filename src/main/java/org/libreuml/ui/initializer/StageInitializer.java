package org.libreuml.ui.initializer;

import javafx.scene.Scene;
import javafx.scene.control.Label;
import javafx.scene.layout.StackPane;
import javafx.stage.Stage;
import org.libreuml.infrastructure.event.StageReadyEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.stereotype.Component;

@Component
public class StageInitializer implements ApplicationListener<StageReadyEvent> {

    @Override
    public void onApplicationEvent(StageReadyEvent event) {
        Stage stage = event.getStage();


        Label label = new Label("LibreUML - Arquitectura Lista");
        label.setStyle("-fx-font-size: 24px; -fx-text-fill: #2c3e50;");

        StackPane root = new StackPane(label);
        Scene scene = new Scene(root, 800, 600);

        stage.setScene(scene);
        stage.setTitle("LibreUML v0.1.0-alpha");
        stage.show();
    }
}