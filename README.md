# VibeStudio

Local-first OSS video studio for building AI video sequences with character sheets, storyboard drafts, and Seedance 2.0 reference-to-video generation.

https://github.com/user-attachments/assets/3a9b5a72-0bc9-45b9-9739-ad80da097001

Prompt library and gallery:
https://vericontext.github.io/vibestudio/

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
- ImgBB API key for strict Seedance image-to-video continuation from local extracted frames
- Cloudflare R2 bucket and S3 API credentials if you want to publish runs to a public gallery

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

1. Add `OPENAI_API_KEY`, `FAL_API_KEY`, and optionally `IMGBB_API_KEY` in the Keys panel.
2. Choose or edit a Character Sheet preset, then generate a sheet.
3. Choose or edit a Storyboard Draft preset, then draft a storyboard.
4. Apply the draft, review each shot prompt, and generate clips.
5. Preview clips or export the completed storyboard.

## Publishing and Gallery

VibeStudio separates **asset hosting** from the **public gallery**:

- `Export` stitches the selected storyboard takes into one local video.
- `Publish` uploads the exported video, thumbnail, run manifest, and reference assets to Cloudflare R2.
- `Gallery` writes a curated static entry under `examples/` using the published R2 URLs.
- `git commit && git push` deploys the updated `examples/` data to GitHub Pages through the included workflow.

The current public gallery at https://vericontext.github.io/vibestudio/ is a static GitHub Pages site. It does not read R2 directly yet. R2 stores the heavy media files, while GitHub Pages serves lightweight JSON entries that point to those R2 URLs.

Current manual publish flow:

```text
Generate clips -> Export -> Publish to R2 -> Add to Gallery -> commit & push -> GitHub Pages deploy
```

This is intentionally conservative for the early OSS phase: every public example is reviewed and versioned in git, while large videos stay out of the repository. A future direction is an R2-backed live gallery index so `Publish` can update the public gallery without a manual commit.

### Cloudflare R2 Setup

Create your own R2 bucket and credentials. Other users should publish to their own bucket, not a shared project bucket.

1. Create an R2 bucket, for example `vibestudio-runs`.
2. Create an R2 access key with write access to that bucket.
3. Enable a public development URL or attach a custom domain for public reads.
4. Copy `.env.example` to `.env.local` and fill the R2 values:

```bash
R2_ACCOUNT_ID=""
R2_ACCESS_KEY_ID=""
R2_SECRET_ACCESS_KEY=""
R2_BUCKET="vibestudio-runs"
R2_REGION="auto"
R2_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"
R2_PUBLIC_BASE_URL="https://pub-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.r2.dev"
```

`R2_ENDPOINT` is the account-level S3 API endpoint, without the bucket path. `R2_PUBLIC_BASE_URL` is the public read URL used in gallery entries.

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
- Use Strict Continuation for scene joins. VibeStudio extracts the previous clip's last frame and sends it as the Seedance image-to-video starting frame.
- Use Omni Reference when you want identity/style/motion references instead of exact first-frame continuity.
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
