# YDB Query Service client

## Experimental

Notice: This API is EXPERIMENTAL and may be changed or removed in a later release.

# TODO

- Make required fields in arguments, and readonly result
- Retryer
- Promise like streams wrappers
- Update auth token on streams
- Compression
- Transactions
- Add context
- Graceful shutdown

# State machine

## Stream

```mermaid
stateDiagram
direction LR
[*] --> Init
Init --> Active
Active --> Closing
Closing --> Closed
Active --> Closed
Closed --> [*]
```

## Retryer

```mermaid
stateDiagram
direction TB
[*] --> init
init --> initStream
initStream --> active
active --> retriableError
active --> notRetriableError
active --> closing
closing --> closed
retriableError --> reinitStream
reinitStream --> forceblyCloseExistingStream
forceblyCloseExistingStream --> initStream
notRetriableError --> [*]
note right of notRetriableError : <font color="#333333">one of the possible causes of the error is the context timeout</font><br>
```
