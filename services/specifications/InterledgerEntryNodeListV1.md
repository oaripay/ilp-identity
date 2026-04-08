# ILP Entry Node Registry Specification

This document describes the functionality and API signatures of the `InterledgerEntryNodeListV1` DID Service Endpoint.

## Fundamental Concept

This is a minimal server that stores the list of the publicly accessible HTTP URLs to your Interledger Relay Nodes that you provide as an Interledger Identity Provider.

## Public API

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/nodes` | Returns the URL list of all currently available and online relay nodes as a JSON array. |

## Private API

| Method | Endpoint | Description |
|---|---|---|
| `PUT` | `/nodes` | Sets the URL list of relay nodes from a request body containing a JSON array string. |

