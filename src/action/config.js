
const yaml = require('js-yaml')
const path = require('path')
const fs = require('fs')

const LIGHTSTEP_CONFIG_FILE = process.env.LIGHTSTEP_CONFIG_FILE || '.lightstep.yml'

/**
 * Parses a `.lightstep.yml` configuration file.
 */
class LightstepConfig {
    constructor(configDir) {
        this._config = { integrations : {} }
        this._loadConfig(configDir)
    }

    _loadConfig(configDir = process.cwd()) {
        try {
            const configFile = path.join(configDir, LIGHTSTEP_CONFIG_FILE)
            let fileContents = fs.readFileSync(configFile, 'utf8')
            const yamlConfig = yaml.safeLoadAll(fileContents)
            this._config = { ...{ integrations : {}, ...yamlConfig[0], } }
        } catch (e) {
            // ignore
        }
    }

    lightstepOrg() {
        return this._config.organization
    }

    lightstepProject() {
        return this._config.project
    }

    services() {
        return this._config.services || []
    }

    integrations() {
        return this._config.integrations
    }
}

module.exports = LightstepConfig