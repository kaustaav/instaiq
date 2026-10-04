package com.influenceiq.crm.common;

import org.springframework.stereotype.Component;

/**
 * Who is making the current request. Until login exists everyone is "system"; with auth this will read the
 * signed-in user (Spring Security), and every "updated by" field follows automatically. One place to change.
 */
@Component
public class CurrentUser {

    public static final String SYSTEM = "system";

    public String name() {
        return SYSTEM;
    }
}
