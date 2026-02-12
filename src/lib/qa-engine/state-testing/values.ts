/**
 * State Testing - Test value generators
 *
 * empty | invalid | boundary | valid
 * Supports: text, email, number, url, tel, password, search, date, time, month, week, datetime-local, checkbox, select, textarea.
 */

const LONG_STRING = 'a'.repeat(500);
const INVALID_EMAIL = 'abc';
const INVALID_NUMBER = '-999999';
const BOUNDARY_EMAIL = 'a@b.co';
const VALID_EMAIL = 'test@example.com';

export function getTestValues(
  type: string,
  input: { min?: number; max?: number; minLength?: number; maxLength?: number; pattern?: string }
): Record<string, string> {
  const typeLower = type.toLowerCase();

  return {
    empty: typeLower === 'checkbox' ? 'off' : '',
    invalid: getInvalidValue(typeLower, input),
    boundary: getBoundaryValue(typeLower, input),
    valid: getValidValue(typeLower, input),
  };
}

function getInvalidValue(type: string, input: { min?: number; max?: number; pattern?: string }): string {
  if (input.pattern) {
    return 'x'; // pattern expects something; single char often fails
  }
  switch (type) {
    case 'email':
      return INVALID_EMAIL;
    case 'number':
    case 'range':
      return INVALID_NUMBER;
    case 'url':
      return 'not-a-url';
    case 'tel':
      return 'abc';
    case 'date':
      return '2024-13-45';
    case 'time':
      return '25:00';
    case 'month':
      return '2024-13';
    case 'week':
      return '2024-W99';
    case 'datetime-local':
      return '2024-02-30T12:00';
    default:
      return LONG_STRING;
  }
}

function getBoundaryValue(
  type: string,
  input: { min?: number; max?: number; minLength?: number; maxLength?: number }
): string {
  switch (type) {
    case 'email':
      return BOUNDARY_EMAIL;
    case 'number':
    case 'range':
      if (input.min != null) return String(input.min);
      if (input.max != null) return String(input.max);
      return '0';
    case 'text':
    case 'search':
    case 'password':
      if (input.maxLength != null) return 'a'.repeat(Math.min(input.maxLength, 100));
      if (input.minLength != null) return 'a'.repeat(input.minLength);
      return 'x';
    case 'date':
      return '2024-01-15';
    case 'time':
      return '12:00';
    case 'month':
      return '2024-06';
    case 'week':
      return '2024-W01';
    case 'datetime-local':
      return '2024-01-15T12:00';
    case 'checkbox':
      return 'on';
    default:
      return 'x';
  }
}

function getValidValue(type: string, input: { min?: number; max?: number }): string {
  switch (type) {
    case 'email':
      return VALID_EMAIL;
    case 'number':
    case 'range':
      const mid = input.min != null && input.max != null
        ? Math.floor((input.min + input.max) / 2)
        : 42;
      return String(mid);
    case 'url':
      return 'https://example.com';
    case 'tel':
      return '+1234567890';
    case 'text':
    case 'search':
    case 'password':
      return 'Valid input';
    case 'date':
      return '2024-06-15';
    case 'time':
      return '14:30';
    case 'month':
      return '2024-06';
    case 'week':
      return '2024-W24';
    case 'datetime-local':
      return '2024-06-15T14:30';
    case 'checkbox':
      return 'on';
    default:
      return 'Valid';
  }
}
