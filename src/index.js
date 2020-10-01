const Swagger = require('swagger-client')
const VERSION = require('../package.json').version

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
        if (!req.headers['User-Agent']) {
            req.headers['User-Agent'] = `lightstep-js-sdk ${VERSION}`
        }
        if (!req.headers['Content-Type']) {
            req.headers['Content-Type'] = 'application/json'
        }
    }

    /**
     * Converts an array of spans to a nested span tree with inline reporter metadata.
     *
     * @param {Object} spans
     * @param {Object} reporters
     */
    createSpanTree(spans, reporters) {
        let spanTable = {}

        // creates table of all reporters
        let reporterTable = {}
        reporters.forEach( reporter => reporterTable[reporter['reporter-id']] = { ... reporter })
        spans.forEach( span => spanTable[span['span-id']] =
        { ...span, reporter : reporterTable[span['reporter-id']], childSpans : [] } )

        // creates tree of span relationships
        let dataTree = []
        spans.forEach(span => {
            if (span.tags.parent_span_guid) {
                spanTable[span.tags.parent_span_guid].childSpans.push(spanTable[span['span-id']])
            } else {
                dataTree.push(spanTable[span['span-id']])
            }
        })
        // assumption: all traces have a single root
        return dataTree[0]
    }

    /**
    * Finds service-to-service relationships from a collection of spans in a tree.
    *
    * Example output (from a single trace):
    *
    * ```
    * {
    *   ROOT: [ 'frontend' ],
    *   frontend: [
    *     'productcatalogservice',
    *     'currencyservice',
    *     'cartservice',
    *     'recommendationservice'
    *   ],
    *   currencyservice: [],
    *   cartservice: [],
    *   recommendationservice: [ 'productcatalogservice' ]
    * }
    * ```
    *
    * @param {Object} tree
    */
    findServiceRelationships(tree) {
        let relationships = {}
        let duration = {}
        const traverse = (tree, parent) => {
            var parentName = (parent && parent.reporter.attributes['lightstep.component_name']) || 'ROOT'
            var currentName = tree.reporter.attributes['lightstep.component_name']

            relationships[parentName] = (relationships[parentName] || [])
            if (!relationships[parentName].includes(currentName) && parentName !== currentName) {
                duration[`${parentName}->${currentName}`] = (tree['end-time-micros'] - tree['start-time-micros'])
                relationships[parentName].push(currentName)
            }

            if (tree.childSpans.length > 0) {
                tree.childSpans.forEach(cs => {
                    traverse(cs, tree)
                })
            }
        }

        traverse(tree)
        return {relationships, duration}
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