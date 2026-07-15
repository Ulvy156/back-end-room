## Code Rules

These rules apply to all new code in this project.

**MVP first — build only what the current feature needs.** No speculative abstractions, no "we might need this later" infrastructure, no over-engineering. Three similar lines of code is better than a premature abstraction.

**DRY — no duplicate logic.** Before writing a helper, check `src/utils/`. If logic is used more than once, extract it to a utility or shared service. Never copy-paste a block of code across services.

**Reusable logic belongs in utils or shared services.** Business logic that spans modules (distance calc, password hashing, Prisma error handling) lives in `src/utils/`. Module-specific helpers stay inside the module.

**Wrap all Prisma writes in `try/catch` and call `prismaError(error)`.** This converts database constraint violations (P2002) and not-found errors (P2025) into the correct NestJS HTTP exceptions so the client gets a clean error response.

**Comments only when the WHY is non-obvious.** Do not comment what the code does — name it well instead. Add a comment only to explain a hidden constraint, a workaround, or behaviour that would surprise a reader.

**Keep services thin.** Controllers handle HTTP concerns (decorators, response shaping). Services handle business logic. No Prisma queries in controllers; no HTTP concepts in services.

**Follow the existing module pattern.** Every feature is a NestJS module with a controller, a service, a `dto/` folder, and an `entities/` folder if needed. Register the module in `app.module.ts`.

**Never trust `userId` from the frontend payload for authorization.** Always use `req.user.id` from the verified JWT. The only two trusted sources for identity are `req.user.id` (JWT) and the DB record. Client-provided IDs are input data only, never identity proof.

**Ownership check pattern — private `assertOwner()` in the service.** When an endpoint requires the requesting user to be the resource owner or an admin, add a private helper to the service:
```ts
private async assertOwner(id: string, requesterId: string, role: UserRole) {
  const record = await this.prisma.<model>.findUnique({ where: { id } });
  if (!record) throw new NotFoundException();
  if (record.userId !== requesterId && role !== UserRole.ADMIN)
    throw new ForbiddenException();
  return record; // reuse in the calling method — no second query needed
}
```
Do not put ownership logic in the controller. Do not create a guard for a single resource — guards are only justified when the same ownership check spans many resources.

**Every mutation endpoint that can be abused needs a `@Throttle()` override.** The global 30 req/60s is a fallback, not protection. Any endpoint that triggers an external call (email, Telegram, R2 upload), creates DB records in bulk, or can be used to inflate counters must have its own tighter `@Throttle` decorator. See `API/RATE-LIMIT.md` for current limits.

**Do not queue a job if the DB write depends on the result.** If the response or the next DB operation needs the outcome of the async work (e.g. an R2 image key that must be stored immediately), keep it synchronous. Queue only when the caller does not need the result — OTP delivery, view count increments, cleanup tasks.
