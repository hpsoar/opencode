import { createMemo, Show } from "solid-js"
import { useParams } from "@solidjs/router"
import type { SessionStatus } from "@opencode-ai/sdk/v2/client"
import { Icon } from "@opencode-ai/ui/icon"
import { Button } from "@opencode-ai/ui/button"
import { Tooltip } from "@opencode-ai/ui/tooltip"
import { useSync } from "@/context/sync"
import { useSDK } from "@/context/sdk"
import { useLayout } from "@/context/layout"
import type { IconProps } from "@opencode-ai/ui/icon"
import { useLocal } from "@/context/local"
import type { ToolPart } from "@opencode-ai/sdk/v2"

export function SessionStatusPanel() {
  const params = useParams()
  const sync = useSync()
  const sdk = useSDK()
  const layout = useLayout()
  const local = useLocal()

  const sessionID = createMemo(() => params.id)
  const sessionKey = createMemo(() => `${params.dir}${params.id ? "/" + params.id : ""}`)
  const view = createMemo(() => layout.view(sessionKey()))

  const idle: SessionStatus = { type: "idle" }
  const status = createMemo(() => sync.data.session_status[sessionID() ?? ""] ?? idle)
  const activity = createMemo(() => sync.data.session_activity?.[sessionID() ?? ""])

  const busy = createMemo(() => status().type !== "idle")

  const show = createMemo(() => {
    if (!sessionID()) return false
    if (!view().status?.shown()) return false
    if (busy()) return true
    return !!activity()?.last
  })

  const kind = createMemo(() => {
    const s = status()
    if (s.type === "idle") return { label: "Idle", icon: "check" as IconProps["name"], tone: "text-icon-success-base" }
    if (s.type === "retry")
      return { label: "Retrying", icon: "brain" as IconProps["name"], tone: "text-icon-warning-base" }
    return { label: "Working", icon: "brain" as IconProps["name"], tone: "text-icon-info-base" }
  })

  const who = createMemo(() => {
    const agent = local.agent.current()
    const model = local.model.current()
    return {
      agent: agent?.name ?? "Unknown",
      model: model?.provider?.name ? `${model.name} · ${model.provider.name}` : (model?.name ?? ""),
    }
  })

  const running = createMemo(() => {
    const id = sessionID()
    if (!id) return
    const messages = sync.data.message[id]
    if (!messages) return

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      const parts = sync.data.part[msg.id]
      if (!parts) continue

      for (let j = parts.length - 1; j >= 0; j--) {
        const part = parts[j]
        if (!part) continue
        if (part.type !== "tool") continue
        const tool = part as ToolPart
        if (tool.state.status === "running" || tool.state.status === "pending") {
          return { tool, messageID: msg.id }
        }
      }
    }
  })

  const delegation = createMemo(() => {
    const run = running()
    if (!run) return
    if (run.tool.tool !== "task") return

    const meta = run.tool.metadata as { sessionId?: string; summary?: unknown } | undefined
    const sessionId = meta?.sessionId
    if (!sessionId) return

    const summary = meta?.summary as
      | { id: string; tool: string; state: { status: string; title?: string } }[]
      | undefined

    const active = summary?.findLast((x) => x.state.status === "running")
    const latest = summary?.findLast((x) => x.state.status === "completed")

    return {
      child: sessionId,
      subagent: (run.tool.state.input as any)?.subagent_type as string | undefined,
      description: (run.tool.state.input as any)?.description as string | undefined,
      tool: active?.tool,
      title: active?.state.title ?? latest?.state.title,
    }
  })

  const text = createMemo(() => {
    const d = delegation()
    if (d) {
      const agent = d.subagent ? `${d.subagent} agent` : "subagent"
      const tool = d.tool ? ` · ${d.tool}` : ""
      const title = d.title ? ` · ${d.title}` : ""
      return `Delegating to ${agent}${tool}${title}`
    }

    const run = running()
    if (run) {
      return `Running ${run.tool.tool}`
    }

    const s = status()
    if (s.type === "idle") return
    if (s.type === "retry") {
      if (s.message) return `Attempt ${s.attempt}: ${s.message}`
      return `Attempt ${s.attempt}`
    }
    if (!s.operation) return "Processing"
    if (s.detail) return `${s.operation} · ${s.detail}`
    return s.operation
  })

  const age = createMemo(() => {
    const last = activity()?.last
    if (!last) return
    const diff = Date.now() - last
    if (diff < 60_000) return `${Math.max(0, Math.floor(diff / 1000))}s`
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`
    return `${Math.floor(diff / 3_600_000)}h`
  })

  async function cancel() {
    const id = sessionID()
    if (!id) return
    await sdk.client.session.abort({ sessionID: id }).catch(() => {})
  }

  return (
    <Show when={show()}>
      <div class="sticky top-0 z-20 w-full border-b border-border-weak-base bg-background-stronger/95 backdrop-blur-sm">
        <div class="px-4 md:px-6 py-2 flex items-center gap-3 md:gap-4">
          <Icon
            name={kind().icon}
            size="small"
            class={`shrink-0 ${kind().tone} ${status().type === "busy" ? "animate-pulse" : ""}`}
          />

          <div class="flex flex-col min-w-0 flex-1">
            <div class="flex items-center gap-2 min-w-0">
              <span class={`text-12-medium ${kind().tone} truncate`}>{who().agent}</span>
              <Show when={who().model}>
                <span class="text-12-regular text-text-weak truncate">{who().model}</span>
              </Show>
            </div>

            <div class="flex items-center justify-between gap-2 min-w-0">
              <Show when={text()}>
                {(t) => <span class="text-11-regular text-text-weak truncate flex-1">{t()}</span>}
              </Show>
              <Show when={age()}>
                {(a) => <span class="text-11-regular text-text-weaker shrink-0 whitespace-nowrap">{a()} ago</span>}
              </Show>
            </div>
          </div>

          <Show when={busy()}>
            <Tooltip value="Cancel">
              <Button variant="ghost" size="small" class="size-6 p-0 shrink-0" onClick={cancel}>
                <Icon name="stop" size="small" class="text-icon-weak" />
              </Button>
            </Tooltip>
          </Show>
        </div>
      </div>
    </Show>
  )
}
