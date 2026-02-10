# Security Policy

## Important: Self-Hosted Application

Transaction Intelligence App is designed to be **self-hosted** on your own infrastructure. You are responsible for securing your deployment environment, including network access, TLS termination, and host-level security. The application handles sensitive financial data — treat your deployment accordingly.

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |

Only the latest version on the `main` branch receives security updates. We recommend always running the most recent version.

## Reporting a Vulnerability

If you discover a security vulnerability, please report it by [opening a GitHub Issue](https://github.com/alcybersec/transaction_intelligence_app/issues/new) with the label `security`.

For sensitive issues that should not be disclosed publicly, please include **[SECURITY]** in the issue title and provide minimal details — just enough for us to understand the scope. We will work with you privately to resolve the issue before any public disclosure.

### What to include

- Description of the vulnerability
- Steps to reproduce
- Affected component(s) (backend, frontend, worker, etc.)
- Potential impact

### Response expectations

- **Acknowledgment**: Within 72 hours
- **Initial assessment**: Within 1 week
- **Fix timeline**: Depends on severity, but we aim to address critical issues promptly

## Scope

The following are considered security issues:

- Authentication or authorization bypasses
- SQL injection, command injection, or other injection attacks
- Cross-site scripting (XSS) or cross-site request forgery (CSRF)
- Exposure of sensitive data (credentials, financial data, tokens)
- Insecure default configurations that could lead to data exposure
- Vulnerabilities in the SMS/email ingestion pipeline

The following are **not** in scope:

- Vulnerabilities in upstream dependencies (report these to the respective projects)
- Issues requiring physical access to the host machine
- Denial of service attacks against a self-hosted instance
- Social engineering attacks
- Issues in third-party services (Ollama, Proton Mail Bridge) — report these upstream
