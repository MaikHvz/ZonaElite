import crypto from "crypto";
import querystring from "querystring";

const config = {
  apiUrl: process.env.FLOW_API_URL || "https://sandbox.flow.cl/api",
  apiKey: process.env.FLOW_API_KEY || "",
  secretKey: process.env.FLOW_SECRET_KEY || "",
};

function signFlowParams(params: Record<string, string>): string {
  const keys = Object.keys(params).sort();
  let toSign = "";
  for (const key of keys) {
    toSign += key + params[key];
  }
  return crypto
    .createHmac("sha256", config.secretKey)
    .update(toSign)
    .digest("hex");
}

interface CreateOrderParams {
  commerceOrder: string;
  subject: string;
  amount: number;
  email: string;
  urlConfirmation: string;
  urlReturn: string;
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
  const signParams: Record<string, string> = {
    apiKey: config.apiKey,
    commerceOrder: params.commerceOrder,
    subject: params.subject,
    currency: "CLP",
    amount: String(params.amount),
    email: params.email,
    urlConfirmation: params.urlConfirmation,
    urlReturn: params.urlReturn,
  };

  if (params.metadata) {
    signParams.optional = JSON.stringify(params.metadata);
  }

  const s = signFlowParams(signParams);
  const body = { ...signParams, s };

  const response = await fetch(`${config.apiUrl}/payment/create`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: querystring.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("Flow create error:", response.status, text);
    throw new Error("Error al crear orden de pago");
  }

  return response.json();
}

interface VerifyResult {
  status: number;
  amount: number;
  commerceOrder: string;
  flowOrder: number;
}

export async function verifyFlowPayment(
  token: string
): Promise<VerifyResult> {
  const signParams: Record<string, string> = {
    apiKey: config.apiKey,
    token,
  };
  const s = signFlowParams(signParams);

  const response = await fetch(
    `${config.apiUrl}/payment/getStatus?apiKey=${config.apiKey}&token=${token}&s=${s}`,
    { method: "GET" }
  );

  if (!response.ok) {
    const text = await response.text();
    console.error("Flow verify error:", response.status, text);
    throw new Error("Error al verificar pago");
  }

  return response.json();
}

export function getFlowConfig() {
  return {
    apiUrl: config.apiUrl,
    apiKey: config.apiKey,
  };
}
