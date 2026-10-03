package com.influenceiq.crm.common.api;

import com.influenceiq.crm.common.NotFoundException;
import com.influenceiq.crm.common.ValidationException;
import com.influenceiq.crm.ingestion.DuplicateInfluencerException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

/**
 * Turns exceptions from any controller into consistent JSON errors (RFC 9457 "Problem Details"):
 * <pre>{"title":"Invalid input","status":400,"detail":"...","errors":["Unknown city: Atlantis"]}</pre>
 * Controllers just throw; they never build error responses themselves.
 */
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

    /** e.g. /api/influencers/abc or ?fmin=lots */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    ProblemDetail badParameter(MethodArgumentTypeMismatchException e) {
        ProblemDetail p = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST,
                "Invalid value for '" + e.getName() + "': " + e.getValue());
        p.setTitle("Invalid input");
        return p;
    }
}
