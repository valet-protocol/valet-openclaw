---
name: valet
description: VALET Protocol - Verified Agent Legitimacy and Endorsement Token for AI agents
metadata:
  openclaw:
    emoji: "🎩"
    requires:
      bins: []
    install:
      - id: npm
        kind: node
        package: "@valet-protocol/openclaw-skill"
        bins: ["valet"]
        label: "Install VALET skill (npm)"
---

# VALET - Agent Delegation Protocol

Enable your OpenClaw agent to prove delegated authority using the VALET protocol.

## Overview

VALET (Verified Agent Legitimacy and Endorsement Token) allows AI agents to cryptographically prove they're authorized to act on behalf of a human principal. Built on RFC 9421 (HTTP Message Signatures) and IPFS.

## Features

- 🔐 Cryptographic agent identity (Ed25519)
- 📝 Signed delegations from principal
- ⏰ 24-hour automatic renewal
- 🌐 Decentralized storage (IPFS)
- ✅ RFC 9421 compliant request signing
- 📊 Activity tracking and violation reporting

## What This Skill Does

1. **Runs IPFS Node**: Lightweight local IPFS node for delegation storage
2. **Manages Identity**: Generates and secures agent keypairs
3. **Signs Requests**: Automatically adds VALET headers to HTTP requests
4. **Handles Renewal**: Presents activity for review every 24 hours
5. **Tracks Activity**: Records all agent actions and violations

## Installation

The skill automatically:
- Installs Helia (lightweight IPFS)
- Initializes IPFS repository at `~/.valet/ipfs`
- Generates Ed25519 keypair for your agent
- Creates IPNS key for delegation publishing
- Starts IPFS daemon as background process
- Creates initial 24-hour delegation

## Usage

### Automatic Authentication

Once installed, all agent HTTP requests automatically include VALET headers:

```http
VALET-Authorization: eyJhZ2VudF9pZCI6ImFnZW50OmVkMjU1MTk6NUZIbmVXNDZ4R1hnczVt...
VALET-Agent: record=https://ipfs.io/ipfs/QmYwAPJzv5CZsnA636s8Bv...
Signature-Input: valet=("@method" "@path" "valet-authorization");created=1708077600;keyid="agent:ed25519:...";alg="ed25519";v="1.0"
Signature: valet=:base64_signature:
```

### Manual Commands

Check delegation status:
```bash
valet status
```

Create new delegation:
```bash
valet create-delegation
```

View current delegation:
```bash
valet show
```

Revoke delegation:
```bash
valet revoke
```

Review activity before renewing delegation:
```bash
valet renew --activity-cid <cid>
```

View activity summary on its own:
```bash
valet activity --cid <cid>
```

## Configuration

Edit `~/.valet/config.json`:

```json
{
  "delegation": {
    "auto_renew": true,
    "max_violations": 5
  },
  "ipfs": {
    "api": "http://localhost:5001"
  }
}
```

## How It Works

### Request Flow

1. Agent makes HTTP request
2. VALET skill intercepts
3. Fetches current delegation CID
4. Signs request per RFC 9421
5. Adds VALET-Authorization, VALET-Agent, Signature-Input, Signature headers
6. Request proceeds to service

### Service Verification

Services verify:
1. Agent signature (proves request came from agent)
2. Delegation signature (proves principal authorized agent)
3. Delegation expiry (ensures fresh authorization)
4. Principal authorization (checks if principal is valid user)

### Renewal Flow

Every 24 hours:
1. Agent flushes buffered activity records to IPFS
2. Presents activity summary: requests by service, status codes, error rates
3. Records are labeled by source (`agent` or `service`) so you can see which are independently verified
4. You approve or deny renewal
5. If approved: new delegation created and published to IPFS
6. If denied: agent stops operating

## Security

- **Agent keys**: Encrypted, stored at `~/.valet/agent-key.pem`
- **Delegations**: 24-hour expiry enforces continuous oversight
- **Activity**: Immutable record on IPFS
- **Violations**: Services report misbehavior to your IPFS node

## Requirements

- OpenClaw
- Node.js 18+
- ~100MB disk space for IPFS

## Limitations

- Delegations are public on IPFS (pseudonymous but not private)
- Requires IPFS daemon running (managed automatically)
- 24-hour renewal required (no exceptions)

## Related

- [VALET Specification](https://github.com/valet-protocol/valet)
- [RFC 9421 - HTTP Message Signatures](https://www.rfc-editor.org/rfc/rfc9421)

## Support

- GitHub: https://github.com/valet-protocol/valet-openclaw
- Issues: https://github.com/valet-protocol/valet-openclaw/issues
