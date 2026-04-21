# Acceptance criteria

## Product
- The product is clearly presented as a standalone trust layer for dish-level menu data
- It does not look like a hidden continuation of another product
- The user can understand the value in under 20 seconds

## UI
- There is an Upload view
- There is a Processing view
- There is a Review Cockpit
- The Review Cockpit clearly shows canonical dish cards
- The Review Cockpit clearly shows evidence and decision summaries
- Approve / Edit / Reject actions are visible

## Pipeline
- The system handles at least one PDF or image input
- The system produces dish candidates
- The system produces canonical dish records
- The system surfaces provenance
- The system routes edge cases into review states

## Demo-critical decisions
- Marghertia is normalized to Margherita
- Pizza Funghi and Calzone Funghi remain separate
- add burrata +3 is routed as a modifier
- Chef's special is routed as ephemeral

## Technical
- Frontend runs locally and is visually inspectable
- Backend exposes testable endpoints
- There is a clean happy-path demo
- There is at least one ambiguous case shown intentionally