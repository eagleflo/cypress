import type { LaunchArgs, OpenProjectLaunchOptions } from '@packages/types'
import debugLib from 'debug'

import type { AuthApiShape } from './actions/AuthActions'
import { CoreDataShape, makeCoreData } from './data/coreDataShape'
import { DataActions } from './DataActions'
import { AppDataSource } from './sources/AppDataSource'
import { ProjectDataSource } from './sources/ProjectDataSource'
import { cached } from './util/cached'
import { WizardDataSource } from './sources'
import type { ProjectApiShape } from './actions'
import { makeLoaders } from './data/loaders'
import { BrowserDataSource } from './sources/BrowserDataSource'
import type { NexusGenAbstractTypeMembers } from '@packages/graphql/src/gen/nxs.gen'

export interface DataContextConfig {
  launchArgs: LaunchArgs
  launchOptions: OpenProjectLaunchOptions
  /**
   * Default is to
   */
  coreData?: CoreDataShape
  /**
   * Injected from the server
   */
  userApi: AuthApiShape
  projectApi: ProjectApiShape
}

export class DataContext {
  private _coreData: CoreDataShape

  constructor (private config: DataContextConfig) {
    this._coreData = config.coreData ?? makeCoreData()
  }

  loaders = makeLoaders(this)

  get launchArgs () {
    return this.config.launchArgs
  }

  get coreData () {
    return this._coreData
  }

  get user () {
    return this.coreData.user
  }

  @cached
  get browser () {
    return new BrowserDataSource(this)
  }

  /**
   * All mutations (update / delete / create), fs writes, etc.
   * should run through this namespace. Everything else should be a "getter"
   */
  @cached
  get actions () {
    return new DataActions(this)
  }

  @cached
  get app () {
    return new AppDataSource(this)
  }

  get appData () {
    return this.coreData.app
  }

  @cached
  get wizard () {
    return new WizardDataSource(this)
  }

  get wizardData () {
    return this.coreData.wizard
  }

  get activeProject () {
    return this.coreData.app.activeProject
  }

  @cached
  get project () {
    return new ProjectDataSource(this)
  }

  get projectsList () {
    return this.coreData.app.projects
  }

  get _apis () {
    return {
      userApi: this.config.userApi,
      projectApi: this.config.projectApi,
    }
  }

  makeId<T extends NexusGenAbstractTypeMembers['Node']> (typeName: T, nodeString: string) {
    return Buffer.from(`${typeName}:${nodeString}`).toString('base64')
  }

  // TODO(tim): type check
  fromId (str: string): string[] {
    const result = Buffer.from(str, 'base64').toString('utf-8')

    return result.split(':')
  }

  debug = debugLib('cypress:data-context')

  logError (e: unknown) {
    // TODO(tim): handle this consistently
    // eslint-disable-next-line no-console
    console.error(e)
  }

  dispose () {
    this.loaders.dispose()
  }
}