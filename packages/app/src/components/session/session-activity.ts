import type { Part } from "@opencode-ai/sdk/v2/client"
import type { State } from "@/context/global-sync/types"

const isNumber = (value: number | undefined): value is number => typeof value === "number"

const partTime = (part: Part) => {
  if (part.type === "text") return part.time?.end ?? part.time?.start
  if (part.type === "reasoning") return part.time.end ?? part.time.start
  if (part.type === "tool") {
    if (part.state.status === "pending") return
    if ("end" in part.state.time) return part.state.time.end
    return part.state.time.start
  }
  if (part.type === "retry") return part.time.created
}

export function activity(data: State, sessionID?: string) {
  if (!sessionID) return
  const messages = data.message[sessionID]
  if (!messages?.length) return

  const times = messages
    .flatMap((message) => {
      const parts = data.part[message.id] ?? []
      const partTimes = parts.map(partTime).filter(isNumber)
      return [message.time.created, ...partTimes]
    })
    .filter(isNumber)

  if (times.length === 0) return
  return Math.max(...times)
}
