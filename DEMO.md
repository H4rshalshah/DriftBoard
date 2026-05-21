# DriftBoard Demo Run Guide

Use this for a quick local resume demo.

## Start

```bash
npm.cmd install
npm.cmd run build
npm.cmd run dev
```

Open:

```text
http://localhost:3000
```

## Demo Account

You can create any account from the register page. The local demo backend accepts it and returns a session immediately.

Example:

```text
Name: Demo User
Email: demo@driftboard.dev
Password: Demo1234
```

## Demo Video

The landing page includes an animated demo reel section. Open the home page and click "Watch Demo Reel" or scroll to the "Demo video" section.

## Local Backend

The backend runs on:

```text
http://localhost:5000
```

Health check:

```text
http://localhost:5000/api/health
```
