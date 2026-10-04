package com.influenceiq.crm.common;

/** The request conflicts with the current state (e.g. someone else saved first). The API turns this into 409. */
public class ConflictException extends RuntimeException {

    public ConflictException(String message) {
        super(message);
    }
}
