const FIELD_NAMES = new Set(['full_name', 'email', 'password', 'password_confirm']);
const REQUEST_ERROR = 'We could not complete your registration. Please try again.';
const NETWORK_ERROR = 'Unable to connect to the server. Check your connection and try again.';

export class RegistrationRequestError extends Error {
  constructor(message, fieldErrors = {}) {
    super(message);
    this.name = 'RegistrationRequestError';
    this.fieldErrors = fieldErrors;
  }
}

function safeMessage(value, sensitiveValues = []) {
  if (typeof value !== 'string') return '';

  const message = value
    .replace(/^Value error,\s*/i, '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim();
  if (
    !message ||
    /traceback|stack(?:\s*trace)?|internal server|sql(?:alchemy)?|database error|[a-z]+(?:error|exception):|password\s*[:=]|token\s*[:=]|\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9._-]+/i.test(message) ||
    sensitiveValues.some((value) => message.toLowerCase().includes(value.toLowerCase()))
  ) {
    return '';
  }
  return message.slice(0, 240);
}

function fieldFromLocation(location) {
  if (!Array.isArray(location)) return null;
  return location.find((part) => typeof part === 'string' && FIELD_NAMES.has(part)) || null;
}

function validationMessage(error, field, sensitiveValues) {
  if (
    error.type === 'string_too_short' &&
    (field === 'password' || field === 'password_confirm') &&
    Number.isInteger(error.ctx?.min_length)
  ) {
    const label = field === 'password' ? 'Password' : 'Confirm password';
    return `${label} must contain at least ${error.ctx.min_length} characters.`;
  }
  if (error.type === 'string_too_short' && field === 'full_name' && Number.isInteger(error.ctx?.min_length)) {
    return `Full name must contain at least ${error.ctx.min_length} characters.`;
  }
  if (field === 'email' && error.type === 'value_error') {
    return 'Enter a valid email address.';
  }
  return safeMessage(error.msg ?? error.message, sensitiveValues);
}

function extractErrors(body, sensitiveValues) {
  const fieldErrors = {};
  const generalErrors = [];

  const addMessage = (value, field = null) => {
    const message = safeMessage(value, sensitiveValues);
    if (!message) return;
    if (field) {
      fieldErrors[field] = [...(fieldErrors[field] || []), message];
    } else {
      generalErrors.push(message);
    }
  };

  const visit = (value, fieldHint = null, depth = 0) => {
    if (depth > 4 || value == null) return;
    if (typeof value === 'string') {
      addMessage(value, fieldHint);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
          const field = fieldFromLocation(entry.loc) || (FIELD_NAMES.has(entry.field) ? entry.field : fieldHint);
          const message = validationMessage(entry, field, sensitiveValues);
          if (message) addMessage(message, field);
        } else {
          visit(entry, fieldHint, depth + 1);
        }
      });
      return;
    }
    if (typeof value !== 'object') return;

    if (Array.isArray(value.loc) || typeof value.msg === 'string') {
      const field = fieldFromLocation(value.loc) || (FIELD_NAMES.has(value.field) ? value.field : fieldHint);
      const message = validationMessage(value, field, sensitiveValues);
      if (message) addMessage(message, field);
      return;
    }

    let foundKnownShape = false;
    for (const key of ['detail', 'message', 'error', 'errors', 'field_errors']) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        foundKnownShape = true;
        visit(value[key], fieldHint, depth + 1);
      }
    }
    for (const [key, nestedValue] of Object.entries(value)) {
      if (FIELD_NAMES.has(key)) {
        foundKnownShape = true;
        visit(nestedValue, key, depth + 1);
      }
    }
    if (!foundKnownShape && typeof value.message === 'string') addMessage(value.message, fieldHint);
  };

  visit(body);
  const unique = (messages) => [...new Set(messages)];
  return {
    fieldErrors: Object.fromEntries(
      Object.entries(fieldErrors).map(([field, messages]) => [field, unique(messages).join(' ')])
    ),
    generalMessage: unique(generalErrors).join(' '),
  };
}

export async function registerUser(payload) {
  let response;
  try {
    response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new RegistrationRequestError(NETWORK_ERROR);
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    // Non-JSON error responses use the same safe fallback as other unknown API errors.
  }

  if (!response.ok) {
    if (response.status >= 500) {
      throw new RegistrationRequestError(REQUEST_ERROR);
    }
    const sensitiveValues = [payload.password, payload.password_confirm].filter(
      (value) => typeof value === 'string' && value.length >= 8
    );
    const { fieldErrors, generalMessage } = extractErrors(data, sensitiveValues);
    if (generalMessage || Object.keys(fieldErrors).length > 0) {
      throw new RegistrationRequestError(generalMessage, fieldErrors);
    }
    throw new RegistrationRequestError(REQUEST_ERROR);
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new RegistrationRequestError(REQUEST_ERROR);
  }
  return data;
}
