# Готовность @ydbjs/topic к промышленной эксплуатации

Аналитический отчёт. Не для коммита в репозиторий.
Основа: сравнительный разбор тест-сьютов топик-клиентов Go, Python, Java, Rust, C++, .NET SDK,
протокола `ydb_topic.proto`, официальной фичевой матрицы YDB и кода/тестов `packages/topic`,
с адверсариальной верификацией каждой находки по исходникам и воспроизведением тестами.

Артефакты анализа: `~/.claude/topic-analysis/` (каталоги сценариев по SDK, `gaps.json` — 81
проверенный пробел, `digest.md`, `repro-tests.json`). Воспроизводящие тесты закоммичены в ветку
`claude/topic-client-js-tests-fbd1d5` (коммит `16c3b67`, 10 файлов, 2718 строк).

---

## Вердикт

**Условно готов.** Ядро (один топик, один consumer, писатель с дедупом, sync-commit по батчу,
транзакции, чтение CDC) — зрелое и покрыто лучше большинства SDK: чистые FSM с
model-тестами на 800 сидов, контрактные тесты по проводу, интеграционные и SLO/chaos-сценарии.
Транзакционные golden-path'ы и changefeed подтверждены на реальном YDB новыми тестами.

**Не готов** для: мульти-топик чтения одним ридером (потеря сообщений — блокер, воспроизведено
на реальном YDB), fire-and-forget commit при конкурентной обработке (тихий коммит
необработанных офсетов — блокер), автопартиционируемых топиков (поддержка не заявляется),
тонких tx-сценариев с ребалансом/гэпами.

## Подтверждённые дефекты (запинены `test.fails`, 17 пинов)

### Блокеры

1. **Мульти-топик: состояние ключуется голым `partitionId`** — у двух топиков партиция 0
   сталкивается: грант второго топика вытесняет первый, его сообщения молча теряются, а
   `commit()` уходит под чужой partition session (порча committed offset чужого топика).
   `reader-state.ts:135`, `reader.ts:136,141`. Пины: `reader.multi-topic.test.ts` (3),
   живое воспроизведение — `tests/reader-parity.test.ts`.

2. **Gap-fill anchor коммитит доставленные-но-неподтверждённые офсеты** — `commit(msg9)` при
   доставленных 5..9 шлёт `[5,10)`. Рекомендованный README-паттерн (fire-and-forget +
   пропуск упавшего сообщения) тихо коммитит упавшее — потеря после рестарта.
   `reader-state.ts:358-389` (якорь двигается только при коммите, не при доставке).
   Пины: `reader.commit-semantics.test.ts` (+ позитивный тест retention-hole, который
   фикс обязан сохранить).

### Major (подтверждены и запинены)

3. **Разреженный `commit([m5,m9])` зависает навсегда** — дыра 6..8 становится
   below-anchor и некоммитабельна до реконнекта, waiter не резолвится. (`commit-semantics`)
4. **`commit()` принимает сообщение чужого ридера** — коммит уходит под чужой consumer
   без проверки принадлежности сессии. (`commit-semantics`)
5. **`onCommittedOffset` не вызывается** после `end_partition` и при watermark из
   `stop_partition`. (`commit-semantics`, 2 пина)
6. **tx-ридер биндит офсеты при буферизации, а не при `read()`** — коммит транзакции
   покрывает сообщения, которые приложение не видело (до 8MiB буфера). (`tx-semantics`)
7. **tx: head-gap не сшивается от committed offset** — при `readOffset`-override или
   retention-гэпе сервер детерминированно абортит tx («Bad request (gap)»). (`tx-semantics`)
8. **`UpdateOffsetsInTransaction` не роутится на ноду tx-сессии.** (`tx-semantics`)
9. **`close()` tx-ридера до коммита тихо выбрасывает офсеты** — tx коммитится без
   бинда, сообщения передоставляются после коммита. (`tx-semantics`)
10. **`read({limit: 0})` / отрицательный limit — бесконечный цикл пустых батчей.** (`read-loop`)
11. **Abort `read()` посреди аккумуляции теряет уже вынутые из очереди сообщения** — в
    связке с (2) следующая команда commit помечает их обработанными. (`read-loop`)
12. **Публичный конструктор `TopicWriter` шлёт пустой `producerId`** — тихий no-dedup,
    дубликаты при каждом реконнекте; фабрика генерирует id, конструктор — нет.
    (`writer.semantics`)
13. **Graceful stop мгновенно закрывает окно коммитов** — задокументированный soft-stop
    («докоммитить перед отдачей партиции») невыполним; `onPartitionSessionStop` зовётся
    после `session.stop()`, его док «last chance to commit» — ложь. (`partition-lifecycle`)

### Пины поведения сервера (не дефекты клиента, но теперь зафиксировано)

- `messageGroupId` без равного `producer` → BAD_REQUEST на init (клиент это не валидирует,
  а с автогенерируемым producer валидную пару собрать невозможно) — `writer-parity`.
- RAW-запись в GZIP-only топик → терминальная ошибка с сырым текстом сервера
  (`supportedCodecs` из InitResponse игнорируется клиентом) — `writer-parity`.
- Захват producer вторым писателем: первый падает терминально — `writer-parity`.
- DEADLINE_EXCEEDED терминален для стримов (Go ретраит) — расхождение задокументировано
  в классификаторной таблице `writer.semantics`.

## Что оказалось рабочим (пробел был в тестах, не в коде)

