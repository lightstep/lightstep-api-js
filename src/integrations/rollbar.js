const fetch = require('node-fetch')

const ROLLBAR_API = 'https://api.rollbar.com'

module.exports.getLastDeployVersions = async ({token, environment}) => {
    const HEADERS = { "X-Rollbar-Access-Token" : token }
    const deployResponse = await fetch(`${ROLLBAR_API}/api/1/deploys`, { headers : HEADERS })
    if (deployResponse.status !== 200) {
        throw new Error(`Rollbar API Error: ${deployResponse.status}`)
    }

    const deploys = await deployResponse.json()

    if (deploys.err === 1) {
        throw new Error(deploys.message)
    }

    if (deploys.err === 0 && deploys.result.deploys.length === 0 ){
        return null
    }

    const lastDeploy = deploys.result.deploys[0]
    const versionsResponse =
        await fetch(`${ROLLBAR_API}/api/1/versions/${lastDeploy.revision}?environment=${environment}`,
            { headers : HEADERS })
    const versions = await versionsResponse.json()

    if (versions.err === 1) {
        throw new Error(versions.message)
    }
    return versions.result
}
