## Summary

-

## Validation

- [ ] `make check`
- [ ] `make e2e`, or a documented reason it does not apply

## Owner UAT for browser changes

- Preview URL and exact commit:
- Test account/role and fixture state:
- Numbered acceptance steps and expected results:
- Physical-device checks still needed (especially iOS keyboard):
- Owner acceptance or reported failures:

See `docs/UAT.md`. Automated checks and owner acceptance are separate evidence.

## Database and deployment safety

- [ ] No database schema change
- [ ] Schema change is backward-compatible with the currently deployed code
- [ ] Expand/contract follow-up is recorded if old schema will be removed later
- [ ] Preview migration was exercised against Postgres where applicable

Never combine adoption and destructive removal in one release. Recovery uses a
forward fix or compatible application rollback, not automatic down migrations.
