import { describe, expect, test } from "bun:test"
import path from "path"
import { resolveMtyCoderHome } from "@mty-coder/shared/global"

describe("resolveMtyCoderHome", () => {
  test("with MTYCODER_HOME set, resolves 4 subdirs under root", () => {
    const result = resolveMtyCoderHome({
      MTYCODER_HOME: "/tmp/profile-a",
    })
    expect(result.mode).toBe("mtycoder_home")
    expect(result.root).toBe("/tmp/profile-a")
    expect(result.config).toBe(path.join("/tmp/profile-a", "config"))
    expect(result.data).toBe(path.join("/tmp/profile-a", "data"))
    expect(result.state).toBe(path.join("/tmp/profile-a", "state"))
    expect(result.cache).toBe(path.join("/tmp/profile-a", "cache"))
  })

  test("without MTYCODER_HOME, falls through to xdg mode", () => {
    const result = resolveMtyCoderHome({})
    expect(result.mode).toBe("xdg")
    expect(result.root).toBeUndefined()
    // xdg paths end with "/mtycoder"
    expect(result.config.endsWith(path.join("", "mtycoder"))).toBe(true)
    expect(result.data.endsWith(path.join("", "mtycoder"))).toBe(true)
    expect(result.state.endsWith(path.join("", "mtycoder"))).toBe(true)
    expect(result.cache.endsWith(path.join("", "mtycoder"))).toBe(true)
  })

  test("empty MTYCODER_HOME string is treated as unset (xdg mode)", () => {
    const result = resolveMtyCoderHome({ MTYCODER_HOME: "" })
    expect(result.mode).toBe("xdg")
  })

  test("relative MTYCODER_HOME path throws with clear error", () => {
    expect(() => resolveMtyCoderHome({ MTYCODER_HOME: "./foo" })).toThrow(
      /MTYCODER_HOME must be an absolute path/,
    )
    expect(() => resolveMtyCoderHome({ MTYCODER_HOME: "foo/bar" })).toThrow(
      /MTYCODER_HOME must be an absolute path/,
    )
  })

  test("tilde-prefixed MTYCODER_HOME throws (not treated as absolute)", () => {
    expect(() => resolveMtyCoderHome({ MTYCODER_HOME: "~/profiles/a" })).toThrow(
      /MTYCODER_HOME must be an absolute path/,
    )
  })

  test("error message includes the offending value", () => {
    expect(() => resolveMtyCoderHome({ MTYCODER_HOME: "./relative" })).toThrow(
      /\.\/relative/,
    )
  })
})
