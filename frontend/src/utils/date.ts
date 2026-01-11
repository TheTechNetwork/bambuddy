/**
 * Date utilities for handling UTC timestamps from the backend.
 *
 * The backend stores all timestamps in UTC without timezone indicators.
 * These utilities ensure dates are properly interpreted as UTC and
 * displayed in the user's local timezone.
 */

export type TimeFormat = 'system' | '12h' | '24h';

/**
 * Apply time format setting to Intl.DateTimeFormatOptions.
 * This modifies the options object in place and returns it.
 */
export function applyTimeFormat(
  options: Intl.DateTimeFormatOptions,
  timeFormat: TimeFormat = 'system'
): Intl.DateTimeFormatOptions {
  if (timeFormat === '12h') {
    options.hour12 = true;
  } else if (timeFormat === '24h') {
    options.hour12 = false;
  }
  // 'system' leaves hour12 undefined, letting the browser decide
  return options;
}

/**
 * Parse a date string from the backend as UTC.
 * Handles ISO 8601 strings with or without timezone indicators.
 *
 * @param dateStr - Date string from backend (e.g., "2026-01-09T12:03:36.288768")
 * @returns Date object in local timezone
 */
export function parseUTCDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;

  // If the string already has a timezone indicator, parse as-is
  if (dateStr.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateStr)) {
    return new Date(dateStr);
  }

  // Otherwise, append 'Z' to interpret as UTC
  return new Date(dateStr + 'Z');
}

/**
 * Format a UTC date string to a localized date/time string.
 *
 * @param dateStr - Date string from backend
 * @param options - Intl.DateTimeFormat options (defaults to showing date and time)
 * @returns Formatted date string in user's locale and timezone
 */
export function formatDate(
  dateStr: string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  const date = parseUTCDate(dateStr);
  if (!date) return '';

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };

  return date.toLocaleString(undefined, options ?? defaultOptions);
}

/**
 * Format a UTC date string to a localized date-only string.
 *
 * @param dateStr - Date string from backend
 * @param options - Intl.DateTimeFormat options
 * @returns Formatted date string in user's locale and timezone
 */
export function formatDateOnly(
  dateStr: string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  const date = parseUTCDate(dateStr);
  if (!date) return '';

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };

  return date.toLocaleDateString(undefined, options ?? defaultOptions);
}

/**
 * Format a UTC date string to a localized date/time string with time format support.
 *
 * @param dateStr - Date string from backend
 * @param timeFormat - Time format setting ('system', '12h', '24h')
 * @param options - Intl.DateTimeFormat options (defaults to showing date and time)
 * @returns Formatted date string in user's locale and timezone
 */
export function formatDateTime(
  dateStr: string | null | undefined,
  timeFormat: TimeFormat = 'system',
  options?: Intl.DateTimeFormatOptions
): string {
  const date = parseUTCDate(dateStr);
  if (!date) return '';

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };

  const finalOptions = applyTimeFormat(options ?? defaultOptions, timeFormat);
  return date.toLocaleString(undefined, finalOptions);
}

/**
 * Format a Date object to a localized time string with time format support.
 *
 * @param date - Date object
 * @param timeFormat - Time format setting ('system', '12h', '24h')
 * @param options - Additional Intl.DateTimeFormat options
 * @returns Formatted time string
 */
export function formatTimeOnly(
  date: Date,
  timeFormat: TimeFormat = 'system',
  options?: Intl.DateTimeFormatOptions
): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
  };

  const finalOptions = applyTimeFormat({ ...defaultOptions, ...options }, timeFormat);
  return date.toLocaleTimeString([], finalOptions);
}
