// Email validation
export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Password validation (minimum 6 characters)
export function isValidPassword(password) {
  return password && password.length >= 6;
}

import { parseISO, isValid, isFuture, isAfter } from 'date-fns';

// Date validation
export function isValidDate(dateString) {
  if (!dateString) return false;
  try {
    const date = parseISO(dateString);
    return isValid(date);
  } catch {
    return false;
  }
}

// Check if date is not in the future
export function isNotFutureDate(dateString) {
  if (!dateString) return false;
  try {
    const date = parseISO(dateString);
    return isValid(date) && !isFuture(date);
  } catch {
    return false;
  }
}

// Validate date range
export function isValidDateRange(startDate, endDate) {
  if (!startDate || !endDate) return false;
  try {
    const start = parseISO(startDate);
    const end = parseISO(endDate);

    if (!isValid(start) || !isValid(end)) {
      return false;
    }

    return !isAfter(start, end);
  } catch {
    return false;
  }
}

// Sanitize string input
export function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, 500); // Limit to 500 chars
}

// Validate required fields
export function validateRequiredFields(data, fields) {
  const missing = [];

  for (const field of fields) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      missing.push(field);
    }
  }

  return {
    valid: missing.length === 0,
    missing
  };
}

// Validate number in range
export function isInRange(value, min, max) {
  const num = Number(value);
  return !isNaN(num) && num >= min && num <= max;
}

// Parse and validate integer
export function parseIntOrDefault(value, defaultValue = null) {
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

// Validate pagination parameters
export function validatePagination(page, limit) {
  const validPage = Math.max(1, parseIntOrDefault(page, 1));
  const validLimit = Math.min(100, Math.max(1, parseIntOrDefault(limit, 20)));

  return {
    page: validPage,
    limit: validLimit,
    offset: (validPage - 1) * validLimit
  };
}