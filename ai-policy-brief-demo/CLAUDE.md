# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A public demo of the AI policy briefing agent: a single page that posts a request to a
Netlify Function, which calls the Claude API and returns a briefing note.

Run `netlify status` for the site ID.

## Commands

```bash
npm install
netlify dev     # required, the page is useless without the function
git push        # deploys (Netlify auto-deploy from main)
```

No tests, no linter, no build step. `netlify.toml` publishes `public/` and bundles
functions from `netlify/functions` with esbuild.

## Architecture

Two files carry the whole demo:

- `public/index.html` is the entire front end.
- `netlify/functions/brief.mjs` is the only function. It holds the prompt and the
  Anthropic call.

`@anthropic-ai/sdk` is listed in `netlify.toml` under
`[functions."brief"] external_node_modules`. If the dependency list changes, that entry
has to change with it or the bundled function fails at runtime rather than at build time.

## API key

The Anthropic key is a Netlify environment variable, read inside the function. It is
never in the repo and never reaches the browser. Keep every model call server-side.

When touching the model call, check the current model IDs rather than trusting whatever
string is already in the file. See the `claude-api` skill.

## Demo settings (2026-09-30)

- Model `claude-sonnet-5-5`, thinking off (`between_tools`), low effort, 4,000 output tokens.
- Search uses the basic `web_search_20250305` tool, capped at 3 searches and limited to
  cbc.ca, theglobeandmail.com, betakit.com and thelogic.co. The dynamic-filtering
  `web_search_20260209` tool failed intermittently with thinking off; do not switch back
  without testing.
- Limits: 3 briefings per visitor per day and 60 in total, counted in Netlify Blobs
  (store `demo-usage`) under a hash of day plus IP; 3 per minute in memory. The page says
  it is for demonstration purposes only.
- The function streams a space every 5 seconds before the JSON body, because Netlify's
  edge drops responses that send nothing for about 30 seconds.
- Only text after the last search result is returned, so search narration never shows.
- Deploy: `netlify deploy --prod --dir public --functions netlify/functions` from this
  folder (linked to site `ai-brief-demo`). The site is not connected to a Git repo.
