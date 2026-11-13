export const PHONE_NUMBER_PATTERN: string
export const PHONE_FORMAT_ERROR: string
export function getPhoneDigits(value: unknown): string | null
export function normalizePhoneNumber(value: unknown): string | null
export function normalizeOptionalPhoneNumber(value: unknown): string | null
export function normalizeUpdatedPhoneNumber(value: unknown, current: string | null): string | null
export function phoneSearchPattern(value: string): string | null
