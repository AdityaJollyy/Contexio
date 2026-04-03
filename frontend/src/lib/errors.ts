import axios from "axios";

interface ZodFieldError {
  _errors: string[];
}

interface ZodFormattedError {
  _errors: string[];
  [key: string]: ZodFieldError | string[];
}

/**
 * Extracts field-specific error messages from Zod's formatted error object
 */
function extractZodErrors(errors: ZodFormattedError): string[] {
  const messages: string[] = [];

  for (const [key, value] of Object.entries(errors)) {
    if (key === "_errors") continue;

    const fieldError = value as ZodFieldError;
    if (fieldError._errors && fieldError._errors.length > 0) {
      messages.push(...fieldError._errors);
    }
  }

  return messages;
}

/**
 * Extracts a user-friendly error message from an API error
 */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;

    // Check for Zod validation errors (field-specific messages)
    if (data?.errors) {
      const fieldErrors = extractZodErrors(data.errors);
      if (fieldErrors.length > 0) {
        return fieldErrors[0]; // Return the first validation error
      }
    }

    // Fall back to top-level message
    return data?.message ?? fallback;
  }

  return fallback;
}
