export async function abortable<T>(signal: AbortSignal, promise: Promise<T>): Promise<T> {
	if (signal.aborted) {
		void promise.catch(() => {})
		throw signal.reason
	}

	let abortHandler: () => void
	let abortPromise = new Promise<T>((_, reject) => {
		abortHandler = () => reject(signal.reason)
		signal.addEventListener('abort', abortHandler, { once: true })
	})

	try {
		return await Promise.race<T>([promise, abortPromise])
	} finally {
		if (abortHandler!) signal.removeEventListener('abort', abortHandler)
	}
}
