package com.influenceiq.crm.common;

import java.util.List;
import lombok.Getter;

/**
 * The input is fine, but the current state doesn't allow the action (e.g. editing a completed campaign).
 * The API turns this into 409 with every reason listed, so the UI can say exactly what's in the way.
 * (Compare: ValidationException = the input itself is wrong, 400.)
 */
@Getter
public class RuleViolationException extends RuntimeException {

    private final List<String> reasons;

    public RuleViolationException(List<String> reasons) {
        super(String.join("; ", reasons));
        this.reasons = List.copyOf(reasons);
    }

    public RuleViolationException(String reason) {
        this(List.of(reason));
    }
}
