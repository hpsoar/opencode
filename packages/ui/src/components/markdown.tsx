import { useMarked } from "../context/marked"
import DOMPurify from "dompurify"
import { checksum } from "@opencode-ai/util/encode"
import { ComponentProps, createEffect, createResource, createSignal, onCleanup, splitProps } from "solid-js"
import { isServer, render } from "solid-js/web"
import { IconButton } from "./icon-button"

type Entry = {
  hash: string
  html: string
}

const max = 200
const cache = new Map<string, Entry>()

if (typeof window !== "undefined" && DOMPurify.isSupported) {
  DOMPurify.addHook("afterSanitizeAttributes", (node: Element) => {
    if (!(node instanceof HTMLAnchorElement)) return
    if (node.target !== "_blank") return

    const rel = node.getAttribute("rel") ?? ""
    const set = new Set(rel.split(/\s+/).filter(Boolean))
    set.add("noopener")
    set.add("noreferrer")
    node.setAttribute("rel", Array.from(set).join(" "))
  })
}

const config = {
  USE_PROFILES: { html: true, mathMl: true },
  SANITIZE_NAMED_PROPS: true,
  FORBID_TAGS: ["style"],
  FORBID_CONTENTS: ["style", "script"],
}

function sanitize(html: string) {
  if (!DOMPurify.isSupported) return ""
  return DOMPurify.sanitize(html, config)
}

function touch(key: string, value: Entry) {
  cache.delete(key)
  cache.set(key, value)

  if (cache.size <= max) return

  const first = cache.keys().next().value
  if (!first) return
  cache.delete(first)
}

export function Markdown(
  props: ComponentProps<"div"> & {
    text: string
    cacheKey?: string
    class?: string
    classList?: Record<string, boolean>
  },
) {
  const [local, others] = splitProps(props, ["text", "cacheKey", "class", "classList"])
  const marked = useMarked()
  let root: HTMLDivElement | undefined
  let mounts: Array<() => void> = []
  const [html] = createResource(
    () => local.text,
    async (markdown) => {
      if (isServer) return ""

      const hash = checksum(markdown)
      const key = local.cacheKey ?? hash

      if (key && hash) {
        const cached = cache.get(key)
        if (cached && cached.hash === hash) {
          touch(key, cached)
          return cached.html
        }
      }

      const next = await marked.parse(markdown)
      const safe = sanitize(next)
      if (key && hash) touch(key, { hash, html: safe })
      return safe
    },
    { initialValue: "" },
  )

  const copy = (value: string) => {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value)

    const el = document.createElement("textarea")
    el.value = value
    el.setAttribute("readonly", "")
    el.style.position = "fixed"
    el.style.top = "-1000px"
    el.style.left = "-1000px"
    document.body.append(el)
    el.select()
    const ok = document.execCommand("copy")
    el.remove()
    if (ok) return Promise.resolve()
    return Promise.reject(new Error("clipboard unavailable"))
  }

  createEffect(() => {
    html.latest

    for (const dispose of mounts) dispose()
    mounts = []

    const el = root
    if (!el) return
    for (const node of el.querySelectorAll('[data-slot="markdown-code-actions"]')) node.remove()

    const pres = Array.from(el.querySelectorAll<HTMLPreElement>("pre.shiki"))
    if (pres.length === 0) return

    for (const pre of pres) {
      const existing = pre.parentElement
      const wrap =
        existing?.getAttribute("data-slot") === "markdown-code" ? existing : document.createElement("div")

      if (wrap !== existing) {
        wrap.setAttribute("data-slot", "markdown-code")
        pre.before(wrap)
        wrap.append(pre)
      }

      const actions = document.createElement("div")
      actions.setAttribute("data-slot", "markdown-code-actions")
      wrap.append(actions)

      const dispose = render(() => <CopyButton pre={pre} copy={copy} />, actions)
      mounts.push(dispose)
    }
  })

  onCleanup(() => {
    for (const dispose of mounts) dispose()
  })

  return (
    <div
      data-component="markdown"
      classList={{
        ...(local.classList ?? {}),
        [local.class ?? ""]: !!local.class,
      }}
      ref={(el) => {
        root = el
      }}
      innerHTML={html.latest}
      {...others}
    />
  )
}

function CopyButton(props: { pre: HTMLPreElement; copy: (value: string) => Promise<void> }) {
  const [state, setState] = createSignal<"idle" | "copied" | "error">("idle")
  let timer: ReturnType<typeof setTimeout> | undefined

  const reset = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => setState("idle"), 2000)
  }

  const handleCopy = () => {
    const value = props.pre.querySelector("code")?.textContent ?? props.pre.textContent ?? ""
    if (!value) return

    props.copy(value).then(
      () => {
        setState("copied")
        reset()
      },
      () => {
        setState("error")
        reset()
      },
    )
  }

  onCleanup(() => {
    if (timer) clearTimeout(timer)
  })

  return (
    <IconButton
      type="button"
      icon={state() === "copied" ? "check" : "copy"}
      variant="secondary"
      onClick={handleCopy}
      aria-label={state() === "copied" ? "Copied" : state() === "error" ? "Copy failed" : "Copy code"}
      data-slot="markdown-copy"
    />
  )
}
