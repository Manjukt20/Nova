export async function apiRequest(path, options = {}) {
  const method = options.method || 'GET'
  const headers = new Headers(options.headers || {})
  const body = options.body

  if (body !== undefined) headers.set('Content-Type', 'application/json')
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) headers.set('X-Requested-With', 'fetch')

  const response = await fetch(`/api${path}`, {
    ...options,
    method,
    headers,
    credentials: 'same-origin',
    body: body === undefined ? undefined : JSON.stringify(body)
  })

  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('The API did not return JSON. Check that the JavaScript API server is running.')
  }
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'The request could not be completed.')
  return result
}
