# Engineering Principles for YDB JavaScript SDK

## Values and priorities

We build a database SDK that applications trust with their data and availability. Our priorities are:

1. **Reliability.** Preserve correctness, data integrity, security, and availability, including when an operation's outcome is uncertain. Make contracts predictable; compatibility includes runtime behavior, not just types.
2. **Efficiency in real use.** Latency, throughput, CPU cost, and memory use are product requirements, not optional polish. Avoid unnecessary work, allocations, retained state, and dependencies, especially on frequently used paths. Judge improvements by their effect on representative application workloads.
3. **Simplicity and maintainability.** Meet those requirements with the fewest concepts, states, and moving parts. Seek elegant designs that eliminate work and code rather than accumulating mechanisms. The project must remain understandable and maintainable without its original authors.

Do not trade correctness for speed or dismiss a meaningful resource cost for implementation convenience. When a real performance requirement needs complexity, make the tradeoff explicit and verify the benefit.

## Make efficiency a design constraint

Look for ways to avoid work before making it faster: unnecessary copies, conversions, allocations, buffering, and repeated computation. Rethinking ownership or data flow can remove the cost with less code than an additional cache, fast path, or configuration option.

Prefer capabilities of the supported runtime and existing project primitives over adding external dependencies. A dependency needs a benefit that justifies its runtime, memory, distribution, and maintenance costs; replacing it with a large homegrown subsystem is not automatically simpler or cheaper.

Use measurements to test performance hypotheses, not intuition alone. Compare representative workloads before and after, accounting for latency, throughput, allocation pressure, and retained memory where relevant. A microbenchmark improvement is not enough if it does not help an application or merely shifts the cost elsewhere.

## Understand the system, not just the symptom

Start with the behavior the user needs, the failure being addressed, and the constraints that matter. Distinguish observations from assumptions. Read the implementation and its callers before deciding where the change belongs.

Trace the relevant behavior from the public entry point through the components that own it, including affected consumers and other implementations of the same rule. A local symptom may come from a misplaced responsibility or an inconsistent contract elsewhere. Understand enough of that path to explain both the cause and the consequences of the fix; reading the entire repository is not the goal.

Before copying an existing approach, establish why it exists and whether its constraints still apply. Check for shared mechanisms and newer approaches already adopted in the project, including capabilities of the supported runtime and dependencies. Prefer the approach that fits the current system, not automatically the nearest example or the newest technique.

Use that understanding to choose the right change boundary. Repair the shared rule when several paths depend on it, rather than adding another local workaround. If the necessary correction requires a broader migration, explain why and propose a scope instead of silently expanding the task or hiding the defect behind a patch.

Proceed independently when the intent is clear and the decision is local and reversible. Ask when uncertainty changes a public contract, correctness guarantee, or scope. Bring a recommendation and the meaningful tradeoff, rather than asking the user to choose implementation details.

## Ground YDB decisions in upstream evidence

For changes that depend on YDB behavior, inspect the relevant database source and protocol definitions, not only this SDK or documentation. Establish what the server actually does, distinguish implementation details from supported guarantees, and account for the server versions the SDK supports. Do not guess server semantics from client-side behavior.

Investigate how other YDB SDKs solve the same problem. Read the relevant implementation together with its history, issues, and bug fixes to understand the failure modes and constraints behind the design. Treat these as evidence to evaluate, not authority to copy; another SDK may carry historical workarounds or make different guarantees.

Transfer the underlying invariant and reasoning, not the implementation wholesale. Adapt the solution to this project's architecture and direction, JavaScript's execution model, and the SDK's contracts and constraints. Preserve useful source references for non-obvious decisions. If upstream evidence is unavailable or inconclusive, make the uncertainty explicit rather than presenting an assumption as a verified fact.

## Prefer coherent rules to accumulated exceptions

Fix the rule that caused the problem, not just the example that exposed it. Behavior that should be the same should have one source of truth.

The best code is code we do not need to write or maintain. Before adding a mechanism, look for a way to remove the need for it: reuse an existing capability, simplify the data flow, or make an invalid state unrepresentable. Do not remove required behavior or safeguards to reduce code.

