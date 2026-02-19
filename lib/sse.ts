export async function* readSSEStream<T>(response: Response): AsyncGenerator<T> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error("No response body")

  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n\n")
    buffer = lines.pop() ?? ""

    for (const line of lines) {
      const data = line.replace(/^data: /, "").trim()
      if (!data) continue

      try {
        yield JSON.parse(data) as T
      } catch {
        // Skip malformed JSON chunks
      }
    }
  }
}
