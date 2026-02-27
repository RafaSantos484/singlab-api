# Changelog

All notable changes to the SingLab API will be documented in this file.

## [Unreleased]

### Added
- URL refresh endpoint `GET /songs/:songId/raw/url` for automatic signed URL renewal
- Automatic URL expiration detection and refresh (refreshes when <24h remaining)
- `rawSongInfo.urlInfo.expiresAt` for client-side cache optimization
- `refreshed` boolean in URL response indicating if new URL was generated

### Changed
- Updated `RawSongInfo` to store URL metadata in `urlInfo`
- Improved URL management strategy with 7-day validity period
- Updated Songs module documentation with URL refresh patterns

## [0.1.0] - 2026-02-26

### Changed
- Adapted documentation to reflect the SingLab API scope and roadmap.

## [0.0.0] - 2026-02-15

### Added
- Initial NestJS and Firebase Functions scaffold.
- Environment configuration via `Env` class.
- Jest unit and e2e test setup.
- ESLint and Prettier configuration.
- GitHub Actions for CI and deployment.

## Changelog Guidelines

### Versioning
This project follows [Semantic Versioning](https://semver.org/).

### Changelog Format
- Added: New features
- Changed: Changes in existing functionality
- Deprecated: Soon-to-be removed features
- Removed: Removed features
- Fixed: Bug fixes
- Security: Security fixes
