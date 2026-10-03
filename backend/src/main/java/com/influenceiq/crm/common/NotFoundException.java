package com.influenceiq.crm.common;

/** The requested thing doesn't exist. The API turns this into HTTP 404. */
public class NotFoundException extends RuntimeException {

    public NotFoundException(String what, Object id) {
        super(what + " " + id + " not found");
    }
}
