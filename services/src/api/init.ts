import { initPublicApi } from './public.js'
import { initPrivateApi } from './private.js'
import { AppContext } from '../types.js'
import { info } from '../logger.js'

export async function initApi(ctx: AppContext) {
	ctx.api.public = initPublicApi(ctx)
	ctx.api.private = initPrivateApi(ctx)
}

export function stopApi(ctx: AppContext) {
	info(ctx, 'api', 'closing api servers')
	ctx.api?.public?.close()
	ctx.api?.private?.close()
}
