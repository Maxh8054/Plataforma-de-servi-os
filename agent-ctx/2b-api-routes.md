# Task 2b - Core API Routes

Created 10 API route files for the core business modules:

## Files Created

1. **`/api/demandas/route.ts`** - GET (list with filters: status, prioridade, responsavelId, search; includes responsavel+anexos; pagination), POST (create with validation), DELETE (by id or delete all)

2. **`/api/demandas/batch/route.ts`** - POST (batch update status for multiple demandas; auto-sets concluidoEm/resolvidoPor when status=Concluída)

3. **`/api/equipamentos/route.ts`** - GET (list with search on nome/tag/categoria/local; pagination), POST (create, validates tag+nome), PATCH (update by id), DELETE (by id or delete all)

4. **`/api/anotacoes/route.ts`** - GET (list for current user only; includes user), POST (create for current user), PATCH (update, scoped to owner), DELETE (delete, scoped to owner)

5. **`/api/feedbacks/route.ts`** - GET (list all, includes user), POST (create, validates titulo+conteudo), DELETE (by id)

6. **`/api/notificacoes/route.ts`** - GET (list for current user), POST (create, supports targeting specific user via userId), PATCH (mark single as read or markAll=true for mark all as read)

7. **`/api/escala/route.ts`** - GET (list with ?mesAno=YYYY-MM filter, includes colaborador+substituto, sorted by data asc), POST (create event), PATCH (update), DELETE (by id)

8. **`/api/usuarios/route.ts`** - GET (list all, search on name/email/role, excludes password), POST (create with hashed password, checks email uniqueness), PATCH (update name/email/role/company/isActive/blocked), DELETE (by id)

9. **`/api/backup/route.ts`** - GET (exports all DB data as JSON with metadata), POST (imports JSON, replaces all data in transaction respecting FK order)

10. **`/api/auditorias/route.ts`** - GET (list with colaboradorId/area/search filters, includes colaborador+epis), POST (create with nested epis array), PATCH (update with epis replacement), DELETE (by id, cascades epis)

## Patterns Used
- All routes: `getUserFromRequest` for auth → 401 if not authenticated
- GET lists: pagination with `?page=1&limit=20`, returns `{items, total, page, limit, totalPages}`
- Search: Prisma `contains` filter (SQLite compatible)
- Default sort: `createdAt desc` (escala uses `data asc`)
- Error handling: try/catch with console.error and 500 response
- No `'use server'` directive (route handlers are server code by default)
- Lint passes cleanly
