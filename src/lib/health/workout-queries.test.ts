import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: null as unknown,
  session: null as unknown,
}));

vi.mock("@/lib/db/client", () => ({
  getDb: () => mocks.db,
}));

vi.mock("@/lib/auth", () => ({
  auth: async () => mocks.session,
}));

import { DELETE as deleteWater } from "@/app/api/water-entries/[id]/route";
import { accessibleExerciseIds, workoutSetsFor } from "./workout-queries";

const dialect = new PgDialect();

describe("user-scoped data access", () => {
  beforeEach(() => {
    mocks.db = null;
    mocks.session = { user: { id: "user-a" } };
  });

  it("does not allow deleting another user's log by guessing its ID", async () => {
    const id = "550e8400-e29b-41d4-a716-446655440000";
    const where = vi.fn((condition: SQL) => {
      expect(condition).toBeDefined();
      return { returning: vi.fn().mockResolvedValue([]) };
    });
    mocks.db = {
      delete: vi.fn(() => ({ where })),
    };

    const response = await deleteWater(
      new Request(`https://vitals.test/api/water-entries/${id}`, {
        method: "DELETE",
      }),
    );
    const query = dialect.sqlToQuery(where.mock.calls[0]![0]);

    expect(response.status).toBe(404);
    expect(query.sql).toContain('"water_entries"."user_id" = $2');
    expect(query.params).toEqual([id, "user-a"]);
  });

  it("limits exercise references to the global catalog and the current user", async () => {
    const where = vi.fn().mockResolvedValue([{ id: "exercise-a" }]);
    mocks.db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({ where })),
      })),
    };

    await expect(
      accessibleExerciseIds(["exercise-a", "exercise-a", "exercise-b"], "user-a"),
    ).resolves.toEqual(["exercise-a"]);
    const query = dialect.sqlToQuery(where.mock.calls[0]![0] as SQL);

    expect(query.sql).toContain('"exercises"."user_id" is null');
    expect(query.sql).toContain('"exercises"."user_id" = $3');
    expect(query.params).toEqual(["exercise-a", "exercise-b", "user-a"]);
  });

  it("scopes workout set reads by both owner and requested workout IDs", async () => {
    const where = vi.fn((condition: SQL) => {
      expect(condition).toBeDefined();
      return { orderBy: vi.fn().mockResolvedValue([]) };
    });
    mocks.db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          leftJoin: vi.fn(() => ({ where })),
        })),
      })),
    };

    await workoutSetsFor("user-a", ["workout-a", "workout-b"]);
    const query = dialect.sqlToQuery(where.mock.calls[0]![0] as SQL);

    expect(query.sql).toContain('"workout_sets"."user_id" = $1');
    expect(query.sql).toContain('"workout_sets"."workout_id" in ($2, $3)');
    expect(query.params).toEqual(["user-a", "workout-a", "workout-b"]);
  });

  it("avoids a query when there are no exercise references", async () => {
    await expect(accessibleExerciseIds([], "user-a")).resolves.toEqual([]);
    expect(mocks.db).toBeNull();
  });
});
