# ILP Identity Services

This is a small lightweight implementation of the `InterledgerEntryNodeListV1` and `InterledgerIdentityProviderV1` services.

The specifications for these services can be found under [specs/identity.md](specs/identity.md) and [specs/entrynodes.md](specs/entrynodes.md) respectively.

## Run

#### With NPM

To start this service as a standalone server

```
API_PUBLIC_BIND="0.0.0.0:3000" \
API_PRIVATE_BIND="0.0.0.0:3001" \
DATA_DIR="./data" \
DB_SQLITE_FILE="registry.db" \
LOG_LEVEL="trace" \
EBSI_DOMAIN="https://ebsi.oari.io" \
IDENTITY_ENDPOINT="http://0.0.0.0:3000/identity" \
ISSUER_WALLET_FILE="./root.wallet.json"
EBSI_ILP_SCHEMA_ID="z4DDAmb38YoKBwT1WPBwxdczBAR4Keqxgwk3qksupjAts" \
LICENSE_TTL_SECONDS="86400" \
CHALLANGE_TTL_SECONDS="180" \
npm start
```

This will create `./data/` sqlite data folder in the working directory that stores all identity records and entry nodes, as outlined in the specifications above.
