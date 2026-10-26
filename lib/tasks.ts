import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

export type TaskStatus = "todo" | "doing" | "done";
export type TaskRepeat = "daily" | "weekly";
export type TaskPoints = 1 | 3 | 5;

export type TaskCompletion = {
  taskId: string;
  title: string;
  assignee?: string;
  points: TaskPoints;
  completedAt: string;
  completedOn: string;
  dueBefore?: string;
};

export type Task = {
  id: string;
  title: string;
  status: TaskStatus;
  points: TaskPoints;
  assignee?: string;
  room?: string;
  due?: string;
  repeat?: TaskRepeat;
  createdAt: string;
  completionHistory?: TaskCompletion[];
};

export type NewTask = Omit<Task, "id" | "createdAt">;
export type TaskChanges = Partial<Omit<Task, "id" | "createdAt">>;

const dataDirectory = path.join(process.cwd(), "data");
const tasksFile = path.join(dataDirectory, "tasks.json");

let taskQueue: Promise<void> = Promise.resolve();
type DatabaseClient = NeonQueryFunction<false, false>;

let databaseClient: DatabaseClient | undefined;

function getDatabase() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    if (process.env.VERCEL || process.env.NODE_ENV === "production") {
      throw new Error("DATABASE_URL must be configured for persistent task storage.");
    }
    return null;
  }
  if (!databaseClient) databaseClient = neon<false, false>(connectionString);
  return databaseClient;
}

