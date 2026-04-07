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
| `GET` | `/identity/:did/challenge` | Returns an OID4VCI challenge for the given DID. |
| `POST` | `/identity/:did/issue` | Accepts a proof of ownership of the given DID and returns a signed ILP License containing the previously collected information about the ILP Node Operator this registry has on record. |
| `GET` | `/identity/:did` | Returns ID and status of the latest issued ILP License for a DID. |

## Private API

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/identities` | Lists all trusted Node Operators known to this registry, identified by DID and legal information. |
| `PUT` | `/identities/:did` | Adds or replaces the trusted Node Operator record for the given DID, including `name`, `street`, `city`, `country`, `email`, `website`, and any other arbitrary fields in `legalInformation`. |
| `DELETE` | `/identities/:did` | Removes the trusted Node Operator record for the given DID. |

### Data Model

Each trusted Node Operator record is identified by its DID and contains legal information collected by the Trusted Issuer.

Example record:

```json
{
	"did": "did:example:123",
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

The fields `name`, `street`, `city`, `country`, `email`, and `website` are expected. Additional fields may be included in `legalInformation` as needed.

### Endpoint Details

#### `GET /identities`

Returns all trusted Node Operator records known to this registry.

Example response:

```json
[
	{
		"did": "did:example:123",
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

