export function waitWithSignal<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
	if (!signal) {
		return promise
	}
	return new Promise((resolve, reject) => {
		let abort = () => reject(signal.reason)
		promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
		if (signal.aborted) {
			reject(signal.reason)
			return
		}
		signal.addEventListener('abort', abort, { once: true })
	})
}
