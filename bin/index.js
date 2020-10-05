/* eslint-disable no-console */

const sdk = require('../src/index.js')
const yargs = require('yargs')

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

yargs.command('streams [stream-id]', 'get streams', (yargs) => {
    yargs
        .positional('project', {
            describe : 'Lightstep project id',
            required : true,
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