async function ensureDatabase(sql: DatabaseClient): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS household_tasks (
      id text PRIMARY KEY,
      data jsonb NOT NULL
    )
  `;
}

async function readDatabaseTasks(sql: DatabaseClient): Promise<Task[]> {
  await ensureDatabase(sql);
  const rows = await sql`SELECT data FROM household_tasks`;
  return rows.map((row) => {
    const task = parseTask(row.data);
    if (!task) throw new Error("Database contains an invalid household task.");
    return task;
  });
}

async function writeDatabaseTask(
  sql: DatabaseClient,
  task: Task,
): Promise<void> {
  await sql`
    INSERT INTO household_tasks (id, data)
    VALUES (${task.id}, ${JSON.stringify(task)}::jsonb)
    ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data
  `;
}

function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const result = taskQueue.then(operation);
  taskQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function readFileTasks(): Promise<Task[]> {
  try {
    const contents: unknown = JSON.parse(await readFile(tasksFile, "utf8"));
    if (!Array.isArray(contents)) {
      throw new Error("Task data must be a JSON array.");
    }
    return contents.map((value) => {
      if (!isRecord(value)) {
        throw new Error("Task data contains an invalid task.");
      }

      const points = value.points === undefined ? 1 : value.points;
      if (!isTaskPoints(points)) {
        throw new Error("Task data contains an invalid points value.");
      }

      return { ...value, points } as Task;
    });
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return [];
    }
    throw error;
  }
}

async function writeFileTasks(tasks: Task[]): Promise<void> {
  await mkdir(dataDirectory, { recursive: true });
  const temporaryFile = `${tasksFile}.${randomUUID()}.tmp`;
  await writeFile(temporaryFile, `${JSON.stringify(tasks, null, 2)}\n`, "utf8");
  await rename(temporaryFile, tasksFile);
}

export function getTasks(): Promise<Task[]> {
  return serialize(async () => {
    const sql = getDatabase();
    const tasks = sql ? await readDatabaseTasks(sql) : await readFileTasks();
    const today = localDateString(new Date());
    let changed = false;
    const updated = tasks.map((task) => {
      if (
        task.status !== "done" ||
        !task.repeat ||
        !task.due ||
        task.due > today
      ) {
        return task;
      }

      let due = task.due;
      while (due < today) {
        due = addDays(due, task.repeat === "daily" ? 1 : 7);
      }
      changed = true;
      const completionHistory =
        task.completionHistory?.length || !task.due
          ? task.completionHistory
          : [
              {
                taskId: task.id,
                title: task.title,
                ...(task.assignee && { assignee: task.assignee }),
                points: task.points,
                completedAt: new Date(
                  `${task.due}T23:59:59.000Z`,
                ).toISOString(),
                completedOn: task.due,
              },
            ];
      return {
        ...task,
        due,
        status: "todo" as const,
        ...(completionHistory && { completionHistory }),
      };
    });

    if (changed) {
      if (sql) {
        await sql.transaction(
          updated
            .filter((task, index) => task !== tasks[index])
            .map(
              (task) => sql`
                UPDATE household_tasks
                SET data = ${JSON.stringify(task)}::jsonb
                WHERE id = ${task.id}
              `,
            ),
        );
      } else {
        await writeFileTasks(updated);
      }
    }
    return updated;
  });
}

export function createTask(input: NewTask): Promise<Task> {
  return createTasks([input]).then(([task]) => task);
}

export function createTasks(inputs: NewTask[]): Promise<Task[]> {
  return serialize(async () => {
    const sql = getDatabase();
    const created = inputs.map(
      (input): Task => ({
        ...input,
        id: randomUUID(),
        createdAt: new Date().toISOString(),
      }),
    );
    if (sql) {
      await ensureDatabase(sql);
      await sql.transaction(
        created.map(
          (task) => sql`
            INSERT INTO household_tasks (id, data)
            VALUES (${task.id}, ${JSON.stringify(task)}::jsonb)
          `,
        ),
      );
    } else {
      const tasks = await readFileTasks();
      await writeFileTasks([...created, ...tasks]);
    }
    return created;
  });
}

export function updateTask(
  id: string,
  changes: TaskChanges,
  completedOn?: string,
): Promise<Task | null> {
  return serialize(async () => {
    const sql = getDatabase();
    if (sql) {
      const tasks = await readDatabaseTasks(sql);
      const previous = tasks.find((task) => task.id === id);
      if (!previous) return null;
      const updated = applyTaskChanges(previous, changes, completedOn);
      await writeDatabaseTask(sql, updated);
      return updated;
    }
    const tasks = await readFileTasks();
    const index = tasks.findIndex((task) => task.id === id);
    if (index === -1) return null;

    const updated = applyTaskChanges(tasks[index], changes, completedOn);
    tasks[index] = updated;
    await writeFileTasks(tasks);
    return updated;
  });
}

export function deleteTask(id: string): Promise<Task | null> {
  return serialize(async () => {
    const sql = getDatabase();
    if (sql) {
      const tasks = await readDatabaseTasks(sql);
      const deleted = tasks.find((task) => task.id === id);
      if (!deleted) return null;
      await sql`DELETE FROM household_tasks WHERE id = ${id}`;
      return deleted;
    }
    const tasks = await readFileTasks();
    const deleted = tasks.find((task) => task.id === id);
    if (!deleted) return null;

    await writeFileTasks(tasks.filter((task) => task.id !== id));
    return deleted;
  });
}

export function restoreTask(task: Task): Promise<Task> {
  return serialize(async () => {
    const sql = getDatabase();
    if (sql) {
      await ensureDatabase(sql);
      await sql`
        INSERT INTO household_tasks (id, data)
        VALUES (${task.id}, ${JSON.stringify(task)}::jsonb)
      `;
      return task;
    }
    const tasks = await readFileTasks();
    if (tasks.some((existing) => existing.id === task.id)) {
      throw new Error("A task with this id already exists.");
    }
    await writeFileTasks([task, ...tasks]);
    return task;
  });
}

function applyTaskChanges(
  previous: Task,
  changes: TaskChanges,
  completedOn?: string,
): Task {
  const updated = { ...previous, ...changes };
  if (changes.status === "done" && previous.status !== "done") {
    const completedAt = new Date().toISOString();
    const completionDate = completedOn ?? localDateString(new Date());
    const completion: TaskCompletion = {
      taskId: updated.id,
      title: updated.title,
      ...(updated.assignee && { assignee: updated.assignee }),
      points: updated.points,
      completedAt,
      completedOn: completionDate,
      ...(previous.due && { dueBefore: previous.due }),
    };
    updated.completionHistory = [...(previous.completionHistory ?? []), completion];
    if (updated.repeat) {
      updated.due = addDays(
        completionDate,
        updated.repeat === "daily" ? 1 : 7,
      );
    }
  } else if (
    previous.status === "done" &&
    changes.status &&
    changes.status !== "done" &&
    previous.completionHistory?.length
  ) {
    const previousCompletion =
      previous.completionHistory[previous.completionHistory.length - 1];
    updated.completionHistory = previous.completionHistory.slice(0, -1);
    updated.due = previousCompletion.dueBefore;
  }
  return updated;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTaskStatus(value: unknown): value is TaskStatus {
  return value === "todo" || value === "doing" || value === "done";
}

function isTaskPoints(value: unknown): value is TaskPoints {
  return value === 1 || value === 3 || value === 5;
}

function isRepeat(value: unknown): value is TaskRepeat {
  return value === "daily" || value === "weekly";
}

export function isTaskDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value
  );
}

function isIsoDate(value: unknown): value is string {
  return isTaskDate(value);
}

function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1, day + days));
  return result.toISOString().slice(0, 10);
}

export function parseTask(value: unknown): Task | null {
  if (!isRecord(value)) return null;
  const parsed = parseNewTask(value);
  if (
    !parsed ||
    typeof value.id !== "string" ||
    !value.id ||
    typeof value.createdAt !== "string" ||
    !Number.isFinite(Date.parse(value.createdAt))
  ) {
    return null;
  }

  const completionHistory = value.completionHistory;
  if (
    completionHistory !== undefined &&
    (!Array.isArray(completionHistory) ||
      completionHistory.some((completion) => !isTaskCompletion(completion)))
  ) {
    return null;
  }

  return {
    ...parsed,
    id: value.id,
    createdAt: value.createdAt,
    ...(completionHistory && { completionHistory }),
  };
}

function isTaskCompletion(value: unknown): value is TaskCompletion {
  if (!isRecord(value)) return false;
  return (
    typeof value.taskId === "string" &&
    typeof value.title === "string" &&
    (value.assignee === undefined || typeof value.assignee === "string") &&
    isTaskPoints(value.points) &&
    typeof value.completedAt === "string" &&
    Number.isFinite(Date.parse(value.completedAt)) &&
    isTaskDate(value.completedOn) &&
    (value.dueBefore === undefined || isTaskDate(value.dueBefore))
  );
}

function optionalText(value: unknown): string | undefined | null {
  if (value === undefined || value === "") return undefined;
  if (typeof value !== "string") return null;
  return value.trim() || undefined;
}

export function parseNewTask(value: unknown): NewTask | null {
  if (!isRecord(value)) return null;

  const title = typeof value.title === "string" ? value.title.trim() : "";
  const assignee = optionalText(value.assignee);
  const room = optionalText(value.room);
  const due = value.due === "" ? undefined : value.due;
  const repeat = value.repeat === "" ? undefined : value.repeat;
  const status = value.status === undefined ? "todo" : value.status;
  const points = value.points === undefined ? 1 : value.points;

  if (
    !title ||
    !isTaskStatus(status) ||
    !isTaskPoints(points) ||
    assignee === null ||
    room === null ||
    (due !== undefined && !isIsoDate(due)) ||
    (repeat !== undefined && !isRepeat(repeat))
  ) {
    return null;
  }

  return {
    title,
    status,
    points,
    ...(assignee && { assignee }),
    ...(room && { room }),
    ...(due && { due }),
    ...(repeat && { repeat }),
  };
}

export function parseTaskChanges(value: unknown): TaskChanges | null {
  if (!isRecord(value)) return null;

  const changes: TaskChanges = {};
  let hasChanges = false;

  if ("title" in value) {
    if (typeof value.title !== "string" || !value.title.trim()) return null;
    changes.title = value.title.trim();
    hasChanges = true;
  }

  if ("status" in value) {
    if (!isTaskStatus(value.status)) return null;
    changes.status = value.status;
    hasChanges = true;
  }

  if ("points" in value) {
    if (!isTaskPoints(value.points)) return null;
    changes.points = value.points;
    hasChanges = true;
  }

  if ("assignee" in value) {
    const assignee = optionalText(value.assignee);
    if (assignee === null) return null;
    changes.assignee = assignee;
    hasChanges = true;
  }

  if ("room" in value) {
    const room = optionalText(value.room);
    if (room === null) return null;
    changes.room = room;
    hasChanges = true;
  }

  if ("due" in value) {
    if (value.due === "") {
      changes.due = undefined;
    } else if (isIsoDate(value.due)) {
      changes.due = value.due;
    } else {
      return null;
    }
    hasChanges = true;
  }

  if ("repeat" in value) {
    if (value.repeat === "") {
      changes.repeat = undefined;
    } else if (isRepeat(value.repeat)) {
      changes.repeat = value.repeat;
    } else {
      return null;
    }
    hasChanges = true;
  }

  return hasChanges ? changes : null;
}
