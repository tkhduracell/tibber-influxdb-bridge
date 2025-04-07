# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. 

## Context
This is docker image that acts as a bridge between InfluxDB v2.7.11+ and the realtime Tibber API. 

The runtime is Node 22, use native tools when possible.

## Build & Test Commands
- Run all tests: `pnpm test`
- Run dev mode with auto reload: `pnpm dev` (never use `start`)
- Format & lint code: `pnpm run check` (writes safe autofixes)
- Run: `docker-compose up --build`

## Code Style Guidelines
- **Formatting**: Follow BiomeJS recommended rules
- **Naming**: 
  - CamelCase for variables/functions
  - PascalCase for classes/constructors
- **Credentials**: Use .env files for sensitive data (never hardcode)
- **Dependencies**: Use the tibber-api package for Tibber API integration

## Tip
- If you need to `curl` use `env curl`!