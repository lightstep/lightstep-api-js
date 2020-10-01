
const sdk = require('../src')

const orgId = process.env.LIGHTSTEP_ORGANIZATION
const apiKey = process.env.LIGHTSTEP_API_KEY
const projectId = process.env.LIGHTSTEP_PROJECT

async function run() {
    const sdkClient = await sdk.init(orgId, apiKey)

    const streams = await sdkClient.listStreams({ project : projectId })
    const streamId = streams.body.data[0].id
    const storedTrace = await sdkClient.traceFromStream(streamId, projectId)
    console.dir(storedTrace)
}

run()