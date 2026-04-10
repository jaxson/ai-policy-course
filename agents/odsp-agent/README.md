# ODSP Information Centre — AI Agent

An AI-powered policy assistant built to help Ontario social workers and ODSP caseworkers quickly find answers about the Ontario Disability Support Program (ODSP) Income Support Policy Directives.

**Original repository:** [github.com/drewsteckle/social-worker-agent](https://github.com/drewsteckle/social-worker-agent)
**Author:** Drew Steckle ([@drewsteckle](https://github.com/drewsteckle))

---

## What It Does

- Answers questions about ODSP eligibility, income treatment, asset limits, shelter allowances, basic needs calculations, and related policy
- Trained on summarized ODSP Income Support Policy Directives sourced from the Ontario government website
- Provides inline citations linking back to the relevant official directive
- Can generate printable client document templates on request
- Offers PDF export for completed calculations or structured summaries
- Enforces a 20-message session limit to prevent API cost abuse

## Project Structure

```
odsp-agent/
├── app.py                          # Flask backend + Claude API integration + system prompt
├── agent.py                        # CLI-based agent (standalone terminal version)
├── requirements.txt                # Python dependencies
├── templates/
│   └── index.html                  # Full frontend (HTML/CSS/JS)
├── static/
│   ├── logo.jpg                    # Ontario government logo
│   ├── ontario-gov.png
│   └── profile.jpg
├── ODSP Policy Directives Summarized for Social Worker System Prompty.txt
└── README.md                       # This file
```

## Setup

1. Install dependencies: `pip3 install -r requirements.txt`
2. Set your Anthropic API key: `export ANTHROPIC_API_KEY="your-key-here"`
3. Run the web app: `python3 app.py` (opens at http://localhost:8080)
4. Or run the CLI version: `python3 agent.py`

## Tech Stack

- Python 3 + Flask
- Anthropic Claude API
- HTML / CSS / JavaScript frontend (no frameworks)
- Marked.js for markdown rendering
