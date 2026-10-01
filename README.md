# InfluenceIQ — Influencer CRM

Internal tool for finding, tracking and shortlisting Instagram micro/nano influencers across campaigns.

## Layout
| Path | What |
|---|---|
| `backend/` | Spring Boot API (Java 21) |
| `frontend/` | React app (not started) |
| `docs/design/` | Design prototype and handoff spec |

## Run the backend
```bash
cd backend
./mvnw spring-boot:run
curl localhost:8080/actuator/health   # {"status":"UP"}
```

Requires JDK 21+. Maven is not needed; `mvnw` downloads it.
