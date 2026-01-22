import { test, expect } from "./fixtures"

test("does not keep snapping back to a message hash while scrolling", async ({ page, sdk, gotoSession }) => {
  const title = `e2e scroll hash ${Date.now()}`
  const created = await sdk.session.create({ title }).then((r) => r.data)

  if (!created?.id) throw new Error("Session create did not return an id")
  const sessionID = created.id

  try {
    // Create enough messages to force turn backfill + multiple re-renders.
    // We keep payload small to avoid server-side limits.
    for (let i = 0; i < 60; i++) {
      await sdk.session.prompt({
        sessionID,
        // Ensure stable IDs so we can reliably deep-link.
        messageID: `msg${i}`,
        noReply: true,
        parts: [{ type: "text", text: `m${i}` }],
      })
    }

    await gotoSession(sessionID)

    const scroller = page.locator("div.overflow-y-auto.no-scrollbar", {
      has: page.locator("[data-message-id]"),
    })
    await expect(scroller).toBeVisible()

    // Anchor to a middle-ish message so that backfill/hydration can update
    // the list without us being at the bottom.
    const targetId = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-message-id]"))
      const ids = nodes.map((n) => n.dataset.messageId).filter(Boolean) as string[]
      // pick a message not at either end
      return ids[Math.floor(ids.length / 2)]
    })

    await page.evaluate((id) => {
      window.location.hash = `#message-${id}`
    }, targetId)

    // Give the app time to apply the hash scroll.
    await page.waitForTimeout(300)

    const before = await scroller.evaluate((el) => el.scrollTop)

    // User scrolls up: if the app is "stuck" to the hash, scrollTop will
    // be forced back toward the hashed message position.
    await scroller.hover()
    await page.mouse.wheel(0, -1200)
    await page.waitForTimeout(200)
    const afterUserScroll = await scroller.evaluate((el) => el.scrollTop)

    // Trigger DOM updates that previously could re-apply the hash navigation:
    // we intentionally mutate the session messages from the server side.
    await sdk.session.prompt({
      sessionID,
      messageID: `msg-extra-${Date.now()}`,
      noReply: true,
      parts: [{ type: "text", text: "extra" }],
    })

    await page.waitForTimeout(500)
    const afterUpdate = await scroller.evaluate((el) => el.scrollTop)

    expect(afterUserScroll).not.toBe(before)
    // Key assertion: updates shouldn't snap us back to the original `before`.
    expect(Math.abs(afterUpdate - afterUserScroll)).toBeLessThan(200)
  } finally {
    await sdk.session.delete({ sessionID }).catch(() => undefined)
  }
})
