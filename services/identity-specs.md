# ILP Identity Registry Specification

This document describes the functionality and API signatures of the `InterledgerIdentityProviderV1` DID Service Endpoint. This identity provider service is generally provided by a "Trusted Issuer (TI)" under the EBSI Trust Model.

## Fundamental Concept

The Interledger Identity Provider Registry shall be a self-contained program that is publicly accessible under a HTTP endpoint. It must fulfil the following two duties:

### A) ILP License Issuance

Providing ILP Nodes with issuance of ILP Licenses to operate on a [Trusted Interledger Network](). For this, the DID and all relevant legal information of the Node must be known in advance. The general flow is:

1. The ILP Node Operator chooses an ILP Identity Provider based on trust and preference
2. The ILP Identity Provider collects legal information and performs necessary legal background checks outside of this specification (KYB/AML)
3. The ILP Identity Provider stores and authorizes the ILP Node Operator's DID in this registry
4. The ILP Node Operator's node can from now on prompt this registry server to issue them a valid ILP License for operation on a [Trusted Network]()

### B) ILP License Revocation Status

Any ILP Node who has received an ILP License from this issuer during a [ILP Node Handshake]() shall have the ability to query the current status of the ILP License at any time.


## Public API

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/identity/:did/challenge` | Returns a fresh OID4VCI-style challenge for the given DID, including `c_nonce`, issuer audience information, supported proof type, and current `status`. |
| `POST` | `/identity/:did/issue` | Accepts an OID4VCI-style proof of control over the given DID and returns a signed ILP License. Issuance must only succeed if the operator record status is `active`. |
| `GET` | `/identity/:did` | Returns only `licenseId` and `status` for the DID. |

### Minimal OID4VCI-Leaning DID Challenge Flow

This specification intentionally borrows only a small subset of OpenID4VCI concepts for DID-based license issuance. In particular, it reuses:

- a fresh `c_nonce` challenge before issuance,
- a proof-of-possession object for the issuance request, and
- an issuer audience value that the client signs against.

It does **not** define a full OAuth Authorization Code Flow, Token Endpoint, Credential Offer, or Issuer Metadata document. Instead, the issuance flow is reduced to the following steps:

1. The ILP Node calls `GET /identity/:did/challenge`.
2. The registry returns a fresh `c_nonce`, the expected issuer audience, the supported proof type, and the current `status` of the DID record.
3. The ILP Node signs an OID4VCI-style proof JWT with a verification method from its DID Document.
4. The ILP Node submits that proof to `POST /identity/:did/issue`.
5. The registry verifies that the DID is known, the DID record `status` is `active`, the nonce is fresh, and the proof signature matches the DID before issuing an ILP License.
6. Any relying party or ILP Node may later inspect the latest `licenseId` and current `status` using `GET /identity/:did`.

## Private API

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/identities` | Lists all trusted Node Operators known to this registry, identified by DID, status, and legal information. |
| `PUT` | `/identities/:did` | Adds or replaces the trusted Node Operator record for the given DID, including its status (`active` or `revoked`). |
| `DELETE` | `/identities/:did` | Removes the trusted Node Operator record for the given DID. |

### Data Model

Each trusted Node Operator record is identified by its DID, includes a `status` field, and contains legal information collected by the Trusted Issuer.

Example record:

```json
{
	"did": "did:example:123",
	"status": "active",
	"legalInformation": {
		"name": "Example Operator GmbH",
		"street": "Example Street 1",
		"city": "Berlin",
		"country": "DE",
		"email": "ops@example.com",
		"website": "https://example.com",
		"commercialRegisterNumber": "HRB 12345",
		"vatId": "DE123456789"
	}
}
```

The field `status` is required and must be either `active` or `revoked`.

The fields `name`, `street`, `city`, `country`, `email`, and `website` are expected. Additional fields may be included in `legalInformation` as needed.

### Endpoint Details

#### `GET /identity/:did/challenge`

Returns a fresh challenge object for the DID in the path.

This endpoint is the minimal equivalent of an OID4VCI Nonce Endpoint plus the proof requirements needed for the subsequent issuance request.

Example response:

```json
{
	"did": "did:example:123",
	"status": "active",
	"credential_issuer": "https://ti.example.com",
	"credential_endpoint": "https://ti.example.com/identity/did:example:123/issue",
	"c_nonce": "f7d2f0ca-e1be-4f93-a7d1-b392c72ee516",
	"c_nonce_expires_in": 300,
	"proof_types_supported": {
		"jwt": {
			"proof_signing_alg_values_supported": ["ES256", "EdDSA"],
			"typ": "openid4vci-proof+jwt"
		}
	}
}
```

