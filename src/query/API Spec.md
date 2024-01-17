# The generic query service API gets designed from the ground up

_Introductions:_

- The interface should not depend on the specific version of the YDB and the mode of
  running it: cloud, local or otherwise.

- It is desirable that the interface should be close in spirit to other database TS (JS) APIs, so that
  the transition to YDB would be comfortable.

- There is no need to repeat the YDB API for other languages, as TypeScript is a language with
  its own specific features. For example, passing named parameters.

_Rules:_

- Like in any good API, rules for checking parameters and default values to be used should be
  formulated and implemented in code.

- A session should not allow a transaction to be created if the transaction is already open.

_Features:_

- Execute simple query, without a transaction.

- Execute multiple queries in a transaction.

- Execute multiple queries without a transaction, but with a guarantee that the result
  will be only if no critical errors occur during execution.

- Execute multiple queries in different transactions, but with a guarantee that the result
  will be only if no critical errors occur during execution.

- Repeat the operation several times, each with a new session in case of an error, according to the repeat policy.

- Specify the type of transaction when it is needed.

- Specify trace id for end-to-end trace collection.

- Optionally, specify a repeat policy for what to execute in an internal YDB session.
  Сan optimize execution time with loss of information for balancing. Can be useful
  for _serverless functions_ where query execution time is critical.

_Technical details:_

- User code, should be passed as a lambda function to ensure transactions and
  sessions are closed at the end of it's execution.  And tracing span data was collected.

- A common session pool code with table service must be used.

_Important:_

- When developing the Query API, check if a similar API can be made for Table Service in the future.
