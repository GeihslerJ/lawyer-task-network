export function normalizeFirmCode(input) {
  const value = typeof input === 'string' ? input.trim().toUpperCase() : '';

  if (!value) {
    return null;
  }

  if (!/^[A-Z0-9_-]{3,30}$/.test(value)) {
    throw new Error('Firm code must be 3-30 chars using letters, numbers, dash, or underscore');
  }

  return value;
}
