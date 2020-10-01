# lightstep-js-sdk

Javascript SDK for the Lightstep Public API.

**This is an unoffical and unsupported API implementation and for reference only.**

```js
    const sdk = require('lightstep-js-sdk');

    // API interfaces automatically generated on `sdkClient.apis` using swagger
    const sdkClient = await sdk.init(orgId, apiKey)
```

### examples

Additional examples are in the `examples/` directory.

```js
    // using auto-generated swagger function
    await projects = sdkClient.sdk.apis.Projects.listProjectsID({ organization: 'my-org-id' })

    // using convenience function (automatically sets org id)
    await projects = sdkClient.listProjects()
```