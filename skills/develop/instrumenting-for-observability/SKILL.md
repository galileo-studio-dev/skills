---
name: instrumenting-for-observability
description: Adds logging, metrics, tracing, and error reporting that let someone else diagnose a failure. Use when instrumenting a new handler, job, or integration, wiring Sentry or a logger, deciding what to log, or when a log line might include request bodies, tokens, emails, or other personal data. Also use when a failure investigation finds no useful trace.
---

# Instrumenting for Observability

## Overview

Observability answers one question: when this fails at 3 a.m., can someone who did not write it tell what happened, to whom, and why, from the logs, traces, and error reports alone? Generated code tends to log nothing or to log everything (`console.log(req.body)`), and both fail that test. The second one also leaks personal data.

**Core principle:** Instrument the boundaries, with structure and correlation, and never with secrets or personal data.

## What to instrument

| Where | Emit | Don't emit |
| --- | --- | --- |
| Start and end of a request, job, or message | One structured event: route or job name, status, duration, the ids of the entities involved, the request or trace id | Every step inside the handler |
| Outbound calls: database, HTTP, queue, provider | Duration, target, status or error class, retry count, usually through the client's own instrumentation | Full payloads |
| Decisions that change the outcome | The branch taken and why: `reason="free_plan"` | "Entering function X" |
| Failures | The error with its cause, the ids needed to find the data, and the trace id, sent to error tracking once | The same error logged at every layer it passes through |
| Background jobs and webhooks | Event id, attempt number, deduplication outcome, final state | The raw webhook body |

One event per unit of work with the right fields beats twenty lines of prose.

## Structure and correlation

- Use the project's logger, not `print` or `console.log`. Log events as key-value fields, not interpolated strings: `logger.info("invoice_sent", invoice_id=..., workspace_id=..., duration_ms=...)`. The exact idiom depends on the logger; match the codebase.
- Propagate one request or trace id across services and into every log line and error report. If the framework or OpenTelemetry already provides one, use it; don't invent a second.
- Levels: `error` means someone should look — a bug, or an expected failure that could not be recovered. `warning` means recovered but unusual: a retry succeeded, a fallback was used. `info` is for business-meaningful events. `debug` is off in production. A 404 or a validation failure is not an `error`.
- Log once, at the boundary that handles the failure (see `designing-error-handling`). If you catch and re-raise, don't also log.

## Errors to Sentry, or the project's tracker

- Report unhandled exceptions once, from the top-level handler. The framework integration usually does this already; don't also call `capture_exception` in inner functions and let the error propagate.
- Attach context as data, not prose: user and workspace ids as tags, entity ids as extra fields, release and environment set at init.
- Keep exception types meaningful (`UpstreamUnavailable`, not `Exception("stripe failed")`) so issues group correctly.
- Expected, handled failures go to logs and metrics, not to error tracking. Reserve the tracker for things a human should act on, or its signal drowns.

## Metrics, when the project has them

- Count and time units of work and outbound calls; label by name and outcome (`status=ok|error`), never by high-cardinality values such as user ids, emails, or URLs containing ids.
- Measure what the feature promises: `emails_sent_total`, `checkout_completed_total`, queue depth, job lag — not only CPU.
- If there is no metrics system, don't add one for a single feature. Log the event with a duration field; it can be derived later.

## Never log or send

- Secrets: API keys, tokens, session cookies, `Authorization` headers, signed URLs, passwords, one-time codes.
- Personal data beyond an identifier: emails, names, phone numbers, addresses, free-text content, payment details. Log `user_id`, not `email`.
- Full request or response bodies, headers, or provider payloads. If you need them to debug, log specific allow-listed fields.
- Anything that would let a log reader act as the user.

Redact at the source, not with a regex on the way out. Keep the SDK's scrubbing on (Sentry: `send_default_pii=False`, and `before_send` for anything custom).

## Example: FastAPI with structlog and Sentry

```python
# app/logging.py — one place: structured logger, request id bound for the whole request
log = structlog.get_logger()

@app.middleware("http")
async def bind_request(request: Request, call_next):
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(
        request_id=request.headers.get("x-request-id") or uuid4().hex,
    )
    started = time.perf_counter()
    response = await call_next(request)
    log.info("http_request", method=request.method, path=request.url.path,
             status=response.status_code,
             duration_ms=round((time.perf_counter() - started) * 1000))
    return response


# billing/service.py — a decision that changes the outcome, recorded with ids only
def send_invoice(invoice: Invoice) -> None:
    if invoice.workspace.plan == "free":
        log.info("invoice_skipped", invoice_id=invoice.id,
                 workspace_id=invoice.workspace_id, reason="free_plan")
        return
    mailer.send(invoice)   # MailerError propagates; the boundary logs and reports it once
    log.info("invoice_sent", invoice_id=invoice.id, workspace_id=invoice.workspace_id)


# main.py — errors reach the tracker once, with release and environment, without PII
sentry_sdk.init(dsn=settings.sentry_dsn, environment=settings.env,
                release=settings.release, send_default_pii=False,
                traces_sample_rate=0.1)
```

Absent on purpose: no `log.debug` inside loops, no `log.error` for a 404, no `email=` field, no `capture_exception` in `send_invoice`.

## Checklist before finishing

- [ ] Each new handler or job emits one start/end event with ids, status, and duration.
- [ ] Errors reach the tracker once, with the ids needed to investigate.
- [ ] No secret, email, body, or header in any log field.
- [ ] Log fields are structured and named like the rest of the codebase.
- [ ] The request or trace id is on every line the unit of work emits.
- [ ] Nothing at `error` level is expected behavior.

## Credits

Created by [Carlos Figueredo](https://github.com/cefigueredo) for the Galileo Studio skills catalog. No upstream source.
