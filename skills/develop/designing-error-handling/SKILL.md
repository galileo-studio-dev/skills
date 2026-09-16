---
name: designing-error-handling
description: Decides where and how failures are handled. Use when writing or reviewing code that can fail — database, HTTP, queue, file, payment or auth provider calls, webhooks, background jobs, parsing of external input — and when deciding whether to add a try/catch, fallback, default value, retry, or timeout. Also use when a reviewer flags swallowed exceptions, silent failures, or defensive checks for states that cannot happen.
---

# Designing Error Handling

## Overview

Error handling has two opposite failure modes, and generated code commits both: wrapping everything in `try/catch` that logs and continues, so bugs become silent wrong results; and ignoring that I/O fails, so there are no timeouts, retries duplicate side effects, and webhooks get applied twice. Good error handling is a design decision made once per boundary, not a reflex applied to every line.

**Core principle:** Separate bugs from expected failures. Bugs surface loudly and early. Expected failures are handled at the boundary that owns recovery, and nowhere else.

## First question: bug or expected failure?

| Kind | Examples | Handling |
| --- | --- | --- |
| **Bug**: an invariant is broken, a programmer error | `None` where the type says it cannot be; an unknown enum branch; internal code passing the wrong shape | Don't catch it. Let it raise, fail the request or job, and reach error tracking. An early `raise` or `assert` with a clear message at the source is fine. |
| **Expected failure**: the world did not cooperate | Network timeout; 5xx from a provider; database deadlock; missing file; invalid user input; rate limit; webhook replay | Handle it **once**, at the boundary that owns recovery, with a defined outcome: retry, return an error to the caller, degrade, or reject the input. |

If you cannot say what the program should *do* when the error occurs, you cannot handle it yet. Let it propagate to something that can.

## Where handling lives: boundaries

Handle at the layer that has enough context to decide and can produce the caller-facing outcome:

- **Input boundary** (HTTP handler, CLI, message consumer): validate and reject with a specific error — status code, field, reason. Inside, trust the validated types.
- **Outbound I/O boundary** (a client wrapper for a provider, a repository): apply timeouts, retry only retryable errors with backoff, and translate raw errors into your domain's error types.
- **Top of a unit of work** (request handler, job runner): one catch that fails the unit, records the error with context, and returns or reports. There is roughly one of these, not one per function.

Between boundaries, no `try/catch`. Functions in the middle either succeed or raise.

## Rules for I/O

- **Every network call has a timeout.** A missing timeout is an eventual outage.
- **Retry only idempotent operations, and only retryable errors** (timeouts, 429, 5xx, deadlocks). Never retry 4xx validation errors or "unknown". Bound the attempts; use backoff with jitter.
- **Side effects behind retries must be idempotent.** Use idempotency keys (Stripe supports them), `INSERT ... ON CONFLICT DO NOTHING`, or check-then-act inside a transaction. If you cannot make it idempotent, don't retry it automatically.
- **Webhooks arrive more than once and out of order.** Verify the signature before anything else. Record the event id and skip ids already processed. Return 2xx only after durable processing, or after durably enqueuing.
- **Partial failure in batches:** decide up front between all-or-nothing (a transaction) and per-item with a report of which items failed. Never silently drop the failures.

## Error messages and types

- Messages say what failed, on what, and what to do: `"Invoice 8123 not found for workspace ws_9"`, not `"Error"` or `"Something went wrong"`.
- Preserve the cause: `raise ... from e` in Python, `new Error(msg, { cause })` in JavaScript. Don't rethrow as a generic error that loses the stack and the type.
- Use a small set of domain error types at the boundary (`NotFound`, `Conflict`, `ValidationError`, `UpstreamUnavailable`) and map them to responses in one place. Don't create an exception class per function.
- Never expose stack traces, SQL, or provider internals to end users. Do include them in logs and error tracking.

## What not to write

| Anti-pattern | Why it is harmful | Instead |
| --- | --- | --- |
| `catch (e) { console.log(e) }` and continue | Turns a bug into a silent wrong result | Let it propagate; catch once at the top of the unit of work |
| `except Exception: return None` | Callers cannot tell "no data" from "database down" | Raise a domain error or let it propagate |
| Fallback or default for a state internal code cannot produce | Lies to readers about what can happen; hides real bugs | Trust the type; assert at the source if paranoid |
| `if (!user) return;` deep inside logic, with no message | A silent no-op nobody learns about | Fail with a specific error, or validate at the boundary |
| Retrying a non-idempotent `POST` | Duplicate charges, duplicate rows | Idempotency key, or no retry |
| Catching to "add context", then rethrowing a new generic error | Loses the original stack and type | `raise ... from e` or `{ cause }`, and keep the type |
| `try/except` around every line "to be safe" | Bloat; every catch is a place a bug can hide | One catch per boundary |

## Example: FastAPI with a payment provider

```python
# billing/errors.py — a small set of domain errors, each knowing its HTTP outcome
class BillingError(Exception):
    status = 500
    code = "billing_error"

class ValidationError(BillingError):
    status, code = 422, "invalid_request"

class NotFound(BillingError):
    status, code = 404, "not_found"

class UpstreamUnavailable(BillingError):
    status, code = 503, "upstream_unavailable"


# billing/stripe_client.py — outbound boundary: translate errors, decide retryability
# (stripe.default_http_client is configured with a 10 s timeout at startup)
def create_charge(payload: ChargeRequest, idempotency_key: str) -> Charge:
    try:
        resp = stripe.Charge.create(**payload.model_dump(), idempotency_key=idempotency_key)
    except (stripe.APIConnectionError, stripe.RateLimitError) as e:
        raise UpstreamUnavailable("stripe charge") from e   # retryable: the job runner may retry
    except stripe.InvalidRequestError as e:
        raise ValidationError(str(e)) from e                # not retryable: surface to the caller
    return Charge.from_stripe(resp)                          # anything else is a bug: let it raise


# billing/router.py — input boundary and unit of work: no try/except here
@router.post("/charges")
def post_charge(req: ChargeRequest, ws: Workspace = Depends(current_workspace)) -> Charge:
    return create_charge(req, idempotency_key=f"{ws.id}:{req.client_ref}")


# main.py — one mapping from domain errors to responses
@app.exception_handler(BillingError)
def billing_error(_: Request, exc: BillingError) -> JSONResponse:
    return JSONResponse(status_code=exc.status, content={"error": exc.code, "detail": str(exc)})
```

Absent on purpose: no `try/except` in the router, no default for a missing workspace (the dependency already rejects unauthenticated requests), no `except Exception`.

## Checklist before finishing

- [ ] Every catch names what it recovers from and what happens next.
- [ ] No catch logs and continues without a defined outcome.
- [ ] Every network call has a timeout; retries are bounded and idempotent.
- [ ] Webhook and job handlers are safe to run twice.
- [ ] Error messages identify the object and the action.
- [ ] Original errors are preserved as the cause.
- [ ] Nothing internal (stack, SQL, provider payloads) reaches the user.

## Credits

Created by [Carlos Figueredo](https://github.com/cefigueredo) for the Galileo Studio skills catalog. No upstream source.
