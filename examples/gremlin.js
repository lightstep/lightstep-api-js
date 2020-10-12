/* eslint-disable no-console */

const sdk = require('../src')
const { createGremlinLatencyAttack } = require('../src/gremlin')

// This script automatically generates Gremlin latency attacks
// from a Lightstep trace.
//
// This is implemented as a CLI command in this repository, see:
//
// $ lightstep gremlin --project dev-foo --span-id $SPAN_ID frontend
//
// The targeted services are assumed to be running in a container
// with the label app=[service name]

// to run on the command line: node gremlin.js

async function run() {
    const sdkClient = await sdk.init(
        process.env.LIGHTSTEP_ORGANIZATION, process.env.LIGHTSTEP_API_KEY)

    const streams = await sdkClient.listStreams({ project : process.env.LIGHTSTEP_PROJECT })

    // Select the first stream returned and get a trace
    const streamId = streams.body.data[0].id
    console.log(`Using trace from stream: ${streamId} `)
    const trace = await sdkClient.traceFromStream( streamId, process.env.LIGHTSTEP_PROJECT)
    if (trace === null) {
        console.error(`Found no exemplar traces in stream ${streamId}`)
        return
    }

    // Use this instead  if you have a specific trace in mind:
    // const trace =  await sdkClient.storedTraces({
    //    project : process.env.LIGHTSTEP_PROJECT, 'span-id' : process.env.LIGHTSTEP_TRACE_ID })

    const traceId = trace.body.data[0].id

    const spans = trace.body.data[0].attributes.spans
    const reporters = trace.body.data[0].relationships.reporters
    const tree = sdkClient.createSpanTree(spans, reporters)

    const { relationships, duration } = sdkClient.findServiceRelationships(tree)
    console.log(`Service relationships from Lightstep trace ${trace.body.data[0].id}:`)
    console.log(relationships)
    console.log(duration)

    console.log('\n')

    console.log('Creating Gremlin latency attacks from trace for service frontend...')
    for (var downstream of relationships.frontend) {
        const latencyx10 = duration[`frontend->${downstream}`] * 10
        console.log(`  creating latency attack for service ${downstream} with latency ${latencyx10}ms...`)
        const attackId = await createGremlinLatencyAttack(downstream, {
            traceId   : traceId,
            latencyMs : latencyx10
        })
        console.log(`  created attack ${attackId} !`)
    }
}

run()
