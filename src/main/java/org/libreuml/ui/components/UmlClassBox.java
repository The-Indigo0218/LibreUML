package org.libreuml.ui.components;

import javafx.geometry.Pos;
import javafx.scene.control.Label;
import javafx.scene.control.Separator;
import javafx.scene.input.MouseEvent;
import javafx.scene.layout.VBox;

public class UmlClassBox extends VBox {

    private double dragStartX;
    private double dragStartY;

    public UmlClassBox(String className) {
        this.getStyleClass().add("uml-class-box");
        this.setPrefWidth(150);

        Label nameLabel = new Label(className);
        nameLabel.getStyleClass().add("uml-class-header");
        nameLabel.setMaxWidth(Double.MAX_VALUE);
        nameLabel.setAlignment(Pos.CENTER);

        Separator sep1 = new Separator();
        Separator sep2 = new Separator();

        VBox attributesBox = new VBox();
        attributesBox.setMinHeight(20);

        VBox methodsBox = new VBox();
        methodsBox.setMinHeight(20);

        this.getChildren().addAll(nameLabel, sep1, attributesBox, sep2, methodsBox);

        enableDrag();
    }

    private void enableDrag() {
        this.setOnMousePressed(this::onMousePressed);
        this.setOnMouseDragged(this::onMouseDragged);
    }

    private void onMousePressed(MouseEvent event) {
        dragStartX = event.getX();
        dragStartY = event.getY();

        event.consume();
        this.toFront();
    }

    private void onMouseDragged(MouseEvent event) {
        double offsetX = event.getSceneX() - this.getParent().localToScene(this.getBoundsInParent()).getMinX() - dragStartX;
        double offsetY = event.getSceneY() - this.getParent().localToScene(this.getBoundsInParent()).getMinY() - dragStartY;

        this.setLayoutX(this.getLayoutX() + offsetX);
        this.setLayoutY(this.getLayoutY() + offsetY);

        event.consume();
    }
}