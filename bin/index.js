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
yargs.command('services', 'get services', () => {}, async (argv) => {
    const sdkClient = await sdk.init(argv.lightstepOrganization,
        argv.lightstepApiKey)
    const services = await sdkClient.listServices({ project : argv.lightstepProject })
    for (const service of services.body.data.items) {
        console.log(`${service.attributes.name}`)
    }
    return Promise.resolve()
})
    .option('lightstep-api-key', {
        type        : 'string',
        required    : true,
        description : 'Lightstep API key',
        default     : process.env.LIGHTSTEP_API_KEY
    })
    .option('lightstep-organization', {
        type        : 'string',
        required    : true,
        description : 'Lightstep organization id',
        default     : process.env.LIGHTSTEP_ORGANIZATION
    })
    .option('lightstep-project', {
        type        : 'string',
        description : 'Lightstep project id'
    })
    .argv
