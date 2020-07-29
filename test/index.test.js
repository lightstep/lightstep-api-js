const sdk = require('../src')

const orgId = 'test-company'
const apiKey = 'test-apikey'

var sdkClient = {}

test('sdk init test', async () => {
    sdkClient = await sdk.init(orgId, apiKey)

    expect(sdkClient.orgId).toBe(orgId)
    expect(sdkClient.apiKey).toBe(apiKey)
    expect(sdkClient.sdk.apis)
})

test('convenience methods', async () => {
    sdkClient = await sdk.init(orgId, apiKey)

    expect(sdkClient.sdk.apis)
    expect(sdkClient.listProjects)
})