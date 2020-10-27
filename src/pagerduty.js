const fetch = require('node-fetch')

const PD_API = 'https://api.pagerduty.com'

module.exports.getPagerdutyServices = async({ apiToken, filterString = '#lightstep' }) => {
    const token = apiToken
    const HEADERS = {
        "Authorization" : `Token token=${token}`,
        "Accept"        : "application/json"
    }
    const serviceResponse = await fetch(`${PD_API}/services?limit=100`, { headers : HEADERS })
    if (serviceResponse.status !== 200) {
        throw new Error(`PagerDuty API error fetching services ${serviceResponse.status}`)
    }
    const json = await serviceResponse.json()
    const pagerdutyServices = json.services
        .filter(s => s.description.indexOf(filterString) !== -1)
        .reduce((obj, s) => {
            obj[s.name] = {
                id          : s.id,
                description : s.description
            }
            return obj
        }, {})
    return pagerdutyServices
}

module.exports.createPagerdutyServiceDeps = async({ relationships, apiToken }) => {
    const body = { relationships : relationships }

    const associateResp = await fetch(`${PD_API}/service_dependencies/associate`,
        {
            method  : 'POST',
            headers : {
                "Content-Type"  : "application/json",
                "Authorization" : `Token token=${apiToken}`,
            },
            body : JSON.stringify(body)
        }
    )
    if (associateResp.status !== 200) {
        const text = await associateResp.text()
        throw new Error(`PagerDuty API error: creating deps ${associateResp.status}: ${text}`)
    }
    return await associateResp.json()
}