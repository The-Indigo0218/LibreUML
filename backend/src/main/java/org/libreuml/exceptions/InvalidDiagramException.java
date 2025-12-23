package org.libreuml.exceptions;

public class InvalidDiagramException extends RuntimeException {
    public InvalidDiagramException(String message) {
        super(message);
    }

    public InvalidDiagramException(String message, Throwable cause) { super(message, cause); }
}
