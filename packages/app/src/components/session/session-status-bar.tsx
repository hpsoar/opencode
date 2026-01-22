import { createMemo, Show } from "solid-js"
import { useParams } from "@solidjs/router"
import { useSync } from "@/context/sync"
import { useSDK } from "@/context/sdk"
import { Tooltip } from "@opencode-ai/ui/tooltip"
import { Button } from "@opencode-ai/ui/button"
import { Icon } from "@opencode-ai/ui/icon"
import type { SessionStatus } from "@opencode-ai/sdk/v2/client"

export function SessionStatusBar() {
  const params = useParams()
  const sync = useSync()
  const sdk = useSDK()

  const sessionID = createMemo(() => params.id)
  const idle: SessionStatus = { type: "idle" }
  const status = createMemo(() => sync.data.session_status[sessionID() ?? ""] ?? idle)
  const activity = createMemo(() => sync.data.session_activity?.[sessionID() ?? ""])

  const busy = createMemo(() => status().type !== "idle")
  const text = createMemo(() => {
    const s = status()
    if (s.type === "idle") return
    if (s.type === "retry") return `Retrying (${s.attempt})`
    const op = s.operation
    if (!op) return "Working"
    if (s.detail) return `${op} · ${s.detail}`
    return op
  })

  const age = createMemo(() => {
    const last = activity()?.last
    if (!last) return
    const diff = Date.now() - last
    if (diff < 60_000) return `${Math.max(0, Math.floor(diff / 1000))}s`
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`
    return `${Math.floor(diff / 3_600_000)}h`
  })

  const show = createMemo(() => {
    if (!sessionID()) return false
    if (busy()) return true
    return !!age()
  })

  async function cancel() {
    const id = sessionID()
    if (!id) return
    await sdk.client.session.abort({ sessionID: id }).catch(() => {})
  }

  return (
    <Show when={show()}>
      <div class="flex items-center gap-2 px-2 py-1 rounded-md border border-border-weak-base bg-surface-raised-base">
        <Show when={busy()}>
          <div
            classList={{
              "size-1.5 rounded-full": true,
              "bg-icon-info-base": status().type === "busy",
              "bg-icon-success-base animate-pulse": status().type === "retry",
            }}
          />
        </Show>
        <Show when={text()}>
          {(t) => <span class="text-12-regular text-text-strong truncate max-w-[180px] hidden md:block">{t()}</span>}
        </Show>
        <Show when={age()}>
          {(a) => (
            <span class="text-12-regular text-text-weak">
              <Show when={busy()} fallback="Updated ">
                Last update
              </Show>
              {a()} ago
            </span>
          )}
        </Show>
        <Show when={busy()}>
          <Tooltip value="Cancel">
            <Button variant="ghost" size="small" class="size-5 p-0" onClick={cancel}>
              <Icon name="stop" size="small" class="text-icon-weak" />
            </Button>
          </Tooltip>
        </Show>
      </div>
    </Show>
  )
}
