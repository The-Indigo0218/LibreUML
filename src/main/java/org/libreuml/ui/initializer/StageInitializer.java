package org.libreuml.ui.initializer;

import javafx.scene.Parent;
import javafx.scene.Scene;
import javafx.stage.Stage;
import lombok.RequiredArgsConstructor;
import org.libreuml.infrastructure.event.StageReadyEvent;
import org.libreuml.ui.FxmlViewLoader;
import org.springframework.context.ApplicationListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class StageInitializer implements ApplicationListener<StageReadyEvent> {

    private final FxmlViewLoader fxmlViewLoader;

    @Override
    public void onApplicationEvent(StageReadyEvent event) {
        Stage stage = event.getStage();

        Parent root = fxmlViewLoader.load("/fxml/main-view.fxml");

        Scene scene = new Scene(root);
        stage.setScene(scene);
        stage.setTitle("LibreUML v0.1.0-alpha");
        stage.show();
    }
}