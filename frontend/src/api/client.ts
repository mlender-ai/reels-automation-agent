import { getApiBaseUrl } from "../lib/media";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const API_BASE = getApiBaseUrl();

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!response.ok) {
    const detail =
      typeof data === "object" && data !== null && "detail" in data ? String((data as { detail?: unknown }).detail ?? "Request failed") : text || "Request failed";
    throw new ApiError(detail, response.status);
  }
  return data as T;
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      ...init,
    });
    return parseResponse<T>(response);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(`Unable to reach the local API at ${API_BASE}. Make sure the backend is running and retry.`, 0);
  }
}

export async function requestForm<T>(path: string, formData: FormData): Promise<T> {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      body: formData,
    });
    return parseResponse<T>(response);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(`Unable to reach the local API at ${API_BASE}. Make sure the backend is running and retry.`, 0);
  }
}