Новые интеграционные тесты подтвердили на реальном YDB: tx-чтение/запись end-to-end
(атомарный бинд офсетов, rollback → передоставка, видимость только после коммита),
чтение CDC-changefeed (`<table>/feed`) с коммитами и резюмом, commit durability через
рестарт ридера, `readFrom`/`partitionIds`-фильтры, `onPartitionSessionStart`-override,
metadataItems/createdAt round-trip, кастомный кодек (id ≥ 10000), пиннинг партиции.
Overdraw流-контроля на оверсайз-сообщении корректен. Реконнект-ядро писателя (mid-stream
status frame, resend, tx identity на пере-отправках, reject tx-коммита при таймауте
drain) — корректно.

## Функциональные пробелы против других SDK / протокола / доков

| Область | Статус | Комментарий |
|---|---|---|
| Autopartitioning чтение | нет | `autoPartitioningSupport` захардкожен `false`; child/adjacent ids из `EndPartitionSession` выбрасываются. Есть у C++/Go/Python. Фактическое поведение на SCALE_UP-топике (compat-режим) не протестировано вовсе |
| Control-plane обёртки | нет (осознанно) | issues 476–479 закрыты как completed: официальный путь — raw `@ydbjs/api`. Но `DescribePartition` отсутствует даже в сгенерированном сервисе (стейл `ydb_topic_v1.proto` в ydb-api-protos) |
| Унарный `CommitOffset` | нет | seek/офсет-тулинг невозможен; взаимодействие с живым ридером не исследовано |
| Consumer-less read | нет | `consumer` обязателен; пустая строка уходит на провод без валидации |
| DirectRead / DirectWrite | нет | записанное проектное решение отложить |
| Валидация кодека по `supportedCodecs` | нет | падение поздно и с сырой ошибкой; буфер теряется |
| `write_session_meta` | нет | ни записать, ни прочитать (Batch.write_session_meta и messageGroupId не доезжают до `TopicMessage`) |
| Ack offset / WriteStatistics / partitionId | нет | сервер шлёт — клиент выбрасывает; потолок наблюдаемости |
| Backpressure-await у писателя | нет | только sync-throw; `flush()` — грубый full-drain барьер |
| Async-компрессия | нет | `gzipSync`/`zstdCompressSync` на event loop; интерфейс кодека синхронный — офлоуд невозможен в принципе |
| `readerName`, `partition_max_in_flight_bytes` | нет | мёртвая/несуществующая конфигурация |
| `start_timeout` (30s), `partition_reassign_gc` (60s) | захардкожены | в отличие от остальных таймингов |
| SLO topic workload в CI | нет | workload есть (`tests/slo/workloads/topic`), в matrix `slo.yml` только kv |
| Доки YDB | устарели в обе стороны | tx/soft-stop/hard-stop помечены «не поддержано», хотя реализованы; `flushIntervalMs` 10ms vs реальный 1000ms; LZOP упомянут для JS без кодека в клиенте |

## Приоритеты фиксов

1. Ключ `(topicPath, partitionId)` (или partition session id с реконсайлом) во всех трёх
   местах: `reader-state.ctx.partitions`, фасадные `#sessions`, `#txReadOffsets`.
2. Anchor при доставке: отличать retention-hole (сшивать от server committed) от
   delivered-but-unacked (не коммитить). Позитивный тест уже есть.
3. tx: бинд офсетов при `read()`; head-gap от committedOffset; прунинг lost-партиций
   перед `UpdateOffsetsInTransaction`; roуting на ноду tx-сессии; guard на `close()`
   до коммита.
4. Валидация `limit`; редоставка батча при abort.
5. Конструктор `TopicWriter`: генерировать/требовать producer; ownership-check в `commit()`.
6. Pre-stop hook (awaited до `StopPartitionSessionResponse`) или честная правка доков;
   `onCommittedOffset` для ended/stopped партиций.
7. Валидация кодека по InitResponse + fail-fast с понятной ошибкой.
8. Матрица SLO: добавить `node-topic`; правка доков YDB (обе стороны рассинхрона).

## Что ещё протестировать (за рамками этой итерации)

- **Autopartitioning live**: SCALE_UP-топик, спровоцированный split — что видит JS-ридер в
  compat-режиме (задержки чтения детей, порядок parent-before-child); то же для писателя.
- **Interop**: go/java пишут → JS читает (metadata, кодеки, message_group_id), и наоборот.
- **Длительные прогоны**: SLO topic в CI; token refresh часами под живым трафиком;
  воскресить `memory-leak.test.ts` (сейчас перманентный skip).
- **Бенчи ридера и кодеков** (сейчас только writer/RAW; 13ms/MiB gzipSync невидим).
- **Big-message end-to-end** (48MiB границы, компрессирующийся/раздувающийся кастомный кодек),
  пустой payload.
- **`readOffset` < committed** в override на живом сервере: терминальность vs reconnect-loop.
- **`Driver.close()`/dispose с живыми стримами**; создание клиентов на закрытом драйвере.
- **Rebalance return-leg**: возврат партиции выжившему ридеру после ухода второго.
- **Конфликт двух tx** (ABORTED на `UpdateOffsetsInTransaction`) на живом сервере; ретрай
  идемпотентной tx — exactly-once.
- **Пины сервера при не-graceful stop**: коммиты после потери партиции игнорируются — не
  должно быть зависших waiter'ов дольше reassign-gc (unit-пин есть, живого нет).

## Как это воспроизводилось

Три волны субагентов (71 агент, ~6.7M токенов): каталогизация тестов шести SDK + протокола +
доков → gap-анализ по 8 измерениям с адверсариальной верификацией каждого blocker/major по
исходникам → написание воспроизводящих тестов с прогоном. Итог прогона всего пакета:
uni — 287 passed + 17 expected fail + 1 skipped; int (Docker local-ydb 25.3) — 43 passed +
1 expected fail + 1 skipped.
