# ILP Identity Services

This is a small lightweight implementation of the `InterledgerEntryNodeListV1` and `InterledgerIdentityProviderV1` services.

The specifications for these services can be found under [specifications/InterledgerEntryNodeListV1.md](specifications/InterledgerEntryNodeListV1.md) and [specifications/InterledgerIdentityProviderV1.md](specifications/InterledgerIdentityProviderV1.md) respectively.

## Run

#### With NPM

To start this service as a standalone server

```
API_PUBLIC_BIND=0.0.0.0:4080 \
API_PRIVATE_BIND=0.0.0.0:4070 \
DB_FILE=test.db \
LOG_LEVEL=trace \
npm start
```

This will create `test.db` in the working directory that stores all identity records and entry nodes, as outlined in the specifications above.