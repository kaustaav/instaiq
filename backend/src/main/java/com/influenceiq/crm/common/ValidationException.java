package com.influenceiq.crm.common;

import java.util.List;
import lombok.Getter;

/** Input broke a business rule. The API will turn this into HTTP 400 with the messages. */
@Getter
public class ValidationException extends RuntimeException {

    private final List<String> errors;

    public ValidationException(List<String> errors) {
        super(String.join("; ", errors));
        this.errors = List.copyOf(errors);
    }

    public ValidationException(String error) {
        this(List.of(error));
    }
}
