# PostgreSQL Repository 实现（P1 阶段）

M0 **不实现** SQL 逻辑。本目录占位，供 P1 添加：

```text
pg/
├── pool.ts                 # ✅ M0 占位
├── project-repository.ts   # ⏸ P1
├── asset-repository.ts     # ⏸ P1
├── artifact-repository.ts  # ⏸ P1
├── job-repository.ts       # ⏸ P1
├── registry-repository.ts  # ⏸ P1
└── ...
```

规则：仅本目录可执行 SQL；`app/` 禁止 import `pg`。
