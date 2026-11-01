import type { SQL } from "drizzle-orm";
import type { AppDatabase } from "./client.js";
type Row = Record<string, unknown>;
export async function executeStatements<T>(
  database: AppDatabase,
  operation: Generator<SQL, T, Row[]>,
): Promise<T> {
  if (database.provider === "sqlite")
    return database.db.transaction(
      (tx) => {
        let step = operation.next();
        while (!step.done) step = operation.next(tx.all(step.value) as Row[]);
        return step.value;
      },
      { behavior: "immediate" },
    );
  return database.db.transaction(async (tx) => {
    let step = operation.next();
    while (!step.done)
      step = operation.next((await tx.execute(step.value)) as Row[]);
    return step.value;
  });
}
