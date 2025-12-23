# Feature List and Implemented Enhancements

This update introduces concrete UI improvements, protocol coverage additions, and consistency fixes for the Universal Protocol Test Client experience.

## Improvements
- Added contextual endpoint placeholders in the data source wizard to guide users per protocol.
- Added quick-connect validation with inline error feedback so empty submissions are prevented and highlighted.
- Expanded the protocol explorer with richer mock hierarchies for faster orientation.

## New Protocol Entries
- **gRPC**: Added to the explorer and wizard options with example service/method paths.
- **SQL**: Added to the explorer to mirror database exploration scenarios.

## Inconsistency Fixes
- Standardized connector naming (e.g., `OPC UA` instead of `OPC-UA`) across monitored items for a uniform table view.
- Synced wizard options with the protocols shown in the explorer so users see the same set in both places.

All items above have been implemented in the UI within `client/src/components/ConnectionExperience.jsx`.
