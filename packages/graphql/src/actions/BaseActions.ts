import type { BaseContext } from '../context/BaseContext'
import type { RunGroup } from '../entities/run'
import type { FoundBrowser } from '@packages/launcher'
import type { LocalProject } from '../entities'
import type { LaunchArgs, LaunchOpts, OpenProject } from '@packages/server/lib/open_project'
import type { Cfg, OpenProjectLaunchOptions } from '@packages/server/lib/project-base'
import type { BrowserContract } from '../contracts/BrowserContract'

/**
 * Acts as the contract for all actions, inherited by:
 *  - ServerActions
 *  - ClientTestActions
 *
 * By having a "base actions" class, we can reuse this code on the client
 * and make the client-only test doubles work as realistically as possible
 */
export abstract class BaseActions {
  constructor (protected ctx: BaseContext) {}

  abstract installDependencies (): void

  abstract createConfigFile (code: string, configFilename: string): void

  abstract addProject (projectRoot: string): LocalProject

  abstract getProjectId (projectRoot: string): Promise<string | null>
  abstract authenticate (): Promise<void>
  abstract logout (): Promise<void>

  abstract getRuns (payload: { projectId: string, authToken: string }): Promise<RunGroup[]>
  abstract getRecordKeys (payload: { projectId: string, authToken: string }): Promise<string[]>
  abstract getBrowsers (): Promise<FoundBrowser[]>

  abstract initializeOpenProject (args: LaunchArgs, options: OpenProjectLaunchOptions): Promise<OpenProject>
  abstract launchOpenProject (browser: BrowserContract, spec: Cypress.Cypress['spec'], options: LaunchOpts): Promise<void>
  abstract resolveOpenProjectConfig (): Cfg | null
}
