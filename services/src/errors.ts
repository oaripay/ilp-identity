export interface ErrorDetails {
	expose?: boolean
	status?: number
	[key: string]: unknown
}

export class UserError extends Error {
	expose: boolean
	status: number

	constructor(message: string, details: ErrorDetails = {}) {
		super(message)
		this.name = 'UserError'
		this.expose = details.expose ?? true
		this.status = details.status ?? 400
		Object.assign(this, details)
	}
}
