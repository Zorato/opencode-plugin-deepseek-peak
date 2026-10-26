# opencode-plugin-deepseek-peak

An [OpenCode](https://opencode.ai) TUI plugin that shows a live DeepSeek pricing
indicator in the sidebar: whether you are in peak hours right now, when the
state flips, and a warning when the holiday calendar is missing.

## What it shows

```
DeepSeek pricing
OFF-PEAK -50% · peak in 2h 14m
flip at 09:00 local
```

- `PEAK x2` (red) during peak hours, `OFF-PEAK -50%` (green) otherwise
- Countdown to the next flip and the flip time in your local timezone
- `no CN holiday data for this year` when the year is missing from the calendar

## Pricing model

DeepSeek peak hours are 01:00-04:00 and 06:00-10:00 UTC, Monday through Friday,
excluding Chinese public holidays. Every other hour, including weekends and
Chinese public holidays in full, is off-peak at half price.

Source: https://api-docs.deepseek.com/quick_start/pricing/

## Install

Clone or copy the plugin into the OpenCode plugin directory:

```sh
git clone https://github.com/Zorato/opencode-plugin-deepseek-peak \
  ~/.config/opencode/plugins/deepseek-peak
```

Restart OpenCode. The indicator appears in the sidebar.

## Updating the holiday calendar

The State Council publishes the next year's Chinese public holiday calendar
around November. When it does, add the rest-day ranges to `CN_HOLIDAYS` in
`tui.tsx`:

```ts
const CN_HOLIDAYS: Record<number, ReadonlyArray<readonly [string, string]>> = {
  2027: [
    ["2027-01-01", "2027-01-03"],
    // ...
  ],
}
```

Until a year is added, the plugin treats that year as having no holidays and
marks the sidebar with a warning.

## License

[MIT](LICENSE)
