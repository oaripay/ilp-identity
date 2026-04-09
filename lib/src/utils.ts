import { ValidationError } from './errors.js'

export function ensureString(value: unknown, message: string): string {
	if (typeof value !== 'string' || value.length === 0)
		throw new ValidationError(message)
	return value
}
