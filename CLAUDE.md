# ExpressLRS Firmware

ExpressLRS is an open-source RC link system for FPV drones and RC aircraft.

## Project Structure

- `src/` - Main firmware source code
- `lib/` - External libraries
- `hardware/` - Hardware definitions
- `tools/` - Build and configuration tools

## Common Commands

- Build: `make` or platformio commands
- Flash: `make flash` or via ELRS configurator
- Clean: `make clean`

## Notes

- Firmware for TX (transmitter) and RX (receiver) modules
- Uses C/C++ with embedded frameworks
- Target platforms: ESP32, ESP8285, STM32, etc.

## Gstack

Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

Available skills: /office-hours, /plan-ceo-review, /plan-eng-review, /plan-design-review, /design-consultation, /design-shotgun, /review, /ship, /land-and-deploy, /canary, /benchmark, /browse, /connect-chrome, /qa, /qa-only, /design-review, /setup-browser-cookies, /setup-deploy, /retro, /investigate, /document-release, /codex, /cso, /autoplan, /careful, /freeze, /guard, /unfreeze, /gstack-upgrade
