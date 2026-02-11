import { describe, it, expect } from "vitest"
import { parseClaudeResponse } from "./claude"

describe("parseClaudeResponse", () => {
  it("returns full response as correctedText when no delimiters present", () => {
    const response = "This is perfectly clean text."
    const result = parseClaudeResponse(response)
    expect(result.correctedText).toBe("This is perfectly clean text.")
    expect(result.errors).toEqual([])
    expect(result.language).toBe("en-US")
  })

  it("strips language and errors delimiters from corrected text", () => {
    const response = [
      "The corrected text here.",
      "---LANGUAGE: fr---",
      "---ERRORS_JSON---",
      '[]',
    ].join("\n")
    const result = parseClaudeResponse(response)
    expect(result.correctedText).toBe("The corrected text here.")
    expect(result.language).toBe("fr")
    expect(result.errors).toEqual([])
  })

  it("parses errors from JSON after delimiter", () => {
    const response = [
      "The corrected text.",
      "---LANGUAGE: en-US---",
      "---ERRORS_JSON---",
      JSON.stringify([
        {
          original: "teh",
          correction: "the",
          category: "spelling",
          rationale: "Misspelling",
          position: { offset: 0, length: 3 },
        },
      ]),
    ].join("\n")
    const result = parseClaudeResponse(response)
    expect(result.correctedText).toBe("The corrected text.")
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].original).toBe("teh")
    expect(result.errors[0].correction).toBe("the")
    expect(result.errors[0].category).toBe("spelling")
  })

  it("extracts various language codes", () => {
    for (const lang of ["fr", "en-US", "de-DE", "pt-BR"]) {
      const response = `Text.\n---LANGUAGE: ${lang}---\n---ERRORS_JSON---\n[]`
      expect(parseClaudeResponse(response).language).toBe(lang)
    }
  })

  it("defaults to en-US when no language line present", () => {
    const response = "Some text.\n---ERRORS_JSON---\n[]"
    expect(parseClaudeResponse(response).language).toBe("en-US")
  })

  it("handles malformed JSON after delimiter gracefully", () => {
    const response = "Corrected.\n---LANGUAGE: en---\n---ERRORS_JSON---\n{not valid json"
    const result = parseClaudeResponse(response)
    expect(result.correctedText).toBe("Corrected.")
    expect(result.errors).toEqual([])
  })

  it("preserves markdown horizontal rules (---) in content", () => {
    const response = [
      "Section one.",
      "",
      "---",
      "",
      "Section two.",
      "---LANGUAGE: en-US---",
      "---ERRORS_JSON---",
      "[]",
    ].join("\n")
    const result = parseClaudeResponse(response)
    expect(result.correctedText).toBe("Section one.\n\n---\n\nSection two.")
  })

  it("uses only the first language match when multiple are present", () => {
    const response = [
      "Text.",
      "---LANGUAGE: fr---",
      "---LANGUAGE: de---",
      "---ERRORS_JSON---",
      "[]",
    ].join("\n")
    const result = parseClaudeResponse(response)
    expect(result.language).toBe("fr")
  })

  it("handles multiline corrected text with paragraphs", () => {
    const response = [
      "First paragraph.",
      "",
      "Second paragraph.",
      "",
      "Third paragraph.",
      "---LANGUAGE: en-US---",
      "---ERRORS_JSON---",
      "[]",
    ].join("\n")
    const result = parseClaudeResponse(response)
    expect(result.correctedText).toBe(
      "First paragraph.\n\nSecond paragraph.\n\nThird paragraph."
    )
  })

  it("handles unknown category by defaulting to grammar", () => {
    const response = [
      "Fixed text.",
      "---LANGUAGE: en---",
      "---ERRORS_JSON---",
      JSON.stringify([
        {
          original: "a",
          correction: "b",
          category: "unknown_cat",
          rationale: "test",
          position: { offset: 0, length: 1 },
        },
      ]),
    ].join("\n")
    const result = parseClaudeResponse(response)
    expect(result.errors[0].category).toBe("grammar")
  })

  it("handles missing fields in error objects with defaults", () => {
    const response = [
      "Text.",
      "---ERRORS_JSON---",
      JSON.stringify([{}]),
    ].join("\n")
    const result = parseClaudeResponse(response)
    expect(result.errors[0]).toEqual({
      original: "",
      correction: "",
      category: "grammar",
      rationale: "",
      position: { offset: 0, length: 0 },
    })
  })
})