Simplicity means fewer concepts and fewer invalid states, not merely fewer lines. Treat the effort to read, review, and safely change code as part of its cost. Prefer explicit ownership and straightforward control flow over clever compression or indirection that requires reconstructing hidden context.

Introduce abstractions when they clarify a stable responsibility or invariant. Do not generalize for hypothetical consumers, hide meaningful differences behind a common interface, or add fallback behavior without a defined contract.

Keep changes focused, but not artificially small: include what is necessary for a coherent fix. Do not preserve a known defect merely to minimize the diff.

## Deliver changes in reviewable units

Split substantial work into pull requests by coherent purpose, not by file count or arbitrary size. Each PR should have a clear reason to exist, an understandable diff, and the tests and documentation needed to establish its own guarantees. Keep intermediate states valid; do not separate a behavior change from the evidence needed to review it.

Put incidental refactoring, cleanup, optimizations, and independent fixes in separate PRs rather than burying them in the main task. Distinguish prerequisites from discoveries: a prerequisite can be an earlier PR, while an unrelated finding should be proposed separately, not silently added to the agreed scope.

Use [stacked pull requests](https://docs.github.com/en/pull-requests/get-started/about-stacked-prs) for dependent steps of a larger change. Put prerequisites in lower layers and build on them in higher layers, so each PR can be reviewed against the layer below it. Keep independent work outside the dependency chain. A stack can land together once the included PRs meet their review and check requirements; this does not remove the need for authorization to merge.

## Make maintenance independent of the author

Leave the knowledge needed to maintain a decision in the repository, not only in a conversation or someone's memory. Express contracts and invariants in code, types, and tests; record non-obvious rationale and operational constraints where future maintainers will encounter them. Explain why an alternative was rejected when that knowledge prevents someone from reintroducing the same problem.

When correctness depends on a rule repeatedly remembered during review, prefer making violations impossible or automatically detectable. Avoid creating parallel documentation that must be manually kept in sync with an existing source of truth.

Judge the result from the position of a maintainer who was not present: can they diagnose a failure, verify the guarantees, and safely change or replace the implementation without asking its author? Reduce that dependency as part of the change, not by documenting every line.

## Make distributed-system semantics explicit

The difficult cases are part of the design, not cleanup after the happy path:

- **Uncertain outcomes:** a lost response does not prove an operation failed. Retry only when the operation's semantics and transaction state allow it; do not turn uncertainty into a claim of success or failure.
- **Cancellation and deadlines:** define which work stops, which resources are released, and what the caller can conclude. Propagate the caller's budget rather than silently creating a new one.
- **Resource ownership:** make it clear who owns sessions, connections, streams, timers, listeners, and background tasks. Every acquisition needs a release path, including partial initialization and failure.
- **Concurrency and backpressure:** reason about ordering, bounded work, and state transitions. Slow consumers, database outages, and recovery must not cause unbounded growth in retained memory, pending work, or retries. Do not let retries amplify overload. Avoid accidental serialization and races hidden by timing assumptions.
- **Errors:** preserve the information callers need to decide what to do next. Do not swallow failures or retry them indiscriminately.

Use structured disposal where the resource supports it. Make lifecycle guarantees understandable without requiring readers to reconstruct every asynchronous interleaving.

## Design for the SDK's users

Design public APIs to make correct use natural and efficient, and incorrect use difficult. Evaluate the whole application workflow, not just the convenience of an individual method. Users should not need to reconstruct SDK internals or write error-prone coordination code to use it safely.

Prevent mistakes through the API's structure rather than relying on warnings in documentation. Minimize independent options, invalid combinations, and ordering or lifecycle rules the caller must remember. Use types and explicit ownership to rule out invalid states where possible. Choose safe defaults without hiding meaningful costs or uncertainty.

TypeScript types alone do not protect JavaScript callers or runtime inputs. Where misuse cannot be prevented structurally, reject it with a clear, actionable error at the responsible boundary, before side effects where possible. Do not silently turn invalid usage into apparent success. Keep safeguards focused on actual risks rather than layering redundant checks on frequently used paths.

Consider dependent packages and existing applications when changing exports, defaults, error behavior, or diagnostics. Treat compatibility as a deliberate decision; do not introduce breaking changes incidentally.

Preserve supported contracts, not every internal detail or hypothetical use. Transitional adapters and parallel implementations need a clear reason to exist and a condition for removal. Complete migrations by removing superseded mechanisms when compatibility permits, rather than accumulating permanent layers.

Keep implementation details private. Update user-facing documentation when the contract changes, explaining guarantees and limitations rather than only showing syntax. Record changes to published packages through the repository's release process; repository-instruction changes alone do not require a package release.

## Verify claims with representative evidence

Choose verification based on what could fail and where the behavior is observable. A passing test suite is evidence, not proof that the requested outcome works.

Actively use disposable experiments, prototypes, diagnostic scripts, tests, and benchmarks to challenge assumptions and compare approaches during development. They are working tools, not automatically deliverables. Remove your one-off scaffolding from the final change unless it has lasting value. Retain focused regression coverage, reusable checks, and evidence needed to maintain correctness or performance guarantees; do not preserve every exploratory case or freeze a discarded implementation in tests.

For behavior involving YDB, prefer integration coverage through public entry points against real YDB. Unit tests are valuable for pure logic and controlled failure scenarios, but internal coverage does not replace evidence that an application can use the feature.

Use fakes when they provide necessary, deterministic control that real YDB cannot reasonably provide. Explain the boundary being simulated and why it is needed. Do not mock away the behavior the test is meant to establish.

For a bug fix, add a regression test that distinguishes the old behavior from the intended behavior. Assert observable contracts rather than incidental implementation steps. Cover relevant failure, cancellation, and cleanup paths, not every imaginable input.

Keep tests deterministic and independently understandable. Synchronize on events or state instead of arbitrary sleeps. Use the test's cancellation budget for real operations and a separate bounded budget for cleanup when necessary.

When changes affect exports, build output, or packaging, verify the built package as an external application would consume it. Check the relevant entry points, JavaScript, type declarations, and required files; tests that resolve directly to workspace source can miss defects in what users receive.

Check affected consumers as well as the changed package. Validate types, builds, style, and runtime behavior in proportion to the change; do not weaken checks or alter expectations just to obtain a green result. For documentation-only changes, check accuracy and consistency rather than running unrelated runtime tests.

## Preserve useful observability without exposing data

Use the SDK's shared logging and diagnostics mechanisms rather than parallel instrumentation. Diagnostics are a contract with telemetry consumers: preserve consistent naming, ownership, identity, and units across producers and subscribers.

Pass database identity explicitly in database-scoped events. Keep it stable for the driver's lifetime, and do not mutate publisher-owned contexts. Keep configuration snapshots separate from per-operation data and convert measurement units at the telemetry boundary.

Make failures diagnosable without logging credentials, tokens, or user data. Instrumentation must not change operation semantics or introduce unbounded work.

## Work within the repository, not around it

Follow the surrounding conventions and use existing tooling for mechanical rules. Keep code, tests, and documentation consistent with the design; do not copy an old pattern when it contradicts the intended contract.

Some repository conventions are deliberate even when other projects differ: use `let` rather than `const`, `#` private fields, and flat `test()` declarations rather than nested `describe`/`it` suites. Write code comments and pull request descriptions in English. Comments should explain decisions, constraints, and non-obvious invariants rather than narrate the code.

Preserve unrelated work, including edits made concurrently. Do not broaden a task into dependency upgrades, generated-file rewrites, or repository-wide formatting without a reason tied to the requested outcome.

Use non-interactive tooling without bypassing safety checks. Treat destructive actions, publication, and changes to shared history as separate decisions requiring authorization, not as an automatic consequence of finishing implementation.

## Leave a reviewable result

Review the final diff as a maintainer would. Can someone understand why the change exists, which invariant it establishes, and what evidence supports it without replaying the conversation?

Report the outcome, consequential decisions, and checks actually performed. Distinguish verified behavior from assumptions, and name unavailable checks or remaining risks. Do not describe a check as passing if it was not run.

Work is complete when the requested behavior works, the change fits the surrounding system, and the next person can confidently maintain it—not merely when the code compiles or the diff is small.
