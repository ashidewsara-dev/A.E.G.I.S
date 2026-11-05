
# A.E.G.I.S.

### Artificially Enhanced Guidance and Intelligent Support

A.E.G.I.S. is a planned hybrid AI-powered personal assistant designed to work across laptops and Android devices.

The project aims to combine online AI services with locally hosted AI models to provide intelligent assistance, voice interaction, conversation history, and controlled device automation.

> **Project status:** Requirements and planning phase. The features described here are project goals and are not yet implemented.

## Project Objectives

- Develop an intelligent conversational assistant.
- Support both online and local AI models.
- Provide voice input and spoken responses.
- Maintain conversation history.
- Introduce user-approved personal memory.
- Automate selected laptop tasks safely.
- Provide an Android companion application.
- Build a modern and user-friendly interface.

## Proposed Technology Stack

| Component | Technology |
|---|---|
| Backend | Python, FastAPI |
| Web Interface | React, TypeScript, Vite |
| Android | Kotlin, Jetpack Compose |
| Database | SQLite |
| Local AI | Ollama |
| Online AI | LLM API |
| Version Control | Git, GitHub |

## Development Priorities

1. Requirements and system design
2. Core text-based AI assistant
3. Online and local AI integration
4. Conversation history
5. Voice interaction
6. Laptop automation
7. Android integration
8. Advanced features

## Repository Structure

```text
A.E.G.I.S/
├── README.md
├── requirements.md
├── .gitignore
├── .env.example
└── docs/
    └── roadmap.md
```

## Security Principles

- Never execute arbitrary AI-generated system commands.
- Use allow-listed automation actions.
- Require confirmation for sensitive actions.
- Never upload API keys or passwords to GitHub.
- Respect user privacy and data permissions.

## Project Status

Currently in the requirements and planning phase.

## License

No license has been selected yet.
