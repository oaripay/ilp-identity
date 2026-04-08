import { getNodes as getStoredNodes, putNodes as putStoredNodes } from './db/storage.ts'
import type { AppContext } from './types.ts'

export function getNodes(ctx: AppContext) {
	return getStoredNodes(ctx.db)
}

export function setNodes(ctx: AppContext, urls: string[]) {
	return putStoredNodes(ctx.db, urls)
}
