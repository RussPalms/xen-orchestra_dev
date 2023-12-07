import mapValues from 'lodash/mapValues.js'
import { dirname } from 'node:path'

function formatVmBackup(backup) {
  return {
    disks:
      backup.vhds === undefined
        ? []
        : Object.keys(backup.vhds).map(vdiId => {
            const vdi = backup.vdis[vdiId]
            return {
              id: `${dirname(backup._filename)}/${backup.vhds[vdiId]}`,
              name: vdi.name_label,
              uuid: vdi.uuid,
            }
          }),

    id: backup.id,
    jobId: backup.jobId,
    mode: backup.mode,
    scheduleId: backup.scheduleId,
    size: backup.size,
    timestamp: backup.timestamp,
    vm: {
      name_description: backup.vm.name_description,
      name_label: backup.vm.name_label,
    },
    // any backup with at least one differential disk is a delta
    differential:
      backup.differentialVhds === undefined ? undefined : Object.values(backup.differentialVhds).some(t => t),
  }
}

// format all backups as returned by RemoteAdapter#listAllVmBackups()
export function formatVmBackups(backupsByVM) {
  return mapValues(backupsByVM, backups => backups.map(formatVmBackup))
}
