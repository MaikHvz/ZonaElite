import crypto from "crypto";
import querystring from "querystring";

const FLOW_LOG_PREFIX = "[flow-sdk]";

function getConfig() {
  const apiUrl = process.env.FLOW_API_URL || "https://sandbox.flow.cl/api";
  const apiKey = process.env.FLOW_API_KEY || "";
  const secretKey = process.env.FLOW_SECRET_KEY || "";

  if (!apiKey || !secretKey) {
    console.error(
      FLOW_LOG_PREFIX,
      "Missing FLOW_API_KEY or FLOW_SECRET_KEY env vars"
    );
  }

  return { apiUrl, apiKey, secretKey };
}

export function getFlowConfig() {
  const { apiUrl, apiKey } = getConfig();
  return { apiUrl, apiKey };
}

function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://zona-elite-six.vercel.app"
  );
}

function signFlowParams(
  params: Record<string, string>,
  secretKey: string
): string {
  const keys = Object.keys(params).sort();
  let toSign = "";
  for (const key of keys) {
    toSign += key + params[key];
  }
  return crypto
    .createHmac("sha256", secretKey)
    .update(toSign)
    .digest("hex");
}

function buildConfirmUrl(): string {
  return `${getBaseUrl()}/api/flow/confirmation`;
}

function buildReturnUrl(): string {
  return `${getBaseUrl()}/dashboard/pagos`;
}

interface CreateOrderParams {
  commerceOrder: string;
  subject: string;
  amount: number;
  email: string;
  metadata?: Record<string, string>;
}

interface CreateOrderResult {
  url: string;
  token: string;
  flowOrder: number;
}

export async function createFlowOrder(
  params: CreateOrderParams
): Promise<CreateOrderResult> {
  const { apiUrl, apiKey, secretKey } = getConfig();

  const signParams: Record<string, string> = {
    apiKey,
    commerceOrder: params.commerceOrder,
    subject: params.subject,
    currency: "CLP",
    amount: String(params.amount),
    email: params.email,
    urlConfirmation: buildConfirmUrl(),
    urlReturn: buildReturnUrl(),
  };

  if (params.metadata) {
    signParams.optional = JSON.stringify(params.metadata);
  }

  const s = signFlowParams(signParams, secretKey);
  const body = { ...signParams, s };

  console.log(FLOW_LOG_PREFIX, "Creating order:", {
    commerceOrder: params.commerceOrder,
    subject: params.subject,
    amount: params.amount,
    urlConfirmation: signParams.urlConfirmation,
    urlReturn: signParams.urlReturn,
  });

  const response = await fetch(`${apiUrl}/payment/create`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: querystring.stringify(body),
  });

  const text = await response.text();

  if (!response.ok) {
    console.error(
      FLOW_LOG_PREFIX,
      "Create order HTTP error:",
      response.status,
      text
    );
    throw new Error(
      `Flow API error (HTTP ${response.status}): ${response.statusText}`
    );
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    console.error(FLOW_LOG_PREFIX, "Invalid JSON from Flow:", text);
    throw new Error("Flow API returned invalid JSON");
  }

  if (data.error) {
    console.error(FLOW_LOG_PREFIX, "Flow API returned error:", data);
    throw new Error(
      `Flow API error: ${data.error_message || data.error || "Unknown"}`
    );
  }

  if (!data.url || !data.token) {
    console.error(FLOW_LOG_PREFIX, "Flow response missing url/token:", data);
    throw new Error("Flow API response missing required fields (url, token)");
  }

  console.log(FLOW_LOG_PREFIX, "Order created:", {
    flowOrder: data.flowOrder,
    token: data.token,
  });

  return data as unknown as CreateOrderResult;
}

interface VerifyResult {
  status: number;
  amount: number;
  commerceOrder: string;
  flowOrder: number;
  optional?: string;
}

export async function verifyFlowPayment(
  token: string
): Promise<VerifyResult> {
  const { apiUrl, apiKey, secretKey } = getConfig();

  const signParams: Record<string, string> = {
    apiKey,
    token,
  };
  const s = signFlowParams(signParams, secretKey);

  const url = `${apiUrl}/payment/getStatus?apiKey=${encodeURIComponent(apiKey)}&token=${encodeURIComponent(token)}&s=${encodeURIComponent(s)}`;

  console.log(FLOW_LOG_PREFIX, "Verifying payment, token:", token);

  const response = await fetch(url, { method: "GET" });

  const text = await response.text();

  if (!response.ok) {
    console.error(
      FLOW_LOG_PREFIX,
      "Verify HTTP error:",
      response.status,
      text
    );
    throw new Error(
      `Flow verify error (HTTP ${response.status}): ${response.statusText}`
    );
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    console.error(FLOW_LOG_PREFIX, "Invalid JSON from Flow verify:", text);
    throw new Error("Flow API returned invalid JSON on verify");
  }

  if (data.error) {
    console.error(FLOW_LOG_PREFIX, "Flow verify returned error:", data);
    throw new Error(
      `Flow verify error: ${data.error_message || data.error || "Unknown"}`
    );
  }

  const status = data.status as number;
  const statusLabels: Record<number, string> = {
    1: "pendiente",
    2: "pagado",
    3: "rechazado",
    4: "cancelado",
    5: "expirado",
  };

  console.log(FLOW_LOG_PREFIX, "Verify result:", {
    status,
    statusLabel: statusLabels[status] || "desconocido",
    flowOrder: data.flowOrder,
    commerceOrder: data.commerceOrder,
  });

  return data as unknown as VerifyResult;
}

export function verifyFlowCallbackSignature(
  body: Record<string, string>,
  receivedSignature: string
): boolean {
  const { secretKey } = getConfig();

  const keys = Object.keys(body).filter((k) => k !== "s").sort();
  let toSign = "";
  for (const key of keys) {
    toSign += key + body[key];
  }

  const expectedSignature = crypto
    .createHmac("sha256", secretKey)
    .update(toSign)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature, "hex"),
    Buffer.from(receivedSignature, "hex")
  );
}

export { FLOW_LOG_PREFIX };
