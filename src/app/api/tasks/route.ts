import {
  createTask,
  createTasks,
  getTasks,
  parseNewTask,
} from "../../../../lib/tasks";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await getTasks());
  } catch (error) {
    console.error("Failed to read tasks:", error);
    return Response.json({ error: "Could not read tasks." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  try {
    if (Array.isArray(body)) {
      if (body.length === 0 || body.length > 10) {
        return Response.json({ error: "Choose between 1 and 10 tasks." }, { status: 400 });
      }
      const parsedInputs = body.map(parseNewTask);
      const inputs = parsedInputs.filter((input) => input !== null);
      if (inputs.length !== parsedInputs.length) {
        return Response.json({ error: "Task details are invalid." }, { status: 400 });
      }
      return Response.json(await createTasks(inputs), { status: 201 });
    }
    const input = parseNewTask(body);
    if (!input) {
      return Response.json({ error: "Task details are invalid." }, { status: 400 });
    }
    return Response.json(await createTask(input), { status: 201 });
  } catch (error) {
    console.error("Failed to create task:", error);
    return Response.json({ error: "Could not create task." }, { status: 500 });
  }
}