Notes:

- `status` reflects the current registry status of the DID record (`active` or `revoked`).
- `credential_issuer` is the audience value the client signs into the proof.
- `c_nonce` MUST be short-lived and single-use or otherwise protected against replay.
- If the DID is unknown, the registry SHOULD return `404 Not Found`.

#### `POST /identity/:did/issue`

Accepts a proof of control over the DID in the path and, if valid, issues an ILP License.

The request body uses a minimal OID4VCI-style proof object.

Example request:

```json
{
	"proof": {
		"proof_type": "jwt",
		"jwt": "eyJ0eXAiOiJvcGVuaWQ0dmNpLXByb29mK2p3dCIsImFsZyI6IkVTMjU2Iiwia2lkIjoiZGlkOmV4YW1wbGU6MTIzI2tleS0xIn0.eyJpc3MiOiJkaWQ6ZXhhbXBsZToxMjMiLCJhdWQiOiJodHRwczovL3RpLmV4YW1wbGUuY29tIiwiaWF0IjoxNzEwMDAwMDAwLCJub25jZSI6ImY3ZDJmMGNhLWUxYmUtNGY5My1hN2QxLWIzOTJjNzJlZTUxNiJ9.signature"
	}
}
```

For the `jwt` proof type, the registry MUST validate at least the following:

- the JOSE header `typ` is `openid4vci-proof+jwt`,
- the JOSE header `kid` identifies a verification method for the DID in the path,
- the JWT claim `iss` equals the DID in the path,
- the JWT claim `aud` equals the returned `credential_issuer` value,
- the JWT claim `nonce` equals a fresh `c_nonce` previously returned by `GET /identity/:did/challenge`, and
- the signature verifies against the DID Document.

Issuance MUST fail if the DID record is `revoked`, even if the proof is otherwise valid.

Example response:

```json
{
	"licenseId": "lic_01HV6G3Q4Q3L0M9S2P7V8K1R2A",
	"status": "active",
	"license": "eyJhbGciOiJFUzI1NiJ9.eyJqdGkiOiJsaWNfMDFIVjZHM1E0UTNMME05UzJQN1Y4SzFSMkEiLCJzdWIiOiJkaWQ6ZXhhbXBsZToxMjMiLCJzdGF0dXMiOiJhY3RpdmUifQ.signature"
}
```

Minimal error guidance:

- `400 Bad Request` for malformed proof payloads,
- `401 Unauthorized` or `400 Bad Request` for invalid proofs or nonce mismatches,
- `404 Not Found` if the DID is unknown,
- `409 Conflict` if the DID exists but its `status` is `revoked`.

#### `GET /identity/:did`

Returns the current status view for the DID.

The response body is intentionally minimal and only contains `licenseId` and `status`.

Example response:

```json
{
	"licenseId": "lic_01HV6G3Q4Q3L0M9S2P7V8K1R2A",
	"status": "active"
}
```

If no license has been issued yet, `licenseId` SHOULD be `null` while `status` still reflects the current DID record status.

#### `GET /identities`

Returns all trusted Node Operator records known to this registry.

Example response:

```json
[
	{
		"did": "did:example:123",
		"status": "active",
		"legalInformation": {
			"name": "Example Operator GmbH",
			"street": "Example Street 1",
			"city": "Berlin",
			"country": "DE",
			"email": "ops@example.com",
			"website": "https://example.com",
			"commercialRegisterNumber": "HRB 12345"
		}
	}
]
```

#### `PUT /identities/:did`

Creates or updates the trusted Node Operator record for the DID given in the path.

Example request:

```json
{
	"status": "active",
	"legalInformation": {
		"name": "Example Operator GmbH",
		"street": "Example Street 1",
		"city": "Berlin",
		"country": "DE",
		"email": "ops@example.com",
		"website": "https://example.com",
		"commercialRegisterNumber": "HRB 12345",
		"vatId": "DE123456789"
	}
}
```

Example response:

```json
{
	"did": "did:example:123",
	"status": "active",
	"legalInformation": {
		"name": "Example Operator GmbH",
		"street": "Example Street 1",
		"city": "Berlin",
		"country": "DE",
		"email": "ops@example.com",
		"website": "https://example.com",
		"commercialRegisterNumber": "HRB 12345",
		"vatId": "DE123456789"
	}
}
```

#### `DELETE /identities/:did`

Deletes the trusted Node Operator record for the DID given in the path.

Example response:

```json
{
	"did": "did:example:123",
	"deleted": true
}
```

