package com.influenceiq.crm;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * Tests get their own throwaway Postgres in Docker (started on first use, removed after the run), so they never
 * touch the development database and don't need docker compose running.
 * <p>
 * {@code @ServiceConnection}: Spring Boot reads the container's random port/user/password and points the
 * DataSource at it, overriding spring.datasource.* from application.properties.
 */
@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfiguration {

    @Bean
    @ServiceConnection
    PostgreSQLContainer postgresContainer() {
        // Same major version as docker compose and RDS (not "latest", which can change underneath us)
        return new PostgreSQLContainer(DockerImageName.parse("postgres:17"));
    }
}
