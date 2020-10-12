# lightstep-js-sdk

Javascript SDK for the Lightstep Public API.

**This is an unoffical and unsupported API implementation and for reference only.**

```js
    const sdk = require('lightstep-js-sdk');

    // API interfaces automatically generated on `sdkClient.apis` using swagger
    const sdkClient = await sdk.init(orgId, apiKey)
```

### cli examples

There is a convenience CLI available for interacting with the API.

```sh
    # Get services for a project
    $ lightstep services --project dev-foo

    # Get streams for a service in a project
    $ lightstep streams --service frontend --project dev-foo

    # Get timeseries for a stream
    $ lightstep timeseries --project dev-foo --streamId jT1VWPSc

    # Take a snapshot for a given query
    $ lightstep snapshot --project dev-foo 'service in ("frontend")'

    # Generate a Gremlin chaos attack from a trace for service frontend
    $ lightstep gremlin --project dev-foo --trace-id $TRACE_ID frontend
```

### code examples

Additional examples are in the `examples/` directory.

```js
    // using auto-generated swagger function
    await projects = sdkClient.sdk.apis.Projects.listProjectsID({ organization: 'my-org-id' })

    // using convenience function (automatically sets org id)
    await projects = sdkClient.listProjects()
```