# Ucanto compatibility testing

This allows implementations of Ucanto in different languages to be tested against each other for compatibility.

## Usage

Install Node.js and dependencies:

```sh
npm install
```

To run the tests:

```sh
# test compat Go -> JS
node compat test go js

# test compat JS -> Go
node compat test js go
```

## Adding an implementation

To test an implementation it first needs a simple CLI to be implemented. All output must be `dag-json` encoded to allow the runner to easily inspect results.

Create a directory in the root and add a config file specifying the command to run to invoke the CLI. e.g. for a JS language implementation the config may look like:

**`js/runner.config.json`**:

```json
{
  "command": "node cli.js"
}
```

### CLI API

The CLI must implement the following commands:

#### `server start`

Start a Ucanto server. The service URL and public identifier must be output.

Output:

```json
{
  "url": "http://127.0.0.1:9000",
  "id": "did:key:z6MkjjaEwghJ9C2Y2wv1MFAuRL25UFLqCHwjh5aE2L9nxqjZ"
}
```

Note: the server process must continue to run after logging the output and terminate on SIGTERM.

#### `key gen`

Generate an Ed25519 key.

Output:

```json
{
  "key": "MgCaZJ5bv5abbSRA8taas7QDr7G9NJcRMj+oxWXgGtHqwm+0BayXMZAtwV/YhPRTnPxVKms7h4DUjsLoSS5npEuyHwTQ="
}
```

#### `delegation create --issuer --audience --resource --ability`

Create a delegation. Required parameters:

* `--issuer` - base64 encoded _private_ key of the issuer
* `--audience` - DID of the intended receipient
* `--resource` - DID of the resource the delegation applies to
* `--ability` - name of the capability to delegate (may be specified multiple times)

Optional parameters:

* `--expiration` - expiration in seconds from unix epoch (if not supplied the delegation MUST not expire)
* `--proof` - base64 encoded archive of delegations to include as proofs

Output:

```json
{
  "delegation": "Mg..."
}
```

#### `invoke --url --issuer --audience --resource --ability --caveats`

Issue an invocation. Required parameters:

* `--url` - service URL
* `--issuer` - base64 encoded _private_ key of the issuer
* `--audience` - DID of the intended receipient (typically the service DID)
* `--resource` - DID of the resource the invocation applies to
* `--ability` - name of the capability to delegate (may be specified multiple times)

Optional parameters:

* `--caveats` - dag-json encoded parameters for the invocation
* `--proof` - base64 encoded archive of delegations to include as proofs

Output (success):

```json
{
  "out": {
    "ok": { "...": "..." }
  },
  "message": "Mg..."
}
```

Output (error):

```json
{
  "out": {
    "error": { "...": "..." }
  },
  "message": "Mg..."
}
```

Note: `out` is the result of the invocation, encoded as dag-json.

### Server implementation

The server MUST operate a Ucanto service at `/` and MUST shut itself down shirtly after receiving a request to `POST /shutdown` (and respond with a `202 Accepted` status).

The server should accept and execute invocation provided the delegation chain is valid. i.e. the issuer does not need explicit delegation from the server to invoke - invocation are acceptable provided the issuer _is_ the resource (self signed) or the issuer is provably delegated to by a self signed delegation.

The following invocation handlers MUST be implemented:

#### `test/echo`

Input:

```json
{ "echo": "..." }
```

Result:

```json
{ "ok": { "echo": "..." } }
```
