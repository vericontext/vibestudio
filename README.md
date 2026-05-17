# VibeStudio

Local-first OSS video studio for building AI video sequences with character sheets, storyboard drafts, and Seedance 2.0 reference-to-video generation.

https://github.com/user-attachments/assets/3a9b5a72-0bc9-45b9-9739-ad80da097001

## What It Does

VibeStudio is a browser-based studio for an asset-first AI video workflow:

- Generate production character sheets with GPT Image 2 style prompts.
- Draft continuity-aware storyboards from a short brief.
- Use selected sheet assets as `@Image1`, `@Image2`, etc. references.
- Generate Seedance 2.0 reference-to-video clips through VibeFrame CLI.
- Chain storyboard shots with previous-video and last-frame continuity references.
- Preview generated clips and export a single storyboard video with audio preserved.

The app is local-first. Project files, generated assets, and provider keys live under `workspace/default`, which is gitignored.

## Status

This is an early OSS studio. The core workflow is usable, but provider behavior, generation latency, and model-specific prompt quality can change. Expect active iteration around prompt presets, storyboard planning, and render reliability.

## Requirements

- Node.js 20 or newer
- pnpm
- ffmpeg and ffprobe available on your `PATH`
- OpenAI API key for character sheets and AI storyboard drafting
- fal.ai API key for Seedance 2.0 video generation

## Quick Start

```bash
pnpm install
pnpm dev
```

Open the local URL printed by Next.js, usually:

```text
http://localhost:3000
```

Then:

1. Add `OPENAI_API_KEY` and `FAL_API_KEY` in the Keys panel.
2. Choose or edit a Character Sheet preset, then generate a sheet.
3. Choose or edit a Storyboard Draft preset, then draft a storyboard.
4. Apply the draft, review each shot prompt, and generate clips.
5. Preview clips or export the completed storyboard.

## VibeFrame CLI

VibeStudio uses the pinned local VibeFrame CLI dependency installed by `pnpm install`:

```json
"@vibeframe/cli": "0.105.2"
```

Commands run from `workspace/default`, so project-scope VibeFrame config is used automatically.

To test against a local VibeFrame checkout during CLI development, opt in explicitly:

```bash
VIBEFRAME_CLI_COMMAND="/path/to/vibeframe/node_modules/.bin/tsx /path/to/vibeframe/packages/cli/src/index.ts" pnpm dev
```

## Project Data

Generated local data is kept out of git:

```text
workspace/default/
  .vibeframe/config.yaml
  assets/
  renders/
  storyboard.json
```

Provider keys are stored in `workspace/default/.vibeframe/config.yaml`. Do not commit files from `workspace`.

## Prompting Notes

For best Seedance 2.0 consistency:

- Use one wide character sheet with turnaround views, face close-ups, movement poses, gear details, and palette swatches.
- Keep `@Image1` as the primary identity and appearance reference.
- Use previous clips only for visual continuity; VibeStudio strips audio from continuity video references to avoid sound carryover.
- Describe visible action, camera movement, framing, lighting, first frame, last frame, and shot-specific sound design.
- Keep each generated clip in the 4-15 second range and stitch longer videos from multiple shots.

## Development

```bash
pnpm typecheck
pnpm build
```

There is currently no lint script.

## Security

Never paste provider keys into issues, screenshots, commits, or generated examples. If a key is exposed, revoke it at the provider immediately.

## License

MIT. See [LICENSE](./LICENSE).
