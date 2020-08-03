# lightstep-js-sdk

Javascript SDK for the Lightstep Public API.

```js
    const sdk = require('lightstep-js-sdk');

    // API interfaces automatically generated on `sdkClient.apis` using swagger
    const sdkClient = await sdk.init(orgId, apiKey)
```

### examples

```js
    // using auto-generated swagger function
    await projects = sdkClient.sdk.apis.Projects.listProjectsID({ origanization: 'my-org-id' })

    // using convenience function (automatically sets org id)
    await projects = sdkClient.listProjects()
```