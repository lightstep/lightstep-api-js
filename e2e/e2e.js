const sdk = require('../src')

beforeAll(async () => {
    jest.setTimeout(240000)
})

const orgId = process.env.LIGHTSTEP_ORG
const apiKey = process.env.LIGHTSTEP_API_KEY

var sdkClient = {}
beforeEach(async () => {
    sdkClient = await sdk.init(orgId, apiKey)
})

test('list projects', async () => {
    const projectsRes = await sdkClient.listProjects()
    expect(projectsRes.status).toEqual(200)
    expect(projectsRes.body.data[0].id).toBeDefined()
})

test('list services', async () => {
    const projectsRes = await sdkClient.listProjects()
    const projectId = projectsRes.body.data[0].id

    const servicesRes = await sdkClient.listServices({ project : projectId})
    expect(servicesRes.status).toEqual(200)
})
