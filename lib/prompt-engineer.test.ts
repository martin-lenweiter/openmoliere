import { describe, it, expect } from "vitest"
import { parsePromptEngineerResponse } from "./prompt-engineer"

describe("parsePromptEngineerResponse", () => {
  it("returns full text and no questions when no delimiter present", () => {
    const response = "Improved prompt text here.\n\n---\n\n## What I changed\n\n- **Added clarity:** Made the task explicit"
    const result = parsePromptEngineerResponse(response)
    expect(result.fullText).toBe(response)
    expect(result.questions).toEqual([])
  })

  it("splits on delimiter and parses questions", () => {
    const response = [
      "Improved prompt.",
      "",
      "---",
      "",
      "## What I changed",
      "",
      "- **Added examples:** Helps the model understand expected format",
      "---QUESTIONS_JSON---",
      JSON.stringify([
        { question: "What audience is this for?", type: "text", placeholder: "e.g., developers" },
        { question: "Include code examples?", type: "boolean" },
      ]),
    ].join("\n")

    const result = parsePromptEngineerResponse(response)
    expect(result.fullText).toBe(
      "Improved prompt.\n\n---\n\n## What I changed\n\n- **Added examples:** Helps the model understand expected format"
    )
    expect(result.questions).toHaveLength(2)
    expect(result.questions[0].question).toBe("What audience is this for?")
    expect(result.questions[0].type).toBe("text")
    expect(result.questions[0].placeholder).toBe("e.g., developers")
    expect(result.questions[1].type).toBe("boolean")
  })

  it("handles malformed JSON after delimiter", () => {
    const response = "Prompt text\n---QUESTIONS_JSON---\n{not valid json"
    const result = parsePromptEngineerResponse(response)
    expect(result.fullText).toBe("Prompt text")
    expect(result.questions).toEqual([])
  })

  it("caps questions at 3", () => {
    const questions = Array.from({ length: 5 }, (_, i) => ({
      question: `Question ${i + 1}`,
      type: "text",
    }))
    const response = `Prompt\n---QUESTIONS_JSON---\n${JSON.stringify(questions)}`
    const result = parsePromptEngineerResponse(response)
    expect(result.questions).toHaveLength(3)
  })

  it("filters out entries missing question field", () => {
    const response = `Prompt\n---QUESTIONS_JSON---\n${JSON.stringify([
      { type: "text" },
      { question: "Valid?", type: "boolean" },
      null,
      "not an object",
    ])}`
    const result = parsePromptEngineerResponse(response)
    expect(result.questions).toHaveLength(1)
    expect(result.questions[0].question).toBe("Valid?")
  })

  it("defaults unknown question type to text", () => {
    const response = `Prompt\n---QUESTIONS_JSON---\n${JSON.stringify([
      { question: "Something?", type: "unknown_type" },
    ])}`
    const result = parsePromptEngineerResponse(response)
    expect(result.questions[0].type).toBe("text")
  })

  it("does not confuse --- in prompt text with the delimiter", () => {
    const response = [
      "Step 1: Do this",
      "",
      "---",
      "",
      "Step 2: Do that",
      "",
      "---",
      "",
      "## What I changed",
      "",
      "- **Clarity:** Better steps",
      "---QUESTIONS_JSON---",
      "[]",
    ].join("\n")

    const result = parsePromptEngineerResponse(response)
    expect(result.fullText).toContain("Step 1: Do this")
    expect(result.fullText).toContain("Step 2: Do that")
    expect(result.questions).toEqual([])
  })

  it("handles empty response", () => {
    const result = parsePromptEngineerResponse("")
    expect(result.fullText).toBe("")
    expect(result.questions).toEqual([])
  })

  it("parses choice type with options", () => {
    const response = `Prompt\n---QUESTIONS_JSON---\n${JSON.stringify([
      {
        question: "Pick a format",
        type: "choice",
        options: ["JSON", "CSV", "XML"],
      },
    ])}`
    const result = parsePromptEngineerResponse(response)
    expect(result.questions[0].type).toBe("choice")
    expect(result.questions[0].options).toEqual(["JSON", "CSV", "XML"])
  })

  it("omits options and placeholder when not present", () => {
    const response = `Prompt\n---QUESTIONS_JSON---\n${JSON.stringify([
      { question: "Yes or no?", type: "boolean" },
    ])}`
    const result = parsePromptEngineerResponse(response)
    expect(result.questions[0]).not.toHaveProperty("options")
    expect(result.questions[0]).not.toHaveProperty("placeholder")
  })
})
