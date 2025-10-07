# GitHub Webhook ReadableStream Error - Fix Documentation

## Problem Description

The webhook was failing with the following error:

```
Exception: The "data" argument must be of type string or an instance of Buffer, TypedArray, or DataView. Received an instance of ReadableStream
Stack: TypeError [ERR_INVALID_ARG_TYPE]: The "data" argument must be of type string or an instance of Buffer, TypedArray, or DataView. Received an instance of ReadableStream
    at Hmac.update (node:internal/crypto/hash:115:11)
    at verifySignature (file:///C:/home/site/wwwroot/src/githubWebhook.js:12:7)
    at handler (file:///C:/home/site/wwwroot/src/githubWebhook.js:26:10)
```

## Root Cause

In Azure Functions v4, the `request.body` property is a `ReadableStream` object, not a string. The previous code was attempting to pass `request.body` directly to `crypto.createHmac().update()`, which expects a string or Buffer.

## Solution

### 1. Use `request.text()` to Read Body

Instead of accessing `request.body` directly, we now use `await request.text()` which:
- Returns a `Promise<string>`
- Properly reads and converts the ReadableStream to a string
- Can only be called once per request (the stream is consumed)

```javascript
// Read body as text first (can only read once)
const bodyText = await request.text();
```

### 2. Add Defensive Type Checking

We added two layers of defense:

#### Handler Level Check
```javascript
// Ensure we have a string (defensive programming)
if (typeof bodyText !== 'string') {
  context.log("[Webhook] Error: bodyText is not a string, got:", typeof bodyText);
  return { status: 400, body: "Invalid request body type" };
}
```

#### Function Level Check
```javascript
function verifySignature(body, signature) {
  if (!signature || !signature.startsWith("sha256=")) return false;
  
  // Ensure body is a string or buffer (defensive check)
  if (typeof body !== 'string' && !Buffer.isBuffer(body)) {
    throw new TypeError(`verifySignature expects string or Buffer, got ${typeof body}`);
  }
  
  const mac = crypto.createHmac("sha256", SECRET);
  mac.update(body || "");
  // ...
}
```

### 3. Added Test Coverage

Added comprehensive tests to verify:
- Type validation works correctly
- Buffer inputs are accepted
- Invalid types (objects, arrays, numbers) throw appropriate errors
- The error that would have occurred with ReadableStream is caught

## Testing

All 136 tests pass, including 2 new tests specifically for type validation:
- `should throw error when body is not string or Buffer`
- `should accept Buffer as body`

## Deployment

After this fix is merged and deployed:
1. The webhook will properly handle GitHub POST requests
2. Request body will be correctly read as a string
3. Signature verification will work correctly
4. Clear error messages will be logged if an unexpected type is received

## Azure Functions v4 Best Practices

When handling request bodies in Azure Functions v4:
- Use `await request.text()` for text/string bodies
- Use `await request.json()` for JSON bodies
- Use `await request.arrayBuffer()` for binary data
- Never access `request.body` directly unless you want to work with the ReadableStream

## References

- [Azure Functions v4 Programming Model](https://learn.microsoft.com/en-us/azure/azure-functions/functions-reference-node)
- [Node.js Crypto HMAC Documentation](https://nodejs.org/api/crypto.html#crypto_class_hmac)
