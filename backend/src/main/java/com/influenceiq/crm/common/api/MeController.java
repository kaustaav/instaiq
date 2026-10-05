package com.influenceiq.crm.common.api;

import com.influenceiq.crm.common.CurrentUser;
import com.influenceiq.crm.common.CurrentUser.Profile;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** GET /api/me: who the server thinks you are (name and picture for the sidebar). */
@RestController
@RequiredArgsConstructor
public class MeController {

    private final CurrentUser currentUser;

    @GetMapping("/api/me")
    public Profile me() {
        Profile p = currentUser.profile();
        return p != null ? p : new Profile(null, "Local user (sign-in off)", null);
    }
}
