const Swagger = require('swagger-client')

/**
* This class provides methods to call the Lightstep Public APs.
* Before calling any method initialize the instance by calling init method on it
* with valid organization and api key.
*/
class LightstepAPI {
    /** Initialize sdk.
     *
     * @param orgId {string}  Lightstep organization id
     * @param apiKey {string} Your api key
     * @returns {LightstepAPI}
     */
    async init(orgId, apiKey) {
        // init swagger client
        const spec = require('./api-swagger.json')
        const swagger = new Swagger({
            spec               : spec,
            requestInterceptor : req => {
                if (process.env.LIGHTSTEP_HOST || process.env.LIGHTSTEP_API_HOST) {
                    req.url = req.url.replace('api.lightstep.com',
                        process.env.LIGHTSTEP_HOST || process.env.LIGHTSTEP_API_HOST)
                }
                this._setHeaders(req, this)
            },
            usePromise : true
        })
        this.sdk = (await swagger)
        this.orgId = orgId
        this.apiKey = apiKey
        this._initConvenienceFunctions()
        return this
    }

    _initConvenienceFunctions() {
        const shortcuts = {
            listProjects   : this.sdk.apis.Projects.listProjectsID,
            listServices   : this.sdk.apis.Services.listServicesID,
            listStreams    : this.sdk.apis.Streams.listStreamsID,
            timeseries     : this.sdk.apis.Streams.timeseriesID,
            storedTraces   : this.sdk.apis.Traces.storedTracesID,
            createSnapshot : this.sdk.apis.Snapshots.createSnapshot,
        }

        for (const s in shortcuts) {
            this[s] = (opts = {}) => {
                if(!opts.organization) {
                    opts.organization = this.orgId
                }
                return shortcuts[s].apply(this, [opts])
            }
        }
    }

    _setHeaders (req, coreAPIInstance) {
        if (!req.headers.Authorization) {
            req.headers.Authorization = 'Bearer ' + coreAPIInstance.apiKey
        }
        if (!req.headers['Content-Type']) {
            req.headers['Content-Type'] = 'application/json'
        }
    }

    /**
     * Returns an exemplar trace from a stream.
     * @param streamId {string} Lightstep stream id
     * @param projectId {string} Lightstep project id
     * @returns {Promise<LightstepAPI>}
     */
    async traceFromStream(streamId, projectId, {
        windowStartMs = Date.now() - (60000 * 10), // 10 minutes ago
        resolutionMs = 60000, // 1 minute
        windowSizeMs = 60000 * 15, // 15 minutes
        exemplarSelector = e => true // returns first exemplar in stream
    } = {}) {
        const timeseriesOpts = {
            project             : projectId,
            'include-exemplars' : 1,
            'resolution-ms'     : resolutionMs,
            'stream-id'         : streamId,
            'youngest-time'     : (new Date(windowStartMs)).toISOString(),
            'oldest-time'       : (new Date(windowStartMs - windowSizeMs)).toISOString(),
        }
        const timeseries = await this.timeseries(timeseriesOpts)
        if (!timeseries.body.data.attributes.exemplars) {
            return null
        }
        const trace = timeseries.body.data.attributes.exemplars.find(exemplarSelector)
        return await this.storedTraces({ project : projectId, 'span-id' : trace.trace_handle })
    }
}

/**
* Returns a Promise that resolves with a new LightstepAPI object.
*
* @param orgId {string} Lightstep organization id
* @param apiKey {string} Your api key
* @returns {Promise<LightstepAPI>}
*/
function init(orgId, apiKey) {
    return new Promise((resolve, reject) => {
        const clientWrapper = new LightstepAPI()

        clientWrapper.init(orgId, apiKey)
            .then(initializedSDK => {
                resolve(initializedSDK)
            })
            .catch(err => {
                reject(err)
            })
    })
}

module.exports = {
    init : init
}