import Bluebird from 'bluebird'
import { createDeferred } from '../../util/deferred'

export function addCommands (Commands, Cypress: Cypress.Cypress, cy: Cypress.cy, state: Cypress.State) {
  let timeoutId

  // @ts-ignore
  Cypress.multiDomainCommunicator.on('html:received', () => {
    // when a secondary domain is detected by the proxy, it holds it up
    // to provide time for the spec bridge to be set up. normally, the queue
    // will not continue until the page is stable, but this signals it to go
    // ahead because we're anticipating multidomain
    // @ts-ignore
    cy.isAnticipatingMultidomain(true)

    // cy.isAnticipatingMultidomain(true) will free the queue to move forward.
    // if the next command isn't switchToDomain, this timeout will hit and
    // the test will fail with a cross-origin error
    timeoutId = setTimeout(() => {
      // @ts-ignore
      Cypress.backend('ready:for:domain', { shouldInject: false })
    }, 2000)
  })

  Commands.addAll({
    // this isn't fully implemented, but in place to be able to test out
    // the other parts of multidomain
    switchToDomain (domain, fn) {
      const done = cy.state('done')
      const deferredDone = createDeferred()
      const invokeDone = (err) => {
        //TODO: if an error comes back, should we call done immediately?
        return deferredDone.resolve({
          crossDomainDoneCalled: true,
          error: err,
        })
      }

      // if done has been provided to the test, allow the user to call done
      // from the switchToDomain context running in the secondary domain.
      if (done) {
        // @ts-ignore
        Cypress.multiDomainCommunicator.once('done:called', invokeDone)
      } else {
        // if done has not been provided, settle this promise now as
        // done should not be available in the secondary domain
        deferredDone.resolve()
      }

      clearTimeout(timeoutId)

      Cypress.log({
        name: 'switchToDomain',
        type: 'parent',
        message: domain,
        end: true,
      })

      // these are proxy commands that represent real commands in a
      // secondary domain. this way, the queue runs in the primary domain
      // with all commands, making it possible to sync up timing for
      // the reporter command log, etc
      const commands = {}
      const logs = {}

      const addCommand = (attrs) => {
        const deferred = createDeferred()

        commands[attrs.id] = {
          deferred,
          name: attrs.name,
        }

        attrs.fn = () => {
          // the real command running in the secondary domain handles its
          // own timeout
          // TODO: add a special, long timeout in case inter-domain
          // communication breaks down somehow
          // @ts-ignore
          cy.clearTimeout()

          // @ts-ignore
          Cypress.multiDomainCommunicator.toSpecBridge('run:command', {
            name: attrs.name,
          })

          return deferred.promise
        }

        Cypress.action('cy:enqueue:command', attrs)
      }

      const updateCommand = (details) => {
        if (details.logAdded) {
          const attrs = details.logAdded

          attrs.consoleProps = () => details.logAdded.consoleProps
          attrs.renderProps = () => details.logAdded.renderProps

          const log = Cypress.log(attrs)

          logs[log.get('id')] = log

          return
        }

        if (details.logChanged) {
          const log = logs[details.logChanged.id]

          if (log) {
            log.set(details.logChanged)
          }

          return
        }

        if (details.end) {
          const command = commands[details.id]

          if (command) {
            delete commands[details.id]
            command.deferred.resolve()
          }
        }
      }

      // @ts-ignore
      Cypress.multiDomainCommunicator.on('command:enqueued', addCommand)

      // @ts-ignore
      Cypress.multiDomainCommunicator.on('command:update', updateCommand)

      return new Bluebird((resolve) => {
        // @ts-ignore
        Cypress.multiDomainCommunicator.once('run:domain:fn', resolve)

        // @ts-ignore
        Cypress.multiDomainCommunicator.once('queue:finished', () => {
          // @ts-ignore
          Cypress.multiDomainCommunicator.off('command:enqueued', addCommand)
          // @ts-ignore
          Cypress.multiDomainCommunicator.off('command:update', updateCommand)

          // By the time the command queue is finished, this promise should be settled as
          // as done will be invoked within the secondary domain already, if applicable
          // TODO: how does this work with errors where commands or other items prematurely fail in the secondary domain?
          deferredDone.promise.then(({ crossDomainDoneCalled, error } = {
            crossDomainDoneCalled: false,
            error: undefined,
          }) => {
            if (crossDomainDoneCalled) {
              done(error)
            }
          })
        })

        // fired once the spec bridge is set up and ready to
        // receive messages
        // @ts-ignore
        Cypress.multiDomainCommunicator.once('bridge:ready', () => {
          state('readyForMultidomain', true)
          // let the proxy know to let the response for the secondary
          // domain html through, so the page will finish loading
          // @ts-ignore
          Cypress.backend('ready:for:domain', { shouldInject: true })
        })

        // @ts-ignore
        cy.once('internal:window:load', ({ type }) => {
          if (type !== 'cross:domain') return

          // once the secondary domain page loads, send along the
          // user-specified callback to run in that domain
          // @ts-ignore
          Cypress.multiDomainCommunicator.toSpecBridge('run:domain:fn', {
            fn: fn.toString(),
            isDoneFnAvailable: !!done,
          })

          state('readyForMultidomain', false)
          // @ts-ignore
          cy.isAnticipatingMultidomain(false)
        })

        // this signals to the runner to create the spec bridge for
        // the specified domain
        // @ts-ignore
        Cypress.multiDomainCommunicator.emit('expect:domain', domain)
      }).finally(() => {
        // if done is to be called from the secondary domain, the 'done:called' event should
        // have already been invoked in the switchToDomain function synchrously while the command queue finishes.
        // Go ahead and remove the listener
        // TODO: how do we handle async/setTimeout with a done?
        // @ts-ignore
        Cypress.multiDomainCommunicator.off('done:called', invokeDone)
      })
    },
  })
}
