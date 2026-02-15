# VALET for OpenClaw

OpenClaw skill for the [VALET Protocol](https://github.com/valet-protocol/spec) - enabling AI agents to prove delegated authority when accessing services.

## What is VALET?

VALET (Verifiable Agent Limited-Expiry Token) is a lightweight protocol that allows AI agents to cryptographically prove they're authorized to act on behalf of a human principal. It's built on RFC 9421 (HTTP Message Signatures) and uses IPFS for decentralized delegation storage.

## What This Skill Does

This OpenClaw skill automatically:
- ✅ Runs a lightweight IPFS node for storing your agent delegations
- ✅ Generates and manages agent keypairs
- ✅ Creates and signs delegations (24-hour validity)
- ✅ Signs all HTTP requests with VALET headers
- ✅ Handles automatic delegation renewal
- ✅ Manages your agent's activity records

## Installation

### Prerequisites

- [OpenClaw](https://github.com/openclaw/openclaw) installed and running
- Node.js 18+ 

### Install the Skill

```bash
openclaw skill install valet
```

This will:
1. Install a lightweight IPFS node (Helia)
2. Initialize your IPFS repository
3. Generate an IPNS key for your delegations
4. Start the IPFS daemon
5. Create your agent's keypair
6. Set up automatic renewal

## Usage

### Basic Usage

Once installed, VALET authentication is **automatic** for all your agent's requests to VALET-enabled services.

### Check Status

```bash
openclaw valet status
```

Output:
```
✓ IPFS daemon running
✓ Agent: agent:ed25519:5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty
✓ Delegation: QmYwAPJzv5CZsnA636s8Bv...
✓ Expires: 2026-02-15T08:00:00Z (23h 45m remaining)
✓ Violations: 0
```

### Manual Delegation Management

Create a new delegation:
```bash
openclaw valet create-delegation
```

Revoke current delegation:
```bash
openclaw valet revoke
```

View delegation details:
```bash
openclaw valet show-delegation
```

## How It Works

### 1. Agent Identity

Your agent gets a cryptographic identity derived from its Ed25519 public key:
```
agent:ed25519:5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty
```

### 2. Delegation

You (the principal) sign a delegation authorizing your agent:
```json
{
  "agent_id": "agent:ed25519:5FHn...",
  "principal_id": "ed25519:ABC123...",
  "issued_at": "2026-02-14T08:00:00Z",
  "expires_at": "2026-02-15T08:00:00Z",
  "delegation_signature": "base64..."
}
```

This gets stored on IPFS and referenced by its CID (Content Identifier).

### 3. Request Signing

When your agent makes a request, it includes VALET headers:
```http
POST /api/send-email HTTP/1.1
Host: mail.example.com
VALET-Authorization: eyJhZ2VudF9pZCI6ImFnZW50OmVkMjU1MTk6NUZIbmVXNDZ4R1hnczVt...
VALET-Agent: record=https://ipfs.io/ipfs/QmYwAPJzv5CZsnA636s8Bv...
Signature-Input: valet=("@method" "@path" "valet-authorization");created=1708077600;keyid="agent:ed25519:5FHn...";alg="ed25519";v="1.0"
Signature: valet=:MEUCIQDxK7VQX8...:
```

### 4. Activity Tracking

The agent records every HTTP request and its response status code. Each record includes a `source` field indicating whether it was reported by the agent itself (`"agent"`) or independently verified by a service (`"service"`).

### 5. 24-Hour Renewal

Every 24 hours:
1. Agent flushes its activity records to IPFS
2. You review the activity summary before reauthorizing
3. You approve or deny renewal
4. New delegation is created and published to IPFS

Review activity before renewing:
```bash
valet renew --activity-cid QmYwAPJzv5...
```

Or view activity on its own:
```bash
valet activity --cid QmYwAPJzv5...
```

Example output:
```
Activity Summary (2026-02-14T08:00:00Z - 2026-02-15T08:00:00Z):

Total Requests: 1,523
Success Rate: 98%

By Service:
  - gmail.com: 847 requests (0 errors)
  - calendar.google.com: 676 requests (31 errors)

By Status:
  - 2xx (Success): 1,489
  - 4xx (Client Error): 3
    - 429: 2
    - 403: 1
  - 5xx (Server Error): 31
    - 500: 31

Note: All records are agent-reported (not independently verified by services).
```

## Configuration

Configuration is stored in `~/.valet/config.json`:

```json
{
  "ipfs": {
    "repo": "/home/user/.valet/ipfs",
    "api": "http://localhost:5001",
    "gateway": "http://localhost:8080"
  },
  "delegation": {
    "ipns_key": "valet-delegations",
    "renewal_interval": 86400,
    "auto_renew": true,
    "max_violations": 5
  },
  "agent": {
    "private_key_path": "/home/user/.valet/agent-key.pem"
  },
  "activity": {
    "enabled": true,
    "flush_interval": 300,
    "storage_key": "valet-activity"
  }
}
```

## Architecture

```
┌─────────────────────────────────────────┐
│   Your OpenClaw Agent                   │
│   - Makes API requests                  │
│   - Signs with VALET headers           │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│   VALET Skill                           │
│   - Manages IPFS node                   │
│   - Signs delegations                   │
│   - Signs requests (RFC 9421)           │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│   Local IPFS Node (Helia)               │
│   - Stores delegations                  │
│   - Pins activity records               │
│   - Provides IPNS names                 │
└─────────────────────────────────────────┘
```

## Security

### Key Storage

Agent private keys are stored encrypted at `~/.valet/agent-key.pem`. Only your OpenClaw process can access them.

### Delegation Expiry

Delegations expire after 24 hours. If you don't renew, your agent stops working. This ensures continuous human oversight.

### Activity Records

All agent activity and violations are recorded on IPFS. You review them before each renewal.

### IPFS Privacy

Delegations are stored on IPFS and are **publicly readable** by anyone with the CID. Agent and principal identities are pseudonymous (public keys), but trackable.

## Troubleshooting

### IPFS daemon not starting

Check the logs:
```bash
tail -f ~/.valet/ipfs.log
```

Restart manually:
```bash
ipfs daemon --repo ~/.valet/ipfs
```

### Delegation expired

Create a new one:
```bash
openclaw valet create-delegation
```

### IPFS repo corrupted

Reset and reinitialize:
```bash
rm -rf ~/.valet/ipfs
openclaw skill reinstall valet
```

## Development

### Building from source

```bash
git clone https://github.com/valet-protocol/valet-openclaw
cd valet-openclaw
npm install
npm run build
```

### Running tests

```bash
npm test
```

### Local installation

```bash
npm link
openclaw skill install file://$(pwd)
```

## Contributing

Contributions welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Related Projects

- [VALET Protocol Specification](https://github.com/valet-protocol/valet)
- [VALET Python SDK](https://github.com/valet-protocol/valet-py) (coming soon)
- [OpenClaw](https://github.com/openclaw/openclaw)

## License

Apache 2.0 - see [LICENSE](LICENSE)

## Support

- Issues: https://github.com/valet-protocol/valet-openclaw/issues
- Discussions: https://github.com/valet-protocol/valet-openclaw/discussions
- VALET Spec: https://github.com/valet-protocol/valet

---

**Give your agents a valet.** 🎩
