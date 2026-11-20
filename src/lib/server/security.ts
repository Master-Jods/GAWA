import { NextResponse } from "next/server";

/**
 * Validates whether a given string is a valid UUID v4 format.
 */
export function isValidUUID(id: unknown): boolean {
  if (typeof id !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id.trim()
  );
}

/**
 * Strips HTML tags, script characters, and control characters to prevent XSS.
 */
export function sanitizeString(
  input: unknown,
  maxLength = 255,
  defaultValue = ""
): string {
  if (typeof input !== "string") return defaultValue;
  const stripped = input
    .replace(/<[^>]*>?/gm, "") // Strip HTML tags
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "") // Strip control characters
    .trim();
  return stripped.slice(0, maxLength);
}

/**
 * Sanitizes multiline text content (preserves safe newlines while stripping dangerous HTML/scripts).
 */
export function sanitizeMultiline(
  input: unknown,
  maxLength = 10000,
  defaultValue = ""
): string {
  if (typeof input !== "string") return defaultValue;
  const stripped = input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<[^>]*>?/gm, "")
    .replace(/[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "")
    .trim();
  return stripped.slice(0, maxLength);
}

/**
 * Sanitizes an array of strings with element-wise limits.
 */
export function sanitizeStringArray(
  input: unknown,
  maxItems = 20,
  maxItemLength = 150
): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .slice(0, maxItems)
    .map((item) => sanitizeString(item, maxItemLength))
    .filter((s) => s.length > 0);
}

/**
 * Validates and clamps a number within boundaries.
 */
export function clampNumber(
  input: unknown,
  min: number,
  max: number,
  defaultValue = min
): number {
  const num = Number(input);
  if (isNaN(num) || !isFinite(num)) return defaultValue;
  return Math.min(Math.max(num, min), max);
}

/**
 * Validates an input against an allowed enum list.
 */
export function validateEnum<T extends string>(
  value: unknown,
  allowedValues: readonly T[],
  defaultValue?: T
): T | null {
  if (typeof value === "string" && allowedValues.includes(value as T)) {
    return value as T;
  }
  return defaultValue !== undefined ? defaultValue : null;
}

/**
 * Standardized JSON success response with security headers.
 */
export function jsonResponse(
  data: Record<string, any>,
  status = 200,
  customHeaders?: Record<string, string>
): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: {
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      ...(customHeaders || {}),
    },
  });
}

/**
 * Standardized JSON error response with security headers.
 */
export function errorResponse(
  message: string,
  status = 400,
  details?: unknown
): NextResponse {
  const body: Record<string, any> = { error: message };
  if (details && process.env.NODE_ENV !== "production") {
    body.details = details;
  }
  return NextResponse.json(body, {
    status,
    headers: {
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
