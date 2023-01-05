[<img src="https://assets-global.website-files.com/5d23691b4883306fdcfb2499/5f3519f51756d7464edaebcb_T1_logo.svg" alt="Talon.One" width="200">](https://www.talonone.com/)

# Talon.One Salesforce Commerce Cloud Cartridge

## Company Overview
The all-in-one promotion software designed for enterprises. Manage all your marketing promotions in one scalable system without stressing developer resources.

## Integration Overview
This repository contains the Talon.One integrations with the Salesforce Commerce Cloud platform. There are two versions currently available for SiteGenesis Javascript Controller (SGJS) and Salesforce Reference Architecture (SFRA).
### Cartridges
* bm_talonone - includes functionality for Business Manager
* int_talonone - includes the base functionality used by SG controllers and SFRA
* int_talonone_controllers - includes SG Controllers specific logic
* int_talonone_sfra - includes SFRA Controllers specific logic

### SiteGenesis Javascript Controller (SGJC)
For the manual, please see the `TalonOne_Controllers_Integration_Guide.docx` file in the `documentation` directory.


### Salesforce Reference Architecture (SFRA)
For the manual, please see the `TalonOne_SFRA_Integration_Guide.docx` file in the `documentation` directory.

## NPM scripts
`npm install` - Install all of the local dependencies.
`npm run compile:js` - Compiles all .js files and aggregates them.
`npm run lint` - Execute linting for all CSS & JavaScript files in the project.

## Tests
### Unit tests
In order to run the unit tests, do the following steps in the root of the project.
1. `npm install`
2. `npm run test`

