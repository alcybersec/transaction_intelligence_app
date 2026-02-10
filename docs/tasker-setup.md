# Tasker SMS Integration Guide

This guide explains how to configure Tasker on Android to automatically forward banking SMS messages to the Transaction Intelligence App.

## Prerequisites

- Android phone with Tasker installed ([Play Store](https://play.google.com/store/apps/details?id=net.dinglisch.android.taskerm))
- Transaction Intelligence App running and accessible from your phone (via local network or VPN)
- The HMAC secret from your `.env` file (`INGESTION_HMAC_SECRET`)

## Overview

The integration works in two modes:

1. **Online Mode**: SMS is sent immediately to the API
2. **Offline Mode**: SMS is queued locally and synced when connectivity returns

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────┐
│   SMS       │────▶│   Tasker    │────▶│  API Server     │
│  Received   │     │  (Online)   │     │  /ingest/sms    │
└─────────────┘     └──────┬──────┘     └─────────────────┘
                          │
                    (If offline)
                          │
                          ▼
                   ┌──────────────┐
                   │ Local Queue  │
                   │ (JSONL file) │
                   └──────┬───────┘
                          │
                    (When online)
                          │
                          ▼
                   ┌─────────────────┐
                   │  Batch Sync     │
                   │ /ingest/sms/batch│
                   └─────────────────┘
```

## Configuration

### Step 1: Create Global Variables

Go to **Tasker → Vars** tab and create these variables:

| Variable | Example Value | Description |
|----------|---------------|-------------|
| `%TXN_API_URL` | `http://192.168.1.100:8001` | Your server URL |
| `%TXN_DEVICE_ID` | `pixel7-alex` | Unique device identifier |
| `%TXN_HMAC_SECRET` | `your-secret-here` | From `.env` INGESTION_HMAC_SECRET |
| `%TXN_QUEUE_DIR` | `/sdcard/TxnIngest` | Offline queue directory |

### Step 2: Create the Send SMS Task

This task sends a single SMS to the API with HMAC authentication.

**Task: Send SMS to TxnApp**

```
1. Variable Set
   Name: %timestamp
   To: %TIMES

2. Variable Set
   Name: %observed_at
   To: %SMSRD

3. JavaScript
   Code:
   // Build the JSON payload
   var payload = {
     "device_id": global("TXN_DEVICE_ID"),
     "observed_at": local("observed_at"),
     "sender": local("SMSRF"),
     "body": local("SMSRB"),
     "source": "sms"
   };
   var body = JSON.stringify(payload);
   setLocal("json_body", body);

4. JavaScriptlet
   Code:
   // Calculate HMAC-SHA256 signature
   var CryptoJS = /* include CryptoJS library */;
   var deviceId = global("TXN_DEVICE_ID");
   var timestamp = local("timestamp");
   var body = local("json_body");
   var secret = global("TXN_HMAC_SECRET");

   var message = deviceId + timestamp + body;
   var signature = CryptoJS.HmacSHA256(message, secret).toString();
   setLocal("signature", signature);

5. HTTP Request
   Method: POST
   URL: %TXN_API_URL/ingest/sms
   Headers:
     Content-Type: application/json
     X-Device-Id: %TXN_DEVICE_ID
     X-Timestamp: %timestamp
     X-Signature: %signature
   Body: %json_body
   Timeout: 30
   Continue Task After Error: On

6. If %http_response_code !~ 2*
   → Perform Task: Queue SMS Offline
```

### Step 3: Create the Offline Queue Task

This task saves SMS to a local file when the server is unreachable.

**Task: Queue SMS Offline**

```
1. Variable Set
   Name: %queue_file
   To: %TXN_QUEUE_DIR/queue.jsonl

2. Write File
   File: %queue_file
   Text: %json_body
   Append: On
   Add Newline: On

3. Flash
   Text: SMS queued for later sync
```

### Step 4: Create the Batch Sync Task

This task syncs all queued messages when connectivity returns.

**Task: Sync Queued SMS**

```
1. Variable Set
   Name: %queue_file
   To: %TXN_QUEUE_DIR/queue.jsonl

2. Test File
   Type: Exists
   Data: %queue_file
   Store Result In: %file_exists

3. Stop If %file_exists eq false

4. Read File
   File: %queue_file
   To: %queue_content

5. JavaScriptlet
   Code:
   // Parse JSONL and build batch payload
   var lines = local("queue_content").trim().split("\n");
   var messages = [];
   for (var i = 0; i < lines.length; i++) {
     if (lines[i].trim()) {
       messages.push(JSON.parse(lines[i]));
     }
   }
   var payload = { "messages": messages };
   setLocal("batch_body", JSON.stringify(payload));
   setLocal("msg_count", messages.length.toString());

6. Flash
   Text: Syncing %msg_count queued messages...

7. Variable Set
   Name: %timestamp
   To: %TIMES

8. JavaScriptlet
   Code:
   // Calculate HMAC for batch
   var CryptoJS = /* include CryptoJS library */;
   var deviceId = global("TXN_DEVICE_ID");
   var timestamp = local("timestamp");
   var body = local("batch_body");
   var secret = global("TXN_HMAC_SECRET");

   var message = deviceId + timestamp + body;
   var signature = CryptoJS.HmacSHA256(message, secret).toString();
   setLocal("signature", signature);

9. HTTP Request
   Method: POST
   URL: %TXN_API_URL/ingest/sms/batch
   Headers:
     Content-Type: application/json
     X-Device-Id: %TXN_DEVICE_ID
     X-Timestamp: %timestamp
     X-Signature: %signature
   Body: %batch_body
   Timeout: 60

10. If %http_response_code ~ 2*
    → Delete File: %queue_file
    → Flash: Synced %msg_count messages successfully
    Else
    → Flash: Sync failed, will retry later
```

### Step 5: Create SMS Receive Profile

This profile triggers when a banking SMS is received.

**Profile: Bank SMS Received**

```
Event: Phone → Received Text
  Type: SMS
  Sender: MASHREQ|NEO|ADCB|FAB|ENBD|RAKBANK|CBD|DIB
  (Use regex to match your banks)

Enter Task: Send SMS to TxnApp
```

### Step 6: Create Connectivity Profile

This profile triggers batch sync when WiFi/VPN connects.

**Profile: Network Connected**

```
State: Net → WiFi Connected
  OR
State: Net → VPN Connected

Enter Task: Sync Queued SMS
```

## Alternative: Simple JavaScript Task (Without CryptoJS)

If you don't want to include CryptoJS, you can use Tasker's built-in Java capabilities:

```javascript
// HMAC-SHA256 using Java
var deviceId = global("TXN_DEVICE_ID");
var timestamp = local("timestamp");
var body = local("json_body");
var secret = global("TXN_HMAC_SECRET");

var message = deviceId + timestamp + body;

var Mac = javax.crypto.Mac;
var SecretKeySpec = javax.crypto.spec.SecretKeySpec;

var mac = Mac.getInstance("HmacSHA256");
var secretKey = new SecretKeySpec(
  new java.lang.String(secret).getBytes("UTF-8"),
  "HmacSHA256"
);
mac.init(secretKey);

var hash = mac.doFinal(new java.lang.String(message).getBytes("UTF-8"));

// Convert to hex
var hexChars = [];
for (var i = 0; i < hash.length; i++) {
  var hex = java.lang.Integer.toHexString(hash[i] & 0xFF);
  if (hex.length == 1) hexChars.push("0");
  hexChars.push(hex);
}
var signature = hexChars.join("");

setLocal("signature", signature);
```

## Testing

### Test from your phone

1. Ensure the API is reachable: `curl http://YOUR_SERVER:8001/health`
2. Send yourself a test SMS from one of your configured bank sender IDs
3. Check if Tasker triggers and sends the request
4. Verify in the app's transaction list or check API logs

### Test with ADB

```bash
# Simulate an SMS from MASHREQ
adb shell am broadcast -a android.provider.Telephony.SMS_RECEIVED \
  --es "sender" "MASHREQ" \
  --es "body" "Your Mashreq Card ending 1234 was used for AED 50.00 at CARREFOUR"
```

### Verify in the app

1. Log in to the web UI at `http://YOUR_SERVER:5174`
2. Check the Transactions tab for new entries
3. If parsing failed, check the review queue

## Troubleshooting

### SMS not being captured

- Ensure Tasker has SMS permissions
- Check that the sender pattern matches (case-insensitive regex)
- Disable battery optimization for Tasker

### HMAC signature invalid (401 error)

- Verify `%TXN_HMAC_SECRET` matches `INGESTION_HMAC_SECRET` in `.env`
- Ensure phone clock is accurate (within 5 minutes of server time)
- Check that JSON body is compact (no extra whitespace)

### Network timeout

- Verify server is reachable from phone network
- If using local IP, ensure phone is on same network or use VPN
- Check firewall rules allow port 8001

### Queue not syncing

- Verify the queue file exists: `/sdcard/TxnIngest/queue.jsonl`
- Check file permissions
- Manually run "Sync Queued SMS" task to test

## Security Notes

1. **Keep HMAC secret secure**: Don't share or commit it to version control
2. **Use HTTPS in production**: Set up a reverse proxy with SSL
3. **VPN recommended**: For sending over mobile data, use a VPN to your home network
4. **Tasker backup**: Exclude `%TXN_HMAC_SECRET` from Tasker backups or encrypt them

## File Locations

| File | Purpose |
|------|---------|
| `/sdcard/TxnIngest/queue.jsonl` | Offline message queue |
| Tasker backup | Contains profiles and tasks |

## API Reference

### Single SMS Endpoint

```
POST /ingest/sms
Headers:
  X-Device-Id: <device_id>
  X-Timestamp: <unix_timestamp>
  X-Signature: <hmac_sha256_hex>
  Content-Type: application/json

Body:
{
  "device_id": "string",
  "observed_at": "ISO8601 datetime",
  "sender": "string",
  "body": "string",
  "source": "sms"
}
```

### Batch SMS Endpoint

```
POST /ingest/sms/batch
Headers: (same as above)

Body:
{
  "messages": [
    { ...sms object... },
    { ...sms object... }
  ]
}
```

Max 500 messages per batch.
