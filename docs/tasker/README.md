# Tasker SMS Ingestion Configuration

This guide explains how to configure Tasker on your Android device to forward banking SMS messages to the Transaction Intelligence App.

## Overview

The Tasker integration provides:
- **Real-time SMS forwarding** when the phone is connected to your network
- **Offline queue** that stores messages when the server is unreachable
- **Automatic catch-up** that syncs queued messages when connectivity returns

## Prerequisites

1. Android phone with Tasker installed
2. Transaction Intelligence App server running and accessible
3. Network connectivity (LAN or Tailscale)

## Configuration

### Step 1: Create the SMS Profile

Create a new Profile in Tasker:

1. **Profile Type**: Event → Phone → Received Text (SMS)
2. **Sender Filter**: Leave empty or add specific senders (see below)
3. **Content Filter**: Leave empty (we'll filter in the task)

**Recommended sender filters** (adjust for your banks):
- `MASHREQ`
- `NEO`
- `*BANK*` (wildcard for any bank)

### Step 2: Create the HTTP POST Task

Create a Task named "Send SMS to TxnIntel":

```
Task: Send SMS to TxnIntel

A1: Variable Set
    Name: %device_id
    To: YOUR_DEVICE_ID
    # Use a unique identifier like "pixel7-alex"

A2: Variable Set
    Name: %timestamp
    To: %TIMES
    # Unix timestamp in seconds

A3: Variable Set
    Name: %api_url
    To: http://YOUR_SERVER:8001/ingest/sms
    # Replace with your server URL

A4: Variable Set
    Name: %hmac_secret
    To: YOUR_HMAC_SECRET
    # Must match INGESTION_HMAC_SECRET in .env

A5: JavaScript
    Code:
    // Build JSON body
    var body = JSON.stringify({
        device_id: local('%device_id'),
        sms_uid: null,
        observed_at: new Date(parseInt(local('%SMSRD')) * 1000).toISOString(),
        sender: local('%SMSRF'),
        body: local('%SMSRB'),
        source: 'sms'
    });
    setLocal('%json_body', body);

    // Generate HMAC signature
    var CryptoJS = /* include CryptoJS library */;
    var message = local('%device_id') + local('%timestamp') + body;
    var signature = CryptoJS.HmacSHA256(message, local('%hmac_secret')).toString();
    setLocal('%signature', signature);

A6: HTTP Request
    Method: POST
    URL: %api_url
    Headers:
        Content-Type: application/json
        X-Device-Id: %device_id
        X-Timestamp: %timestamp
        X-Signature: %signature
    Body: %json_body
    Timeout: 30
    Continue Task After Error: On

A7: If [ %http_response_code != 200 AND %http_response_code != 201 ]
    A8: Write File
        File: /sdcard/TxnIngest/queue.jsonl
        Text: %json_body
        Append: On
        Add Newline: On
    A9: Flash
        Text: SMS queued for later sync
A10: End If
```

### Step 3: Create the Offline Queue Directory

On your phone, create the queue directory:
```
/sdcard/TxnIngest/
```

### Step 4: Create the Catch-Up Profile

Create a Profile to sync queued messages when connectivity returns:

1. **Profile Type**: State → Net → Wifi Connected
   - OR State → Net → VPN Connected (for Tailscale)

2. **Task**: "Sync Queued SMS"

```
Task: Sync Queued SMS

A1: If [ %queuefile ~ */TxnIngest/queue.jsonl ]
    A2: Read File
        File: /sdcard/TxnIngest/queue.jsonl
        To Var: %queue_content

    A3: Variable Set
        Name: %timestamp
        To: %TIMES

    A4: JavaScript
        Code:
        // Parse queue and build batch request
        var lines = local('%queue_content').trim().split('\n');
        var messages = lines.filter(l => l).map(l => JSON.parse(l));
        var body = JSON.stringify({ messages: messages });
        setLocal('%batch_body', body);

        // Generate HMAC signature
        var message = local('%device_id') + local('%timestamp') + body;
        var signature = CryptoJS.HmacSHA256(message, local('%hmac_secret')).toString();
        setLocal('%signature', signature);

    A5: HTTP Request
        Method: POST
        URL: %api_url/batch
        Headers:
            Content-Type: application/json
            X-Device-Id: %device_id
            X-Timestamp: %timestamp
            X-Signature: %signature
        Body: %batch_body
        Timeout: 120

    A6: If [ %http_response_code == 200 OR %http_response_code == 201 ]
        A7: Delete File
            File: /sdcard/TxnIngest/queue.jsonl
        A8: Flash
            Text: Synced %http_data queued messages
    A7: End If
A8: End If
```

## Offline Queue File Format

The queue file (`queue.jsonl`) uses JSON Lines format - one JSON object per line:

```jsonl
{"device_id":"pixel7-alex","sms_uid":null,"observed_at":"2024-01-15T10:30:00+04:00","sender":"MASHREQ","body":"Your Mashreq Card...","source":"sms"}
{"device_id":"pixel7-alex","sms_uid":null,"observed_at":"2024-01-15T11:45:00+04:00","sender":"NEO","body":"Transaction alert...","source":"sms"}
```

## HMAC Signature Generation

The signature is computed as:
```
HMAC-SHA256(secret, device_id + timestamp + body)
```

Where:
- `secret`: The `INGESTION_HMAC_SECRET` from your server's `.env`
- `device_id`: Your unique device identifier
- `timestamp`: Unix timestamp (seconds) of the request
- `body`: The raw JSON request body

### JavaScript Example

```javascript
// Using CryptoJS
var message = device_id + timestamp + JSON.stringify(payload);
var signature = CryptoJS.HmacSHA256(message, secret).toString();
```

### Python Example (for testing)

```python
import hmac
import hashlib
import json
import time

device_id = "pixel7-alex"
timestamp = str(int(time.time()))
body = json.dumps(payload)
secret = "your-hmac-secret"

message = device_id + timestamp + body
signature = hmac.new(
    secret.encode(),
    message.encode(),
    hashlib.sha256
).hexdigest()
```

## Request Headers

All ingestion requests require these headers:

| Header | Description | Example |
|--------|-------------|---------|
| `X-Device-Id` | Unique device identifier | `pixel7-alex` |
| `X-Timestamp` | Unix timestamp (seconds) | `1705315800` |
| `X-Signature` | HMAC-SHA256 hex signature | `a1b2c3...` |
| `Content-Type` | Always JSON | `application/json` |

## API Endpoints

### Single SMS: `POST /ingest/sms`

Request body:
```json
{
  "device_id": "pixel7-alex",
  "sms_uid": "abc123",
  "observed_at": "2024-01-15T10:30:00+04:00",
  "sender": "MASHREQ",
  "body": "Your Mashreq Card ending 1234 was used for AED 50.00 at CARREFOUR on 15-Jan-2024. Avl Cr Limit: AED 10,000.00",
  "source": "sms"
}
```

Response:
```json
{
  "status": "accepted",
  "message": {
    "id": "uuid-here",
    "source": "sms",
    "source_uid": "abc123",
    "observed_at": "2024-01-15T10:30:00+04:00",
    "sender": "MASHREQ",
    "created_at": "2024-01-15T10:30:05+00:00",
    "parse_status": "pending",
    "is_duplicate": false
  },
  "is_duplicate": false
}
```

### Batch SMS: `POST /ingest/sms/batch`

Request body:
```json
{
  "messages": [
    { /* SMS object 1 */ },
    { /* SMS object 2 */ },
    ...
  ]
}
```

Response:
```json
{
  "status": "accepted",
  "total": 10,
  "accepted": 8,
  "duplicates": 2,
  "last_sync_cursor": "2024-01-15T11:45:00+04:00",
  "messages": [ /* accepted message objects */ ]
}
```

## Troubleshooting

### SMS not being captured
- Check that Tasker has SMS permissions
- Verify the sender filter matches your bank's sender ID
- Check Tasker's "Run Log" for errors

### HTTP request failing
- Verify server is reachable from your phone
- Check that the URL and port are correct
- Verify HMAC secret matches server configuration

### Signature invalid errors
- Ensure timestamp is current (within 5 minutes)
- Verify device_id in body matches X-Device-Id header
- Check that HMAC secret is identical on both ends

### Queue not syncing
- Check the queue file exists and has content
- Verify the catch-up profile is triggering
- Check network connectivity to server

## Security Notes

1. **Keep your HMAC secret secure** - Don't share it or commit it to git
2. **Use HTTPS in production** - The current setup uses HTTP for local development
3. **Tailscale recommended** - For secure remote access without exposing ports

## Testing

You can test the endpoint using curl:

```bash
# Generate signature
DEVICE_ID="test-device"
TIMESTAMP=$(date +%s)
BODY='{"device_id":"test-device","observed_at":"2024-01-15T10:30:00Z","sender":"TEST","body":"Test message","source":"sms"}'
SECRET="your-hmac-secret"
SIGNATURE=$(echo -n "${DEVICE_ID}${TIMESTAMP}${BODY}" | openssl dgst -sha256 -hmac "$SECRET" | cut -d' ' -f2)

# Send request
curl -X POST http://localhost:8001/ingest/sms \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: $DEVICE_ID" \
  -H "X-Timestamp: $TIMESTAMP" \
  -H "X-Signature: $SIGNATURE" \
  -d "$BODY"
```
