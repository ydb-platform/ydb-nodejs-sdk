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

state "Init" as init
state "Init Stream" as initStream
state "Retriable Error" as retriableError
state "Non Retriable Error" as nonRetriableError
state "Closing" as closing
state "Closed" as closed
state "Forcebly Close Existing Stream" as forceblyCloseExistingStream

[*] --> init
init --> initStream
initStream --> active
active --> retriableError
active --> nonRetriableError
active --> closing
closing --> closed
retriableError --> forceblyCloseExistingStream
forceblyCloseExistingStream --> initStream
nonRetriableError --> closed
closed --> [*]
note right of nonRetriableError : <font color="#333333">One of the possible causes of the error is the context timeout</font><br>
```
