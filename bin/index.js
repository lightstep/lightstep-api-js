#!/usr/bin/env node

/* eslint-disable no-console */

const sdk = require('../src/index.js')
const yargs = require('yargs')
const { createGremlinLatencyAttack } = require('../src/integrations/gremlin')
const pagerduty = require('../src/integrations/pagerduty')

yargs.command('projects', 'get projects', () => {}, async (argv) => {
    const sdkClient = await sdk.init(argv.lightstepOrganization,
        argv.lightstepApiKey)
    const projects = await sdkClient.listProjects()
    for (const project of projects.body.data) {
        console.log(`${project.id}`)
    }
    return Promise.resolve()
})

yargs.command('services', 'get services', (yargs) => {
    yargs
        .positional('project', {
            describe : 'Lightstep project id',
            required : true,
            type     : 'string',
            default  : process.env.LIGHTSTEP_PROJECT
        })
}, async (argv) => {
    const sdkClient = await sdk.init(argv.lightstepOrganization,
        argv.lightstepApiKey)

    const services = await sdkClient.listServices({ project : argv.project })
    for (const service of services.body.data.items) {
        console.log(`${service.attributes.name}`)
    }
    return Promise.resolve()
})

yargs.command('timeseries', 'get timeseries for string', (yargs) => {
    const windowStartMs = Date.now() - (60000 * 10)
    const windowSizeMs = 60000 * 15
    yargs
        .positional('project', {
            describe : 'Lightstep project id',
            required : true,
            type     : 'string',
            default  : process.env.LIGHTSTEP_PROJECT
        })
        .positional('stream-id', {
            describe : 'Lightstep stream id',
            required : true,
            type     : 'string',
        })
        .positional('resolution-ms', {
            describe : 'Length of time represented by each "point" in the timeseries (ms)',
            required : true,
            type     : 'number',
            default  : 60000
        })
        .positional('oldest-time', {
            describe : 'Beginning of the time range being queried',
            required : true,
            type     : 'string',
            default  : (new Date(windowStartMs - windowSizeMs)).toISOString()
        })
        .positional('youngest-time', {
            describe : 'End of the time range being queried',
            required : true,
            type     : 'string',
            default  : (new Date(windowStartMs)).toISOString()
        })
}, async (argv) => {
    const sdkClient = await sdk.init(argv.lightstepOrganization,
        argv.lightstepApiKey)
    const timeseriesOpts = {
        project             : argv.project,
        'include-exemplars' : 1,
        'resolution-ms'     : argv.resolutionMs,
        'stream-id'         : argv.streamId,
        'youngest-time'     : argv.youngestTime,
        'oldest-time'       : argv.oldestTime,
    }
    const timeseries = await sdkClient.timeseries(timeseriesOpts)
    console.log(JSON.stringify(timeseries.body.data, null, 2))
    return Promise.resolve()
})

yargs.command('streams [stream-id]', 'get streams', (yargs) => {
    yargs
        .positional('project', {
            describe : 'Lightstep project id',
            required : true,
            type     : 'string',
            default  : process.env.LIGHTSTEP_PROJECT
        })
}, async (argv) => {
    const sdkClient = await sdk.init(argv.lightstepOrganization,
        argv.lightstepApiKey)
    if (argv.streamId) {
        const streamResp = await sdkClient.getStream(
            { project : argv.project, 'stream-id' : argv.streamId })
        const stream = streamResp.body.data
        console.log(`${stream.id}\t${stream.attributes.name}\t${stream.attributes.query}`)
        return Promise.resolve()
    } else {
        const streams = await sdkClient.listStreams({ project : argv.project })
        for (const stream of streams.body.data) {
            console.log(`${stream.id}\t${stream.attributes.name}\t${stream.attributes.query}`)
        }
        return Promise.resolve()
    }
})

yargs.command('take-snapshot <query>', 'take a snapshot for a query', (yargs) => {
    yargs
        .positional('project', {
            describe : 'Lightstep project id',
            required : true,
            type     : 'string',
            default  : process.env.LIGHTSTEP_PROJECT
        })
}, async (argv) => {
    const sdkClient = await sdk.init(argv.lightstepOrganization,
        argv.lightstepApiKey)
    const snapshot = await sdkClient.createSnapshot({ project : argv.project, data    : {
        data : {
            attributes : {
                query : argv.query
            }
        }
    } })

    console.log(snapshot.body.data.id)
    return Promise.resolve()
})

yargs.command('snapshot <id>', 'retrieve a snapshot for a query', (yargs) => {
    yargs
        .positional('project', {
            describe : 'Lightstep project id',
            required : true,
            type     : 'string',
            default  : process.env.LIGHTSTEP_PROJECT
        })
}, async (argv) => {
    const sdkClient = await sdk.init(argv.lightstepOrganization,
        argv.lightstepApiKey)
    const snapshot = await sdkClient.getSnapshot({ project : argv.project, snapshotId : argv.id})

    console.log(JSON.stringify(snapshot, null, 2))
    return Promise.resolve()
})

