# Code Design concepts

## The rules by which the query service code built and works:

- Unlike table-service, a grpc connection is created per endpoint only once, and is reused for all sessions with that endpoint

- Important: Do not start using the session until the first packet arrives in attach-stream

- When a new session is created, a grpc stream is created with the attach() command

- The attach-stream remains open for the entire lifetime of the session, including when it
  returns to the pool of free sessions.

- If attach-stream breaks, the session is considered not reusable.  But its current use, if any, is not interrupted.

- A session can be terminated if the exec method returns an error that the session is broken - same logic as in table-service

- There is no re-attach mechanism at the moment, but it is possible that it will appear in the future

- In the first approximation of the service implementation, only the sequential mode of receiving result sets is used

- It still may be worth to make an experimental mixed mode, since we will have to compare performance anyway

- Maximize the use of session pool management logic, error handling logic and retriers from table-service

- Data output is impleted via async iterator. Important: Make sure that in all error scenarios, all
  Promises that have gotten out and have not yet completed will return reject

## Check

- If the session endpoint was removed from discover-service, such a session should not be terminated
  but also not be returned to the session-pool - this required for graceful shutdown.  And other sessions
  for this endpoint, if they are not used, should also be removed from the pool

- Verify that a new session pool is created using RR endpoint enum

- When endpoint dies, all sesssions reletaed to it are also dye

## Issues:

- Test buffering in grpc-stream, if blocking completion on("data" ...), whether server will stop
  sending a new data to the client

## Phase 2:

- A context to the session should be passed through the session itself, not through intermediate user code
