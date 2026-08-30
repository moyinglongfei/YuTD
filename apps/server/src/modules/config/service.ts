import type { ConfigModelType } from '@/modules/config/model'
import { Value } from '@sinclair/typebox/value'
import { loadConfig, patchConfig } from '@/lib/config'
import { ConfigModel } from '@/modules/config/model'

let _config: ConfigModelType['config']

export abstract class ConfigService {
  static init() {
    _config = loadConfig()
    return _config
  }

  static get() {
    return _config
  }

  static getPublic() {
    return Value.Parse(ConfigModel.publicConfig, _config)
  }

  static update(data: Partial<ConfigModelType['newConfig']>) {
    _config = patchConfig(data)

    return _config
  }
}
