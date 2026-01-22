import { createEffect, createMemo, onCleanup } from "solid-js"
import { useParams } from "@solidjs/router"
import { useSync } from "@/context/sync"
import { useSDK } from "@/context/sdk"
import { showToast, toaster } from "@opencode-ai/ui/toast"

const WARN_AFTER_MS = 90_000

export function SessionStallWarning() {
  const params = useParams()
  const sync = useSync()
  const sdk = useSDK()

  const sessionID = createMemo(() => params.id)
  const status = createMemo(() => sync.data.session_status[sessionID() ?? ""] ?? { type: "idle" as const })
  const last = createMemo(() => sync.data.session_activity?.[sessionID() ?? ""]?.last)

  let toastId: number | undefined
  let timer: number | undefined

  const dismiss = () => {
    if (!toastId) return
    toaster.dismiss(toastId)
    toastId = undefined
  }

  const clear = () => {
    if (timer !== undefined) {
      window.clearInterval(timer)
      timer = undefined
    }
  }

  const schedule = () => {
    if (timer !== undefined) return
    timer = window.setInterval(() => {
      const id = sessionID()
      if (!id) return
      if (status().type === "idle") {
        dismiss()
        return
      }
      const t = last()
      if (!t) return
      if (Date.now() - t < WARN_AFTER_MS) {
        dismiss()
        return
      }
      if (toastId) return
      toastId = showToast({
        title: "No recent progress",
        description:
          "This session hasn't produced any updates for a while. It may be waiting on a slow tool or provider.",
        icon: "circle-ban-sign",
        persistent: true,
        actions: [
          {
            label: "Cancel",
            onClick: () => {
              const sid = sessionID()
              if (!sid) return
              void sdk.client.session.abort({ sessionID: sid }).catch(() => {})
            },
          },
          {
            label: "Dismiss",
            onClick: "dismiss",
          },
        ],
      })
    }, 2_000)
  }

  createEffect(() => {
    if (!sessionID()) {
      clear()
      dismiss()
      return
    }
    schedule()
  })

  onCleanup(() => {
    clear()
    dismiss()
  })

  return null
}
