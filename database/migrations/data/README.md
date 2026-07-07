# Data Migrations（P2 框架）

**禁止默认执行。** 仅 dry-run / 计划。

## 使用

```typescript
import { runMigrationBatch, runConsistencyCheck } from "../framework";

// 计划 + dry-run（默认）
const batch = await runMigrationBatch({ phase: "D2" });

// 一致性校验
const report = await runConsistencyCheck();
```

## 执行迁移（需双重门控）

1. `AI_CUT_MIGRATION_EXECUTE=true`
2. `runMigrationBatch({ phase: "D2", execute: true })`

P2 **未启用**上述门控。

## Migrator 覆盖

Project · Asset · Material · Character · Scene · Prop · Director · Timeline · Voice · Subtitle · Music · Effect · Job · QA · Export · Cost · Logs

## 回滚

```typescript
import { rollbackFromSnapshot, listRollbackSnapshots } from "../framework";
rollbackFromSnapshot(snapshotId, { dryRun: true });
```
