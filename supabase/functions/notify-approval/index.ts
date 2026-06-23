const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ALLOWED_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type Task = {
  id?: string;
  title?: string;
  type?: string;
  due?: string;
  points?: number;
  pendingAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
};

type ApprovalRequest = {
  householdId?: string;
  taskId?: string;
  pendingAt?: string;
};

type SupabaseFetchInit = Omit<RequestInit, "headers"> & {
  headers?: Record<string, string>;
};

Deno.serve(async request => {
  if (request.method === "OPTIONS") {
    return jsonResponse({}, 204);
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await request.json() as ApprovalRequest;
    const householdId = String(body.householdId || "").trim();
    const taskId = String(body.taskId || "").trim();
    const pendingAt = String(body.pendingAt || "").trim();

    if (!householdId || !taskId || !pendingAt) {
      return jsonResponse({ error: "Missing householdId, taskId, or pendingAt" }, 400);
    }

    const task = await getPendingTask(householdId, taskId, pendingAt);
    if (!task) {
      return jsonResponse({ error: "Pending task has not synced yet" }, 409);
    }

    const logged = await logNotification(householdId, taskId, pendingAt);
    if (!logged) {
      return jsonResponse({ notified: false, skipped: "already-notified" });
    }

    await sendSms(task);
    return jsonResponse({ notified: true });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: "Notification failed" }, 500);
  }
});

async function getPendingTask(householdId: string, taskId: string, pendingAt: string): Promise<Task | null> {
  const row = await supabaseFetch(
    `/rest/v1/teen_task_state?household_id=eq.${encodeURIComponent(householdId)}&select=payload`,
    { method: "GET" }
  );
  const payload = Array.isArray(row) ? row[0]?.payload : null;
  const tasks = Array.isArray(payload?.tasks) ? payload.tasks as Task[] : [];
  return tasks.find(task => {
    return task.id === taskId &&
      task.pendingAt === pendingAt &&
      !task.completedAt &&
      !task.cancelledAt;
  }) || null;
}

async function logNotification(householdId: string, taskId: string, pendingAt: string): Promise<boolean> {
  const response = await supabaseFetch(
    "/rest/v1/teen_task_notifications?on_conflict=household_id,task_id,pending_at",
    {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify({
        household_id: householdId,
        task_id: taskId,
        pending_at: pendingAt
      })
    }
  );
  return Array.isArray(response) && response.length > 0;
}

async function sendSms(task: Task): Promise<void> {
  const accountSid = getRequiredEnv("TWILIO_ACCOUNT_SID");
  const authToken = getRequiredEnv("TWILIO_AUTH_TOKEN");
  const from = getRequiredEnv("TWILIO_FROM_NUMBER");
  const to = getRequiredEnv("APPROVAL_NOTIFY_TO_NUMBER");
  const appBaseUrl = Deno.env.get("APP_BASE_URL") || "";
  const title = task.title || "A case";
  const points = Number.isFinite(Number(task.points)) ? Number(task.points) : 0;
  const link = appBaseUrl ? `\n${appBaseUrl}` : "";
  const message = `Entropy Division: "${title}" is waiting for approval. Moral value +${points}.${link}`;
  const params = new URLSearchParams({
    To: to,
    From: from,
    Body: message
  });

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params
  });

  if (!response.ok) {
    throw new Error(`Twilio failed: ${await response.text()}`);
  }
}

async function supabaseFetch(path: string, init: SupabaseFetchInit): Promise<unknown> {
  const supabaseUrl = getRequiredEnv("SUPABASE_URL").replace(/\/$/, "");
  const serviceKey = getSupabaseServiceKey();
  const response = await fetch(`${supabaseUrl}${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...(init.headers || {})
    }
  });

  if (!response.ok) {
    throw new Error(`Supabase failed: ${await response.text()}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function getSupabaseServiceKey(): string {
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys);
      const key = parsed?.default || parsed?.service_role || parsed?.serviceRole || parsed?.secret;
      if (key) {
        return String(key);
      }
    } catch {
      // Fall through to the legacy single-secret name.
    }
  }
  return getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
}

function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}
