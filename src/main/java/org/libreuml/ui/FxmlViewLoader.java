package org.libreuml.ui;

import javafx.fxml.FXMLLoader;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationContext;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
@RequiredArgsConstructor
public class FxmlViewLoader {

    private final ApplicationContext context;

    public <T> T load(String fxmlPath) {
        try {
            FXMLLoader loader = new FXMLLoader(getClass().getResource(fxmlPath));
            loader.setControllerFactory(context::getBean);

            return loader.load();
        } catch (IOException e) {
            throw new RuntimeException("No se pudo cargar la vista: " + fxmlPath, e);
        }
    }
}