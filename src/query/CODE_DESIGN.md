The rules by which the query service code works:

- Unlike table-service, a grpc connection is created per endpoint only once, and is reused for all sessions with that endpoint

- When a new session is created, a grpc stream is created with the attach() command

- The attach-stream remains open for the entire lifetime of the session, including when it
  returns to the pool of free sessions.

- If attach-stream breaks, the session is considered not reusable.  But its current use, if any, is not interrupted.

- A session can be terminated if the exec method returns an error that the session is broken - same logic as in table-service

- There is no re-attach mechanism at the moment, but it is possible that it will appear in the future

- In the first approximation of the service implementation, only the sequential mode of receiving result sets is used

- It still may be worth to make an experimental mixed mode, since we will have to compare performance anyway

- Maximize the use of session pool management logic and error handling logic from table-service

- Data output is impleted via async iterator. Important: Make sure that in all error scenarios, all
  Promises that have gotten out and have not yet completed will return reject
