# Migration 管理规范

> **所有新增数据库变更必须通过 Migration 管理，禁止直接手动修改数据库结构。**

## 原则

1. 开发、测试、生产环境使用 **同一套 Migration 脚本**
2. 每次 DDL 变更 = 一个新文件 + `schema_migrations` 登记
3. 禁止 `psql` 手改表结构后不提交 Migration
4. 禁止 ORM `sync` / `autoMigrate` 覆盖生产

## 目录

```text
database/
├── schema/000_init.sql          # M0 baseline（新环境首次执行）
├── migrations/schema/
│   ├── M000__baseline.sql       # 标记文件
│   ├── M001__xxx.sql            # 增量 DDL
│   └── ...
└── schema_migrations 表         # 已应用版本追踪
```

## 命名

```text
M{序号}__{snake_case描述}.sql
```

示例：`M001__add_project_tags.sql`

## 工作流

### 新环境（首次）

```bash
bash database/scripts/m0-init.sh
# 或
psql $DATABASE_URL -f database/schema/000_init.sql
psql $DATABASE_URL -f database/seeders/001_registry.sql
```

### 增量变更

1. 编写 `database/migrations/schema/M00N__description.sql`
2. 本地执行并验证
3. 脚本末尾或配套脚本写入：

```sql
INSERT INTO schema_migrations (version, name)
VALUES ('M00N', 'description')
ON CONFLICT (version) DO NOTHING;
```

4. 提交 PR；CI/CD 按 `schema_migrations` 跳过已应用版本

### 禁止

- ❌ 直接 `ALTER TABLE` 生产库
- ❌ 修改已应用的 Migration 文件（应新建 M00N+1 回滚/修正）
- ❌ 跳过 `schema_migrations` 登记

## 数据迁移（D*）

数据 DML 脚本放 `migrations/data/`，**独立于** Schema Migration，需另批门控。

## M0 状态

| 版本 | 说明 | 状态 |
|------|------|------|
| M000 | baseline（000_init.sql） | ✅ M0 |
