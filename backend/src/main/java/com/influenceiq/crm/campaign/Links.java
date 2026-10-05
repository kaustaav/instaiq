package com.influenceiq.crm.campaign;

import java.util.regex.Pattern;

/** Draft, live and receipt links: anything that looks like a web address (same check as the UI). */
final class Links {

    private static final Pattern WEB_LINK = Pattern.compile("^https?://\\S+\\.\\S+");

    private Links() {
    }

    static boolean isWebLink(String v) {
        return v != null && WEB_LINK.matcher(v.trim()).find();
    }
}
