# Cloud Deployment Principles

This project's stable deployment defaults. Provider specifics — CLI syntax and flags, instance types, pricing, service tiers, region availability, IaC tool versions — change often: look them up with web search and the CLI's `--help` before using them, not from trained knowledge.

- **CLI access:** the provider's SSO login (`aws sso login`, `az login`, `gcloud auth login`), never long-lived personal keys. Confirm the active identity before any change.
- **Hosting:** start on managed services; move to self-hosted only when cost or customization demands it.
- **Sizing:** check existing reservations or savings plans first, start at the smallest viable size, right-size from 1–2 weeks of observed usage; spot/preemptible for non-production.
- **Certificates and DNS:** provider-managed where possible.
- **Monitoring baseline:** health checks with alerting; request, error-rate and latency metrics; centralized logs retained for the compliance period.
- **Secrets:** held in the deployed environment's secret store (project profile § Configuration) and injected into the process as environment variables at runtime (`.claude/rules/security.md`); never committed or baked into images.
- **Security baseline:** least-privilege identity per service; data stores on private networks, only the load balancer public; automated vulnerability scanning of images and dependencies; encryption at rest on every data store; a web application firewall considered for public web apps.
- **Containers:** multi-stage build that runs the project's production build command inside the image (never copies local build output in); runtime dependencies only in the final stage; non-root user; a health check using a tool the image actually contains; a `.dockerignore` excluding `.git`, `.env`, dependency caches and local build output.
