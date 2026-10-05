package com.influenceiq.crm.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;

import com.influenceiq.crm.TestcontainersConfiguration;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/**
 * Sign-in on. jwt() stands in for a token that already passed Google's signature check (that check is in
 * GoogleTokensTest); here: who is let in, and that changes are recorded under their name.
 */
@SpringBootTest(properties = {"app.demo-data.enabled=false", "app.auth.enabled=true", "app.auth.google-client-id=test-client",
        "app.auth.allowed-domains=example.com", "app.auth.allowed-emails=Owner@Example.org",
        "app.cors.allowed-origins=https://ui.example.net"})
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class SecurityTest {

    @Autowired MockMvcTester mvc;

    /** A Google token's claims: a Workspace member has "hd" (hosted domain); personal accounts don't. */
    private static RequestPostProcessor user(String email, String hd, boolean verified) {
        return jwt().jwt(j -> {
            j.claim("email", email).claim("email_verified", verified).claim("name", "Test Person");
            if (hd != null) j.claim("hd", hd);
        });
    }

    @Test
    void noTokenIs401WithAMessage() throws Exception {
        MvcTestResult r = mvc.get().uri("/api/reference").exchange();
        assertThat(r).hasStatus(HttpStatus.UNAUTHORIZED);
        assertThat((String) JsonPath.read(r.getResponse().getContentAsString(), "$.detail")).isEqualTo("Sign in to continue");
        assertThat(mvc.get().uri("/actuator/health").exchange()).hasStatusOk(); // "is it up?" stays open
    }

    @Test
    void whoGetsIn() throws Exception {
        assertThat(mvc.get().uri("/api/reference").with(user("priya@example.com", "example.com", true)).exchange()).hasStatusOk();
        assertThat(mvc.get().uri("/api/reference").with(user("owner@example.org", null, true)).exchange()).hasStatusOk(); // allow-listed, any case

        MvcTestResult outsider = mvc.get().uri("/api/reference").with(user("someone@gmail.com", null, true)).exchange();
        assertThat(outsider).hasStatus(HttpStatus.FORBIDDEN);
        assertThat((String) JsonPath.read(outsider.getResponse().getContentAsString(), "$.detail"))
                .isEqualTo("You don't have access to InfluenceIQ");
        // the company domain only counts when Google says so ("hd"), not because the address text ends with it
        assertThat(mvc.get().uri("/api/reference").with(user("fake@example.com", null, true)).exchange()).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri("/api/reference").with(user("priya@example.com", "example.com", false)).exchange())
                .hasStatus(HttpStatus.FORBIDDEN); // unverified email
        assertThat(mvc.get().uri("/api/reference").with(user("x@other.com", "other.com", true)).exchange()).hasStatus(HttpStatus.FORBIDDEN);
    }

    @Test
    void changesAreRecordedUnderTheSignedInPerson() throws Exception {
        var priya = user("priya@example.com", "example.com", true);
        MvcTestResult created = mvc.post().uri("/api/influencers").with(priya).contentType(MediaType.APPLICATION_JSON).content("""
                {"handle": "sec_audit", "name": "Audit Test", "cities": ["Pune"], "categories": ["Food"], "followers": 1000}""").exchange();
        assertThat(created).hasStatus(HttpStatus.CREATED).bodyJson()
                .hasPathSatisfying("$.metrics.updatedBy", v -> assertThat(v).isEqualTo("priya@example.com"));

        assertThat(mvc.get().uri("/api/me").with(priya).exchange()).bodyJson()
                .hasPathSatisfying("$.email", v -> assertThat(v).isEqualTo("priya@example.com"))
                .hasPathSatisfying("$.name", v -> assertThat(v).isEqualTo("Test Person"));
    }

    @Test
    void corsPreflightNeedsNoToken() {
        assertThat(mvc.options().uri("/api/campaigns").header("Origin", "https://ui.example.net")
                .header("Access-Control-Request-Method", "POST")
                .header("Access-Control-Request-Headers", "authorization,content-type").exchange()).hasStatusOk();
    }
}
