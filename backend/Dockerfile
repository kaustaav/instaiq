# Multi-stage build: stage 1 compiles with a full JDK + Maven, stage 2 ships only a JRE and the jar.
# Build:  docker build -t crm-backend backend/
# Run:    docker run --rm -p 8080:8080 crm-backend

# ---------- Stage 1: build ----------
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app

# Copy only the build definition first. Docker caches each step, so dependencies are downloaded again
# only when pom.xml changes, not on every code change. (Plain RUN steps, no BuildKit-only features, so it
# builds with any Docker, including the one Amazon Linux installs.)
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN ./mvnw -B -q dependency:go-offline

# Now the source; this layer changes on every code edit.
COPY src/ src/
RUN ./mvnw -B -q package -DskipTests \
 && cp target/*.jar app.jar

# ---------- Stage 2: run ----------
FROM eclipse-temurin:21-jre
WORKDIR /app

# Don't run as root inside the container.
RUN groupadd --system app && useradd --system --gid app --uid 1001 app
COPY --from=build --chown=app:app /app/app.jar app.jar
USER app

EXPOSE 8080
# Size the heap from the container's memory limit (75%) instead of the host's.
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "/app/app.jar"]
