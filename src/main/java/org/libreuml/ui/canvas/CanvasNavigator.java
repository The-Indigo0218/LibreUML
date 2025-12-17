package org.libreuml.ui.canvas;

import javafx.scene.image.PixelWriter;
import javafx.scene.image.WritableImage;
import javafx.scene.input.MouseEvent;
import javafx.scene.layout.*;
import javafx.scene.paint.Color;
import javafx.scene.Cursor;

public class CanvasNavigator {

    private final Pane canvas;
    private double dragStartX;
    private double dragStartY;

    public CanvasNavigator(Pane canvas) {
        this.canvas = canvas;
        initializeDots();
        initializeEvents();
    }

    private void initializeDots() {
        double spacing = 20.0;
        WritableImage pattern = new WritableImage((int) spacing, (int) spacing);
        PixelWriter writer = pattern.getPixelWriter();

        Color dotColor = Color.web("#505050");

        writer.setColor(0, 0, dotColor);
        writer.setColor(0, 1, dotColor);
        writer.setColor(1, 0, dotColor);
        writer.setColor(1, 1, dotColor);

        BackgroundImage gridImg = new BackgroundImage(
                pattern,
                BackgroundRepeat.REPEAT, BackgroundRepeat.REPEAT,
                BackgroundPosition.DEFAULT, BackgroundSize.DEFAULT
        );

        canvas.setBackground(new Background(
                new BackgroundFill[] {
                        new BackgroundFill(Color.web("#1e1e1e"), null, null)
                },
                new BackgroundImage[] {
                        gridImg
                }
        ));
    }

    private void initializeEvents() {
        canvas.setOnMousePressed(this::onMousePressed);
        canvas.setOnMouseDragged(this::onMouseDragged);
        canvas.setOnMouseReleased(e -> canvas.setCursor(Cursor.DEFAULT));
    }



    private void onMousePressed(MouseEvent event) {
        this.dragStartX = event.getSceneX() - canvas.getTranslateX();
        this.dragStartY = event.getSceneY() - canvas.getTranslateY();
        canvas.setCursor(Cursor.CLOSED_HAND);
    }

    private void onMouseDragged(MouseEvent event) {
        double newX = event.getSceneX() - this.dragStartX;
        double newY = event.getSceneY() - this.dragStartY;
        canvas.setTranslateX(newX);
        canvas.setTranslateY(newY);
    }

    public void onMouseReleased() {
        canvas.setCursor(Cursor.DEFAULT);
    }
}