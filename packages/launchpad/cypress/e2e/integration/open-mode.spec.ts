import defaultMessages from '../../../../frontend-shared/src/locales/en-US.json'

describe('Launchpad: Open Mode', () => {
  it('Shows the open page', () => {
    cy.setupE2E()
    cy.visitLaunchpad()

    cy.get('h1').should('contain', defaultMessages.globalPage.empty.title)
  })

  describe('when there is a list of projects', () => {
    it('goes to an active project if one is added', () => {
      cy.setupE2E('todos')
      cy.visitLaunchpad()

      cy.get('h1').should('contain', 'Welcome to Cypress!')
    })
  })
})