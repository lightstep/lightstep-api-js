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

First, install the CLI using npm. You'll need to tell npm to use Lightstep's GitHub-based npm repository:

```sh
  $ npm_config_registry=https://npm.pkg.github.com/lightstep npm install -g @lightstep/lightstep-api-js
  $ lightstep --help # see different options
```

You'll also need to set a Lightstep API key:

```sh
  $ export LIGHTSTEP_API_KEY=<<your key>>
```

Examples:

```sh
    # Get services for a project
    $ lightstep services --project dev-foo

    # Get streams for a service in a project
    $ lightstep streams --service frontend --project dev-foo

    # Get timeseries for a stream
    $ lightstep timeseries --project dev-foo --streamId jT1VWPSc

    # Take a snapshot for a given query
    $ lightstep take-snapshot --project dev-foo 'service in ("frontend")'

    # Experimental integrations below

    # Generate a Gremlin chaos attack from a span for service named frontend
    $ lightstep gremlin --project dev-foo --span-id $SPAN_ID frontend

    # Generate PagerDuty service relationships from a snapshot id
    $ lightstep pagerduty --project dev-foo jT1VWPSc
```

### code examples

Additional examples are in the `examples/` directory.

```js
    // using auto-generated swagger function
    await projects = sdkClient.sdk.apis.Projects.listProjectsID({ organization: 'my-org-id' })

    // using convenience function (automatically sets org id)
    await projects = sdkClient.listProjects()
```
