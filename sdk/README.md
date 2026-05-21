# @driftboard/sdk

DriftBoard API Schema Monitoring SDK for Node.js/Express applications.

## Installation

```bash
npm install @driftboard/sdk
```

## Quick Start

```javascript
const express = require('express');
const driftboard = require('@driftboard/sdk');

const app = express();

app.use(driftboard({ apiKey: 'your-api-key' }));

app.get('/api/users', (req, res) => {
  res.json({ users: [] });
});

app.listen(3000);
```

## Configuration

```javascript
const driftboard = require('@driftboard/sdk');

app.use(driftboard({
  apiKey: 'your-api-key',
  endpoint: 'https://api.driftboard.io', // Default
  projectId: 'your-project-id',
  flushInterval: 5000, // Flush every 5 seconds (default)
  maxQueueSize: 100, // Maximum queue size (default)
  sampleRate: 1, // Sample rate 0-1 (default: 1)
  includeRequestBody: true, // Include request body in schema (default: true)
  includeResponseBody: true, // Include response body in schema (default: true)
  excludePaths: ['/health', '/metrics'], // Paths to exclude
  debug: false // Enable debug logging
}));
```

## API Reference

### driftboard(config)

Express middleware factory.

**Parameters:**

- `config.apiKey` (string): Your DriftBoard API key (required)
- `config.endpoint` (string): API endpoint URL (default: 'https://api.driftboard.io')
- `config.projectId` (string): Project identifier
- `config.flushInterval` (number): Flush interval in milliseconds (default: 5000)
- `config.maxQueueSize` (number): Maximum queue size (default: 100)
- `config.sampleRate` (number): Sampling rate 0-1 (default: 1)
- `config.includeRequestBody` (boolean): Include request body (default: true)
- `config.includeResponseBody` (boolean): Include response body (default: true)
- `config.excludePaths` (string[]): Paths to exclude from monitoring
- `config.debug` (boolean): Enable debug logging (default: false)

## Class-Based Usage

```javascript
const { DriftBoard } = require('@driftboard/sdk');

const board = new DriftBoard({ apiKey: 'your-api-key' });
app.use(board.middleware());
```

## TypeScript Support

```typescript
import driftboard, { DriftBoard, DriftBoardConfig } from '@driftboard/sdk';

const config: DriftBoardConfig = {
  apiKey: process.env.DRIFTBOARD_API_KEY!,
  projectId: 'my-project',
  debug: true
};

app.use(driftboard(config));
```

## Excluded Paths

By default, common health check paths are not monitored. You can customize this:

```javascript
app.use(driftboard({
  apiKey: 'your-api-key',
  excludePaths: ['/health', '/metrics', '/ready']
}));
```

## Request/Response Body Extraction

The SDK automatically extracts JSON schemas from request and response bodies for POST, PUT, and PATCH requests.

## Logging

Enable debug logging to see what's happening:

```javascript
app.use(driftboard({
  apiKey: 'your-api-key',
  debug: true
}));
```

## License

MIT