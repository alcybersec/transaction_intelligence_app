# Tasker Quick Setup (Copy-Paste Method)

If XML import doesn't work, create the task manually with these copy-paste steps.

## Step 1: Create Global Variables

**Tasker → Vars tab (top right) → + button**

Create these 3 variables:

| Name | Value |
|------|-------|
| `%TXN_API_URL` | `http://192.168.1.100:8001` ← your server IP |
| `%TXN_DEVICE_ID` | `my-phone` ← unique name for this device |
| `%TXN_HMAC_SECRET` | `dev-hmac-secret` ← from your .env file |

---

## Step 2: Create "Send SMS" Task

**Tasks tab → + button → name it "Send SMS to TxnApp"**

### Action 1: Variable Set
- **Name:** `%timestamp`
- **To:** `%TIMES`

### Action 2: JavaScriptlet
- Tap **Code** and paste this entire block:

```javascript
var payload = JSON.stringify({
  device_id: global("TXN_DEVICE_ID"),
  observed_at: new Date().toISOString(),
  sender: local("SMSRF"),
  body: local("SMSRB"),
  source: "sms"
});
setLocal("json_body", payload);

var deviceId = global("TXN_DEVICE_ID");
var timestamp = local("timestamp");
var secret = global("TXN_HMAC_SECRET");
var message = deviceId + timestamp + payload;

var Mac = javax.crypto.Mac.getInstance("HmacSHA256");
var keySpec = new javax.crypto.spec.SecretKeySpec(
  new java.lang.String(secret).getBytes("UTF-8"), "HmacSHA256"
);
Mac.init(keySpec);
var hash = Mac.doFinal(new java.lang.String(message).getBytes("UTF-8"));

var hex = "";
for (var i = 0; i < hash.length; i++) {
  var b = hash[i] & 0xFF;
  hex += (b < 16 ? "0" : "") + java.lang.Integer.toHexString(b);
}
setLocal("signature", hex);
```

### Action 3: HTTP Request
- **Method:** POST
- **URL:** `%TXN_API_URL/ingest/sms`
- **Headers:** (tap to add each one)
  ```
  Content-Type:application/json
  X-Device-Id:%TXN_DEVICE_ID
  X-Timestamp:%timestamp
  X-Signature:%signature
  ```
- **Body:** `%json_body`
- **Timeout:** 30
- **Continue Task After Error:** ✓ enabled

### Action 4: Flash (optional, for debugging)
- **Text:** `SMS sent: %http_response_code`

---

## Step 3: Create SMS Profile

**Profiles tab → + button → Event → Phone → Received Text**

- **Type:** SMS
- **Sender:** `MASHREQ|NEO|ADCB|FAB|ENBD` (regex for your banks)
- **Content:** leave empty

**Link to task:** Select "Send SMS to TxnApp"

---

## Step 4: Test It

### Option A: Manual test
1. Go to **Tasks → Send SMS to TxnApp**
2. Set test variables first:
   - **Vars tab:** Add `%SMSRF` = `TEST` and `%SMSRB` = `Test message`
3. Tap **Play** button
4. Check the flash message shows `200` or `201`

### Option B: Real SMS test
Send yourself an SMS from one of your configured senders (or have a friend do it).

### Check server received it:
```bash
docker compose logs api --tail=5
```

---

## Troubleshooting

### "TypeError" in JavaScript
- Make sure you copied the entire JavaScript block
- Check for missing semicolons or brackets

### HTTP Response 401
- Verify `%TXN_HMAC_SECRET` matches your server's `INGESTION_HMAC_SECRET` exactly
- Check your phone's clock is accurate

### HTTP Response 0 or timeout
- Server not reachable - check IP address and port
- Try opening `http://YOUR_IP:8001/health` in phone browser

### Profile not triggering
- Check Tasker has SMS permission
- Verify sender regex matches (case-insensitive)
- Make sure profile is enabled (not greyed out)

---

## Optional: Offline Queue

To queue messages when offline, add this after the HTTP Request action:

### Action 5: If
- **Condition:** `%http_response_code` *doesn't match* `2*`

### Action 6: Write File
- **File:** `/sdcard/TxnIngest/queue.jsonl`
- **Text:** `%json_body`
- **Append:** ✓
- **Add Newline:** ✓

### Action 7: End If

Then create a separate "Sync Queue" task that runs on WiFi connect.
