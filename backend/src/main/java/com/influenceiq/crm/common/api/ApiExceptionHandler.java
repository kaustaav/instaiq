package com.influenceiq.crm.common.api;

import com.influenceiq.crm.common.ConflictException;
import com.influenceiq.crm.common.NotFoundException;
import com.influenceiq.crm.common.RuleViolationException;
import com.influenceiq.crm.common.ValidationException;
import com.influenceiq.crm.ingestion.DuplicateInfluencerException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

/**
 * Turns exceptions from any controller into consistent JSON errors (RFC 9457 "Problem Details"):
 * <pre>{"title":"Invalid input","status":400,"detail":"...","errors":["Unknown city: Atlantis"]}</pre>
 * Controllers just throw; they never build error responses themselves.
 */
@Slf4j
@RestControllerAdvice // applies to every @RestController
public class ApiExceptionHandler {

    @ExceptionHandler(ValidationException.class)
    ProblemDetail validation(ValidationException e) {
        ProblemDetail p = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, e.getMessage());
        p.setTitle("Invalid input");
        p.setProperty("errors", e.getErrors()); // every problem, so the form can show them all at once
        return p;
    }

    @ExceptionHandler(DuplicateInfluencerException.class)
    ProblemDetail duplicate(DuplicateInfluencerException e) {
        ProblemDetail p = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, e.getMessage());
        p.setTitle("Influencer already exists");
        p.setProperty("existingId", e.getExistingId()); // so the UI can link to the existing profile
        return p;
    }

    @ExceptionHandler(NotFoundException.class)
    ProblemDetail notFound(NotFoundException e) {
        ProblemDetail p = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, e.getMessage());
        p.setTitle("Not found");
        return p;
    }

    /** Our own version check, or Hibernate's @Version check catching a race in the same instant: both mean "reload". */
    @ExceptionHandler({ConflictException.class, ObjectOptimisticLockingFailureException.class})
    ProblemDetail conflict(RuntimeException e) {
        ProblemDetail p = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT,
                e instanceof ConflictException ? e.getMessage() : "This record was changed by someone else. Reload and try again.");
        p.setTitle("Edit conflict");
        return p;
    }

    /** Allowed input, but not in the current state (e.g. a completed campaign is read-only). Every reason listed. */
    @ExceptionHandler(RuleViolationException.class)
    ProblemDetail ruleViolation(RuleViolationException e) {
        ProblemDetail p = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, e.getMessage());
        p.setTitle("Not allowed right now");
        p.setProperty("errors", e.getReasons());
        return p;
    }

    /**
     * A database constraint caught something the code didn't, typically two requests racing (both add the same
     * influencer to a campaign at the same moment). Safe to retry after a reload; never shown as a 500.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    ProblemDetail dataIntegrity(DataIntegrityViolationException e) {
        // logged: if this isn't a race but a missing check in our code, we want to see it
        log.warn("Constraint violation returned as 409: {}", e.getMostSpecificCause().getMessage());
        ProblemDetail p = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT,
                "This conflicts with a change saved at the same moment. Reload and try again.");
        p.setTitle("Edit conflict");
        return p;
    }

    /** Body isn't valid JSON, or a value has the wrong type (e.g. "followers": "lots", "status": "MAYBE"). */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    ProblemDetail unreadable(HttpMessageNotReadableException e) {
        ProblemDetail p = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "The request body is not valid JSON for this endpoint");
        p.setTitle("Invalid input");
        return p;
    }

    /** e.g. /api/influencers/abc or ?fmin=lots */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    ProblemDetail badParameter(MethodArgumentTypeMismatchException e) {
        ProblemDetail p = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST,
                "Invalid value for '" + e.getName() + "': " + e.getValue());
        p.setTitle("Invalid input");
        return p;
    }
}
