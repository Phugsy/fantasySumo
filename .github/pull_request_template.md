## Summary

-

## Validation

- [ ] `make check`
- [ ] `make e2e`, or a documented reason it does not apply

## Database and deployment safety

- [ ] No database schema change
- [ ] Schema change is backward-compatible with the currently deployed code
- [ ] Expand/contract follow-up is recorded if old schema will be removed later
- [ ] Preview migration was exercised against Postgres where applicable

Never combine adoption and destructive removal in one release. Recovery uses a
forward fix or compatible application rollback, not automatic down migrations.
