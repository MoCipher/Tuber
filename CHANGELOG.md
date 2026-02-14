# Changelog

## Unreleased

### Fixed
- Normalize YouTube URL/path inputs passed to `GET /api/feed` so full channel/user URLs (for example `https://www.youtube.com/c/<name>` or `/channel/<id>`) are accepted and resolved correctly. This fixes 404s when subscriptions are stored as full URLs. (server)

### Tests
- Added unit tests to validate URL normalization for `/api/feed` (server/test/feed.test.js)
