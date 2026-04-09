## ILP Entry Nodes Registry (Public) — Specification

This document describes the functionality and API signatures of the **ILP Entry Nodes Registry** public endpoint. The registry is a self-contained program that is publicly accessible over HTTP and provides discovery and self-service registration of ILP Entry Nodes.

## Fundamental Concept

The ILP Entry Nodes Registry fulfils two duties:

### A) Entry Node Discovery

Any party (e.g., ILP Nodes during bootstrapping) can query the registry to obtain a list of currently registered entry nodes.

### B) Self-Service Registration & De-registration (VP-gated)

An Entry Node Operator can add or remove its node from the registry by presenting a Verifiable Presentation JWT (`vpJwt`). The registry verifies the VP and derives the operator DID from it. Entries are bound to that DID.

## Data Model

Each entry node record contains:

- `id` (UUID): server-generated identifier
- `url` (string): public base URL of the entry node
- `did` (string): operator DID derived from the verified VP
- `createdAt` (datetime): server timestamp at registration

### Public listing view

For public discovery, the registry only exposes:

```json
{
	"id": "uuid",
	"did": "did:ebsi:123...",
	"url": "https://node.example.com"
}
```

## Public API

| Method   | Endpoint     | Description                                                                                   |
| -------- | ------------ | --------------------------------------------------------------------------------------------- |
| `GET`    | `/`          | Lists registry name version and issuer's `did`.                                               |
| `GET`    | `/nodes`     | Lists all registered entry nodes (public view: `id`, `did` ,`url`).                           |
| `POST`   | `/nodes`     | Registers an entry node URL for the DID proven by `vpJwt`.                                    |
| `DELETE` | `/nodes/:id` | Deletes the entry node record **only if** `id` matches an existing record and vpJwt is valid. |

## Request/Response Schemas

### Register request body

```json
{
	"url": "https://node.example.com",
	"vpJwt": "eyJ..."
}
```

Constraints:

- `url` MUST be a valid absolute URL.
- `vpJwt` MUST be a string containing a VP JWT accepted by the registry verifier.

### Delete request body

```json
{
	"vpJwt": "eyJ..."
}
```

Constraints:

- `vpJwt` MUST be a string containing a VP JWT accepted by the registry verifier.

## Endpoint Details

### GET /

Checks health, `name`,`version` and `did`

#### Example Response (200 OK)

```json
	{
		"name": "InterledgerIdentityProviderV1",
		"version": "1.0.0",
		"did": "did:ebsi:987..."
	},
```

### `GET /nodes`

Lists all entry nodes.

#### Example response (`200 OK`)

```json
[
	{
		"id": "1f7b8c2e-6b1d-4e0a-9c4c-2f2a2f0b9a11",
		"did": "did:ebsi:123...",
		"url": "https://node-a.example.com"
	},
	{
		"id": "9d2a3c14-2df3-4bb5-9a42-4c09a0b7e222",
		"did": "did:ebsi:123...",
		"url": "https://node-b.example.com"
	}
]
```

Notes:

- The response intentionally omits `did` and `createdAt`.

---

### `POST /nodes`

Registers a new entry node record.

#### Processing rules

1. The registry MUST verify `vpJwt`.
2. On success, the registry MUST derive the operator `did` from the VP.
3. The registry MUST create a new record with:
   - `id = UUIDv4`
   - `url` from the request body
   - `did` from the verified VP
   - `createdAt = now()`

#### Example request

```json
{
	"url": "https://node.example.com",
	"vpJwt": "eyJ..."
}
```

#### Example response (`201 Created`)

Returns the created DB record (as stored), e.g.:

```json
{
	"id": "1f7b8c2e-6b1d-4e0a-9c4c-2f2a2f0b9a11",
	"url": "https://node.example.com",
	"did": "did:example:123",
	"createdAt": "2026-04-09T10:00:00.000Z"
}
```

#### Errors

- `400 Bad Request`: malformed JSON or invalid `url`/`vpJwt` types
- `403 Forbidden`: VP verification failed (`Could not verify VP: ...`)

---

### `DELETE /nodes/:id`

Deletes an entry node record, but only if the caller can prove control over the DID that owns that entry.

#### Processing rules

1. The registry MUST verify `vpJwt` and derive `did`.
2. The registry MUST look up a record that matches **all** of:
   - `id` from the path
   - `did` derived from the verified VP
3. If no matching record exists, deletion MUST fail with `404`.
4. If it exists, the registry MUST delete it and return success.

#### Example request

`DELETE /nodes/1f7b8c2e-6b1d-4e0a-9c4c-2f2a2f0b9a11`

```json
{
	"id": "9d2a3c14-2df3-4bb5-9a42-4c09a0b7e222",
	"vpJwt": "eyJ..."
}
```

#### Example response (`200 OK`)

```json
{ "message": "Entry node deleted" }
```

#### Errors

- `400 Bad Request`: malformed JSON or invalid `url`/`vpJwt`
- `403 Forbidden`: VP verification failed
- `404 Not Found`: no record matches `(id, url, did)` (`Entry node not found`)

## Security Considerations

- `vpJwt` verification MUST validate signature and required claims per the registry’s VP policy (`verifyVpIlp`).
- Deletion is intentionally constrained to `(id, url, did)` to prevent unauthorized removal of other operators’ entries.
- The registry SHOULD apply rate-limiting and logging on `POST`/`DELETE` endpoints.