yargs.command('service-diagram <snapshot-id>', 'retrieve a service diagram for a snapshot', (yargs) => {
    yargs
        .positional('project', {
            describe : 'Lightstep project id',
            required : true,
            type     : 'string',
            default  : process.env.LIGHTSTEP_PROJECT
        })
    yargs
        .positional('output', {
            describe : 'Service diagram output format (json or graphviz)',
            required : true,
            type     : 'string',
            default  : 'graphviz'
        })
        .positional('diagram-input', {
            describe : 'Generate diagram from input instead of calling the API',
            required : false,
            type     : 'string'
        })
}, async (argv) => {
    const sdkClient = await sdk.init(argv.lightstepOrganization, argv.lightstepApiKey)

    var diagram
    if (argv.diagramInput) {
        diagram = JSON.parse(argv.diagramInput)
    }

    if (!diagram) {
        diagram = await sdkClient.getServiceDiagram({ project : argv.project, snapshotId : argv.snapshotId })
    }

    if (argv.output === 'json') {
        console.log(JSON.stringify(diagram, null, 2))
    }

    if (argv.output === 'graphviz') {
        console.log(sdkClient.diagramToGraphviz(diagram).to_dot())
    }

    return Promise.resolve()
})

yargs.command('gremlin <service>', 'generate gremlin attack from trace targeting a service', (yargs) => {
    yargs
        .option('gremlin-api-key', {
            describe : 'Gremlin API key',
            type     : 'string',
            required : true,
            default  : process.env.GREMLIN_API_KEY
        })
        .option('project', {
            describe : 'Lightstep project id',
            type     : 'string',
            required : true,
            default  : process.env.LIGHTSTEP_PROJECT
        })
        .option('span-id', {
            describe : 'Lightstep span to generate attacks from',
            type     : 'string',
            required : true
        })
        .option('latency-multiplier', {
            describe : 'What factor to increase latency',
            required : true,
            type     : 'number',
            default  : 2
        })
}, async (argv) => {
    const sdkClient = await sdk.init(argv.lightstepOrganization,
        argv.lightstepApiKey)
    const trace =  await sdkClient.storedTraces({
        project : argv.project, 'span-id' : argv.spanId })
    const traceId = trace.body.data[0].id
    const spans = trace.body.data[0].attributes.spans
    const reporters = trace.body.data[0].relationships.reporters
    const tree = sdkClient.createSpanTree(spans, reporters)

    const { relationships, duration } = sdkClient.findServiceRelationships(tree)
    console.log(`Service relationships from Lightstep trace ${trace.body.data[0].id}:`)
    console.log(relationships)
    console.log(duration)
    console.log('Creating Gremlin latency attacks from trace for service frontend...')

    for (var downstream of relationships[argv.service]) {
        const latencyx10 = duration[`frontend->${downstream}`] * argv.latencyMultiplier
        console.log(`  creating latency attack for service ${downstream} with latency ${latencyx10}ms...`)
        const attackId = await createGremlinLatencyAttack(downstream, {
            traceId   : traceId,
            latencyMs : latencyx10
        })
        console.log(`  created attack ${attackId} !`)
    }
    return Promise.resolve()
})

yargs.command('pagerduty <snapshot-id>', 'update PagerDuty service diagram from a snapshot', (yargs) => {
    yargs
        .option('pagerduty-api-token', {
            describe : 'PagerDuty API token',
            type     : 'string',
            required : true,
            default  : process.env.PAGERDUTY_API_TOKEN
        })
        .option('project', {
            describe : 'Lightstep project id',
            type     : 'string',
            required : true,
            default  : process.env.LIGHTSTEP_PROJECT
        })
}, async (argv) => {
    const sdkClient = await sdk.init(argv.lightstepOrganization,
        argv.lightstepApiKey)
    const diagram = await sdkClient.getServiceDiagram({ project : argv.project, snapshotId : argv.snapshotId })
    const pagerdutyServices = await pagerduty.getPagerdutyServices({ apiToken : argv.pagerdutyApiToken })
    const pagerdutyRelationships = []
    const edges = diagram.data.attributes['service-diagram'].edges
    for (var e in edges) {
        if (!pagerdutyServices[edges[e].from] ||
             !pagerdutyServices[edges[e].to]) {
            continue
        }
        pagerdutyRelationships.push({
            "supporting_service" : {
                "id"   : pagerdutyServices[edges[e].to].id,
                "type" : "service"
            },
            "dependent_service" : {
                "id"   : pagerdutyServices[edges[e].from].id,
                "type" : "service"
            }
        })
    }
    const deps = await pagerduty.createPagerdutyServiceDeps({
        relationships : pagerdutyRelationships,
        apiToken      : argv.pagerdutyApiToken })
    deps.relationships.forEach(r => {
        console.log(`Created PagerDuty service relationship ${r.id}...`)
    })
    return Promise.resolve()
})

yargs.option('lightstep-api-key', {
    type        : 'string',
    required    : true,
    description : 'Lightstep API key',
    default     : process.env.LIGHTSTEP_API_KEY
})

yargs.option('lightstep-organization', {
    type        : 'string',
    required    : true,
    description : 'Lightstep organization id',
    default     : process.env.LIGHTSTEP_ORGANIZATION
})

yargs.argv
