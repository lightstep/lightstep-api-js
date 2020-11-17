const Swagger = require('swagger-client')
const VERSION = require('../package.json').version
const fetch = require('node-fetch')
const graphviz = require('graphviz')
const { diffSummary, snapshotSummary} = require('./snapshot-utils')

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

    basePath() {
        return require('./api-swagger.json').basePath
    }

    defaultHostname() {
        return require('./api-swagger.json').host
    }

    getApiHostname() {
        return process.env.LIGHTSTEP_HOST || process.env.LIGHTSTEP_API_HOST || this.defaultHostname()
    }

    _initConvenienceFunctions() {
        const shortcuts = {
            listProjects   : this.sdk.apis.Projects.listProjectsID,
            listServices   : this.sdk.apis.Services.listServicesID,
            listStreams    : this.sdk.apis.Streams.listStreamsID,
            getStream      : this.sdk.apis.Streams.getStreamID,
            timeseries     : this.sdk.apis.Streams.timeseriesID,
            storedTraces   : this.sdk.apis.Traces.storedTracesID,
            createSnapshot : this.sdk.apis.Snapshots.createSnapshot,
        }

        this.utils = {
            diffSummary, snapshotSummary
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

    /**
     * Returns a snapshot from the API
     */
    async getSnapshot({project, snapshotId}) {
        // eslint-disable-next-line max-len
        const url = `https://${this.getApiHostname()}${this.basePath()}/${this.orgId}/projects/${project}/snapshots/${snapshotId}?include-percentiles=1&include-exemplars=1&include-histogram=1`
        const response = await fetch(url, {
            method  : 'GET',
            headers : {
                "Content-Type"  : "application/json",
                "Authorization" : `Bearer ${this.apiKey}`,
            }
        } )
        if (response.status !== 200) {
            const text = await response.text()
            throw new Error(`HTTP Error ${response.status}: ${text}`)
        }
        return await response.json()
    }

    /**
     * Returns a service diagram from a snapshot id from the API
     */
    async getServiceDiagram({project, snapshotId}) {
        const hostname = this.getApiHostname()
        const basePath = this.basePath()
        // eslint-disable-next-line max-len
        const reqUrl = `https://${hostname}${basePath}/${this.orgId}/projects/${project}/snapshots/${snapshotId}/service-diagram`
        const response = await fetch(reqUrl, {
            method  : 'GET',
            headers : {
                "Content-Type"  : "application/json",
                "Authorization" : `Bearer ${this.apiKey}`,
            }
        } )
        if (response.status !== 200 && response.status !== 202) {
            const text = await response.text()
            throw new Error(`HTTP Error ${response.status}: ${text}`)
        }
        return await response.json()
    }

    /**
     * Converts a Lightstep service diagram to dotviz format
     */
    diagramToGraphviz(diagramJson) {
        var g = graphviz.digraph('LS')
        const nodes = diagramJson.data.attributes['service-diagram'].nodes

        for (var n in nodes) {
            g.addNode(nodes[n].service_name)
        }
        const edges = diagramJson.data.attributes['service-diagram'].edges
        for (var e in edges) {
            g.addEdge(edges[e].from, edges[e].to)
        }
        return g
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
    init         : init,
    integrations : {
        pagerduty : require('./integrations/pagerduty'),
        rollbar   : require('./integrations/rollbar'),
        gremlin   : require('./integrations/gremlin')
    },
    action : require('./action')
}