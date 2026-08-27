# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The public course repository for PPG2012H, "Applied AI Systems and Governance:
Technology, Policy, and Practice", a 14-week graduate seminar taught by Jaxson Khan at
the Munk School of Global Affairs & Public Policy, University of Toronto (Winter 2026).

There is no build, no tests, and no deploy. It is markdown plus a couple of small
Python demo agents.

## Where student projects go

When asked to add a project to this repo under a topic, the destination is
`<topic>/<project-slug>.md`. Student-built agents go in `ai-policy-agents/`. New topic
folders follow the same convention as they appear.

Canvas is the surface for grading, submissions, rubrics, and student-facing
announcements. This repo is the public course-materials surface. Do not confuse them.

There is no GitHub MCP connected. Draft the markdown here; Jaxson commits and pushes.

## Layout

- `syllabus.md` is the full syllabus: schedule, readings, assignments, policies.
- `instructions/student-research-custom-instructions.md` is the AI-tool guidance handed
  to students.
- `ai-policy-agents/` holds worked examples, each in its own folder with a README:
  - `odsp-agent/` is the only runnable one. Flask app (`app.py`) plus `agent.py`, with
    `static/` and `templates/`. Install with `pip install -r requirements.txt`, run
    `python app.py`. Its system prompt is the ODSP policy directives text file beside it.
  - `policy-brief-example/` is a Claude skill (`SKILL.md`) plus a sample output.
  - `ontario-bills-tracker/` is a README-only description.

## Conventions

Everything here is public and student-facing. It carries Jaxson's name and the Munk
School's, so match the register of the existing README and syllabus: plain, specific, no
promotional language. Never copy in client material from the private `ai-policy` repo.
