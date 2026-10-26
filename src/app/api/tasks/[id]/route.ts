import {
  deleteTask,
  parseTask,
  parseTaskChanges,
  restoreTask,
  isTaskDate,
  updateTask,
} from "../../../../../lib/tasks";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: RouteContext) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const changes = parseTaskChanges(body);
  if (!changes) {
    return Response.json({ error: "Task updates are invalid." }, { status: 400 });
  }

  try {
    const { id } = await params;
    const completionDate =
      typeof body === "object" &&
      body !== null &&
      "completedOn" in body &&
      isTaskDate(body.completedOn)
        ? body.completedOn
        : undefined;
    if (
      typeof body === "object" &&
      body !== null &&
      "completedOn" in body &&
      !isTaskDate(body.completedOn)
    ) {
      return Response.json({ error: "Completion date is invalid." }, { status: 400 });
    }
    const task = await updateTask(id, changes, completionDate);
    if (!task) {
      return Response.json({ error: "Task not found." }, { status: 404 });
    }
    return Response.json(task);
  } catch (error) {
    console.error("Failed to update task:", error);
    return Response.json({ error: "Could not update task." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const task = await deleteTask(id);
    if (!task) {
      return Response.json({ error: "Task not found." }, { status: 404 });
    }
    return Response.json(task);
  } catch (error) {
    console.error("Failed to delete task:", error);
    return Response.json({ error: "Could not delete task." }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const task = parseTask(body);
  if (!task) {
    return Response.json({ error: "Task details are invalid." }, { status: 400 });
  }

  try {
    const { id } = await params;
    if (task.id !== id) {
      return Response.json({ error: "Task id does not match." }, { status: 400 });
    }
    return Response.json(await restoreTask(task), { status: 201 });
  } catch (error) {
    console.error("Failed to restore task:", error);
    return Response.json({ error: "Could not restore task." }, { status: 500 });
  }
}
