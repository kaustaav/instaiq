package com.influenceiq.crm;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

/** The whole app starts (all beans, Flyway migrations, Hibernate validation) against a throwaway Postgres. */
@Import(TestcontainersConfiguration.class)
@SpringBootTest(properties = "app.demo-data.enabled=false") // tests never load demo data, whatever .env says
class CrmBackendApplicationTests {

    @Test
    void contextLoads() {
    }
}
