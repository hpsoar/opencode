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

export function SessionStatusPanel() {
  const params = useParams()
  const sync = useSync()
  const sdk = useSDK()
  const layout = useLayout()

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

  const text = createMemo(() => {
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
          <div class="flex items-center gap-2 min-w-0 flex-1">
            <Icon
              name={kind().icon}
              size="small"
              class={`shrink-0 ${kind().tone} ${status().type === "busy" ? "animate-pulse" : ""}`}
            />
            <div class="flex flex-col min-w-0 flex-1">
              <span class={`text-12-medium ${kind().tone} truncate`}>{kind().label}</span>
              <Show when={text()}>{(t) => <span class="text-11-regular text-text-weak truncate">{t()}</span>}</Show>
            </div>
          </div>

          <Show when={age()}>
            {(a) => (
              <div class="flex items-center gap-1.5 text-11-regular text-text-weak shrink-0">
                <Show when={busy()} fallback="Updated">
                  <span>Last update</span>
                </Show>
                <span class="text-text-strong font-medium">{a()} ago</span>
              </div>
            )}
          </Show>

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
