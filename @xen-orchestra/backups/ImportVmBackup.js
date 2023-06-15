'use strict'

const assert = require('assert')

const { formatFilenameDate } = require('./_filenameDate.js')
const { importIncrementalVm } = require('./_incrementalVm.js')
const { Task } = require('./Task.js')
const { watchStreamSize } = require('./_watchStreamSize.js')

exports.ImportVmBackup = class ImportVmBackup {
  constructor({ adapter, metadata, srUuid, xapi, settings: { newMacAddresses, mapVdisSrs = {} } = {} }) {
    this._adapter = adapter
    this._importIncrementalVmSettings = { newMacAddresses, mapVdisSrs }
    this._metadata = metadata
    this._srUuid = srUuid
    this._xapi = xapi
  }

  async run() {
    const adapter = this._adapter
    const metadata = this._metadata
    const isFull = metadata.mode === 'full'

    const sizeContainer = { size: 0 }

    let backup
    if (isFull) {
      backup = await adapter.readFullVmBackup(metadata)
      watchStreamSize(backup, sizeContainer)
    } else {
      assert.strictEqual(metadata.mode, 'delta')

      const ignoredVdis = new Set(
        Object.entries(this._importIncrementalVmSettings.mapVdisSrs)
          .filter(([_, srUuid]) => srUuid === null)
          .map(([vdiUuid]) => vdiUuid)
      )
      backup = await adapter.readIncrementalVmBackup(metadata, ignoredVdis)
      Object.values(backup.streams).forEach(stream => watchStreamSize(stream, sizeContainer))
    }

    return Task.run(
      {
        name: 'transfer',
      },
      async () => {
        const xapi = this._xapi
        const srRef = await xapi.call('SR.get_by_uuid', this._srUuid)

        let vmRef
        
        try {
          vmRef = isFull
          ? await xapi.VM_import(backup, srRef)
          : await importIncrementalVm(backup, await xapi.getRecord('SR', srRef), {
              ...this._importIncrementalVmSettings,
              detectBase: false,
            })
        }
        catch(err){
          if(err.code === 'SR_HAS_NO_PBDS'){
            const error = new Error('SR used for VM import is missing (not connected or removed)')
            error.cause = err
            error.code = err.code
            throw error
          }
          throw err
        } 
        

        await Promise.all([
          xapi.call('VM.add_tags', vmRef, 'restored from backup'),
          xapi.call(
            'VM.set_name_label',
            vmRef,
            `${metadata.vm.name_label} (${formatFilenameDate(metadata.timestamp)})`
          ),
        ])

        return {
          size: sizeContainer.size,
          id: await xapi.getField('VM', vmRef, 'uuid'),
        }
      }
    )
  }
}
