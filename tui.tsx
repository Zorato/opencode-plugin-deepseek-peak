/** @jsxImportSource @opentui/solid */
import { Plugin } from "@opencode/plugin/tui"
import { createSignal } from "solid-js"

// The host repaints the sidebar from its own events and re-invokes a slot's
// `render`, so a timer created inside the component is dropped with that
// component. The clock therefore lives in `setup` and the component only reads
// it.
const CLOCK_MS = 30_000

// DeepSeek peak hours are 01:00-04:00 and 06:00-10:00 UTC, Monday through
// Friday, excluding Chinese public holidays. Every other hour, including
// weekends and Chinese public holidays in full, is off-peak at half price.
// Source: https://api-docs.deepseek.com/quick_start/pricing/
const PEAK_WINDOWS: ReadonlyArray<readonly [number, number]> = [
  [1, 4],
  [6, 10],
]

// Chinese public holiday rest days by year, as date ranges inclusive.
// The State Council publishes the next year's calendar around November;
// add the new ranges here when it does. For a year without an entry the
// plugin assumes no holidays and marks the sidebar accordingly.
// 2026 dates: State Council announcement of 2025-11-04.
const CN_HOLIDAYS: Record<number, ReadonlyArray<readonly [string, string]>> = {
  2026: [
    ["2026-01-01", "2026-01-03"], // New Year
    ["2026-02-15", "2026-02-23"], // Spring Festival
    ["2026-04-04", "2026-04-06"], // Qingming
    ["2026-05-01", "2026-05-05"], // Labour Day
    ["2026-06-19", "2026-06-21"], // Dragon Boat
    ["2026-09-25", "2026-09-27"], // Mid-Autumn
    ["2026-10-01", "2026-10-07"], // National Day
  ],
}

function utcDateKey(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  const day = String(date.getUTCDate()).padStart(2, "0")
  return `${date.getUTCFullYear()}-${month}-${day}`
}

function isCnHoliday(date: Date): boolean {
  const ranges = CN_HOLIDAYS[date.getUTCFullYear()]
  if (!ranges) return false
  const key = utcDateKey(date)
  return ranges.some(([from, to]) => key >= from && key <= to)
}

// The peak windows sit at 09:00-12:00 and 14:00-18:00 Beijing time, so the
// UTC date and the Beijing date are the same calendar day inside every
// window. Checking the holiday by the UTC date is therefore exact.
function isPeakHour(date: Date): boolean {
  const weekday = date.getUTCDay()
  if (weekday === 0 || weekday === 6) return false
  if (isCnHoliday(date)) return false
  const hour = date.getUTCHours() + date.getUTCMinutes() / 60
  return PEAK_WINDOWS.some(([from, to]) => hour >= from && hour < to)
}

// Scan UTC midnight boundaries and window edges over the next 8 days for the
// first moment where the peak state differs from the current one. Weekend and
// holiday days contribute only their midnight boundary, which is enough
// because they are off-peak around the clock.
function nextFlip(from: Date): Date {
  const peak = isPeakHour(from)
  const dayStart = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
  const edges = [0, 60, 240, 360, 600, 1440]
  for (let day = 0; day < 8; day++) {
    for (const minute of edges) {
      const candidate = new Date(dayStart + day * 86_400_000 + minute * 60_000)
      if (candidate <= from) continue
      if (isPeakHour(candidate) !== peak) return candidate
    }
  }
  return new Date(dayStart + 8 * 86_400_000)
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60_000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours > 0 ? `${hours}h ${String(minutes).padStart(2, "0")}m` : `${minutes}m`
}

function formatLocalTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  return `${hours}:${minutes}`
}

// Short form for the prompt footer: the word and its color are the whole
// message, so it fits beside the Jevvy badge and the key hints. The sidebar
// keeps the long form with the countdown.
function FooterPeakStatus(props: {
  theme: Plugin.Context["theme"]
  now: () => Date
}) {
  const view = () => {
    const peak = isPeakHour(props.now())
    return {
      text: peak ? "PEAK x2" : "OFF-PEAK",
      color: peak
        ? props.theme.text.feedback.error.base
        : props.theme.text.feedback.success.base,
    }
  }
  return (
    <box paddingLeft={2} flexShrink={0}>
      <text wrapMode="none" fg={view().color}>
        {view().text}
      </text>
    </box>
  )
}

function DeepSeekPeakStatus(props: {
  theme: Plugin.Context["theme"]
  now: () => Date
}) {
  const view = () => {
    const current = props.now()
    const peak = isPeakHour(current)
    const flip = nextFlip(current)
    return {
      status: peak ? "PEAK x2" : "OFF-PEAK -50%",
      color: peak
        ? props.theme.text.feedback.error.base
        : props.theme.text.feedback.success.base,
      countdown: formatDuration(flip.getTime() - current.getTime()),
      next: peak ? "off-peak" : "peak",
      flipTime: formatLocalTime(flip),
      calendarMissing: CN_HOLIDAYS[current.getUTCFullYear()] === undefined,
    }
  }

  return (
    <box>
      <text>DeepSeek pricing</text>
      <text fg={view().color}>
        {view().status} · {view().next} in {view().countdown}
      </text>
      <text>flip at {view().flipTime} local</text>
      {view().calendarMissing && <text>no CN holiday data for this year</text>}
    </box>
  )
}

export default Plugin.define({
  id: "deepseek-peak",
  setup(context) {
    const [now, setNow] = createSignal(new Date())
    const clock = setInterval(() => setNow(new Date()), CLOCK_MS)

    const sidebar = context.ui.slot({
      append: "sidebar.content",
      render: () => <DeepSeekPeakStatus theme={context.theme} now={now} />,
    })

    // `prompt.footer.status` is the right-hand group of the prompt footer, the
    // same slot the Jevvy badge and the /btw marker use. It renders on the
    // home screen and inside a session, so the label is deliberately short.
    const footer = context.ui.slot({
      append: "prompt.footer.status",
      render: () => <FooterPeakStatus theme={context.theme} now={now} />,
    })

    return () => {
      clearInterval(clock)
      sidebar()
      footer()
    }
  },
})
