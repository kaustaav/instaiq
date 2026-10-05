package com.influenceiq.crm.api;

import static org.assertj.core.api.Assertions.assertThat;

import com.influenceiq.crm.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;

/** CORS as deployed: the UI lives on another address (Amplify) and is the only other website allowed. */
@SpringBootTest(properties = {"app.demo-data.enabled=false", "app.cors.allowed-origins=https://develop.example.amplifyapp.com"})
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class ApiAccessTest {

    private static final String UI = "https://develop.example.amplifyapp.com";

    @Autowired MockMvcTester mvc;

    @Test
    void browserOnTheUiSiteMayCallUsOthersMayNot() {
        MvcTestResult preflight = mvc.options().uri("/api/campaigns").header("Origin", UI)
                .header("Access-Control-Request-Method", "POST")
                .header("Access-Control-Request-Headers", "authorization,content-type").exchange();
        assertThat(preflight).hasStatusOk().headers().hasValue("Access-Control-Allow-Origin", UI);

        assertThat(mvc.options().uri("/api/campaigns").header("Origin", "https://evil.example")
                .header("Access-Control-Request-Method", "POST").exchange()).hasStatus(HttpStatus.FORBIDDEN);
    }
}
