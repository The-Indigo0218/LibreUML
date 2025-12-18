package org.libreuml.ui.canvas;

import javafx.scene.Cursor;
import javafx.scene.image.PixelWriter;
import javafx.scene.image.WritableImage;
import javafx.scene.input.MouseEvent;
import javafx.scene.input.ScrollEvent;
import javafx.scene.layout.*;
import javafx.scene.paint.Color;

public class CanvasNavigator {

    private final Pane canvas;
    private double dragStartX;
    private double dragStartY;

    private static final double MIN_SCALE = 0.1;
    private static final double MAX_SCALE = 5.0;
    private static final double ZOOM_FACTOR = 1.05;

    public CanvasNavigator(Pane canvas) {
        this.canvas = canvas;
        initializeGrid();
        initializeEvents();
    }

    private void initializeGrid() {
        double spacing = 20.0;
        WritableImage pattern = new WritableImage((int) spacing, (int) spacing);
        PixelWriter writer = pattern.getPixelWriter();

        Color dotColor = Color.web("#ffffff", 0.2);

        writer.setColor(0, 0, dotColor);
        writer.setColor(1, 0, dotColor);
        writer.setColor(0, 1, dotColor);
        writer.setColor(1, 1, dotColor);

        BackgroundImage gridImg = new BackgroundImage(
                pattern,
                BackgroundRepeat.REPEAT, BackgroundRepeat.REPEAT,
                BackgroundPosition.DEFAULT, BackgroundSize.DEFAULT
        );

        canvas.setBackground(new Background(
                new BackgroundFill[] { new BackgroundFill(Color.web("#1e1e1e"), null, null) },
                new BackgroundImage[] { gridImg }
        ));
    }

    private void initializeEvents() {
        canvas.setOnMousePressed(this::onMousePressed);
        canvas.setOnMouseDragged(this::onMouseDragged);
        canvas.setOnMouseReleased(e -> canvas.setCursor(Cursor.DEFAULT));

        canvas.setOnScroll(this::onScroll);
    }

    private void onScroll(ScrollEvent event) {
        event.consume();
        double delta = event.getDeltaY();
        double currentScale = canvas.getScaleX();
        double scaleFactor = (delta > 0) ? ZOOM_FACTOR : (1 / ZOOM_FACTOR);

        double newScale = currentScale * scaleFactor;
        newScale = Math.max(MIN_SCALE, Math.min(newScale, MAX_SCALE));
        scaleFactor = newScale / currentScale;

        double mouseLocalX = (event.getSceneX() - canvas.getTranslateX()) / currentScale;
        double mouseLocalY = (event.getSceneY() - canvas.getTranslateY()) / currentScale;

        canvas.setScaleX(newScale);
        canvas.setScaleY(newScale);

        double newTranslateX = event.getSceneX() - (mouseLocalX * newScale);
        double newTranslateY = event.getSceneY() - (mouseLocalY * newScale);

        canvas.setTranslateX(newTranslateX);
        canvas.setTranslateY(newTranslateY);
    }

    private void onMousePressed(MouseEvent event) {
        dragStartX = event.getSceneX() - canvas.getTranslateX();
        dragStartY = event.getSceneY() - canvas.getTranslateY();
        canvas.setCursor(Cursor.CLOSED_HAND);
    }

    private void onMouseDragged(MouseEvent event) {
        canvas.setTranslateX(event.getSceneX() - dragStartX);
        canvas.setTranslateY(event.getSceneY() - dragStartY);
    }

    public void onMouseReleased() {
        canvas.setCursor(Cursor.DEFAULT);
    }
}