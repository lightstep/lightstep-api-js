const sdk = require('../src')
const fetch = require('node-fetch')

/**
 * Creates a Gremlin latenecy attack targeting a container
 * with label app=service_name
 *
 * @param {string} targetAppLabel
 */
const createGremlinLatencyAttack = async(targetAppLabel, { duration = 60, latencyMs = 2000, traceId = '' }) => {
    const attack = {
        "command" : {
            "type" : "latency",
            "args" : [
                "latency",
                "-l",
                `${duration}`,
                "-m",
                `${latencyMs}`,
                "-h",
                "^api.gremlin.com,^ingest.staging.lightstep.com,^ingest.lightstep.com",
                "-p",
                "^53"
            ]
        },
        "annotations" : {
            "lightstep.created_from_trace_id" : `${traceId}`
        },
        "target" : {
            "containers" : {
                "labels" : {
                    "app" : targetAppLabel
                }
            },
            "type" : "Random"
        }
    }
    const response = await fetch('https://api.gremlin.com/v1/attacks/new', {
        method  : 'POST',
        headers : {
            "Content-Type"  : "application/json",
            "Authorization" : `Key ${process.env.GREMLIN_API_KEY}`,
        },
        body : JSON.stringify(attack) } )
    const text = await response.text()
    if (response.status !== 201) {
        throw new Error(`HTTP Error ${response.status}: ${text}`)
    }
    return text
}

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
